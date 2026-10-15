#!/usr/bin/env node
// tools/make-manifest.mjs —— 生成/刷新 mod.json（发布前跑一次）
//
//   node tools/make-manifest.mjs --repo <本体源码检出> [--base-commit <sha>] [--version x.y.z]
//                                [--source <url>] [--out mod.json] [--mod-root <mod 包根>]
//
// mod.json 是「包对基线的承诺」：
//   base.files  装之前本体的 84 个源文件必须逐字节等于它（纯净基线判定）
//   patched     补丁产物（72 个文件）装完之后必须逐字节等于它（不看 git 退出码的复核依据）
//   owned       files/ 下 mod 自有文件（29 个）装完之后的字节
//   removed     安装时删除、卸载时还原的上游文件（12 个）
//   generated   build-data / i18n 生成的文件（22 个），只登记路径，字节由 state.json 记录
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  die, digestFile, ensureDir, exists, head, posix, readJson, rmrf, run, runToFile, say, tempDir,
  walkFiles, warn, writeJson,
} from '../scripts/lib/util.mjs';
import { applyPatch, blobToFile, collectRejects, gitAvailable, patchTargets } from '../scripts/lib/gitops.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const defaultModRoot = resolve(here, '..');

// 安装时删除、卸载时还原的上游文件（这些自选 kit 已转为预设棋子 kit）
const REMOVED = [
  'server/sim/content/kits/ops/op-headb2.js',
  'server/sim/content/kits/ops/op-helage.js',
  'server/sim/content/kits/ops/op-poca.js',
  'server/sim/content/kits/ops/op-bgsnow.js',
  'server/sim/content/kits/ops/op-veen.js',
  'server/sim/content/kits/ops/op-saga.js',
  'test/content/op_headb2.test.js',
  'test/content/op_helage.test.js',
  'test/content/op_poca.test.js',
  'test/content/op_bgsnow.test.js',
  'test/content/op_saga.test.js',
  'test/content/op_veen.test.js',
];

const args = process.argv.slice(2);
const opt = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (!a.startsWith('--')) continue;
  const k = a.slice(2);
  if (['repo', 'base-commit', 'version', 'source', 'out', 'mod-root'].includes(k)) opt[k] = args[++i];
  else opt[k] = true;
}

const modRoot = resolve(opt['mod-root'] ?? defaultModRoot);
if (!exists(join(modRoot, 'files')) || !exists(join(modRoot, 'patches'))) die(`不是 mod 包根目录：${modRoot}`, 3);
if (!opt.repo) die('缺少 --repo <本体源码检出>', 3);
const repo = resolve(process.cwd(), opt.repo);
if (!exists(join(repo, 'tools', 'build-data.mjs'))) die(`不是本体源码检出：${repo}`, 3);
if (!gitAvailable(repo)) die('需要 git（指纹取自基线的 git 对象，不取工作区）', 3);

const existingPath = join(modRoot, 'mod.json');
const existing = exists(existingPath) ? readJson(existingPath) : null;

head('1/5 基线');
const baseCommit = opt['base-commit'] ?? existing?.base?.commit;
if (!baseCommit) die('缺少基线提交：--base-commit <sha>（首次生成必须显式给）', 3);
if (run('git', ['cat-file', '-e', `${baseCommit}^{commit}`], { cwd: repo, capture: true, allowFail: true, ceiling: repo }).code !== 0) {
  die(`基线提交在 ${repo} 里不可达：${baseCommit}`, 3);
}
const fullCommit = run('git', ['rev-parse', baseCommit], { cwd: repo, capture: true, ceiling: repo }).out.trim();
const tmp = tempDir('mod-manifest-');
const pkgFile = join(tmp, 'package.json');
if (blobToFile(repo, fullCommit, 'package.json', pkgFile) !== 0) die('基线提交里没有 package.json', 3);
const baseVersion = readJson(pkgFile).version;
const version = opt.version ?? existing?.version ?? '1.0.0';
say(`  本体 v${baseVersion} · 基线 ${fullCommit.slice(0, 12)} · mod v${version}`);

head('2/5 补丁');
const patches = walkFiles(join(modRoot, 'patches')).filter((f) => f.endsWith('.patch')).sort();
if (!patches.length) die('patches/ 下没有 .patch', 3);
const patchTargetsAll = [...new Set(patches.flatMap((p) => patchTargets(join(modRoot, 'patches', ...p.split('/')))))].sort();
say(`  ${patches.length} 个补丁，涉及 ${patchTargetsAll.length} 个文件`);

