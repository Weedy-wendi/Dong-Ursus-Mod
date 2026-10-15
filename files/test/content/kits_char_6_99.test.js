// test/content/kits_char_6_99.test.js — 早露 (chess_char_6_99, 自定义 6★ 攻城手, tier 6) kit tests:
// form + kit identity (S3 雪崩击 default, heaviest priority, SIE-X on the elite), T1 深入骨髓's def pen on heavy
// enemies, T2 学生楷模's team ATK, S3's harpoon links (bind + forced strikes), and the operator's own effect
// 雪崩攻势 (every 3 total 【乌萨斯】+【精准】 layers → ATK +1/+2 %; 只统计已激活盟约, 2026-10-13 修订).
// Run: node --test test/content/kits_char_6_99.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, enemyRec, checkInvariants } from '../helpers/battleHarness.js';
import { KITS, skillSpecSource } from '../../server/sim/content/index.js';
import { getDefaultSource } from '../../server/sim/simdata.js';
const ds = getDefaultSource();

const A = 'chess_char_6_99_a', B = 'chess_char_6_99_b';
const S3 = 'skchr_poca_3';
const dummy = (key, o = {}) => enemyRec({ key, hp: 1e9, speed: 0, atk: 0, ...o });
const done = (h) => { checkInvariants(h.b); assert.equal(h.b.errors.length, 0, JSON.stringify(h.b.errors[0])); };
const hitsBy = (h, u) => h.hooksOf('damaged').filter((c) => c.source === u);

test('both forms: preset kit hand-authored, S3 雪崩击 is the default skill, 攻城手 heaviest targeting; _b carries SIE-X', () => {
  for (const [id, golden] of [[A, false], [B, true]]) {
    const h = makeBattle({ defs: { enemies: { e_dummy: dummy('e_dummy') } }, units: [{ chessId: id, row: 10, col: 5 }], autoFinish: false, timeLimit: 20 });
    const u = h.unit(1);
    assert.equal(u.def.charId, 'char_197_poca');
    assert.equal(u.skill.id, S3, `${id}: default skill S3 雪崩击`);
    assert.equal(skillSpecSource(ds.getChess(id), KITS), 'kit', `${id}: hand-authored preset kit`);
    assert.equal(u.profile.priority, 'heaviest', `${id}: 攻城手 heaviest first`);
    assert.equal(!!ds.rawChess(id).module?.active, golden, `${id}: module ${golden ? 'SIE-X active' : 'none'}`);
    done(h);
  }
});

test('深入骨髓: her damage to a weight-3 enemy ignores 60 % of its DEF (pot6); a light enemy is not pierced', () => {
  const pen = (mass) => {
      const defs = { enemies: { e_x: dummy('e_x', { mass }) } };
    const h = makeBattle({
      defs, units: [{ chessId: A, row: 10, col: 5 }],
      enemies: [{ key: 'e_x', pos: [9, 7] }], autoFinish: false, timeLimit: 60, captureNoisy: true, seed: 11,
    });
    h.step(1);
    const u = h.unit(1);
    const e = h.enemies()[0];
    h.runUntil(() => hitsBy(h, u).some((c) => c.target === e && c.dmg.isAttack), 30);
    const hit = hitsBy(h, u).find((c) => c.target === e && c.dmg.isAttack);
    return hit.dmg.defIgnorePct ?? 0;
  };
  assert.ok(Math.abs(pen(3) - 0.6) < 1e-6, 'heavy enemy: def pen 0.6');
  assert.equal(pen(1), 0, 'light enemy: no pen');
});

