// test/render/anim-role-fixes.test.js — 动作角色数据的三条钉子（mod 侧新增，随 files/ 整文件覆盖）：
//   ① 发射 clip 补全（tools/assets/anim-roles.mjs LAUNCH_CLIP_MODELS）：名单上的模型在 data/assets.json 里确实拿到了
//      裸 Start_N 起手（代码声明 ↔ 清单数据一致），名单之外没有任何模型拿到 —— 名单被悄悄加宽或数据没重算都会红。
//   ② 名单上的每个起手槽：骨架里有 Skill_N_End 时收尾必须用自己编号的 End，普攻不得引用起手 / 收尾 clip。
//   ③ 按模型修正表（tools/assets/spine.mjs PREFAB_SPINE_ROLES）里的嵯峨：清单里 S2 用普通 clip 挥砍、S3 才是
//      Skill_2 起手 / 持续 / 收尾 —— 代码修了而数据没跟上就会红（2026-10-15 就是这么发现的）。
//
// 背景（2026-10-15 业主实测）：6 个宿主干员的骨架把某几招的起手 clip 命名成裸 Start_N（家族解析器只找
// Skill_N_Begin / Skill_N_Start），于是这些技能的起手从来不播。补上之后：Start → 技能 clip → 编号 End，
// 技能结束后普攻仍是普通普攻（不再引用 Start / End）。名单保持显式而非「凡骨架有 Start_N 就补」：嵯峨的
// Skill_2_* 属于她的第三招，那里的 Start_N 不是该槽自己的起手（见 PREFAB_SPINE_ROLES 的 SAGA_S3）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LAUNCH_CLIP_MODELS } from '../../tools/assets/anim-roles.mjs';

const M = JSON.parse(readFileSync(new URL('../../data/assets.json', import.meta.url), 'utf8'));
const START = /^Start_\d+$/;

/** 清单里用上裸 Start_N 起手的模型 id（起手只会出现在技能槽上，见 anim-roles.mjs resolveSkill）。 */
function modelsUsingLaunchClips() {
  const out = new Set();
  const scan = (id, anims) => {
    const slots = [anims?.skill, ...Object.values(anims?.skills || {})];
    if (slots.some((s) => s && START.test(String(s.begin || '')))) out.add(id);
  };
  for (const [id, e] of Object.entries(M.chars || {})) {
    for (const side of ['front', 'back']) if (e.spine?.[side]) scan(id, e.spine[side].anims);
  }
  for (const [id, e] of Object.entries(M.enemies || {})) if (e.spine) scan(id, e.spine.anims);
  for (const [id, e] of Object.entries(M.tokens || {})) if (e.spine) scan(id, e.spine.anims);
  return out;
}

test('发射 clip 的放行名单与清单一致：只有名单上的模型用裸 Start_N 起手', () => {
  assert.deepEqual([...modelsUsingLaunchClips()].sort(), [...LAUNCH_CLIP_MODELS].sort());
});

/** id → { 技能槽 index: 该槽的起手 clip }。 */
const LAUNCHES = {
  char_1029_yato2: { 0: 'Start_1', 1: 'Start_2', 2: 'Start_3' },   // 麒麟R夜刀（mod 自有）
  char_1023_ghost2: { 1: 'Start_2' },                              // 傀影 S2
  char_1028_texas2: { 1: 'Start_2', 2: 'Start_3' },                // 缄默德克萨斯 S2/S3
  char_1039_thorn2: { 1: 'Start_2' },                              // 引星棘刺 S2
  char_1502_crosly: { 1: 'Start_2', 2: 'Start_3' },                // 弑君者 S2/S3
  char_2027_wang: { 1: 'Start_2' },                                // 望 S2
  char_4011_lessng: { 1: 'Start_2' },                              // 止颂 S2
};

