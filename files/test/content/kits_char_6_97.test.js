// test/content/kits_char_6_97.test.js — 麒麟R夜刀 (chess_char_6_97, 自定义 6★ 处决者) kit tests: kit identity,
// S2 乱舞 / S3 空中回旋乱舞 as deploy-time duration casts (2026-10-14 用户修订: 怒潮凛冬 S3 同款 —— 正式 cast、
// 空放不需要接敌、技能条倒数、mods/flags 随 cast 起终), the hit frames inside the Skill_2 animation window
// (1 干员秒 = 1 引擎秒, 2026-10-14 实测修订 —— SP/DP 1/秒、攻击间隔 1:1), the redeploy regression
// (a stale bullet step of an earlier cast must not outlive its deployment), and 麒麟之魂 (garrison_992)
// 的数值（2026-10-17 用户修订：再部署 -75%、【狂龙症】攻击力 +50% 且 90% 物理/法术减伤，不再给屏障）。
// Run: node --test test/content/kits_char_6_97.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, enemyRec, checkInvariants } from '../helpers/battleHarness.js';
import { getDefaultSource } from '../../server/sim/simdata.js';
import { KITS, skillSpecSource } from '../../server/sim/content/index.js';

const ds = getDefaultSource();
const A = 'chess_char_6_97_a', B = 'chess_char_6_97_b';
const S1 = 'skchr_yato2_1', S2 = 'skchr_yato2_2', S3 = 'skchr_yato2_3';
const dummy = (key, o = {}) => enemyRec({ key, hp: 1e12, speed: 0, atk: 0, def: 0, ...o });
const ENEMIES = { e_dummy: dummy('e_dummy') };
const done = (h) => { checkInvariants(h.b); assert.equal(h.b.errors.length, 0, JSON.stringify(h.b.errors[0])); };
/** Events (kind, …args) the sim queued so far, `[time, ...event]`. */
const trace = (h) => {
  const evs = [];
  const orig = h.b._ev.bind(h.b);
  h.b._ev = (e) => { evs.push([h.b.time, ...e]); return orig(e); };
  return evs;
};
const kinds = (evs, ...names) => evs.filter((e) => names.includes(e[1]));

test('both forms: the preset kit is hand-authored, S2 乱舞 is the default skill (2026-10-13 用户修订)', () => {
  for (const id of [A, B]) {
    const h = makeBattle({ defs: { enemies: ENEMIES }, units: [{ chessId: id, row: 10, col: 5 }], autoFinish: false, timeLimit: 30 });
    assert.equal(h.unit(1).def.charId, 'char_1029_yato2');
    assert.equal(h.unit(1).skill.id, S2, `${id}: default skill S2 乱舞`);
    assert.equal(skillSpecSource(ds.getChess(id), KITS), 'kit', `${id}: hand-authored preset kit`);
    done(h);
  }
  assert.deepEqual(ds.rawChess(A).skills.map((s) => s.skillId), [S1, S2, S3]);
});

test('S2 乱舞: a duration cast on deploy (空放, no target needed) — 前摇 1 s + Skill_2 3.433 s, all 16 hits inside the animation window', () => {
  const h = makeBattle({ defs: { enemies: ENEMIES }, units: [{ chessId: A, row: 10, col: 5, skillIndex: 1 }],
    enemies: [{ key: 'e_dummy', pos: [10, 6] }], autoFinish: false, timeLimit: 30, captureNoisy: true });
  const u = h.unit(1);
  const evs = trace(h);
  h.run(0.3);
  assert.ok(u.skill.active, 'cast active from the deploy');
  assert.equal(u.skill.id, S2);
  assert.ok(u.s.flags.disarm, 'disarmed during the cast');
  assert.ok(u.s.flags.taunt > 0 || (u.findBuff(u.skill._buffKey)?.mods?.taunt ?? 0) > 0, 'taunt +1 from the skill mods');
  // duration = 前摇 1 + Skill_2 3.433
  assert.ok(Math.abs(u.skill.duration - 4.433) < 1e-9, `S2 duration 4.433, got ${u.skill.duration}`);
  // the cast runs its course: the off event lands at the duration end
  h.run(5);
  const offs = kinds(evs, 'skill').filter((e) => e[3] === 0);
  assert.equal(offs.length, 1, `one off event at the cast end, got ${JSON.stringify(kinds(evs, 'skill'))}`);
  assert.ok(offs[0][0] > 4.3 && offs[0][0] < 4.6, `off at ~4.433, at ${offs[0][0]}`);
  // the 16 hit frames, all inside the animation window (前摇 1 s + 动画 3.433 s ⇒ first ≤ 1.4, last ≤ 3.967):
  // the enemy takes no other damage during the cast (she is disarmed — normal attacks resume at 4.433)
  const eid = h.enemies()[0].id;
  const hits = kinds(evs, 'dmg').filter((e) => e[2] === eid).map((e) => +e[0].toFixed(2));
  const cast = hits.filter((t) => t <= 4.2);
  assert.ok(cast.length >= 16, `16 dance hits inside the window, got ${cast.length}`);
  assert.ok(cast[0] >= 1.3 && cast[0] <= 1.5, `first hit at ~1.4 (inside Skill_2), got ${cast[0]}`);
  assert.ok(!u.skill.active, 'cast over');
  assert.ok(!u.s.flags.disarm, 'disarm off after the cast');
  done(h);
});

