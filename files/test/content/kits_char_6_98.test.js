// test/content/kits_char_6_98.test.js — 怒潮凛冬 (chess_char_6_98, 自定义 6★ 撼地者) kit tests:
// forms + kit identity, the S3 hammers, 汹涌怒火's splash multiplier and 万众巨潮's student aura, and the
// operator's own effect 勇冠三军 (2026-10-13: hits carry an extra true-damage rider of 75 %/150 % of her own max HP).
// Run: node --test test/content/kits_char_6_98.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, enemyRec, checkInvariants } from '../helpers/battleHarness.js';
import { getDefaultSource } from '../../server/sim/simdata.js';
import { KITS, skillSpecSource } from '../../server/sim/content/index.js';

const ds = getDefaultSource();
const raw = (id) => ds.rawChess(id);
const A = 'chess_char_6_98_a', B = 'chess_char_6_98_b';
const S1 = 'skchr_headb2_1', S2 = 'skchr_headb2_2', S3 = 'skchr_headb2_3';
const READY = { sp: 999 };
const IDLE = { sp: 0 };
const dummy = (key, o = {}) => enemyRec({ key, hp: 1e9, speed: 0, atk: 0, ...o });
const ENEMIES = { e_dummy: dummy('e_dummy') };
const done = (h) => { checkInvariants(h.b); assert.equal(h.b.errors.length, 0, JSON.stringify(h.b.errors[0])); };
const dealtTo = (h, u, t) => h.hooksOf('damaged').filter((c) => c.source === u && c.target === t);
const tagged = (h, u, tag) => h.hooksOf('damaged').filter((c) => c.source === u && (c.dmg?.tags || []).includes(tag));
const bondOn = (layers, active = true) => ({ count: 3, active, tier: 1, layers });

test('both forms: the preset kit is hand-authored, S3 is the default skill, hammer splash profile; _b carries HAM-X', () => {
  for (const [id, golden] of [[A, false], [B, true]]) {
    const h = makeBattle({ defs: { enemies: ENEMIES }, units: [{ chessId: id, row: 10, col: 5 }], autoFinish: false, timeLimit: 30 });
    const unit = h.unit(1);
    assert.equal(unit.def.charId, 'char_1051_headb2');
    assert.equal(unit.skill.id, S3, `${id}: default skill S3 无可抵挡`);
    assert.equal(skillSpecSource(ds.getChess(id), KITS), 'kit', `${id}: hand-authored preset kit`);
    assert.equal(unit.profile.splashScale, 0.5, `${id}: hammer 50 % splash`);
    assert.equal(!!ds.rawChess(id).module?.active, golden, `${id}: module ${golden ? 'HAM-X active' : 'none'}`);
    done(h);
  }
  // the loadout records resolve the official skills of the season row (rank 4 normal / rank 7 elite)
  assert.deepEqual(raw(A).skills.map((s) => s.skillId), [S1, S2, S3]);
  assert.equal(raw(A).skill.skillId, S3);
});

test('S3 无可抵挡: five hammers on the tile ahead (skill damage, not a normal attack), over ~7.8 s', () => {
  const h = makeBattle({
    defs: { enemies: ENEMIES }, units: [{ chessId: A, row: 10, col: 5, carryState: READY }],
    enemies: [{ key: 'e_dummy', pos: [10, 6] }], autoFinish: false, timeLimit: 30, captureNoisy: true,
  });
  const u = h.unit(1);
  const e = h.enemies()[0];
  h.runUntil(() => tagged(h, u, 'headb2Hammer').length >= 5, 20);
  const hammers = tagged(h, u, 'headb2Hammer');
  assert.ok(hammers.length >= 5, `five hammers, got ${hammers.length}`);
  assert.ok(hammers.every((c) => c.dmg.isSkill), 'skill damage');
  // the hammers land 1.1 s apart (30 fps clip) — all five inside ~8 s of the cast
  assert.ok(hammers[4].t - hammers[0].t < 9, `hammer span ${hammers[4].t - hammers[0].t}`);
  done(h);
});

