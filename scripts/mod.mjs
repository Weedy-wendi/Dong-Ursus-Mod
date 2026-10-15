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
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  brief, cmpVersion, copyFile, die, digestFile, ensureDir, exists, head, posix, pruneEmptyDirs,
  readJson, rmrf, run, say, sha256, tempDir, walkFiles, warn,
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

// ---------------------------------------------------------------- 三态判定
//
// 玩家手上的本体**不必是纯净本体**。这里只回答两件事：
//   ① 本体版本对不对（在调用方判：<repo>/package.json 的 version == mod.json 的 base.version）
//   ② 树里有没有本 mod 的内容、处在什么状态
// 判定用 mod.json 自带的三组指纹，不依赖 git、也不依赖 mod.json 之外的任何东西。

/** 单个文件是否等于期望字节（容忍 CRLF ↔ LF） */
function matchWanted(abs, want) {
  const now = digestFile(abs);
  if (!now) return false;
  if (now.size === want.size && now.sha256 === want.sha256) return true;
  try {
    const s = readFileSync(abs).toString('latin1');
    if (!s.includes('\r')) return false;
    const n = Buffer.from(s.replace(/\r\n/g, '\n'), 'latin1');
    return n.length === want.size && sha256(n) === want.sha256;
  } catch { return false; }
}

/**
 * @returns {{ pristine, modPresent, ownedMatch, ownedTotal, patchedMatch, patchedTotal,
 *             removedAbsent, removedTotal, pre, state }}
 *   pristine    这 85 个「装之前」的文件是否都在基线字节上
 *   modPresent  树里有没有本 mod 的痕迹（安装记录 / 自有文件 / 被删掉的上游文件）
 */
function classify(repo, mod, st = loadState(repo)) {
  const pre = verifySet(repo, mod.base.files);
  const owned = verifySet(repo, mod.owned);
  const patched = verifySet(repo, mod.patched);
  const removedAbsent = (mod.removed ?? []).filter((rel) => !exists(join(repo, ...rel.split('/'))));
  const ownedMatch = owned.ok.length + owned.eol.length;
  const patchedMatch = patched.ok.length + patched.eol.length;
  return {
    pre, state: st ?? null,
    pristine: pre.missing.length === 0 && pre.mismatch.length === 0,
    modPresent: !!st || ownedMatch > 0 || removedAbsent.length > 0,
    ownedMatch, ownedTotal: Object.keys(mod.owned).length,
    patchedMatch, patchedTotal: Object.keys(mod.patched).length,
    removedAbsent: removedAbsent.length, removedTotal: (mod.removed ?? []).length,
  };
}

/**
 * 树上有本 mod 内容、但**没有安装记录**（旧版 install.mjs 装的，或玩家手工覆盖过）时的处理：
 * 把这 85 个「装之前」的文件恢复成基线字节，之后就能正常套补丁。
 * 优先 git（精确、且连被删掉的 12 个上游文件一起还原）；git 不可用时退回上一次安装留下的
 * .mod-dong-ursus/backup/。当前字节先另存一份，避免悄悄丢东西。
 */