test('S3 空中回旋乱舞: a duration cast — Start_3 1 s wind-up, then the bullet (无敌/不可阻挡/不普攻 as skill flags)', () => {
  const h = makeBattle({ defs: { enemies: ENEMIES }, units: [{ chessId: A, row: 10, col: 5, skillIndex: 2 }],
    enemies: [{ key: 'e_dummy', pos: [10, 6] }], autoFinish: false, timeLimit: 30 });
  const u = h.unit(1);
  h.run(0.3);
  assert.ok(u.skill.active && u.skill.id === S3);
  assert.ok(u.s.flags.invulnerable && u.s.flags.unblockable, 'invulnerable + unblockable from the skill flags');
  assert.ok(Math.abs(u.skill.duration - (1 + 5 / 8 + 0.25)) < 1e-9, `S3 duration 1.875, got ${u.skill.duration}`);
  const before = h.enemies()[0].hp;
  h.run(2);
  assert.ok(before - h.enemies()[0].hp > 0, 'the bullet dealt its damage');
  assert.ok(!u.skill.active, 'cast over after the bullet');
  assert.ok(!u.s.flags.invulnerable, 'invulnerable off with the cast');
  done(h);
});

test('S1 鬼人化: a deploy-time duration cast (数据 duration) — 技能期间鬼人化，结束后回到普通攻击序列', () => {
  const h = makeBattle({ defs: { enemies: ENEMIES }, units: [{ chessId: A, row: 10, col: 5, skillIndex: 0 }], autoFinish: false, timeLimit: 30 });
  h.run(0.2);
  const u = h.unit(1);
  assert.equal(u.skill.id, S1);
  assert.equal(u.skill.kind, 'duration', 'a deploy-time duration cast (与耀骑士临光 S2 同型), not a permanent passive');
  assert.ok(u.skill.active, 'active during the cast');
  assert.ok(u.skill.duration > 1 && u.skill.duration < 120, `the data duration, got ${u.skill.duration}`);
  assert.ok(!(u.skillAnimUntil > 3000), 'no held 3600 s stance window any more (业主报障 2026-10-15)');
  done(h);
});

