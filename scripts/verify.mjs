#!/usr/bin/env node
// mod 测试子集：数据完整性 + 自有内容 + 宿主校准。
// 用法: node <mod>/scripts/verify.mjs [repoRoot=..]
// 注意：全量测试（node --test test/）之前必须先跑 node tools/golden.mjs --update。
import { execFileSync } from 'node:child_process';
import { join, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = process.argv[2] ? (isAbsolute(process.argv[2]) ? process.argv[2] : join(process.cwd(), process.argv[2])) : join(here, '..', '..');
const files = [
  'test/data.test.js',            // 棋子/盟约/特质/装备计数 + 镜像一致性
  'test/backups.test.js',         // 自定义预设棋子的 backup 行（146/87 计数 + skip 守卫）
  'test/i18n-data.test.js',       // 四语言 overlay stale=0
  'test/content/ursus_bond.test.js',   // 【乌萨斯】盟约（叠攻/周边技回/带装备倍率）
  'test/content/garrisons_meta.test.js', // 特质 prep 侧（含 988-992 自定义处理器）
  'test/content/garrisons_battle.test.js', // 特质战斗侧 + 覆盖率
  'test/content/items.test.js',   // 四件装备（行为 + 123 计数 + 覆盖率）
  'test/content/choices.test.js', // 机变卡覆盖（55 商店道具）
  'test/content/kits_char_2_98.test.js', 'test/content/kits_char_3_98.test.js',
  'test/content/kits_char_4_98.test.js', 'test/content/kits_char_4_99.test.js',
  'test/content/kits_char_5_98.test.js', 'test/content/kits_char_5_99.test.js',
  'test/content/kits_char_6_97.test.js', 'test/content/kits_char_6_98.test.js', 'test/content/kits_char_6_99.test.js',
  'test/render/yato2-redeploy-stance.test.js', // 重部署姿态对账（依赖 01 补丁的 skills/deploy/units 修改）
  'test/render/anim-role-fixes.test.js',       // 发射 clip 放行名单 ↔ 清单数据一致 + 嵯峨的按模型修正
  'test/render/attack-clip-after-skill.test.js', // 技能期间/结束后的普攻口径（业主报障 2026-10-15）
];
console.log('[verify] 本体: ' + repo);
try {
  execFileSync(process.execPath, ['--test', ...files], { cwd: repo, stdio: 'inherit' });
  console.log('[verify] mod 测试子集全部通过 ✅');
} catch {
  console.log('[verify] 有失败——按 SKILL.md「测试与排障」一节处理 ❌');
  process.exit(1);
}