test('汹涌怒火: the trait splash of her attacks takes ×damage_scale (1.24), the main target does not', () => {
  const h = makeBattle({
    defs: { enemies: ENEMIES }, units: [{ chessId: A, row: 10, col: 5 }],
    enemies: [{ key: 'e_dummy', pos: [10, 6] }, { key: 'e_dummy', pos: [11, 6] }],
    autoFinish: false, timeLimit: 30, captureNoisy: true, seed: 11,
  });
  h.step(1);
  const u = h.unit(1);
  const main = h.enemies().find((x) => Math.round(x.y) === 10);
  const side = h.enemies().find((x) => Math.round(x.y) === 11);
  h.runUntil(() => dealtTo(h, u, side).length > 0, 30);
  const mainHit = dealtTo(h, u, main).find((c) => c.dmg.isAttack && !c.dmg.isSplash);
  const splash = dealtTo(h, u, side).find((c) => c.dmg.isAttack && c.dmg.isSplash);
  assert.ok(mainHit && splash, 'an attack hit both');
  // captured amount = the raw share (atk × 0.5, no talent); the talent rides dmg.mul (the 汹涌怒火 1.24)
  assert.ok(Math.abs(splash.dmg.amount / mainHit.dmg.amount - 0.5) < 0.02,
    `raw splash share ≈ 0.5 × ATK: ${splash.dmg.amount} vs main ${mainHit.dmg.amount}`);
  assert.ok(Math.abs((splash.dmg.mul ?? 1) - 1.24) < 0.01, `the splash rides ×1.24, got ${splash.dmg.mul}`);
  done(h);
});

test('万众巨潮: while a skill runs every operator gets ATK/DEF +14 %, the 乌萨斯学生自治团 ×2', () => {
  const h = makeBattle({
    defs: { enemies: ENEMIES },
    units: [
      { chessId: A, row: 10, col: 5, carryState: READY },
      { chessId: 'chess_char_1_10_a', row: 10, col: 6 },   // 古米: a 乌萨斯学生自治团 member
      { chessId: 'chess_char_1_02_a', row: 10, col: 4 },   // 角峰: not a student
    ],
    enemies: [{ key: 'e_dummy', pos: [9, 6] }], autoFinish: false, timeLimit: 30, captureNoisy: true,
  });
  const u = h.unit(1);
  h.runUntil(() => h.hooksOf('skillStart').some((c) => c.unit === u), 30);
  const gumo = h.unit(2), yak = h.unit(3);
  const gB = gumo.findBuff('talent:headb2:tide'), yB = yak.findBuff('talent:headb2:tide');
  assert.ok(gB && yB, 'the aura is up on both');
  assert.ok(Math.abs(gB.data.v - 0.36) < 1e-6, `student doubled (pot6 0.18 × 2): ${gB.data.v}`);
  assert.ok(Math.abs(yB.data.v - 0.18) < 1e-6, `non-student (pot6): ${yB.data.v}`);
  done(h);
});

test('勇冠三军 (2026-10-13 修订): her hits carry an extra true-damage rider of 75 % of her own max HP (150 % elite)', () => {
  const mk = (id) => makeBattle({
    defs: { enemies: { e_dummy: dummy('e_dummy', { mass: 3 }) } }, units: [{ chessId: id, row: 10, col: 5 }],
    enemies: [{ key: 'e_dummy', pos: [10, 6] }], autoFinish: false, timeLimit: 30, captureNoisy: true, seed: 5,
  });
  const riderOf = (id) => {
    const h = mk(id);
    h.step(1);
    const u = h.unit(1);
    const e = h.enemies()[0];
    h.runUntil(() => tagged(h, u, 'headb2Rider').some((c) => c.target === e), 30);
    const riders = tagged(h, u, 'headb2Rider').filter((c) => c.target === e);
    return { rider: riders[0].dmg.amount, maxHp: u.s.maxHp, hits: riders.length };
  };
  const a = riderOf(A);
  assert.ok(Math.abs(a.rider - a.maxHp * 0.75) < 0.5, `normal: rider ${a.rider} ≈ 75 % of ${a.maxHp}`);
  const b = riderOf(B);
  assert.ok(Math.abs(b.rider - b.maxHp * 1.5) < 0.5, `elite: rider ${b.rider} ≈ 150 % of ${b.maxHp}`);
});
