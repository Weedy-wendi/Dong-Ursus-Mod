// test/content/kits_char_5_99.test.js — 维伊 (chess_char_5_99, 自定义 6★ 秘术师 → tier 5) kit tests:
// form + kit identity (S3 用赤铁铭记 default, mystic store-energy trait, MSC-Y on the elite), the volley mechanics
// (stored energies / 转置能量 ride the next attack as extra arts hits tagged 'veen'), T2 战争技艺's dot + her
// targeting skip, and the operator's own effect 奥术共鸣 (every 3 total 【乌萨斯】+【奥术】 layers → ATK +1/+2 %).
// Run: node --test test/content/kits_char_5_99.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, enemyRec, checkInvariants } from '../helpers/battleHarness.js';
import { KITS, skillSpecSource } from '../../server/sim/content/index.js';
import { getDefaultSource } from '../../server/sim/simdata.js';
const ds = getDefaultSource();

const A = 'chess_char_5_99_a', B = 'chess_char_5_99_b';
const S3 = 'skchr_veen_3';
const dummy = (key, o = {}) => enemyRec({ key, hp: 1e9, speed: 0, atk: 0, ...o });
const ENEMIES = { e_dummy: dummy('e_dummy') };
const done = (h) => { checkInvariants(h.b); assert.equal(h.b.errors.length, 0, JSON.stringify(h.b.errors[0])); };
const veenHits = (h, u) => h.hooksOf('damaged').filter((c) => c.source === u && (c.dmg?.tags || []).includes('veen'));

test('both forms: preset kit hand-authored, S3 用赤铁铭记 is the default skill, 秘术师 arts; _b carries MSC-Y', () => {
  for (const [id, golden] of [[A, false], [B, true]]) {
    const h = makeBattle({ defs: { enemies: { e_dummy: dummy('e_dummy') } }, units: [{ chessId: id, row: 10, col: 5 }], autoFinish: false, timeLimit: 20 });
    const u = h.unit(1);
    assert.equal(u.def.charId, 'char_4226_veen');
    assert.equal(u.skill.id, S3, `${id}: default skill S3`);
    assert.equal(skillSpecSource(ds.getChess(id), KITS), 'kit', `${id}: hand-authored preset kit`);
    assert.equal(u.dmgType, 'arts', `${id}: 秘术师法伤`);
    assert.equal(typeof u.profile.storeEnergy, 'function', `${id}: the mystic store`);
    assert.equal(!!ds.rawChess(id).module?.active, golden, `${id}: module ${golden ? 'MSC-Y active' : 'none'}`);
    done(h);
  }
});

test('the volley: stored energies ride her next attack as extra arts hits, each carrying 战争技艺', () => {
  // she stores while no enemy is in range, then one enters: the first attack releases the volley (multi-hit)
  const h = makeBattle({
    defs: { enemies: { e_far: dummy('e_far', { hp: 1e9, speed: 0 }), e_dummy: dummy('e_dummy') } },
    units: [{ chessId: A, row: 10, col: 5 }],
    enemies: [{ key: 'e_far', pos: [10, 2] }],   // out of her (right-facing) 3-14 range
    autoFinish: false, timeLimit: 90, captureNoisy: true, seed: 21,
  });
  const u = h.unit(1);
  h.run(8);   // store a few energies with no valid target
  h.spawn('e_dummy', { pos: [10, 8] });
  h.step(1);
  const e = h.enemies().find((x) => String(x.defId || '').endsWith('e_dummy'));
  h.runUntil(() => veenHits(h, u).some((c) => c.target === e), 30);
  const volley = veenHits(h, u).filter((c) => c.target === e);
  assert.ok(volley.length >= 2, `the volley lands as several veen hits, got ${volley.length}`);
  h.run(2.5);   // the 战争技艺 dot ticks at its 1 s interval
  const marks = h.hooksOf('damaged').filter((c) => c.source === u && (c.dmg?.tags || []).includes('veenWar'));
  assert.ok(marks.length >= 1, 'each hit carries 战争技艺 (the dot lands)');
  done(h);
});

test('战争技艺: she never picks a marked enemy — with only a marked one in range she holds her fire (stores)', () => {
  const h = makeBattle({
    defs: { enemies: { e_dummy: dummy('e_dummy') } }, units: [{ chessId: A, row: 10, col: 5 }],
    enemies: [{ key: 'e_dummy', pos: [10, 7] }], autoFinish: false, timeLimit: 30, captureNoisy: true, seed: 23,
  });
  h.step(1);
  const u = h.unit(1);
  const e = h.enemies()[0];
  h.runUntil(() => veenHits(h, u).some((c) => c.target === e), 30);   // her first hit marks the target (战争技艺)
  assert.ok(e.findBuff('veen:war:' + u.id), 'the hit leaves the 战争技艺 mark');
  assert.equal(u.profile.canAttack(h.b, u), false, 'with only the marked enemy in range she holds her fire (stores instead)');
  done(h);
});

test('奥术共鸣: 【乌萨斯】+【奥术】 layers every 3 → ATK +1 % (normal); 只统计已激活盟约（口径 2026-10-13 修订）', () => {
  const mk = (bonds) => makeBattle({
    defs: { enemies: { e_dummy: dummy('e_dummy') } }, units: [{ chessId: A, row: 10, col: 5 }],
    autoFinish: false, timeLimit: 5, bonds,
  });
  const h = mk({ ursusShip: { count: 3, active: true, tier: 1, layers: 5 }, arcaneShip: { count: 2, active: true, tier: 1, layers: 4 } });
  h.run(1.2);
  const b = h.unit(1).findBuff('talent:veen:resonance');
  assert.ok(b && Math.abs(b.mods.atkPct - 0.03) < 1e-6, `9 layers → +3 %, got ${b && b.mods.atkPct}`);
  const h2 = mk({ ursusShip: { count: 3, active: false, tier: 0, layers: 6 }, arcaneShip: { count: 2, active: false, tier: 0, layers: 0 } });
  h2.run(1.2);
  const b2 = h2.unit(1).findBuff('talent:veen:resonance');
  assert.ok(!b2, '未激活盟约的层数不纳入统计（inactive layers excluded）');
  done(h); done(h2);
});
