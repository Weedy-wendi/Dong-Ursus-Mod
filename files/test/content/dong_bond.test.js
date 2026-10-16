// test/content/dong_bond.test.js — 【东】核心盟约 (dongShip, 自定义, 2026-10-17 公式修订) battle tests:
// 3人 — 成员的每次伤害 ×(1 + 45% + 0.6% × 盟约层数) × (1 + 0.3% × 自身已损失生命比例)：
// 层数与已损失生命比例都在**每次命中时**实时读取（谢拉格同型 hit 钩子）；非成员不吃加成。
// 文案与参数在 tools/custom-content.mjs 的 BONDS.dongShip（bb.dmg_base / dmg_per_layer / dmg_per_lost_hp）。
// Run: node --test test/content/dong_bond.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec, enemyRec, checkInvariants } from '../helpers/battleHarness.js';
import { bondBb } from '../../server/sim/content/bonds/core.js';

const close = (a, b, eps = 1e-6, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} expected ${b}, got ${a}`);
const op = (id, bonds) => chessRec({
  id, bonds, profession: 'WARRIOR', skill: null,
  stats: { atk: 1000, maxHp: 10000, def: 0, blockCnt: 2 },
});
const dummy = enemyRec({ key: 'e_dummy', hp: 1e8, speed: 0, atk: 0, def: 0, res: 0 });
const bondOn = (count, layers = 0, thresholds = [3, 6]) => ({
  count, active: count >= thresholds[0], tier: thresholds.filter((t) => count >= t).length, layers,
});
const defsOf = (list) => {
  const chess = {};
  for (const [id, bonds] of list) chess[id] = op(id, bonds);
  return { chess, enemies: { e_dummy: dummy } };
};

test('东 3人: members deal ×(1 + 45% + 0.6%×层数) × (1 + 0.3%×已损失生命比例) per hit (2026-10-17 公式修订)', () => {
  const bb = bondBb('dongShip');
  assert.equal(bb.dmg_base, 0.45, '伤害基础 45%');
  assert.equal(bb.dmg_per_layer, 0.006, '每层 +0.6%');
  assert.equal(bb.dmg_per_lost_hp, 0.003, '每损失 1% 生命 +0.3%');
  assert.equal(bb.dmg_disp_base, 1.45, '显示键 = 1 + 基础（effectDesc「提升至{0:0%}」）');
  const h = makeBattle({
    defs: defsOf([['d1_a', ['dongShip']], ['d2_a', ['dongShip']], ['d3_a', ['dongShip']], ['n1_a', ['preciShip']]]),
    units: [
      { chessId: 'd1_a', row: 10, col: 3 }, { chessId: 'd2_a', row: 10, col: 4 }, { chessId: 'd3_a', row: 10, col: 5 },
      { chessId: 'n1_a', row: 11, col: 3 },
    ],
    enemies: [{ key: 'e_dummy', pos: [10, 6] }],
    autoFinish: false, timeLimit: 60, captureNoisy: true, bonds: { dongShip: bondOn(3, 10) },
  });
  h.step(1);
  const a = h.unit('d1_a'), n = h.unit('n1_a');
  const e = h.enemies()[0];
  /** 期望倍率：层数 L、已损失生命百分比 lostPct。 */
  const mul = (L, lostPct) => (1 + 0.45 + 0.006 * L) * (1 + 0.003 * lostPct);

  // 满血：已损失生命比例 0 → 只吃 (1+45%+0.6%×10)
  close(h.b.dealDamage(a, e, { amount: 1000, type: 'true' }), 1000 * mul(10, 0), 1e-6, '满血：×(1+45%+0.6%×10)');
  // 掉到 40% 血：比例实时参与 → ×(1+0.3%×60)
  a.hp = a.s.maxHp * 0.4;
  close(h.b.dealDamage(a, e, { amount: 1000, type: 'true' }), 1000 * mul(10, 60), 1e-6, '损失 60% 生命：×(1+45%+0.6%×10)×(1+0.3%×60)');
  // 层数也是每次命中实时读取
  h.b.addLayers('p1', 'dongShip', 20, 'test');
  close(h.b.dealDamage(a, e, { amount: 1000, type: 'true' }), 1000 * mul(30, 60), 1e-6, '实时层数 30');
  // 非【东】干员不吃加成
  close(h.b.dealDamage(n, e, { amount: 1000, type: 'true' }), 1000, 1e-6, '非【东】干员：无加成');
  checkInvariants(h.b);
  assert.equal(h.b.errors.length, 0, JSON.stringify(h.b.errors[0]));
});

test('东 3人: 未激活的【东】不提供加成（active 守卫）', () => {
  const h = makeBattle({
    defs: defsOf([['d1_a', ['dongShip']], ['d2_a', ['dongShip']], ['d3_a', ['dongShip']]]),
    units: [{ chessId: 'd1_a', row: 10, col: 3 }, { chessId: 'd2_a', row: 10, col: 4 }, { chessId: 'd3_a', row: 10, col: 5 }],
    enemies: [{ key: 'e_dummy', pos: [10, 6] }],
    autoFinish: false, timeLimit: 60, captureNoisy: true, bonds: { dongShip: bondOn(3, 10, [4]) },   // count 3 < 4 → inactive
  });
  h.step(1);
  const a = h.unit('d1_a'), e = h.enemies()[0];
  close(h.b.dealDamage(a, e, { amount: 1000, type: 'true' }), 1000, 1e-6, '未激活：无加成');
  checkInvariants(h.b);
  assert.equal(h.b.errors.length, 0, JSON.stringify(h.b.errors[0]));
});
