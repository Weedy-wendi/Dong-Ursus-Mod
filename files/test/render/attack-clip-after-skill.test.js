// test/render/attack-clip-after-skill.test.js — 技能期间 / 技能结束后的「普通攻击动画」口径（mod 侧新增）。
//
// 业主口径（2026-10-15）：普通攻击该播哪个 clip 由技能槽决定 —— 技能有自己的攻击性 loop 就用它
// （临光 S1 Skill_1_Loop / S3 Skill_3、缄默德克萨斯 S2 Skill_2_Loop、止颂 S2/S3、夜刀 S1/S2），
// 否则一直用干员自己的攻击 clip（临光 S2、缄默德克萨斯 S1/S3、弑君者 S2、引星棘刺 S1/S2 等），
// 技能结束/瞬发技能播完之后回到普通攻击与 Idle。
//
// 这里钉的是渲染层的行为（units.js sync + spine.js _attackClip/_idleName）：技能结束后 skillOn 不得被闩住，
// 否则 spine.js 会把技能 clip 当作普攻（业主报障：德克萨斯 剑雨 / 耀骑士临光 技能结束后普攻变成技能动画）。
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installFakePixi, fakeViewCtx } from './fakepixi.js';
import { presetCamera } from '../../public/js/render/projection.js';
import { spineEntry } from '../../public/js/assets.js';
import { UF, ANIM } from '../../shared/constants.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const M = JSON.parse(readFileSync(path.join(ROOT, 'data/assets.json'), 'utf8'));

let fake, UnitView, cam;
let clockT = 0;
before(async () => {
  fake = installFakePixi();
  cam = presetCamera('normal', { width: 1280, height: 720 });
  ({ UnitView } = await import('../../public/js/render/units.js'));
});
after(() => fake.restore());

const store = () => ({
  picture: () => null,
  image: async () => null,
  hasBack: () => false,
  spineEntry: (id, o) => spineEntry(M, id, o),
  spine: {
    acquire: async (e) => ({ animations: Object.keys(e.animations || {}).map((name) => ({ name })) }),
    restart: () => false,
    release: () => {},
    peek: () => null,
  },
});
const sample = (anim, flags = 0) => ({ x: 5, y: 10, hp: 1000, maxHp: 1000, sp: 0, spMax: 0, flags, anim, vx: 0, vy: 0 });
const tick = () => new Promise((r) => setImmediate(r));

/** A real operator's view + a recorder of every clip it sets; drive it with the sim's snapshot (anim + flags). */
async function op(charId, skillIndex) {
  clockT = 0;
  const v = new UnitView(fakeViewCtx(fake.P, { assets: store(), cam }), {
    id: 7, side: 'ally', kind: 'chess', defId: charId, spine: charId, tier: 1, x: 5, y: 10, maxHp: 1000, dir: 'RIGHT', skillIndex,
  });
  await tick(); await tick();
  const log = [];
  const a = v.actor;
  const st = a.spine.state;
  const set = st.setAnimation;
  st.setAnimation = (i, name, loop) => { log.push(name); return set(i, name, loop); };
  const step = (s, anim, flags = 0) => {
    for (let t = 0; t < s - 1e-9; t += 1 / 60) { clockT += 1 / 60; v.sync(sample(anim, flags), clockT); v.update(1 / 60, cam, clockT); }
  };
  const attackClip = () => { log.length = 0; a.attack(1.05); return log[0]; };
  return { v, a, step, attackClip, log };
}

