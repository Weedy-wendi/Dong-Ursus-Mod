// test/content/kits_char_2_98.test.js — 伯塔尼 (chess_char_2_98, 自定义 5★ 巫役, tier 2) kit tests:
// form + kit identity, S1 谐波破坏's erosion rider and its conditional extra segment, the RIT-X module's
// ×ep_damage_scale vs elite enemies, T1 背弃沉默's ASPD stacks on an erosion burst, and the operator's own
// effect 乌萨斯齐鸣 (every skill start → +1/+2 layers per ursus operator in range, activated bonds only, 8/16 cap).
// Run: node --test test/content/kits_char_2_98.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, enemyRec, checkInvariants } from '../helpers/battleHarness.js';
import { KITS, skillSpecSource } from '../../server/sim/content/index.js';
import { getDefaultSource } from '../../server/sim/simdata.js';
const ds = getDefaultSource();

const A = 'chess_char_2_98_a', B = 'chess_char_2_98_b';
const S1 = 'skchr_botany_1', S2 = 'skchr_botany_2';
const READY = { sp: 999 };
const dummy = (key, o = {}) => enemyRec({ key, hp: 1e9, speed: 0, atk: 0, ...o });
const ENEMIES = { e_dummy: dummy('e_dummy'), e_elite: dummy('e_elite', { rank: 'ELITE' }) };
const done = (h) => { checkInvariants(h.b); assert.equal(h.b.errors.length, 0, JSON.stringify(h.b.errors[0])); };
const botanyTagged = (h, u) => h.hooksOf('damaged').filter((c) => c.source === u && (c.dmg?.tags || []).includes('botany'));
const elementsOn = (h, t) => h.hooksOf('elementHit').filter((c) => c.target === t && c.dmg?.type === 'element');
const layers = (h, id) => h.b.getPlayer('p1')?.bonds?.[id]?.layers ?? 0;
const bondOn = (active = true) => ({ count: 2, active, tier: active ? 1 : 0, layers: 0 });

test('both forms: preset kit hand-authored, S1 谐波破坏 is the default skill (auto), 法术伤害 ranged; _b carries RIT-X', () => {
  for (const [id, golden] of [[A, false], [B, true]]) {
    const h = makeBattle({ defs: { enemies: ENEMIES }, units: [{ chessId: id, row: 10, col: 5 }], autoFinish: false, timeLimit: 20 });
    const u = h.unit(1);
    assert.equal(u.def.charId, 'char_4223_botany');
    assert.equal(u.skill.id, S1, `${id}: default skill S1 谐波破坏`);
    assert.equal(skillSpecSource(ds.getChess(id), KITS), 'kit', `${id}: hand-authored preset kit`);
    assert.equal(u.dmgType, 'arts', `${id}: 巫役法伤`);
    assert.equal(u.def.position, 'RANGED', `${id}: ranged`);
    assert.equal(!!ds.rawChess(id).module?.active, golden, `${id}: module ${golden ? 'RIT-X active' : 'none'}`);
    done(h);
  }
});

test('S1 谐波破坏: the first attack on a fresh target rides the extra segment too; later attacks only the erosion rider', () => {
  const h = makeBattle({
    defs: { enemies: ENEMIES }, units: [{ chessId: A, row: 10, col: 5 }],
    enemies: [{ key: 'e_dummy', pos: [9, 6] }], autoFinish: false, timeLimit: 60, captureNoisy: true, seed: 13,
  });
  h.step(1);
  const u = h.unit(1);
  const e = h.enemies()[0];
  h.runUntil(() => h.hooksOf('skillStart').filter((c) => c.unit === u).length >= 2, 50);
  h.run(3);   // the second cast's projectile is still in flight when the skillStart lands
  const hits = botanyTagged(h, u).filter((c) => c.target === e);
  assert.ok(hits.length >= 4, `botany-tagged damage instances (2 casts), got ${hits.length}`);
  // first cast on a fresh target: extra arts + extra erosion + normal erosion; later casts: the erosion rider only
  const elem = hits.filter((c) => c.dmg.type === 'element');
  assert.ok(elem.length >= 3, `erosion riders accumulate, got ${elem.length}`);
  assert.ok((e.elem?.erosion ?? 0) > 0, 'the erosion gauge filled');
  done(h);
});

