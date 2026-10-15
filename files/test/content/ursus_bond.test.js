// test/content/ursus_bond.test.js — 乌萨斯核心盟约 (ursusShip, 自定义, 2026-10-15 系数修订) battle tests:
// 3人 — a member's skill start gives every OTHER on-field member an additive ATK stack of +3.6 % + 0.06 % × bond
// layers (accumulated, capped at 54 % + 0.9 % × live layers) and raises the natural SP recovery of the operators on
// the caster's surrounding 8 tiles by 40 % (不叠加 — the highest holds); 6人 — the SP aura 覆盖为 80 % and a member
// carrying 1/2 items deals ×1.75/×2.5 with attacks. Run: node --test test/content/ursus_bond.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, enemyRec, checkInvariants } from '../helpers/battleHarness.js';

const dummy = (key, o = {}) => enemyRec({ key, hp: 1e9, speed: 0, atk: 0, ...o });
const done = (h) => { checkInvariants(h.b); assert.equal(h.b.errors.length, 0, JSON.stringify(h.b.errors[0])); };
const CHAR = { botany: 'char_4223_botany', helage: 'char_188_helage', headb2: 'char_1051_headb2', poca: 'char_197_poca', turdus: 'char_4224_turdus', leto: 'char_194_leto' };
const byChar = (h, charId) => h.b.allyUnits.find((x) => x.def?.charId === charId);
const layers = (h) => h.b.getPlayer('p1')?.bonds?.ursusShip?.layers ?? 0;

test('3人: a member skill start stacks ATK on every OTHER on-field member (the caster excluded)', () => {
  const h = makeBattle({
    defs: { enemies: { e_dummy: dummy('e_dummy') } },
    units: [
      { chessId: 'chess_char_2_98_a', row: 10, col: 4 },
      { chessId: 'chess_char_4_98_a', row: 10, col: 5 },
      { chessId: 'chess_char_6_98_a', row: 10, col: 6 },
    ],
    enemies: [{ key: 'e_dummy', pos: [10, 6] }], autoFinish: false, timeLimit: 120, captureNoisy: true, seed: 41,
    bonds: { ursusShip: { count: 3, active: true, tier: 1, layers: 0 } },
  });
  h.step(1);
  const caster = byChar(h, CHAR.botany);
  h.runUntil(() => h.hooksOf('skillStart').some((c) => c.unit === caster), 110);
  h.run(0.3);
  // the caster gains nothing (「其他【乌萨斯】干员」); the other two hold one stack of 3.6 % + 1 % × L
  // (her 齐鸣 raises the live layers with the same cast, so the exact per-stack value depends on the hook order)
  const casterAtk = caster.findBuff('bond:ursus:atk');
  assert.equal(casterAtk, null, 'the caster holds no ATK stack');
  const L = layers(h);
  for (const who of [CHAR.helage, CHAR.headb2]) {   // the other two fielded members
    const b = byChar(h, who).findBuff('bond:ursus:atk');
    assert.ok(b, `${who}: holds the ATK stack`);
    assert.ok(b.mods.atkPct >= 0.036 - 1e-9 && b.mods.atkPct <= 0.036 + 0.0006 * L + 1e-9,
      `${who}: one start → +3.6 % (+0.06 % × ${L}), got ${b.mods.atkPct}`);
  }
  done(h);
});

test('3人: the stacks accumulate toward the cap 54 % + 0.9 % × live layers', () => {
  const h = makeBattle({
    defs: { enemies: { e_dummy: dummy('e_dummy') } },
    units: [
      { chessId: 'chess_char_2_98_a', row: 10, col: 4 },
      { chessId: 'chess_char_6_99_a', row: 10, col: 5 },
      { chessId: 'chess_char_6_98_a', row: 10, col: 6 },
    ],
    enemies: [{ key: 'e_dummy', pos: [10, 6] }], autoFinish: false, timeLimit: 240, captureNoisy: true, seed: 41,
    bonds: { ursusShip: { count: 3, active: true, tier: 1, layers: 0 } },
  });
  h.step(1);
  const caster = byChar(h, CHAR.botany);
  h.runUntil(() => h.hooksOf('skillStart').filter((c) => c.unit === caster).length >= 4, 240);
  h.run(0.3);
  const L = layers(h);
  const b = byChar(h, CHAR.poca).findBuff('bond:ursus:atk');
  assert.ok(b, 'the stack buff exists');
  // accumulated: every member's skill start (sp凛冬's S2 is an SP_FULL auto-cast at deploy — it counts too) grants
  // 早露 one stack of (3.6 % + 0.06 % × live L); 早露/麒麟R夜刀(被动) never start a skill themselves, and her own
  // 齐鸣 adds ≤8 layers/battle (2026-10-14 cap)
  const poca = byChar(h, CHAR.poca);
  const grants = h.hooksOf('skillStart').filter((c) => c.unit !== poca).length;
  const min = grants * 0.036, max = Math.min(0.54 + 0.009 * L, grants * (0.036 + 0.0006 * 8));
  assert.ok(b.mods.atkPct >= min - 1e-9 && b.mods.atkPct <= max + 1e-9,
    `grants ${grants}: ${b.mods.atkPct} within [${min.toFixed(4)}, ${max.toFixed(4)}] (layers ${L})`);
  done(h);
});

