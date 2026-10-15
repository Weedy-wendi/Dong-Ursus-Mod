// test/content/kits_char_4_98.test.js — 赫拉格 (chess_char_4_98, 自定义 6★ 武者, tier 4) kit tests:
// form + kit identity, the musha trait heal, T1 月盈星亏's berserk ASPD, and the operator's own effect
// 老将刀意 (each kill → +2/+4 layers on the activated 【乌萨斯】【远见】only, capped 8/16 per battle
// (2026-10-14 用户修订)).
// Run: node --test test/content/kits_char_4_98.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, enemyRec, checkInvariants } from '../helpers/battleHarness.js';
import { KITS, skillSpecSource } from '../../server/sim/content/index.js';
import { getDefaultSource } from '../../server/sim/simdata.js';
const ds = getDefaultSource();

const A = 'chess_char_4_98_a', B = 'chess_char_4_98_b';
const S2 = 'skchr_helage_2';
const ENEMIES = {
  e_attacker: enemyRec({ key: 'e_attacker', hp: 1e9, speed: 0, atk: 500, bat: 0.6, range: 1.5, def: 0 }),
  e_dummy: enemyRec({ key: 'e_dummy', hp: 1e9, speed: 0, atk: 0, def: 0 }),
  e_fodder: enemyRec({ key: 'e_fodder', hp: 10, speed: 0, atk: 0, def: 0 }),   // 一刀一个：老将刀意的击杀源
};
const done = (h) => { checkInvariants(h.b); assert.equal(h.b.errors.length, 0, JSON.stringify(h.b.errors[0])); };
const hitsOn = (h, u) => h.hooksOf('damaged').filter((c) => c.source === u && c.dmg?.isAttack);
const selfHeals = (h, u) => h.hooksOf('heal').filter((c) => c.source === u && c.target === u && !c.opts?.regen);
const layers = (h, id) => h.b.getPlayer('p1')?.bonds?.[id]?.layers ?? 0;
const bondOn = (active = true) => ({ count: 2, active, tier: active ? 1 : 0, layers: 0 });

test('both forms: preset kit hand-authored, S2 弦月 is the default skill, 武者 (no heal from others, self heal, block 1)', () => {
  for (const id of [A, B]) {
    const h = makeBattle({ defs: { enemies: ENEMIES }, units: [{ chessId: id, row: 10, col: 5 }], autoFinish: false, timeLimit: 20 });
    const u = h.unit(1);
    assert.equal(u.def.charId, 'char_188_helage');
    assert.equal(u.skill.id, S2, `${id}: default skill S2 弦月`);
    assert.equal(skillSpecSource(ds.getChess(id), KITS), 'kit', `${id}: hand-authored preset kit`);
    assert.equal(u.profile.noHeal, true, `${id}: 武者禁疗`);
    assert.equal(u.base.bat, 1.2, `${id}: 1.2 s attack interval`);
    assert.equal(u.s.blockCnt, 1, `${id}: blocks 1`);
    done(h);
  }
});

test('武者 trait: each attack hit heals him 70 (E2 frame)', () => {
  const h = makeBattle({
    defs: { enemies: ENEMIES }, units: [{ chessId: B, row: 10, col: 5 }],
    enemies: [{ key: 'e_dummy', pos: [10, 6] }], autoFinish: false, timeLimit: 20, captureNoisy: true,
  });
  const u = h.unit(1);
  u.hp = Math.max(1, u.s.maxHp - 500);
  h.runUntil(() => hitsOn(h, u).length >= 2, 15);
  assert.ok(hitsOn(h, u).length >= 2, 'he attacked');
  const heals = selfHeals(h, u);
  assert.ok(heals.length >= 2, `a heal per hit, got ${heals.length}`);
  for (const c of heals) assert.ok(Math.abs(c.amount - 70) < 1e-6, `70 per hit, got ${c.amount}`);
  done(h);
});