test('学生楷模: every 【乌萨斯学生自治团】 operator of her team holds ATK +10 % (pot6), deployed or not', () => {
  const h = makeBattle({
    defs: { enemies: { e_dummy: dummy('e_dummy') } },
    units: [
      { chessId: A, row: 10, col: 5 },
      { chessId: 'chess_char_1_10_a', row: 10, col: 6 },   // 古米 (student, on the field)
      { chessId: 'chess_char_1_02_a', row: 10, col: 4 },   // 角峰 (kjerag — not a student)
    ],
    autoFinish: false, timeLimit: 20,
  });
  const gummy = h.b.allyUnits.find((x) => x.def?.charId === 'char_196_sunbr');
  const notStudent = h.b.allyUnits.find((x) => x.def?.charId === 'char_102_tianyan') ?? h.unit(3);
  const gb = gummy.findBuff('talent:poca:students');
  assert.ok(gb && Math.abs(gb.mods.atkPct - 0.1) < 1e-6, `student holds +10 %, got ${gb && gb.mods.atkPct}`);
  assert.equal(notStudent.findBuff('talent:poca:students'), null, 'non-student holds nothing');
  done(h);
});

test('S3 雪崩击: the cast harpoon-links the heaviest enemies (bound) and strikes along the links every second', () => {
  const h = makeBattle({
    defs: { enemies: { e_a: dummy('e_a', { mass: 5 }), e_b: dummy('e_b', { mass: 4 }), e_c: dummy('e_c', { mass: 1 }) } },
    units: [{ chessId: A, row: 10, col: 5, carryState: { sp: 999 } }],
    enemies: [{ key: 'e_a', pos: [9, 7] }, { key: 'e_b', pos: [10, 8] }, { key: 'e_c', pos: [9, 2] }],   // e_c out of her (right-facing) 4-3
    autoFinish: false, timeLimit: 60, captureNoisy: true, seed: 13,
  });
  h.step(1);
  const u = h.unit(1);
  h.runUntil(() => h.hooksOf('skillStart').some((c) => c.unit === u), 40);
  h.run(2.5);
  // the two heaviest enemies are linked and bound; the strikes land as her attacks
  const bound = h.enemies().filter((e) => e.findBuff('bind'));
  assert.equal(bound.length, 2, `two harpoon links bind two enemies, got ${bound.length}`);
  const strikes = hitsBy(h, u).filter((c) => c.dmg.isAttack);
  assert.ok(strikes.length >= 3, `the linked enemies take her strikes, got ${strikes.length}`);
  done(h);
});

test('雪崩攻势: 【乌萨斯】+【精准】 layers every 3 → ATK +1 % (normal); 只统计已激活盟约（口径 2026-10-13 修订）', () => {
  const bonds = (ursus, preci) => ({ ursusShip: { count: 3, active: true, tier: 1, layers: ursus }, preciShip: { count: 2, active: true, tier: 1, layers: preci } });
  const atkBuff = (h) => {
    const u = h.unit(1);
    return u.findBuff('talent:poca:avalanche');
  };
  // 7 + 2 = 9 layers → floor(9/3)=3 → +3 %
  const h = makeBattle({
    defs: { enemies: { e_dummy: dummy('e_dummy') } }, units: [{ chessId: A, row: 10, col: 5 }],
    autoFinish: false, timeLimit: 5, bonds: bonds(7, 2),
  });
  h.run(1.2);   // the 0.5 s re-read ticks
  const b = atkBuff(h);
  assert.ok(b && Math.abs(b.mods.atkPct - 0.03) < 1e-6, `9 layers → +3 %, got ${b && b.mods.atkPct}`);
  // 4 + 2 = 6 → +2 %; the bonds need not be active for their layers to count
  const h2 = makeBattle({
    defs: { enemies: { e_dummy: dummy('e_dummy') } }, units: [{ chessId: A, row: 10, col: 5 }],
    autoFinish: false, timeLimit: 5, bonds: { ursusShip: { count: 3, active: false, tier: 0, layers: 4 }, preciShip: { count: 2, active: false, tier: 0, layers: 2 } },
  });
  h2.run(1.2);
  const b2 = atkBuff(h2);
  assert.ok(!b2, `未激活盟约的层数不纳入统计（inactive layers excluded, got ${b2 && b2.mods.atkPct}）`);
  done(h); done(h2);
});