head('3/5 装前指纹（base.files）');
const preimagePaths = [...new Set([...patchTargetsAll, ...REMOVED])].sort();
const baseFiles = {};
const blobTmp = join(tmp, 'blob.bin');
for (const rel of preimagePaths) {
  if (blobToFile(repo, fullCommit, rel, blobTmp) !== 0) die(`基线提交 ${fullCommit.slice(0, 12)} 里没有 ${rel}`, 3);
  const d = digestFile(blobTmp);
  baseFiles[rel] = { size: d.size, sha256: d.sha256 };
}
say(`  ${Object.keys(baseFiles).length} 个文件（补丁目标 ${patchTargetsAll.length} + 被替换 ${REMOVED.length}）`);

head('4/5 补丁产物指纹（patched）');
const stage = join(tmp, 'stage');
ensureDir(stage);
for (const rel of patchTargetsAll) {
  if (blobToFile(repo, fullCommit, rel, join(stage, ...rel.split('/'))) !== 0) die(`取不出 ${rel}`, 3);
}
for (const p of patches) {
  const r = applyPatch(stage, join(modRoot, 'patches', ...p.split('/')));
  if (!r.ok) die(`补丁 ${p} 在纯净副本上就套不上（${r.mode}）：${r.err}`, 3);
  const rej = collectRejects(stage, patchTargetsAll);
  if (rej.length) die(`补丁 ${p} 落了 .rej：${rej.join('、')}`, 3);
}
const patched = {};
for (const rel of patchTargetsAll) {
  const d = digestFile(join(stage, ...rel.split('/')));
  if (!d) die(`补丁产物缺失：${rel}`, 3);
  patched[rel] = { size: d.size, sha256: d.sha256 };
}
say(`  ${Object.keys(patched).length} 个文件`);

head('5/5 自有文件 / 生成物 / 写出');
const owned = {};
for (const rel of walkFiles(join(modRoot, 'files')).sort()) {
  const d = digestFile(join(modRoot, 'files', ...rel.split('/')));
  owned[rel] = { size: d.size, sha256: d.sha256 };
}
const genOut = run('git', ['ls-tree', '-r', '--name-only', fullCommit, '--', 'data'], { cwd: repo, capture: true, ceiling: repo });
const generated = genOut.out.split('\n').map((s) => s.trim()).filter(Boolean).sort();
if (!generated.length) warn('基线提交里 data/ 下没有文件？生成物清单为空');

const i18n = [];
for (const [script, optional] of [['i18n/apply-i18n.mjs', false], ['i18n/prune-stale.mjs', true], ['i18n/rehash-families.mjs', false]]) {
  if (exists(join(modRoot, ...script.split('/')))) i18n.push(optional ? { script, optional: true } : { script });
}
const verify = ['scripts/verify.mjs'].filter((s) => exists(join(modRoot, ...s.split('/'))));

const source = existing?.source ?? { repo: 'https://github.com/Weedy-wendi/Dong-Ursus-Mod', branchPrefix: 'base-' };
if (opt.source) source.repo = opt.source;

const manifest = {
  format: 1,
  mod: existing?.mod ?? 'dong-ursus',
  name: existing?.name ?? '【东】＋【乌萨斯】盟约 mod',
  version,
  license: existing?.license ?? 'GPL-3.0-or-later',
  homepage: existing?.homepage ?? 'https://github.com/Weedy-wendi/Dong-Ursus-Mod',
  source,
  base: { version: baseVersion, commit: fullCommit, files: baseFiles },
  patches: patches.map((p) => posix(join('patches', p))),
  build: { data: 'tools/build-data.mjs', i18n: 'tools/build-i18n.mjs', i18nOptional: true },
  i18n,
  verify,
  owned,
  patched,
  removed: REMOVED,
  generated,
};
const out = resolve(modRoot, opt.out ?? 'mod.json');
writeJson(out, manifest);
rmrf(tmp);

say(`  写出 ${out}`);
say(`  base.files ${Object.keys(baseFiles).length} · patched ${Object.keys(patched).length} · owned ${Object.keys(owned).length}` +
  ` · removed ${REMOVED.length} · generated ${generated.length}`);
const d = digestFile(out);
say(`  sha256 ${d.sha256.slice(0, 16)} · ${d.size} B`);
