// test/content/kits_char_5_98.test.js — 乌啾 (chess_char_5_98, 自定义 5★ 链愈师, tier 5) kit tests:
// form + kit identity (S2 “捉迷藏！” default, chain-heal profile, XAH-X on the elite), S2's hp loss + immediate
// heal + HoT + 迷彩, T1 久病良医's own-jump boost + the extra un-falloff jump, and the operator's own effect
// 病床巡视 (every skill start → +3/+6 【乌萨斯】【迅捷】 layers per ursus operator in range, activated only, 12/24 cap).
// Run: node --test test/content/kits_char_5_98.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, enemyRec, checkInvariants } from '../helpers/battleHarness.js';
import { KITS, skillSpecSource } from '../../server/sim/content/index.js';
import { getDefaultSource } from '../../server/sim/simdata.js';
const ds = getDefaultSource();

const A = 'chess_char_5_98_a', B = 'chess_char_5_98_b';
const S2 = 'skchr_turdus_2';
const dummy = (key, o = {}) => enemyRec({ key, hp: 1e9, speed: 0, atk: 0, ...o });
const ENEMIES = { e_dummy: dummy('e_dummy') };
const done = (h) => { checkInvariants(h.b); assert.equal(h.b.errors.length, 0, JSON.stringify(h.b.errors[0])); };
const layers = (h, id) => h.b.getPlayer('p1')?.bonds?.[id]?.layers ?? 0;
const bondOn = (active = true) => ({ count: 3, active, tier: active ? 1 : 0, layers: 0 });
const healsBy = (h, u) => h.hooksOf('heal').filter((c) => c.source === u);

test('both forms: preset kit hand-authored, S2 “捉迷藏！” is the default skill, 链愈师 chain heal; _b carries XAH-X', () => {
  for (const [id, golden] of [[A, false], [B, true]]) {
    const h = makeBattle({ defs: { enemies: { e_dummy: dummy('e_dummy') } }, units: [{ chessId: id, row: 10, col: 5 }], autoFinish: false, timeLimit: 20 });
    const u = h.unit(1);
    assert.equal(u.def.charId, 'char_4224_turdus');
    assert.equal(u.skill.id, S2, `${id}: default skill S2`);
    assert.equal(skillSpecSource(ds.getChess(id), KITS), 'kit', `${id}: hand-authored preset kit`);
    assert.equal(u.dmgType, 'heal', `${id}: 链愈师治疗系`);
    assert.equal(u.profile.heal?.mode, 'chain', `${id}: chain heal profile`);
    assert.equal(!!ds.rawChess(id).module?.active, golden, `${id}: module ${golden ? 'XAH-X active' : 'none'}`);
    done(h);
  }
});

test('S2 “捉迷藏！”: the cast costs 15 % current HP, heals the lowest-hp ally once (HoT + 迷彩 on the healed)', () => {
  const h = makeBattle({
    defs: { enemies: { e_dummy: dummy('e_dummy') } }, units: [{ chessId: A, row: 10, col: 5 }, { chessId: 'chess_char_1_10_a', row: 10, col: 6 }],
    autoFinish: false, timeLimit: 60, captureNoisy: true, seed: 7,
  });
  h.step(1);
  const u = h.unit(1);
  const gummy = h.b.allyUnits.find((x) => x.def?.charId === 'char_196_sunbr');
  gummy.hp = Math.floor(gummy.s.maxHp * 0.5);   // the injured patient
  const hpBefore = u.hp;
  u.skill.activate('test', { free: true });
  const paid = u.hp <= hpBefore * 0.85 + 1;   // the loss lands on the cast itself; her chain heal may jump back to her later
  assert.ok(paid, `she paid 15 % of her current HP on the cast (${hpBefore} → ${u.hp})`);
  h.run(1);
  const hot = gummy.findBuff('skill:turdus:hot');
  assert.ok(hot, 'the patient holds the HoT');
  h.run(2);
  const healed = healsBy(h, u).filter((c) => c.target === gummy);
  assert.ok(healed.length >= 2, `immediate heal + HoT ticks, got ${healed.length}`);
  const camou = gummy.findBuff('camou') ?? gummy.s.flags?.camou;
  assert.ok(camou, 'the healed target holds 迷彩');
  done(h);
});

