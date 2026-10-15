// test/content/kits_char_5_98.test.js — 乌啾 (chess_char_5_98, 自定义 5★ 链愈师, tier 5) kit tests:
// form + kit identity (S2 “捉迷藏！” default, chain-heal profile, XAH-X on the elite), S2's hp loss + immediate
// heal + HoT + 迷彩, T1 久病良医's own-jump boost + the extra un-falloff jump, and the operator's own effect
// 病床巡视 (every skill start → +1/+2 【乌萨斯】【迅捷】 layers per ursus operator in range, activated only, 12/24 cap).
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

test('病床巡视: every skill start gives the activated 【乌萨斯】/【迅捷】+1 per ursus operator in range (cap 12, normal)', () => {
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
  h.runUntil(() => h.hooksOf('skillStart').filter((c) => c.unit === u).length >= 6, 110);
  const casts = h.hooksOf('skillStart').filter((c) => c.unit === u).length;
  const expect = Math.min(12, casts * 1);
  assert.equal(layers(h, 'ursusShip'), expect, `乌萨斯 ${layers(h, 'ursusShip')} vs ${expect} (1 ursus other in range, cap 12)`);
  assert.equal(layers(h, 'swiftShip'), expect, '迅捷 mirrors 乌萨斯');
  done(h);
  // inactive bonds gain nothing
  const h2 = field({ ursusShip: bondOn(false), swiftShip: bondOn(false) });
  const u2 = h2.unit(1);
  h2.runUntil(() => h2.hooksOf('skillStart').filter((c) => c.unit === u2).length >= 2, 110);
  assert.equal(layers(h2, 'ursusShip'), 0, 'inactive 乌萨斯 gains nothing');
  done(h2);
});
