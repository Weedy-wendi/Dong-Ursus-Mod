#!/usr/bin/env node
// 【东】+【乌萨斯】mod 一键安装。幂等——重复运行安全。
// 步骤: 覆盖 mod 自有文件 → git apply 两个补丁（01 内含被替换 op-* 文件的删除）→ 清理补丁未覆盖的残留 →
//       重 build data → 合并 i18n overlay。
// 用法: node <mod>/scripts/install.mjs [repoRoot=..]  （repoRoot = 本体仓库根目录）
import { readFileSync, writeFileSync, copyFileSync, rmSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const mod = join(here, '..');
const repo = process.argv[2] ? (isAbsolute(process.argv[2]) ? process.argv[2] : join(process.cwd(), process.argv[2])) : join(here, '..', '..');
const say = (m) => console.log('[install] ' + m);

// ---- 0. 校验本体 ----
for (const f of ['tools/build-data.mjs', 'package.json', 'server/sim/content/index.js']) {
  if (!existsSync(join(repo, f))) { console.error(`[install] 不是本体仓库根目录（缺少 ${f}）: ${repo}`); process.exit(1); }
}
say('本体: ' + repo);

// ---- 1. 覆盖 mod 自有文件（tools/custom-content.mjs + 13 个 kit + mod 测试）----
const filesDir = join(mod, 'files');
let copied = 0;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const src = join(dir, name);
    if (statSync(src).isDirectory()) walk(src);
    else {
      const rel = relative(filesDir, src);
      const dst = join(repo, rel);
      mkdirSync(dirname(dst), { recursive: true });
      copyFileSync(src, dst);
      copied++;
    }
  }
};
walk(filesDir);
say(`覆盖/新增 mod 自有文件 ${copied} 个`);

// ---- 2. git apply 补丁（幂等：正向 check 失败时试反向 check，通过 = 已安装过）----
// 注意顺序：补丁必须先于删除——01 补丁自身包含被替换 op-* 文件的删除块，先删会导致补丁整体拒绝。
const git = (args) => { try { return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }); } catch (e) { return null; } };
if (!git(['--version'])) say('警告: 环境里没有 git，跳过补丁（需按 patches/*.patch 手工套用）');
for (const patch of ['01-mod-shared.patch', '02-tests-calibration.patch']) {
  const p = join(mod, 'patches', patch);
  const rel = relative(repo, p).replaceAll('\\', '/');
  if (git(['apply', '--check', rel]) !== null) { git(['apply', rel]); say(`补丁 ${patch}: 已应用`); continue; }
  if (git(['apply', '--check', '--reverse', rel]) !== null) { say(`补丁 ${patch}: 已应用过，跳过`); continue; }
  // 冲突：带 --reject 尽量套用，余下 .rej 交给 agent/人工
  say(`补丁 ${patch}: 与本体有冲突——用 --reject 尽量套用，*.rej 文件需要人工处理！`);
  try { execFileSync('git', ['apply', '--reject', rel], { cwd: repo, stdio: 'inherit' }); } catch { /* .rej 已落盘 */ }
}

// ---- 3. 清理被 mod 替换的上游文件（补丁已删大部分；此处兜底——无 git 或补丁冲突时保证删干净）----
const REMOVED = [
  'server/sim/content/kits/ops/op-headb2.js',
  'server/sim/content/kits/ops/op-helage.js',
  'server/sim/content/kits/ops/op-poca.js',
  'server/sim/content/kits/ops/op-bgsnow.js',
  'server/sim/content/kits/ops/op-veen.js',
  'server/sim/content/kits/ops/op-saga.js',   // 嵯峨：骨架编号与技能槽位错位，已转为预设棋子 kit（chess_char_5_97-saga.js）
  'test/content/op_headb2.test.js',
  'test/content/op_helage.test.js',
  'test/content/op_poca.test.js',
  'test/content/op_bgsnow.test.js',
  'test/content/op_saga.test.js',
  'test/content/op_veen.test.js',
];
for (const f of REMOVED) {
  const p = join(repo, f);
  if (existsSync(p)) { rmSync(p); say('删除（被 mod 替换）: ' + f); }
}

// ---- 4. 重建 data（注入 → data/*.json）----
say('运行 node tools/build-data.mjs（首次会下载 gamedata，可能较慢）…');
execFileSync(process.execPath, ['tools/build-data.mjs'], { cwd: repo, stdio: 'inherit' });

// ---- 5. i18n：先跑 build-i18n 迁移本体既有翻译（版本升级后 zh 源变了），再合并 mod 记录、清理陈旧记录 ----
try { execFileSync(process.execPath, ['tools/build-i18n.mjs'], { cwd: repo, stdio: 'inherit' }); } catch (e) { say('警告: build-i18n 失败（overlay 与 data 结构差异过大时会出现），后续 apply-i18n 仍会执行'); }
execFileSync(process.execPath, [join(mod, 'i18n', 'apply-i18n.mjs'), repo], { stdio: 'inherit' });
try { execFileSync(process.execPath, [join(mod, 'i18n', 'prune-stale.mjs'), repo], { stdio: 'inherit' }); } catch (e) { say('警告: prune-stale 失败，按 i18n 测试输出手工清理'); }
// backups(units/tokens/diy) 的家族级聚合 _h 必须按当前 data 重算——build-i18n 迁移的旧 _h 会导致整族 stale
execFileSync(process.execPath, [join(mod, 'i18n', 'rehash-families.mjs'), repo], { stdio: 'inherit' });

say('完成。下一步：');
say('  1) node scripts/verify.mjs ' + repo + '   —— 跑 mod 测试子集（应全绿）');
say('  2) 如需跑全量测试：先 node tools/golden.mjs --update（约 2 分钟）再 node --test test/');
say('  3) 若补丁有 *.rej：按 SKILL.md 的「冲突处理」一节人工合入');