describe('技能结束后的普通攻击动画不是技能 clip（业主报障 2026-10-15）', () => {
  test('德克萨斯 S2 剑雨（瞬发，sim 只给 0.5 s ANIM.SKILL 窗口）：窗口后普攻回到 Attack_Loop，姿态不闩住', async () => {
    const o = await op('char_102_texas', 1);
    o.v.setSkill(true); o.v.setSkill(false);       // 瞬发技能：sim 的 on/off 事件同 tick
    o.step(0.5, ANIM.SKILL);                       // sim 的技能动画窗口（SKILL_ANIM_WINDOW）
    assert.equal(o.a.current, 'Skill', '剑雨 clip 仍在播（本体的一次性窗口）');
    o.step(2, ANIM.ATTACK);                        // 窗口结束：此后是普通攻击
    assert.equal(o.a.skillOn, false, 'skillOn 不得被闩住');
    assert.equal(o.a.current, 'Idle');
    assert.equal(o.attackClip(), 'Attack_Loop');
  });

  test('耀骑士临光 S3（持续技能，sim 用 UF.SKILL 承载）：开着时普攻 Skill_3，关掉后回到 Attack_Loop', async () => {
    const o = await op('char_1014_nearl2', 2);
    o.step(0.2, ANIM.IDLE, UF.SKILL);
    assert.equal(o.a.skillOn, true, '有 UF.SKILL 就进姿态');
    assert.equal(o.attackClip(), 'Skill_3', '技能期间用技能自己的循环片');
    o.step(1, ANIM.SKILL, UF.SKILL);
    o.step(1, ANIM.ATTACK);                        // 技能结束：标志位清了，anim 也不再是 SKILL
    assert.equal(o.a.skillOn, false, '迟滞过后姿态释放');
    assert.equal(o.a._idleName(), 'Idle', '静止回到普通 Idle');
    assert.equal(o.attackClip(), 'Attack_Loop');
  });

  test('止颂 S2（有专属 loop）：技能期间普攻 Skill_2_Loop，标志位一清就回到 Attack', async () => {
    const o = await op('char_4011_lessng', 1);
    o.step(0.2, ANIM.IDLE, UF.SKILL);
    assert.equal(o.attackClip(), 'Skill_2_Loop');
    o.step(0.2, ANIM.ATTACK, UF.SKILL);            // 技能期间普攻会把 anim 压到 ATTACK，但 UF.SKILL 还在
    assert.equal(o.a.skillOn, true, '标志位还在，姿态不受 anim 抖动影响');
    o.step(0.1, ANIM.ATTACK);                      // sim 清掉 UF.SKILL = 技能结束
    assert.equal(o.a.skillOn, false);
    assert.equal(o.attackClip(), 'Attack');
  });

  test('不带 UF.SKILL 的姿态（部署期被动，如麒麟R夜刀）：anim 抖动不会误关，窗口真正结束后释放', async () => {
    const o = await op('char_1029_yato2', 2);
    o.v.setSkill(true);                            // 部署事件给的那次 ON
    o.step(0.2, ANIM.SKILL);                       // sim 的姿态窗口（无标志位）
    assert.equal(o.a.skillOn, true);
    o.step(0.1, ANIM.ATTACK);                      // 窗口之间被普攻压到 ATTACK
    assert.equal(o.a.skillOn, true, '不足迟滞的 ATTACK 抖动不释放姿态');
    o.step(1, ANIM.ATTACK);                        // 窗口真正结束
    assert.equal(o.a.skillOn, false, '姿态不得被闩住');
    assert.equal(o.attackClip(), 'Attack1');
  });

  test('普攻口径的按槽位补丁：弑君者 S2 / 缄默德克萨斯 S3 姿态保留、普攻用普通攻击 clip', async () => {
    const c = await op('char_1502_crosly', 1);
    c.step(0.2, ANIM.IDLE, UF.SKILL);
    assert.equal(c.a._idleName(), 'Skill_2_Idle', '弑君者 S2 的姿态 idle 保留');
    assert.equal(c.attackClip(), 'Attack_A', '普攻仍是她自己的 Attack_A');
    const t = await op('char_1028_texas2', 2);
    t.step(0.2, ANIM.IDLE, UF.SKILL);
    assert.equal(t.a._idleName(), 'Skill_3_Idle', '缄默德克萨斯 S3 的姿态 idle 保留');
    assert.equal(t.attackClip(), 'Attack', '普攻仍是普通 Attack');
  });

  test('临光 S2（骨架里只有倒地的 Skill_2_Die）：用普通攻击，姿态是普通 Idle', async () => {
    const o = await op('char_1014_nearl2', 1);
    o.step(0.2, ANIM.IDLE, UF.SKILL);
    assert.equal(o.attackClip(), 'Attack_Loop');
    assert.equal(o.a._idleName(), 'Idle', '静止是普通 Idle');
  });

  test('麒麟R夜刀：普通攻击按 Attack1→2→3 循环；断敌回到 idle 后从 Attack1 重新开始', async () => {
    const o = await op('char_1029_yato2', 2);
    o.step(0.2, ANIM.IDLE);
    const seen = [];
    for (let i = 0; i < 4; i++) { seen.push(o.attackClip()); o.step(1.05, ANIM.ATTACK); }
    assert.deepEqual(seen, ['Attack1', 'Attack2', 'Attack3', 'Attack1'], '连续攻击按序列循环');
    o.step(3, ANIM.IDLE);                          // 不接敌：回到 idle
    assert.equal(o.attackClip(), 'Attack1', '断敌后下一轮从第一格开始');
  });

  test('麒麟R夜刀 S1：技能期间按 Skill_Attack1→2→3→4 循环，开技能即从第一格起', async () => {
    const o = await op('char_1029_yato2', 0);
    o.step(0.2, ANIM.IDLE, UF.SKILL);
    const seen = [];
    for (let i = 0; i < 5; i++) { seen.push(o.attackClip()); o.step(1.05, ANIM.SKILL, UF.SKILL); }
    assert.deepEqual(seen, ['Skill_Attack1', 'Skill_Attack2', 'Skill_Attack3', 'Skill_Attack4', 'Skill_Attack1']);
  });
});
