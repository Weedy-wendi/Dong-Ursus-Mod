#!/usr/bin/env node
// scripts/mod.mjs —— 【东】+【乌萨斯】mod 命令行入口（install / update / uninstall / status）
//
//   node <mod>/scripts/mod.mjs status    [本体仓库] [--json]
//   node <mod>/scripts/mod.mjs install   [本体仓库] [--dry-run] [--force] [--no-backup]
//   node <mod>/scripts/mod.mjs uninstall [本体仓库] [--force] [--keep-changed] [--keep-backup]
//   node <mod>/scripts/mod.mjs update    [本体仓库] [--check] [--force] [--file <zip|目录>]
//                                                  [--source <url>] [--no-sync-package]
//
// 设计要点（都是踩过的坑）：
//   · 补丁基线 = 本体版本的「mod 前提交」，所以 install 只接受**纯净基线树**；树上已有旧版 mod
//     时（有记录）会先精确还原再装——实测「新版补丁直接覆盖旧版树」会落 71 个 .rej 且几乎不改东西。
//   · git 的退出码不可信（子目录里会静默跳过、已应用会跳过），补丁套完一律按 mod.json 的字节指纹复核。
//   · 卸载优先用 git 还原（精确），备份目录兜底（本体不是 git 检出时也能精确还原）。
//   · 升级按「分支 = base-<本体版本>」选取，包里 mod.json 的 base 再做一次自我声明校验。
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  brief, cmpVersion, copyFile, die, digestFile, ensureDir, exists, head, posix, pruneEmptyDirs,
  readJson, rmrf, run, say, tempDir, walkFiles, warn,
} from './lib/util.mjs';
import { loadManifest, reportBad, tryLoadManifest, verifySet, verdict } from './lib/manifest.mjs';
import {
  backUp, backupPath, clearState, driftCheck, loadState, saveState, stateDir, statePath, summarize,
} from './lib/state.mjs';
import {
  applyPatch, checkoutPaths, collectRejects, gitAvailable, gitVersion, hasCommit, isRepoRoot, patchTargets,
} from './lib/gitops.mjs';
import { stagePackage } from './lib/source.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const modRoot = resolve(here, '..');
const NODE_MIN = 22;

// ---------------------------------------------------------------- 命令行解析