function restorePristine(repo, mod, { dryRun = false } = {}) {
  const paths = Object.keys(mod.base.files);
  const useGit = isRepoRoot(repo) && hasCommit(repo, mod.base.commit);
  const result = { total: paths.length, fromGit: 0, fromBackup: 0, backedUp: 0, unresolved: [], backupDir: null, plan: '' };

  if (dryRun) {
    result.plan = useGit
      ? `用 git 从基线提交 ${String(mod.base.commit).slice(0, 12)} 还原 ${paths.length} 个文件`
      : `从 .mod-dong-ursus/backup/ 还原 ${paths.length} 个文件（git 不可用）`;
    return result;
  }

  // 1) 先把「与基线不同」的当前字节另存（可能含玩家改动）
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = join(stateDir(repo), `backup-legacy-${stamp}`);
  for (const rel of paths) {
    const abs = join(repo, ...rel.split('/'));
    if (!exists(abs) || matchWanted(abs, mod.base.files[rel])) continue;
    copyFile(abs, join(dir, ...rel.split('/')));
    result.backedUp++;
  }
  result.backupDir = result.backedUp ? posix(relative(repo, dir)) : null;

  // 2) git 还原（含「安装时被删掉」的文件）
  if (useGit) {
    const failed = new Set(checkoutPaths(repo, mod.base.commit, paths));
    for (const rel of paths) {
      if (failed.has(rel)) continue;
      if (matchWanted(join(repo, ...rel.split('/')), mod.base.files[rel])) result.fromGit++;
    }
  }

  // 3) 剩下的用备份（上一次安装留下的装前副本）
  for (const rel of paths) {
    const abs = join(repo, ...rel.split('/'));
    if (matchWanted(abs, mod.base.files[rel])) continue;
    const b = backupPath(repo, rel);
    if (!exists(b)) { result.unresolved.push(rel); continue; }
    copyFile(b, abs);
    if (matchWanted(abs, mod.base.files[rel])) result.fromBackup++;
    else result.unresolved.push(rel);
  }
  return result;
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

  const c = mod ? classify(repo, mod, st) : null;
  out.versionOk = mod ? baseVersion === mod.base.version : null;
  if (c) {
    out.modContent = {
      installedRecord: !!st,
      present: c.modPresent,
      ownedMatch: `${c.ownedMatch}/${c.ownedTotal}`,
      patchedMatch: `${c.patchedMatch}/${c.patchedTotal}`,
      removedAbsent: `${c.removedAbsent}/${c.removedTotal}`,
    };
    out.pristine = { ok: c.pre.ok.length, eol: c.pre.eol.length, missing: c.pre.missing.length, mismatch: c.pre.mismatch.length, mismatchPaths: c.pre.mismatch.slice(0, 10) };
  }

  if (c && !out.versionOk) {
    out.verdict = `本体是 v${baseVersion}，这个包适配 v${mod.base.version}：版本不符（请取 base-${baseVersion} 分支的包，或先更新本体）`;
  } else if (st) {
    const { drifted, missing, eolOnly } = driftCheck(repo, st);
    out.installed = {
      modVersion: st.modVersion, baseVersion: st.baseVersion, installedAt: st.installedAt,
      files: summarize(st), drifted: drifted.length, missing: missing.length, eolOnly: eolOnly.length,
      driftedPaths: drifted.slice(0, 10).map((d) => d.path), missingPaths: missing.slice(0, 10),
    };
    out.verdict = drifted.length || missing.length
      ? `已安装 v${st.modVersion}，但有 ${drifted.length} 个文件被改过、${missing.length} 个文件不见了`
      : `已安装 v${st.modVersion}（干净，与安装时一致）`;
  } else if (c?.pristine) {
    out.verdict = `未安装；本体是 v${mod.base.version} 的基线，可以直接 install`;
  } else if (c?.modPresent) {
    out.verdict = `树里有本 mod 的内容但没有安装记录（自有文件 ${c.ownedMatch}/${c.ownedTotal} 在树里、被替换的上游文件已删 ${c.removedAbsent}/${c.removedTotal}）` +
      ' —— 直接 install 会自动把这 85 个文件回退到基线再装，不必手工 stash';
  } else if (c) {
    out.verdict = `未安装；这 85 个文件里有 ${c.pre.mismatch.length} 个内容不同、${c.pre.missing.length} 个缺失，且看不出是本 mod 造成的` +
      ' —— install 会先拒绝并列出它们（确认无关可用 --force 硬装）';
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
  if (c && !out.versionOk) warn(`  版本不符：本体 v${baseVersion} ≠ 包要求的 v${mod.base.version}`);
  if (c) say(`  本 mod 内容：自有文件 ${c.ownedMatch}/${c.ownedTotal} 在树里 · 补丁产物 ${c.patchedMatch}/${c.patchedTotal} 符合 · 被替换的上游文件已删 ${c.removedAbsent}/${c.removedTotal}`);
  if (out.installed) {
    say(`  安装记录：v${out.installed.modVersion}（装于 ${out.installed.installedAt}）`);
    say(`  记录 ${st.entries.length} 项：${Object.entries(out.installed.files).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
    if (out.installed.drifted) warn(`  被改过：${brief(out.installed.driftedPaths)}`);
    if (out.installed.missing) warn(`  不见了：${brief(out.installed.missingPaths)}`);
  } else if (c?.pristine) {
    say(`  无安装记录；这 85 个文件都在基线字节上（${c.pre.ok.length} 一致${c.pre.eol.length ? ` + ${c.pre.eol.length} 仅换行符不同` : ''}）`);
  } else if (c) {
    say(`  无安装记录；基线对比：${c.pre.ok.length} 一致 / ${c.pre.missing.length} 缺失 / ${c.pre.mismatch.length} 不同`);
    if (c.modPresent) say(`  但树里有本 mod 的内容 → 视为「旧版安装 / 手工覆盖」，install 会自动回退后重装`);
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

  // 状态判定：玩家的本体不必是纯净本体，只要求「版本对」+「知道树里有什么」
  const st = loadState(repo);
  const c = classify(repo, mod, st);

  // A. 已装同版本、且与安装时逐字节一致 → 什么都不用做
  if (st && st.modVersion === mod.version && !flags.force) {
    const { drifted, missing } = driftCheck(repo, st);
    if (!drifted.length && !missing.length) {
      say(`  已安装 v${st.modVersion}，与安装时一致：无需重装（要强制重装：--force）`);
      say(`  想确认功能就接着跑：node ${posix(join(modRoot, 'scripts', 'verify.mjs'))} ${repo}`);
      return 0;
    }
  }

  if (flags.dryRun) {
    if (st) say(`  --dry-run：有安装记录 v${st.modVersion} → 会先精确还原，再装 v${mod.version}`);
    else if (c.pristine) say('  --dry-run：本体是基线 → 直接装');
    else if (c.modPresent) say(`  --dry-run：树里有本 mod 内容但没有记录 → 先${restorePristine(repo, mod, { dryRun: true }).plan}，再装`);
    else {
      reportBad(c.pre, '本体这边有改动，但看不出是本 mod 造成的');
      say('  --dry-run：install 会拒绝这些改动（确认与本 mod 无关可 --force 硬装）');
    }
    return 0;
  }

  // B. 有安装记录 → 先精确还原（git 优先，备份兜底）
  if (st) {
    if (st.modVersion === mod.version) say(`  已安装同版本 v${st.modVersion}：先还原再重装（幂等）`);
    else say(`  检测到已安装 v${st.modVersion}：先还原到基线，再装 v${mod.version}`);
    const r = restore(repo, st, { force: flags.force });
    say(`  还原：git ${r.fromGit} · 备份 ${r.fromBackup} · 删除新增 ${r.deleted.length} · 保留改动 ${r.kept.length}`);
    if (r.unresolved.length) die(`还原失败 ${r.unresolved.length} 个文件：${brief(r.unresolved)}\n      用 status 查看，或手工从 .mod-dong-ursus/backup/ 取回`, 5);
    if (r.kept.length) warn(`保留了 ${r.kept.length} 个被改过的文件：${brief(r.kept)}`);
    // C. 没有记录，但树里有本 mod 内容（旧版 install.mjs 装的 / 手工覆盖过）→ 自动回退这 85 个文件
  } else if (!c.pristine && c.modPresent) {
    say(`  树里有本 mod 内容但没有安装记录（自有文件 ${c.ownedMatch}/${c.ownedTotal} 在树里、被替换的上游文件已删 ${c.removedAbsent}/${c.removedTotal}）`);
    say(`  按「旧版安装」处理：先把相关文件回退到 v${mod.base.version} 基线，再装 v${mod.version}`);
    const r = restorePristine(repo, mod);
    say(`  回退：git ${r.fromGit} · 备份 ${r.fromBackup} · 另存 ${r.backedUp} 个文件${r.backupDir ? ` → ${r.backupDir}` : ''}`);
    if (r.unresolved.length) {
      die(`有 ${r.unresolved.length} 个文件没能回退到基线：${brief(r.unresolved)}\n` +
        `      本体不是 git 检出、或基线提交不可达，且没有上一次安装留下的备份。\n` +
        `      处理办法：用 git stash / 重新解包本体回到基线；确实要硬装：--force（补丁可能套不上）`, 5);
    }
  }

  const v = verifySet(repo, mod.base.files);
  if (v.missing.length || v.mismatch.length) {
    reportBad(v, '本体树与基线不一致');
    if (!flags.force) {
      die(`这 85 个文件里有内容与本 mod 适配的 v${mod.base.version} 基线不符，而且看不出是本 mod 造成的` +
        `（本 mod 的内容会在上面被自动回退）。\n` +
        `      常见原因：你手改过这些文件、装了别的 mod、或本体版本不对。\n` +
        `      处理办法（任选其一，然后重跑本命令）：\n` +
        `        · 可回退：git stash push -u -m "快照"\n` +
        `        · 回基线：git reset --hard ${mod.base.commit} && git clean -fd\n` +
        `        · 确认与本 mod 无关、想硬装：--force（补丁可能套不上，会落 .rej）`, 2);
    }
    warn('--force：跳过基线校验，继续安装');
  } else say(`  基线校验：${verdict(v)} ✅`);

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
