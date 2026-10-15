#!/usr/bin/env node
// 动作角色对账：证明 data/assets.json 里的 anims 就是当前 resolver + 按模型修正表的产物
// （即「重建清单」是幂等的；不一致的模型 = 代码与数据脱节，运行时读的是数据，代码等于没生效）。
//
// 用法: node <mod>/scripts/check-anim-roles.mjs [repoRoot=..]
//   repoRoot = 装好 mod 的本体仓库根（默认 mod 包的上两级，与 verify.mjs 一致）
//
// 判据：逐模型跑
//   resolveRoles(Object.keys(spine.animations), { modelId: id, skillIndices, numberedSkills, durations: spine.animations })
//   → applyRoleFix(..., PREFAB_SPINE_ROLES[id], spine.animations)
// 结果必须与清单的 spine.anims 逐字段一致。本次（v0.2.6）实测 695/695。
// 不需要素材、不需要网络：输入全部取自清单自身（animations 是 clip → 时长）。
import { readFileSync } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = process.argv[2]
  ? (isAbsolute(process.argv[2]) ? process.argv[2] : join(process.cwd(), process.argv[2]))
  : join(here, '..', '..');

const { resolveRoles } = await import(pathToFileURL(join(repo, 'tools', 'assets', 'anim-roles.mjs')).href);
const { applyRoleFix, applySkillRolePatches, PREFAB_SPINE_ROLES } = await import(pathToFileURL(join(repo, 'tools', 'assets', 'spine.mjs')).href);
const M = JSON.parse(readFileSync(join(repo, 'data', 'assets.json'), 'utf8'));

/** 清单里该模型解析过的技能槽顺序：主槽在前（resolveRoles 把 skill 设为 indices[0]），其余升序。 */
function indicesOf(anims) {
  const keys = Object.keys(anims?.skills || {}).map(Number).sort((a, b) => a - b);
  const primary = anims?.skill?.index;
  const list = Number.isInteger(primary) ? [primary, ...keys.filter((k) => k !== primary)] : keys;
  return list.length ? list : [0];
}

const cases = [];
for (const [id, e] of Object.entries(M.chars || {})) {
  for (const side of ['front', 'back']) if (e.spine?.[side]) cases.push({ label: `chars.${id}.${side}`, id, sp: e.spine[side], numbered: false });
}
for (const [id, e] of Object.entries(M.enemies || {})) if (e.spine) cases.push({ label: `enemies.${id}`, id, sp: e.spine, numbered: true });
for (const [id, e] of Object.entries(M.tokens || {})) if (e.spine) cases.push({ label: `tokens.${id}`, id, sp: e.spine, numbered: false });

const bad = [];
let ok = 0;
for (const c of cases) {
  const durations = c.sp.animations || {};
  const resolved = resolveRoles(Object.keys(durations), {
    modelId: c.id, skillIndices: indicesOf(c.sp.anims), numberedSkills: c.numbered, durations,
  });
  const { roles } = applyRoleFix(resolved, PREFAB_SPINE_ROLES[c.id], durations);
  applySkillRolePatches(c.id, roles);
  if (JSON.stringify(roles) === JSON.stringify(c.sp.anims || {})) { ok++; continue; }
  const fields = [...new Set([...Object.keys(roles), ...Object.keys(c.sp.anims || {})])]
    .filter((k) => JSON.stringify(roles[k]) !== JSON.stringify(c.sp.anims?.[k]))
    .map((k) => `${k}: 代码 ${JSON.stringify(roles[k])} vs 清单 ${JSON.stringify(c.sp.anims?.[k])}`);
  bad.push(`${c.label} :: ${fields.join(' | ')}`);
}

console.log(`[anim-roles] 本体: ${repo}`);
console.log(`[anim-roles] 逐模型对账：一致 ${ok} / ${cases.length}，不一致 ${bad.length}`);
for (const b of bad) console.log('  ' + b);
if (bad.length) {
  console.log('[anim-roles] 代码与 data/assets.json 脱节：按 SKILL.md「维护」第 6 条重算清单（anims + hash，保住末尾 LF）❌');
  process.exit(1);
}
console.log('[anim-roles] 清单动作角色 == 代码产物 ✅');