function parseArgs(argv) {
  const flags = { _: [] };
  const takesValue = new Set(['file', 'source', 'repo', 'branch']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') { flags.help = true; continue; }
    if (!a.startsWith('--')) { flags._.push(a); continue; }
    const key = a.slice(2);
    if (takesValue.has(key)) { flags[key] = argv[++i]; continue; }
    flags[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = true;
  }
  return flags;
}

const USAGE = `
【东】+【乌萨斯】mod 命令行

  node <mod>/scripts/mod.mjs status    [本体仓库] [--json]
  node <mod>/scripts/mod.mjs install   [本体仓库] [--dry-run] [--force] [--no-backup]
  node <mod>/scripts/mod.mjs uninstall [本体仓库] [--force] [--keep-changed] [--keep-backup]
  node <mod>/scripts/mod.mjs update    [本体仓库] [--check] [--force] [--file <zip|目录>]
                                                 [--source <url>] [--branch <分支名>] [--no-sync-package]

  本体仓库：本体（Stronghold-Protocol 源码检出）根目录，默认取当前目录（其次取 <mod>/../..）
`;

// ---------------------------------------------------------------- 公共小件

function checkNode() {
  const major = Number(process.versions.node.split('.')[0]);
  if (!Number.isFinite(major) || major < NODE_MIN) {
    die(`需要 Node.js >= ${NODE_MIN}，当前是 ${process.versions.node}`, 3);
  }
}

function looksLikeRepo(dir) {
  return ['package.json', 'tools/build-data.mjs', 'server/sim/content/index.js'].every((f) => exists(join(dir, ...f.split('/'))));
}

function resolveRepo(arg) {
  const cand = arg
    ? resolve(process.cwd(), arg)
    : (looksLikeRepo(process.cwd()) ? process.cwd() : resolve(modRoot, '..', '..'));
  if (!exists(cand)) die(`本体目录不存在：${cand}`, 3);
  const missing = ['package.json', 'tools/build-data.mjs', 'server/sim/content/index.js'].filter((f) => !exists(join(cand, ...f.split('/'))));
  if (missing.length) {
    die(`这不是本体（Stronghold-Protocol 源码检出）根目录：${cand}\n      缺少：${missing.join('、')}\n      注意：Release 的整合包/精简包没有开发工具链，装不了本 mod`, 3);
  }
  return cand;
}

/** 本体 package.json 的版本号 */
const baseVersionOf = (repo) => readJson(join(repo, 'package.json')).version;

/** mod.json 里登记的、会被安装触碰的全部路径（去重，保留优先级 removed > patched > owned > generated） */
function touchedPaths(mod) {
  const seen = new Map();
  const add = (kind, list) => { for (const rel of list ?? []) if (!seen.has(rel)) seen.set(rel, kind); };
  add('removed', mod.removed);
  add('patched', Object.keys(mod.patched ?? {}));
  add('owned', Object.keys(mod.owned ?? {}));
  add('generated', mod.generated);
  return seen;
}

function buildEntries(repo, mod) {
  const entries = [];
  for (const [rel, kind0] of touchedPaths(mod)) {
    const before = digestFile(join(repo, ...rel.split('/')));
    const kind = kind0 === 'removed' ? 'deleted' : (before ? 'modified' : 'created');
    entries.push({ path: posix(rel), kind, before, after: null });
  }
  return entries;
}

/** 装完/还原后回填 after */
function fillAfter(repo, entries) {
  for (const e of entries) e.after = digestFile(join(repo, ...e.path.split('/')));
  return entries;
}

function backupAll(repo, entries) {
  let n = 0;
  for (const e of entries) if (e.before && backUp(repo, e.path)) n++;
  return n;
}

// ---------------------------------------------------------------- status

function cmdStatus(repo, flags) {
  const mod = tryLoadManifest(modRoot);
  const st = loadState(repo);
  const baseVersion = exists(join(repo, 'package.json')) ? baseVersionOf(repo) : null;
  const out = {
    package: mod ? { mod: mod.mod, version: mod.version, base: mod.base?.version, baseCommit: mod.base?.commit, source: mod.source?.repo ?? null } : null,
    repo,
    repoVersion: baseVersion,
    git: { available: !!gitAvailable(repo), repoRoot: isRepoRoot(repo), baseCommitReachable: !!(mod?.base?.commit && hasCommit(repo, mod.base.commit)) },
    installed: null,
    pristine: null,
    verdict: '',
  };

  if (st) {
    const { drifted, missing, eolOnly } = driftCheck(repo, st);
    out.installed = {
      modVersion: st.modVersion, baseVersion: st.baseVersion, installedAt: st.installedAt,
      files: summarize(st), drifted: drifted.length, missing: missing.length, eolOnly: eolOnly.length,
      driftedPaths: drifted.slice(0, 10).map((d) => d.path), missingPaths: missing.slice(0, 10),
    };
    out.verdict = drifted.length || missing.length
      ? `已安装 v${st.modVersion}，但有 ${drifted.length} 个文件被改过、${missing.length} 个文件不见了`
      : `已安装 v${st.modVersion}（干净，与安装时一致）`;
  } else if (mod) {
    const v = verifySet(repo, mod.base.files);
    out.pristine = { ok: v.ok.length, eol: v.eol.length, missing: v.missing.length, mismatch: v.mismatch.length, mismatchPaths: v.mismatch.slice(0, 10) };
    out.verdict = (!v.missing.length && !v.mismatch.length)
      ? '未安装；本体树是 v' + mod.base.version + ' 的纯净基线，可以装'
      : `未安装；本体树与 v${mod.base.version} 基线不一致（${v.missing.length} 缺失 / ${v.mismatch.length} 不同）`;
  } else {
    out.verdict = 'mod 包缺少 mod.json，无法判断（先跑 node tools/make-manifest.mjs 生成）';
  }

  if (flags.json) { console.log(JSON.stringify(out, null, 2)); return 0; }

  head('mod 包');
  if (out.package) {
    say(`  版本 v${out.package.version} · 适配本体 v${out.package.base} · 许可 ${mod.license ?? '?'}`);
    say(`  基线提交 ${String(out.package.baseCommit).slice(0, 12)} · 源 ${out.package.source ?? '(未登记)'}`);
    say(`  文件数：补丁 ${Object.keys(mod.patched).length} · 自有 ${Object.keys(mod.owned).length} · 删除 ${mod.removed.length} · 生成 ${mod.generated.length}`);
  } else say('  缺少 mod.json');

  head('本体');
  say(`  目录 ${repo}`);
  say(`  版本 v${baseVersion}`);
  say(`  git：${out.git.available ? gitVersion(repo) : '不可用'}${out.git.repoRoot ? '（是仓库根）' : '（不是仓库根）'}` +
    `· 基线提交${out.git.baseCommitReachable ? '可达（可精确还原）' : '不可达（还原将用备份）'}`);

  head('安装状态');
  if (out.installed) {
    say(`  v${out.installed.modVersion}（装于 ${out.installed.installedAt}）`);
    say(`  记录 ${st.entries.length} 项：${Object.entries(out.installed.files).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
    if (out.installed.drifted) warn(`  被改过：${brief(out.installed.driftedPaths)}`);
    if (out.installed.missing) warn(`  不见了：${brief(out.installed.missingPaths)}`);
  } else if (out.pristine) {
    say(`  无安装记录；纯净度：${out.pristine.ok} 一致${out.pristine.eol ? `（另 ${out.pristine.eol} 个仅换行符不同）` : ''} / ${out.pristine.missing} 缺失 / ${out.pristine.mismatch} 不同`);
  } else say('  无安装记录');

  head('结论');
  say('  ' + out.verdict);
  return 0;
}

// ---------------------------------------------------------------- 还原（uninstall 的核心，install 前置也用它）

function restore(repo, st, { force = false, keepChanged = true } = {}) {
  const { drifted, missing } = driftCheck(repo, st);
  const driftedPaths = new Set(drifted.map((d) => d.path));
  const keep = new Set();
  if (!force) for (const p of driftedPaths) { if (keepChanged) keep.add(p); }

  const result = { restored: [], fromGit: 0, fromBackup: 0, deleted: [], kept: [...keep], missing, unresolved: [] };

  // 1) 需要还原的（装前存在过的文件）
  const need = st.entries.filter((e) => e.before && e.kind !== 'created' && !keep.has(e.path));
  const useGit = isRepoRoot(repo) && hasCommit(repo, st.baseCommit);
  if (need.length && useGit) {
    say(`  用 git 从基线提交 ${String(st.baseCommit).slice(0, 12)} 还原 ${need.length} 个文件…`);
    const failed = new Set(checkoutPaths(repo, st.baseCommit, need.map((e) => e.path)));
    for (const e of need) {
      const now = digestFile(join(repo, ...e.path.split('/')));
      if (!failed.has(e.path) && now && now.sha256 === e.before.sha256 && now.size === e.before.size) { result.fromGit++; result.restored.push(e.path); }
    }
  }
  // 2) 剩下的（含 git 不可用 / git 还原后仍不一致）用备份
  for (const e of need) {
    if (result.restored.includes(e.path)) continue;
    const b = backupPath(repo, e.path);
    if (!exists(b)) { result.unresolved.push(e.path); continue; }
    copyFile(b, join(repo, ...e.path.split('/')));
    const now = digestFile(join(repo, ...e.path.split('/')));
    if (now && now.sha256 === e.before.sha256 && now.size === e.before.size) { result.fromBackup++; result.restored.push(e.path); }
    else result.unresolved.push(e.path);
  }

  // 3) 安装时新增的文件 → 删掉（漂移且未 --force 的保留）
  for (const e of st.entries) {
    if (e.kind !== 'created' || keep.has(e.path)) continue;
    const abs = join(repo, ...e.path.split('/'));
    if (!exists(abs)) continue;
    rmrf(abs);
    result.deleted.push(e.path);
  }

  // 4) 清掉因此变空的目录（只在树内部）
  pruneEmptyDirs([...result.deleted, ...result.restored].map((rel) => dirname(join(repo, ...rel.split('/')))), repo);
  return result;
}

// ---------------------------------------------------------------- install

function cmdInstall(repo, flags) {
  const mod = loadManifest(modRoot);
  checkNode();

  head('1/5 体检');
  if (!gitAvailable(repo)) die('找不到 git：补丁必须用 git apply 套用（请安装 git 后重试）', 3);
  const baseVersion = baseVersionOf(repo);
  if (baseVersion !== mod.base.version) {
    die(`版本不匹配：本体是 v${baseVersion}，这个 mod 包适配 v${mod.base.version}。\n` +
      `      请取 base-${baseVersion} 分支的包（node scripts/mod.mjs update），或先更新本体`, 2);
  }
  say(`  本体 v${baseVersion} · mod 包 v${mod.version} · git ${gitVersion(repo)}`);

  // 已装旧版 → 先精确还原
  const st = loadState(repo);
  if (st) {
    if (st.modVersion === mod.version && !flags.force) say(`  已安装同版本 v${st.modVersion}：先还原再重装（幂等）`);
    else say(`  检测到已安装 v${st.modVersion}：先还原到基线，再装 v${mod.version}`);
    const r = restore(repo, st, { force: flags.force });
    say(`  还原：git ${r.fromGit} · 备份 ${r.fromBackup} · 删除新增 ${r.deleted.length} · 保留改动 ${r.kept.length}`);
    if (r.unresolved.length) die(`还原失败 ${r.unresolved.length} 个文件：${brief(r.unresolved)}\n      用 status 查看，或手工从 .mod-dong-ursus/backup/ 取回`, 5);
    if (r.kept.length) warn(`保留了 ${r.kept.length} 个被改过的文件（它们会让纯净度校验失败）：${brief(r.kept)}`);
  }

  const v = verifySet(repo, mod.base.files);
  if (v.missing.length || v.mismatch.length) {
    reportBad(v, '本体树与基线不一致');
    if (!flags.force) {
      die(`本体树不是 v${mod.base.version} 的纯净基线——本 mod 的补丁只能套在基线上。\n` +
        `      常见原因：树上还留着旧版 mod 的改动，或你手改过这些文件。\n` +
        `      处理办法（任选其一，然后重跑本命令）：\n` +
        `        · 稳妥（可回退）：git stash push -u -m "mod 快照"\n` +
        `        · 直接回基线：  git reset --hard ${mod.base.commit} && git clean -fd\n` +
        `      （确实要在不干净的树上硬装：--force，风险自负）`, 2);
    }
    warn('--force：跳过纯净度校验，继续安装');
  } else say(`  纯净度：${verdict(v)} ✅`);

  if (flags.dryRun) { say('--dry-run：体检通过，未改动任何文件'); return 0; }

  head('2/5 快照与备份');
  const entries = buildEntries(repo, mod);
  say(`  将触碰 ${entries.length} 个路径（补丁 ${Object.keys(mod.patched).length} · 自有 ${Object.keys(mod.owned).length} · 删除 ${mod.removed.length} · 生成 ${mod.generated.length}）`);
  if (!flags.noBackup) say(`  备份 ${backupAll(repo, entries)} 个文件 → ${posix(stateDir(repo))}`);
  else warn('--no-backup：不写备份（卸载时将只能依赖 git 还原）');

  head('3/5 覆盖 / 删除 / 套补丁');
  let n = 0;
  for (const rel of walkFiles(join(modRoot, 'files'))) { copyFile(join(modRoot, 'files', rel), join(repo, ...rel.split('/'))); n++; }
  say(`  覆盖/新增 mod 自有文件 ${n} 个`);
  let del = 0;
  for (const rel of mod.removed) {
    const abs = join(repo, ...rel.split('/'));
    if (exists(abs)) { rmrf(abs); del++; }
  }
  say(`  删除被替换的上游文件 ${del} 个`);
  const rejAll = [];
  for (const patch of mod.patches) {
    const abs = join(modRoot, ...patch.split('/'));
    const r = applyPatch(repo, abs);
    if (!r.ok) {
      rejAll.push(...r.rejects);
      die(`补丁 ${patch} 套用失败${r.rejects.length ? `，落了 ${r.rejects.length} 个 .rej` : ''}：${r.err}\n` +
        `      本体树可能不是纯净基线；先用 status 查看，必要时按上面的方法回到基线重试`, 5);
    }
    say(`  补丁 ${patch}：${r.mode === 'apply' ? '已套用' : r.mode === 'ignore-whitespace' ? '已套用（忽略空白差异，工作区可能是 CRLF）' : r.mode}`);
  }

  head('4/5 重建 data 与合并 i18n');
  run(process.execPath, [join(repo, ...mod.build.data.split('/'))], { cwd: repo });
  if (mod.build.i18n) {
    const r = run(process.execPath, [join(repo, ...mod.build.i18n.split('/'))], { cwd: repo, allowFail: true });
    if (r.code !== 0 && !mod.build.i18nOptional) die(`build-i18n 失败（exit ${r.code}）`, 5);
    if (r.code !== 0) warn('build-i18n 失败（可选步骤，继续）');
  }
  for (const step of mod.i18n) {
    const r = run(process.execPath, [join(modRoot, ...step.script.split('/')), repo], { cwd: modRoot, allowFail: true });
    if (r.code !== 0 && !step.optional) die(`i18n 步骤失败：${step.script}（exit ${r.code}）`, 5);
    if (r.code !== 0) warn(`i18n 步骤失败（可选，继续）：${step.script}`);
  }

  head('5/5 安装后复核（按字节指纹，不看 git 退出码）');
  const pv = verifySet(repo, mod.patched);
  const ov = verifySet(repo, mod.owned);
  const bad = pv.missing.length + pv.mismatch.length + ov.missing.length + ov.mismatch.length;
  fillAfter(repo, entries);
  saveState(repo, {
    format: 1, mod: mod.mod, modVersion: mod.version, baseVersion: mod.base.version, baseCommit: mod.base.commit,
    installedAt: new Date().toISOString(), repo, backup: !flags.noBackup, ok: bad === 0, entries,
  });
  if (bad) {
    reportBad(pv, '补丁产物');
    reportBad(ov, 'mod 自有文件');
    die(`安装后复核失败（${bad} 个文件与 mod.json 的承诺不符）。已写入安装记录，可用 uninstall 还原。\n` +
      `      最可能的原因：git 静默跳过了补丁（工作区 CRLF / 树不是基线）。`, 5);
  }
  say(`  补丁产物 ${pv.ok.length + pv.eol.length} / ${Object.keys(mod.patched).length} 一致 · 自有文件 ${ov.ok.length + ov.eol.length} 个一致 ✅`);

  head('完成');
  say(`  mod v${mod.version} → ${repo}`);
  say(`  建议接着跑：node ${posix(join(modRoot, 'scripts', 'verify.mjs'))} ${repo}`);
  for (const v2 of mod.verify ?? []) say(`  或：node ${posix(join(modRoot, ...v2.split('/')))} ${repo}`);
  return 0;
}

// ---------------------------------------------------------------- uninstall

function cmdUninstall(repo, flags) {
  const st = loadState(repo);
  if (!st) {
    head('没有安装记录');
    say(`  找不到 ${posix(statePath(repo))}`);
    say('  这个 mod 只记录了自己装过什么；没有记录就无法保证「精确还原」。');
    say('  如果本体是 git 检出、且改动都来自本 mod，可以手工回到基线：');
    say('    git stash push -u -m "mod 快照"      # 可回退');
    say('    git reset --hard <基线提交> && git clean -fd');
    return 3;
  }
  head(`卸载 mod v${st.modVersion}（适配本体 v${st.baseVersion}）`);
  const r = restore(repo, st, { force: flags.force, keepChanged: !flags.force });
  say(`  还原：git ${r.fromGit} · 备份 ${r.fromBackup} · 删除新增 ${r.deleted.length} · 保留改动 ${r.kept.length}`);
  if (r.kept.length) warn(`按你的要求保留了 ${r.kept.length} 个被改过的文件（--force 可强制还原）：${brief(r.kept)}`);
  if (r.unresolved.length) {
    warn(`有 ${r.unresolved.length} 个文件没能还原：${brief(r.unresolved)}`);
    warn('  这些文件的装前副本在 .mod-dong-ursus/backup/ 下，可手工覆盖回去。');
  }
  // 有保留/未还原的文件时留着安装记录与备份：这样用户还能再跑一次（--force / 手工核对）
  const leftover = r.kept.length + r.unresolved.length;
  if (leftover) {
    warn(`还有 ${leftover} 个文件没回到安装前，已保留 .mod-dong-ursus/ 以便重试：`);
    warn('  · 强制还原（会覆盖这台电脑上的改动）：再跑一次 uninstall --force');
    warn('  · 只要清理记录：uninstall --force 之后会自动删除；或手工删掉 .mod-dong-ursus/');
  } else {
    clearState(repo, { keepBackup: flags.keepBackup });
    say(`  ${flags.keepBackup ? '已保留备份目录' : '已清理 .mod-dong-ursus/'}`);
  }

  head('完成');
  if (exists(join(repo, '.git'))) say('  建议确认：git -C ' + repo + ' status --porcelain（期望为空）');
  say(`  残留 ${r.unresolved.length + r.kept.length} 个未还原文件；其余已回到安装前的字节`);
  return (r.unresolved.length || r.kept.length) ? 5 : 0;
}

// ---------------------------------------------------------------- update

function syncPackage(dest, src) {
  const skip = (rel) => rel.startsWith('.git/') || rel === '.git' || rel.split('/')[0] === '.mod-dong-ursus';
  const srcFiles = walkFiles(src).filter((r) => !skip(r));
  const destFiles = walkFiles(dest).filter((r) => !skip(r));
  const srcSet = new Set(srcFiles);
  let written = 0;
  for (const rel of srcFiles) {
    const a = join(src, ...rel.split('/')), b = join(dest, ...rel.split('/'));
    const da = digestFile(a), db = digestFile(b);
    if (!db || da.sha256 !== db.sha256) { copyFile(a, b); written++; }
  }
  const gone = destFiles.filter((r) => !srcSet.has(r));
  for (const rel of gone) rmrf(join(dest, ...rel.split('/')));
  pruneEmptyDirs(gone.map((rel) => dirname(join(dest, ...rel.split('/')))), dest);
  return { written, removed: gone };
}

function cmdUpdate(repo, flags) {
  const local = loadManifest(modRoot);
  checkNode();
  const baseVersion = baseVersionOf(repo);
  head('1/3 拉取包');
  const staged = stagePackage({ file: flags.file, source: flags.source, manifest: local, baseVersion, branch: flags.branch ?? null });
  try {
    const cand = tryLoadManifest(staged.dir);
    if (!cand) die('取回的包里没有可用的 mod.json', 4);
    say(`  来源：${staged.origin}`);
    say(`  候选：mod v${cand.version}（适配本体 v${cand.base?.version}）· 本地：mod v${local.version}`);

    head('2/3 对比包');
    if (cand.base?.version !== baseVersion) {
      die(`这个包适配本体 v${cand.base?.version}，你的本体是 v${baseVersion} —— 拒绝安装（跨版本混装会把本体弄坏）`, 2);
    }
    if (cand.base?.commit && local.base?.commit && cand.base.commit !== local.base.commit) {
      if (!flags.force) die(`基线提交不同：包要求 ${String(cand.base.commit).slice(0, 12)}，本地登记 ${String(local.base.commit).slice(0, 12)}（--force 可忽略）`, 2);
      warn('--force：忽略基线提交不同');
    }
    const cmp = cmpVersion(cand.version, local.version);
    if (cmp === 0 && !flags.force) { say('  已是最新版本，无需更新'); return 0; }
    if (cmp < 0 && !flags.force) { say(`  候选 v${cand.version} 比本地 v${local.version} 旧，忽略（--force 可强制）`); return 0; }
    if (flags.check) { say(`  --check：可以把 v${local.version} 更新到 v${cand.version}（未执行）`); return 0; }

    head('3/3 更新包（用新包安装 + 同步本地包目录）');
    const r = run(process.execPath, [join(staged.dir, 'scripts', 'mod.mjs'), 'install', repo], { allowFail: true });
    if (r.code !== 0) die(`新包安装失败（exit ${r.code}）：本体树可能停在中间状态。\n      用 node ${posix(join(staged.dir, 'scripts', 'mod.mjs'))} status ${repo} 查看；必要时用同一条命令 uninstall 还原`, 5);
    if (flags.noSyncPackage) say('  --no-sync-package：跳过本地包目录同步');
    else {
      const s = syncPackage(modRoot, staged.dir);
      say(`  本地包目录已同步：写入 ${s.written} 个文件${s.removed.length ? `、删除 ${s.removed.length} 个旧文件` : ''}`);
      if (s.removed.length) say(`    删除：${brief(s.removed)}`);
    }
    head('完成');
    say(`  mod v${local.version} → v${cand.version}（本体 v${baseVersion}）`);
    return 0;
  } finally {
    if (staged.cleanup) rmrf(staged.cleanup);
  }
}

// ---------------------------------------------------------------- main

const flags = parseArgs(process.argv.slice(2));
const cmd = flags._[0];

if (flags.help || !cmd) { console.log(USAGE); process.exit(cmd ? 0 : 1); }

let rc = 0;
switch (cmd) {
  case 'status': rc = cmdStatus(resolveRepo(flags.repo ?? flags._[1]), flags); break;
  case 'install': rc = cmdInstall(resolveRepo(flags.repo ?? flags._[1]), flags); break;
  case 'uninstall': rc = cmdUninstall(resolveRepo(flags.repo ?? flags._[1]), flags); break;
  case 'update': rc = cmdUpdate(resolveRepo(flags.repo ?? flags._[1]), flags); break;
  default:
    console.error(`[mod] ✖ 未知命令：${cmd}`);
    console.log(USAGE);
    rc = 1;
}
process.exit(rc);