test('月盈星亏: 坚忍 ASPD up to min_attack_speed, linear in the HP lost up to min_hp_ratio (E2: 100 at 30 % HP)', () => {
  const h = makeBattle({
    defs: { enemies: ENEMIES }, units: [{ chessId: B, row: 10, col: 5 }],
    enemies: [{ key: 'e_dummy', pos: [10, 6] }], autoFinish: false, timeLimit: 20, captureNoisy: true,
  });
  const u = h.unit(1);
  h.step(2);
  assert.equal(u.findBuff('talent:helage:berserk'), null, 'no berserk at full HP');
  u.hp = u.s.maxHp * 0.5;
  h.runUntil(() => u.findBuff('talent:helage:berserk'), 5);
  const b = u.findBuff('talent:helage:berserk');
  assert.ok(b, 'the berserk buff is up');
  const want = 100 * (1 - u.hpRatio) / (1 - 0.3);
  assert.ok(Math.abs(b.mods.aspd - want) < 0.05, `aspd ${b.mods.aspd} ≈ ${want} (hpRatio ${u.hpRatio.toFixed(3)})`);
  done(h);
});

test('老将刀意: each kill gives the activated 【乌萨斯】【远见】+2 layers, capped 8 per battle (normal); an inactive bond gains nothing', () => {
  const field = (bonds, n = 5) => makeBattle({
    defs: { enemies: ENEMIES }, units: [{ chessId: A, row: 10, col: 5 }],
    enemies: [{ key: 'e_fodder', pos: [10, 6], count: n, interval: 1.5 }],
    autoFinish: false, timeLimit: 60, captureNoisy: true, seed: 9,
    bonds,
  });
  const killsOf = (h, u) => h.hooksOf('kill').filter((c) => c.killer === u);
  // 5 fodder in his range: 5 kills × +2 = 10 → the cap 8 (2026-10-14 用户修订) holds the layers at 8
  const h = field({ visiShip: bondOn(true), raidShip: bondOn(true), ursusShip: bondOn(true) });
  const u = h.unit(1);
  h.runUntil(() => killsOf(h, u).length >= 5, 50);
  assert.ok(killsOf(h, u).length >= 5, '5 kills happen');
  assert.equal(layers(h, 'visiShip'), 8, `远见 capped at 8, got ${layers(h, 'visiShip')}`);
  assert.equal(layers(h, 'ursusShip'), 8, `乌萨斯 capped at 8, got ${layers(h, 'ursusShip')}`);
  assert.equal(layers(h, 'raidShip'), 0, '突袭 is not part of the effect');
  done(h);

  // the same fight with both bonds inactive: no layers anywhere
  const h2 = field({ visiShip: bondOn(false), raidShip: bondOn(false) }, 3);
  const u2 = h2.unit(1);
  h2.runUntil(() => killsOf(h2, u2).length >= 3, 50);
  assert.equal(layers(h2, 'visiShip'), 0, 'inactive 远见 gains nothing');
  assert.equal(layers(h2, 'ursusShip'), 0, 'inactive 乌萨斯 gains nothing');
  done(h2);
});

test('老将刀意 (精锐): each kill gives +4 layers, capped 16 per battle', () => {
  const h = makeBattle({
    defs: { enemies: ENEMIES }, units: [{ chessId: B, row: 10, col: 5 }],
    enemies: [{ key: 'e_fodder', pos: [10, 6], count: 4, interval: 1.5 }],
    autoFinish: false, timeLimit: 60, captureNoisy: true, seed: 11,
    bonds: { visiShip: bondOn(true), ursusShip: bondOn(true) },
  });
  const u = h.unit(1);
  const killsOf = (h, u) => h.hooksOf('kill').filter((c) => c.killer === u);
  h.runUntil(() => killsOf(h, u).length >= 4, 50);
  assert.equal(layers(h, 'visiShip'), 16, `远见 = 4 kills × 4 (cap 16), got ${layers(h, 'visiShip')}`);
  assert.equal(layers(h, 'ursusShip'), 16, `乌萨斯 = 4 kills × 4 (cap 16), got ${layers(h, 'ursusShip')}`);
  done(h);
});