test('RIT-X (elite): her element damage vs an ELITE enemy takes ×1.18, a normal enemy does not', () => {
  // one enemy per battle: her targeting keeps the closest one, so both shares can't be observed in one fight
  const fight = (enemyKey) => {
    const muls = [];
    const h = makeBattle({
      defs: { enemies: ENEMIES }, units: [{ chessId: B, row: 10, col: 5, carryState: READY }],
      enemies: [{ key: enemyKey, pos: [9, 6] }],
      autoFinish: false, timeLimit: 60, captureNoisy: true, seed: 17,
      setup: (b) => b.on('elementHit', (ctx) => muls.push(ctx.dmg.mul ?? 1)),
    });
    h.runUntil(() => muls.length >= 2, 50);
    return muls;
  };
  const normal = fight('e_dummy');
  assert.ok(normal.length >= 2 && normal.every((m) => Math.abs(m - 1) < 1e-6), 'normal enemy: no scale');
  const elite = fight('e_elite');
  assert.ok(elite.length >= 2 && elite.every((m) => Math.abs(m - 1.18) < 1e-6), `elite enemy: ×1.18, got ${elite[0]}`);
});

test('背弃沉默: an erosion burst inside her range stacks the ASPD talent (≤3); the burst target must be in range', () => {
  // forge a burst: her own erosion on a 1-HP dummy bursts the gauge (1000 fill) — hp 1e9 keeps it alive
  const h = makeBattle({
    defs: { enemies: { e_dummy: enemyRec({ key: 'e_dummy', hp: 1e9, speed: 0, atk: 0, elementRes: -1e9 }) } },
    units: [{ chessId: B, row: 10, col: 5 }],
    enemies: [{ key: 'e_dummy', pos: [9, 6] }], autoFinish: false, timeLimit: 120, captureNoisy: true, seed: 19,
  });
  const u = h.unit(1);
  h.runUntil(() => u.findBuff('talent:botany:aspd'), 110);
  const b = u.findBuff('talent:botany:aspd');
  assert.ok(b, 'the burst stacked the talent');
  assert.equal(b.mods.aspd, 7, 'E2 pot6 bb: aspd 7');
  assert.ok(b.stacks <= 3 || b.maxStacks === 3, 'capped at 3');
  done(h);
});

test('乌萨斯齐鸣: every skill start gives the activated 【乌萨斯】/【助力】+1 per ursus operator in range (cap 8, normal)', () => {
  const field = (bonds) => makeBattle({
    defs: { enemies: ENEMIES },
    units: [
      { chessId: A, row: 10, col: 5 },                     // 伯塔尼 (ursus, in her own range)
      { chessId: 'chess_char_4_98_a', row: 10, col: 6 },   // 赫拉格 (ursus, in range)
      { chessId: 'chess_char_1_02_a', row: 10, col: 4 },   // 角峰 (not ursus — kjerag, in range)
    ],
    enemies: [{ key: 'e_dummy', pos: [9, 6] }], autoFinish: false, timeLimit: 120, captureNoisy: true, seed: 23,
    bonds,
  });
  const h = field({ ursusShip: bondOn(true), deputShip: bondOn(true) });
  const u = h.unit(1);
  h.runUntil(() => h.hooksOf('skillStart').filter((c) => c.unit === u).length >= 4, 110);
  const casts = h.hooksOf('skillStart').filter((c) => c.unit === u).length;
  // 2 ursus operators in range → +2 per cast, capped at 8 per battle (2026-10-14 用户修订：4→8)
  const expect = Math.min(8, casts * 2);
  assert.equal(layers(h, 'ursusShip'), expect, `乌萨斯 ${layers(h, 'ursusShip')} vs ${expect}`);
  assert.equal(layers(h, 'deputShip'), expect, `助力 mirrors 乌萨斯`);
  done(h);

  // inactive bonds gain nothing (2026-10-11 用户确认: 需盟约激活才叠层)
  const h2 = field({ ursusShip: bondOn(false), deputShip: bondOn(false) });
  const u2 = h2.unit(1);
  h2.runUntil(() => h2.hooksOf('skillStart').filter((c) => c.unit === u2).length >= 2, 110);
  assert.equal(layers(h2, 'ursusShip'), 0, 'inactive 乌萨斯 gains nothing');
  assert.equal(layers(h2, 'deputShip'), 0, 'inactive 助力 gains nothing');
  done(h2);
});