test('名单上的起手槽：裸 Start_N + 自己编号的 End，普攻不被起手 / 收尾污染', () => {
  for (const [id, slots] of Object.entries(LAUNCHES)) {
    for (const side of ['front', 'back']) {
      const sp = M.chars[id].spine[side];
      const anims = sp.anims;
      const clips = new Set(Object.keys(sp.animations));
      for (const [idx, clip] of Object.entries(slots)) {
        const slot = anims.skills[idx] || (String(anims.skill.index) === idx ? anims.skill : null);
        assert.ok(slot, `${id} ${side}: 槽位 ${idx} 在清单里`);
        assert.equal(slot.begin, clip, `${id} ${side} S${Number(idx) + 1}: 起手`);
        const end = `Skill_${Number(idx) + 1}_End`;
        if (clips.has(end)) assert.equal(slot.end, end, `${id} ${side} S${Number(idx) + 1}: 收尾用自己的 End`);
      }
      // 主槽与该槽位同步（render/units.js 取 anims.skills[index] ?? anims.skill）
      const primary = anims.skill;
      if (slots[String(primary.index)]) assert.equal(primary.begin, slots[String(primary.index)], `${id} ${side}: 主槽同步`);
      // 普攻：既不起手也不收尾
      assert.equal(anims.attack?.begin ?? null, null, `${id} ${side}: 普攻不起手`);
      assert.ok(!START.test(String(anims.attack?.end || '')), `${id} ${side}: 普攻不引用 Start 起手`);
      assert.ok(!/^Skill_\d+_End$/.test(String(anims.attack?.end || '')), `${id} ${side}: 普攻不引用技能 End`);
    }
  }
});

test('嵯峨（char_362_saga）：S2 用普通 clip 挥砍，S3 才是 Skill_2 起手 / 持续 / 收尾', () => {
  for (const side of ['front', 'back']) {
    const sk = M.chars.char_362_saga.spine[side].anims.skills;
    assert.ok(sk['0'], `${side}: 每个技能槽都有 clip（test/assets.test.js 对本体的要求）`);
    assert.deepEqual(sk['1'], { begin: null, loop: 'Skill', end: null, index: 1, idle: null }, `${side} S2 除恶`);
    assert.deepEqual(sk['2'], { begin: 'Skill_2_Begin', loop: 'Skill_2_Loop', end: 'Skill_2_End', index: 2, idle: 'Skill_2_Idle' }, `${side} S3 怒目`);
  }
});

test('按槽位的攻击口径补丁（SKILL_ROLE_PATCHES）：这些技能期间普攻仍用干员自己的攻击 clip', () => {
  // 耀骑士临光 S2：骨架里只有 Skill_2_Die（倒地姿态），她的 S2 用普通 Attack_*
  for (const side of ['front', 'back']) {
    const s1 = M.chars.char_1014_nearl2.spine[side].anims.skills['1'];
    assert.deepEqual({ ...s1 }, { begin: null, loop: 'Attack_Loop', end: null, via: 'attack', index: 1, idle: null }, `${side} S2`);
    assert.notEqual(s1.loop, 'Skill_2_Die', `${side}: 不再把倒地片当技能动画`);
  }
  // 缄默德克萨斯 S3：姿态（Skill_3_Idle）保留，普攻回落到普通 Attack
  const texas2 = M.chars.char_1028_texas2.spine.front.anims.skills['2'];
  assert.equal(texas2.via, 'attack', '缄默德克萨斯 S3：普攻用普通攻击');
  assert.equal(texas2.idle, 'Skill_3_Idle', 'S3 的姿态 idle 保留');
  assert.equal(texas2.loop, 'Skill_3_Loop', 'S3 的循环片保留');
  // 弑君者 S2：起手 / 姿态 / 收尾保留，普攻用 Attack_A
  const crosly = M.chars.char_1502_crosly.spine.front.anims.skills['1'];
  assert.equal(crosly.via, 'attack', '弑君者 S2：普攻用 Attack_A');
  assert.deepEqual([crosly.begin, crosly.loop, crosly.end, crosly.idle], ['Start_2', 'Skill_2_Idle', 'Skill_2_End', 'Skill_2_Idle'], 'S2 的起手/姿态/收尾保留');
});