test('3人: the skill start raises the natural SP recovery of the surrounding 8 tiles (40 %, 不叠加), not the caster', () => {
  const h = makeBattle({
    defs: { enemies: { e_dummy: dummy('e_dummy') } },
    units: [
      { chessId: 'chess_char_2_98_a', row: 10, col: 4 },
      { chessId: 'chess_char_4_98_a', row: 10, col: 5 },   // adjacent to the caster
      { chessId: 'chess_char_6_98_a', row: 10, col: 6 },   // two tiles away — outside the ring
    ],
    enemies: [{ key: 'e_dummy', pos: [10, 6] }], autoFinish: false, timeLimit: 240, captureNoisy: true, seed: 41,
    bonds: { ursusShip: { count: 3, active: true, tier: 1, layers: 0 } },
  });
  h.step(1);
  const caster = byChar(h, CHAR.botany);
  const near = byChar(h, CHAR.helage);   // adjacent (col 5 vs 4)
  const far = byChar(h, CHAR.headb2);    // col 6 vs 4 — not in the 8 tiles
  h.runUntil(() => h.hooksOf('skillStart').some((c) => c.unit === caster), 110);
  h.run(0.2);
  assert.equal(caster.findBuff('bond:ursus:sp'), null, 'the caster herself is not in the ring');
  const sp = near.findBuff('bond:ursus:sp');
  assert.ok(sp && Math.abs(sp.mods.spRecoveryFlat - 0.4) < 1e-6, `the adjacent member: SP recovery +0.4/s, got ${sp && sp.mods.spRecoveryFlat}`);
  assert.equal(far.findBuff('bond:ursus:sp'), null, 'two tiles away: outside the ring');
  // a second start must not stack it (不叠加 — one entry, the highest holds)
  h.runUntil(() => h.hooksOf('skillStart').filter((c) => c.unit === caster).length >= 2, 240);
  h.run(0.2);
  const sp2 = near.findBuff('bond:ursus:sp');
  assert.ok(sp2 && Math.abs(sp2.mods.spRecoveryFlat - 0.4) < 1e-6, 'the SP recovery value never stacks');
  done(h);
});

test('6人: a member carrying 1 item deals ×1.75 with attacks (the bond buff), no items → no multiplier', () => {
  const ITEM = 'chess_item_1_01_e_a';
  const fight = (items) => {
    const h = makeBattle({
      defs: { enemies: { e_dummy: dummy('e_dummy') } },
      units: [
        { chessId: 'chess_char_2_98_a', row: 10, col: 4 },
        { chessId: 'chess_char_4_98_a', row: 10, col: 5 },
        { chessId: 'chess_char_6_98_a', row: 10, col: 6 },
        { chessId: 'chess_char_6_99_a', row: 10, col: 3, items: items >= 2 ? [ITEM, ITEM] : items >= 1 ? [ITEM] : [] },   // 早露 — the attacker
        { chessId: 'chess_char_5_98_a', row: 10, col: 2 },
        { chessId: 'chess_char_3_98_a', row: 11, col: 3 },
      ],
      enemies: [{ key: 'e_dummy', pos: [10, 7] }], autoFinish: false, timeLimit: 90, captureNoisy: true, seed: 43,
      bonds: { ursusShip: { count: 3, active: true, tier: 2, layers: 0 } },
    });
    h.step(1);
    const attacker = byChar(h, CHAR.poca);
    const e = h.enemies()[0];
    h.runUntil(() => h.hooksOf('damaged').some((c) => c.source === attacker && c.target === e && c.dmg.isAttack), 60);
    const hit = h.hooksOf('damaged').find((c) => c.source === attacker && c.target === e && c.dmg.isAttack);
    assert.ok(hit, 'the attacker landed within 60 s');
    return attacker.findBuff('bond:ursus:dmg');
  };
  const one = fight(1);
  assert.ok(one && Math.abs(one.mods.dmgDealtMul - 1.75) < 1e-6, `1 item → the bond buff ×1.75, got ${one && one.mods.dmgDealtMul}`);
  const none = fight(0);
  assert.equal(none, null, 'no items → no multiplier buff');
});