test('redeploy regression: an instant redeploy (突袭/不屈 style) mid S3 re-arms a fresh cast with its own flags', () => {
  const h = makeBattle({ defs: { enemies: ENEMIES }, units: [{ chessId: A, row: 10, col: 5, skillIndex: 2 }],
    enemies: [{ key: 'e_dummy', pos: [10, 6] }], autoFinish: false, timeLimit: 60 });
  const u = h.unit(1);
  const evs = trace(h);
  h.run(0.2);
  // 死在前摇里：上一施放的弹道 step 计时器（1 s 后引爆）还挂着 → 即刻重部署（突袭/不屈走的 battle.redeploy）
  h.b.kill(u);
  assert.equal(h.b.redeploy(u, { free: true }), true, 'instant redeploy');
  h.run(0.5);
  assert.ok(u.skill.active, 'the new cast is live');
  assert.ok(u.s.flags.invulnerable, 'invulnerable from the new cast flags');
  // 跨过旧 step 的引爆点（部署 + 1 s）：滞留 step 不得干扰新施放，新弹道照常落地
  h.run(1.0);
  assert.ok(u.s.flags.invulnerable, 'still in the new cast');
  const before = h.enemies()[0].hp;
  h.run(1.5);
  assert.ok(before - h.enemies()[0].hp > 0, 'the redeployed bullet deals its damage');
  // 每个 cast 一个 off 事件：第一次随死亡结束（0.2s），重部署后的新 cast 在自己的 duration 末端正常收束
  h.run(2.0);
  const offs = kinds(evs, 'skill').filter((x) => x[3] === 0);
  assert.equal(offs.length, 2, `death-off + the new cast's off, got ${JSON.stringify(kinds(evs, 'skill'))}`);
  assert.ok(offs[0][0] <= 0.3, `the first cast ended with the death, at ${offs[0][0]}`);
  assert.ok(offs[1][0] > 1.8 && offs[1][0] < 2.3, `the new cast ends at its duration, at ${offs[1][0]}`);
  done(h);
});

test('normal respawn redeploy re-arms the S2 乱舞 cast (skill active, disarm, fresh duration)', () => {
  const h = makeBattle({ defs: { enemies: ENEMIES }, units: [{ chessId: A, row: 10, col: 5, skillIndex: 1 }],
    enemies: [{ key: 'e_dummy', pos: [10, 6] }], autoFinish: false, timeLimit: 60 });
  const u = h.unit(1);
  h.run(1);
  h.b.kill(u);
  // respawnTime 6 s × 【麒麟之魂】-75% = 1.5 s（2026-10-16 起；DP 不足时以 DP 为准）——逐步推进到刚重部署那一刻。
  // 不按固定时刻断言（旧写法在 t=11 断言 cast 仍 active，是按 -50% 的再部署时间标定的；-75% 后 cast 已结束）
  for (let t = 0; !u.alive && t < 30; t += 0.25) h.run(0.25);
  assert.ok(u.alive, 'redeployed after the respawn timer');
  assert.ok(u.skill.active, 'cast re-armed');
  assert.ok(u.s.flags.disarm, 'disarm from the fresh cast');
  assert.ok(Math.abs(u.skill.duration - 4.433) < 1e-9, 'fresh duration');
  done(h);
});

test('麒麟之魂 (garrison_992, 2026-10-17 用户修订): 再部署 -75%、【狂龙症】攻击力 +50% + 90% 物理/法术减伤（不再给屏障）、每秒流失 100', () => {
  const h = makeBattle({ defs: { enemies: ENEMIES }, units: [{ chessId: A, row: 10, col: 5 }], autoFinish: false, timeLimit: 30 });
  h.run(0.2);
  const u = h.unit(1);
  assert.equal(u.s.redeployMul, 0.25, '再部署时间 -75%');
  const loss = u.s.maxHp * 0.5;
  assert.ok(Math.abs(u.hp - loss) < 1e-6, `部署时失去当前生命值的 50%（hp ${u.hp} vs ${loss}）`);
  // 2026-10-17 用户修订：屏障去掉，改为 90% 物理/法术减伤
  assert.equal(u.findBuff('garrison:yato2:shield'), null, '【狂龙症】不再给屏障');
  const oni = u.findBuff('trait:yato2:oni');
  assert.ok(oni, '【狂龙症】已挂上');
  assert.equal(oni.mods.atkPct, 0.5, '【狂龙症】攻击力 +50%');
  assert.ok(Math.abs(u.s.physTakenMul - 0.1) < 1e-9, `90% 物理减伤（physTakenMul ${u.s.physTakenMul}）`);
  assert.ok(Math.abs(u.s.artsTakenMul - 0.1) < 1e-9, `90% 法术减伤（artsTakenMul ${u.s.artsTakenMul}）`);
  // 每秒流失 100 点生命
  const hp0 = u.hp;
  h.run(1.05);
  assert.ok(hp0 - u.hp >= 99 && hp0 - u.hp <= 101, `每秒流失 100 点生命（掉了 ${hp0 - u.hp}）`);
  done(h);
});
