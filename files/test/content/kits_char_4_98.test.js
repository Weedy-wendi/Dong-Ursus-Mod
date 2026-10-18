// test/content/kits_char_4_98.test.js — 赫拉格 (chess_char_4_98, 自定义 6★ 武者, tier 4) kit tests:
// form + kit identity, the musha trait heal, T1 月盈星亏's berserk ASPD, and the operator's own effect
// 老将刀意：2026-10-18 用户修订 → <休整期开始时>使已激活的【乌萨斯】【远见】+8/16，移交 garrisons_meta.test.js（旧战斗侧击杀测试移除）
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