test('久病良医: receiving her own heal heals for ×1.1 (normal) and adds one extra un-falloff jump to another ally', () => {
  const h = makeBattle({
    defs: { enemies: { e_dummy: dummy('e_dummy') } }, units: [{ chessId: A, row: 10, col: 5 }, { chessId: 'chess_char_1_10_a', row: 10, col: 6 }],
    autoFinish: false, timeLimit: 30, captureNoisy: true, seed: 9,
  });
  h.step(1);
  const u = h.unit(1);
  const gummy = h.b.allyUnits.find((x) => x.def?.charId === 'char_196_sunbr');
  u.hp = Math.floor(u.s.maxHp * 0.4);
  gummy.hp = Math.floor(gummy.s.maxHp * 0.4);
  h.b.heal(u, u, 1000, { tags: ['test'] });
  h.run(0.5);
  const own = healsBy(h, u).filter((c) => c.target === u);
  const mul = u.def.talents[0].bb['chain.atk_scale_2'];   // the E2 form's data bb (1.25)
  const boosted = own.find((c) => Math.abs(c.amount - 1000 * mul) < 1);
  assert.ok(boosted, `her own heal is ×${mul} (own), got ${own.map((c) => Math.round(c.amount)).join(',')}`);
  const extra = healsBy(h, u).filter((c) => c.target === gummy && (c.opts?.tags || []).includes('turdusOwnJump'));
  assert.ok(extra.length >= 1 && Math.abs(extra[0].amount - 1000 * mul) < 1, 'the extra un-falloff jump lands on the other ally at the boosted amount');
  done(h);
});

test('病床巡视 (2026-10-17 用户修订): every skill start gives the activated 【乌萨斯】/【迅捷】+3 per ursus operator in range (cap 12, normal)', () => {
  const field = (bonds) => makeBattle({
    defs: { enemies: { e_dummy: dummy('e_dummy') } },
    units: [
      { chessId: A, row: 10, col: 5 },
      { chessId: 'chess_char_4_98_a', row: 10, col: 6 },   // 赫拉格 (ursus, in range)
      { chessId: 'chess_char_1_02_a', row: 10, col: 4 },   // 角峰 (kjerag, in range — not ursus)
    ],
    autoFinish: false, timeLimit: 120, captureNoisy: true, seed: 15, bonds,
  });
  const h = field({ ursusShip: bondOn(true), swiftShip: bondOn(true) });
  const u = h.unit(1);
  h.step(1);   // 先推进一帧：单位部署完、盟约装好，处理器里的 up(unit) 才为真
  // 开技事件直接 emit：这个阵型里她的 S2 在 110 s 内自然攒不满技力，等自然开技只会让断言双双为 0
  // （旧版本就是这样 0 == 0 通过的）；emit 是引擎自己的事件入口，最终仍由 kit 里那个处理器加层。
  const castOnce = () => { h.b.emit('skillStart', { unit: u }); h.run(0.05); };
  // 范围内 2 名【乌萨斯】（她自己 + 赫拉格）× 每人 +3 = +6（2026-10-17 用户修订：2/4 → 3/6）
  castOnce();
  assert.equal(layers(h, 'ursusShip'), 6, `乌萨斯 1 次开技 = 2 人 × 3 = 6, got ${layers(h, 'ursusShip')}`);
  assert.equal(layers(h, 'swiftShip'), 6, '迅捷 mirrors 乌萨斯');
  // 2 次开技即到本场上限 12（2026-10-17：8/16 → 12/24）
  castOnce();
  assert.equal(layers(h, 'ursusShip'), 12, `乌萨斯 2 次开技 = 12（到本场上限）, got ${layers(h, 'ursusShip')}`);
  castOnce();
  assert.equal(layers(h, 'ursusShip'), 12, `乌萨斯 capped at 12, got ${layers(h, 'ursusShip')}`);
  assert.equal(layers(h, 'swiftShip'), 12, '迅捷 mirrors 乌萨斯');
  done(h);
  // inactive bonds gain nothing
  const h2 = field({ ursusShip: bondOn(false), swiftShip: bondOn(false) });
  const u2 = h2.unit(1);
  h2.step(1);
  for (let i = 0; i < 3; i++) { h2.b.emit('skillStart', { unit: u2 }); h2.run(0.05); }
  assert.equal(layers(h2, 'ursusShip'), 0, 'inactive 乌萨斯 gains nothing');
  done(h2);
});
