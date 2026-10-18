// test/content/rim_bond.test.js — 雷姆必拓核心盟约 (rimBillitonShip, 自定义, 2026-10-16 实装计划 §3.1) tests:
// 3人 — members ATK +(20 % + 0.8 % × bond layers, 直接乘算, live layers); prep milestone — every 25 layers →
// 1 rim operator of tier ≤ the dispatch centre level, paid only while active (catch-up like the 维多利亚 hammers),
// NOT doubled by 投资人 (a bond milestone, not an investRepeat gain); 6人 (2026-10-17 user revision) — a skill
// start grants 20 s of stealth and every on-field member raises the attack damage by 30 % (dmgDealtMul = 1+0.3×n, 2026-10-17 second revision 40%→30%);
// 9人 — the stealth lasts 40 s instead + a 10 s ATK +200 % window on the skill start (replace, not stack).
// Run: node --test test/content/rim_bond.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec, enemyRec, checkInvariants } from '../helpers/battleHarness.js';
import { bondBb, registerMeta as coreRegisterMeta } from '../../server/sim/content/bonds/core.js';
import { createRegistry } from '../../server/match/effectsMeta.js';
import { makeMatch, DATA, give, legalTileFor } from '../match/harness.js';

const close = (a, b, eps = 1e-6, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} expected ${b}, got ${a}`);
const op = (id, bonds, extra = {}) => chessRec({
  id, bonds, profession: 'WARRIOR', skill: null, ...extra,
  stats: { atk: 1000, maxHp: 10000, def: 0, blockCnt: 2, ...(extra.stats || {}) },
});
const bondOn = (count, layers = 0, tier = null, thresholds = [3, 6, 9]) => ({
  count, active: count >= thresholds[0], tier: tier ?? thresholds.filter((t) => count >= t).length, layers,
});
const dummy = enemyRec({ key: 'e_dummy', hp: 1e8, speed: 0, def: 0, res: 0 });
const buffOf = (u, key) => u.buffs.find((b) => b.key === key) ?? null;

function lineup(ids, row = 10, col = 3) {
  return ids.map((chessId, i) => ({ chessId, row: row + Math.floor(i / 7), col: col + (i % 7) }));
}
function defsOf(list) {
  const chess = {};
  for (const [id, bonds] of list) chess[id] = op(id, bonds);
  return { chess, enemies: { e_dummy: dummy } };
}

// 加籍三名（PR1 的全部成员；官方池内棋子）。
const MEMBERS = ['chess_char_3_02_a', 'chess_char_4_14_a', 'chess_char_4_06_a']; // 断崖/莱恩哈特/寒芒克洛丝

// ---------------------------------------------------------------------------------------------------------------------
// 3人: ATK

test('雷姆必拓 3人: members ATK +(20%+0.5%×L), live layers; non-members unchanged', () => {
  const bb = bondBb('rimBillitonShip');
  close(bb.atk_base, 0.2);
  close(bb.atk_per_layer, 0.005);
  const defs = defsOf([['r1_a', ['rimBillitonShip']], ['r2_a', ['rimBillitonShip']], ['r3_a', ['rimBillitonShip']], ['none_a', ['preciShip']]]);
  const h = makeBattle({
    defs, units: lineup(['r1_a', 'r2_a', 'r3_a', 'none_a']),
    bonds: { rimBillitonShip: bondOn(3, 10) },
  });
  h.step(1);
  close(h.unit('r1_a').s.atk, 1000 * (1 + 0.2 + 0.005 * 10));
  close(h.unit('r3_a').s.atk, 1000 * (1 + 0.2 + 0.005 * 10));
  close(h.unit('none_a').s.atk, 1000);
  h.b.addLayers('p1', 'rimBillitonShip', 20, 'test');
  h.step(2);
  close(h.unit('r2_a').s.atk, 1000 * (1 + 0.2 + 0.005 * 30), 1e-9, 'live layers');
  checkInvariants(h.b);
});

// ---------------------------------------------------------------------------------------------------------------------
// 6人: ASPD per on-field member (PR1 只有 3 名成员，用 harness 的 count 拉满 6 人档)

test('雷姆必拓 6人: skill start grants 20 s stealth; attack damage ×(1+0.3×on-field members), live count', () => {
  const defs = defsOf([['r1_a', ['rimBillitonShip']], ['r2_a', ['rimBillitonShip']], ['r3_a', ['rimBillitonShip']]]);
  const h = makeBattle({
    defs, units: lineup(['r1_a', 'r2_a', 'r3_a']),
    bonds: { rimBillitonShip: bondOn(6, 0, 2) },
  });
  h.step(1);
  // the damage buff: 3 on field → ×1.9
  for (const id of ['r1_a', 'r2_a', 'r3_a']) {
    const b = buffOf(h.unit(id), 'bond:rim:dmg');
    assert.ok(b, `${id}: holds the damage buff`);
    close(b.mods.dmgDealtMul, 1.9);
  }
  // a member leaving the field drops the count (the 1 s poll): knock r3 out by hand
  h.unit('r3_a').alive = false;
  h.run(1.1);
  close(buffOf(h.unit('r1_a'), 'bond:rim:dmg').mods.dmgDealtMul, 1.6, 1e-9, 'the poll drops a fallen member');
  // skill start → 20 s stealth (the 6-tier duration)
  const u = h.unit('r1_a');
  h.b.emit('skillStart', { unit: u, skill: { kind: 'normal' } });
  const stealth = buffOf(u, 'bond:rim:stealth');
  assert.ok(stealth, 'the skill start grants the stealth buff');
  assert.equal(stealth.duration > 19 && stealth.duration <= 20, true, `20 s window, got ${stealth.duration}`);
  assert.ok(u.s.flags.stealth, 'the stealth flag is on');
  checkInvariants(h.b);
});

// ---------------------------------------------------------------------------------------------------------------------
// 9人: stealth on deploy + refreshable skill damage window

test('雷姆必拓 9人: skill start stealth lasts 40 s and opens an ATK +200 % window that refreshes (replace, not stack)', () => {
  const h = makeBattle({
    defs: { enemies: { e_dummy: dummy } },
    units: lineup(MEMBERS),
    bonds: { rimBillitonShip: bondOn(9, 0, 3) },
  });
  h.step(1);
  const u = h.unit('chess_char_3_02_a');
  assert.ok(!buffOf(u, 'bond:rim:stealth'), 'no stealth on deployment (the stealth moved to the skill start)');
  // skill start → 40 s stealth (the 9-tier upgrade over the 20 s of the 6 tier) + the ATK window
  h.b.emit('skillStart', { unit: u, skill: { kind: 'normal' } });
  const stealth = buffOf(u, 'bond:rim:stealth');
  assert.ok(stealth, 'the skill start grants the stealth buff');
  assert.equal(stealth.duration > 39 && stealth.duration <= 40, true, `40 s window, got ${stealth.duration}`);
  assert.ok(u.s.flags.stealth, 'the stealth flag is on');
  let win = buffOf(u, 'bond:rim:skill');
  assert.ok(win && Math.abs(win.mods.atkPct - 2) < 1e-9, `ATK +200 % window, got ${win && win.mods.atkPct}`);
  h.run(3);
  h.b.emit('skillStart', { unit: u, skill: { kind: 'normal' } });
  win = buffOf(u, 'bond:rim:skill');
  const wins = u.buffs.filter((b) => b.key === 'bond:rim:skill');
  assert.equal(wins.length, 1, 'the window is replaced, not stacked');
  assert.ok(win.duration > 9, `refreshed to a fresh 10 s, got ${win.duration}`);
  // the 6-tier damage buff still applies (3 members on field → ×2.2)
  close(buffOf(u, 'bond:rim:dmg').mods.dmgDealtMul, 1.9);
  checkInvariants(h.b);
});

// ---------------------------------------------------------------------------------------------------------------------
// prep milestone: every 25 layers → 1 rim operator (real match, the 维多利亚 hammers shape)

test('雷姆必拓 milestone: every 25 layers → 1 rim operator, only while active (catch-up), not doubled by 投资人', () => {
  // only the core bond meta: no 获得时 garrisons muddying the chess count
  const reg = createRegistry({ content: false });
  coreRegisterMeta(reg);
  // seed 1: the random bond bans (drawDisabledBonds, 5+5) must leave the rim members in the pool — seed 5 draws
  // rimBillitonShip and its members' other bonds, banning all three (the PR3 restore guarantee addresses this).
  const h = makeMatch({ mode: 'solo', seed: 1, registry: reg, fake: true }).start();
  h.toPrep(1);
  const ps = h.ps('p_0');
  for (const p of [...ps.board.values(), ...ps.hand.filter(Boolean)]) if (p.kind === 'chess') ps.returnCopies(p);
  ps.board.clear();
  ps.hand.fill(null);
  ps.temp.fill(null);
  ps.recompute();
  // the pool holds the three PR1 rim members (the shared pool's official chess); counted in pool copies — duplicate
  // grants merge into an elite (3 normals → 1 golden piece holding 3 copies), so a piece count would under-count
  const isRim = (p) => p && p.kind === 'chess' && Array.isArray(DATA.chess[p.id]?.bonds) && DATA.chess[p.id].bonds.includes('rimBillitonShip');
  const rim = () => [...ps.board.values(), ...ps.hand.filter(Boolean), ...ps.temp].filter(isRim)
    .reduce((n, p) => n + (p.poolCopies || 0), 0);
  assert.equal(ps.bonds.rimBillitonShip?.active ?? false, false);
  ps.addLayers('rimBillitonShip', 26);          // "无需激活" gains while inactive: milestone 25 is owed
  for (const id of MEMBERS) give(h.m, ps, id, 'board', legalTileFor(h.m, ps, id));
  assert.equal(ps.bonds.rimBillitonShip.active, true);
  ps.shop.level = 4;                            // tier cap: the PR1 members are t3/t4 — a level-1 shop admits none
  const base = rim();                           // the 3 activated members themselves
  assert.equal(rim(), base, 'inactive: no operator granted');
  h.m.dispatch(ps, 'onPrepStart', { round: h.m.round });
  assert.equal(rim(), base + 1, 'caught up once active (26 layers → 1)');
  assert.equal(ps.counters['bond:rim:recruits'], 1);
  h.m.dispatch(ps, 'onPrepEnd', { round: h.m.round });
  ps.addLayers('rimBillitonShip', 24);          // 50
  h.m.dispatch(ps, 'onBuy', {});                // any hook pays it
  assert.equal(rim(), base + 2, 'milestone 50 paid');
  assert.equal(ps.counters['bond:rim:recruits'], 2);
  // the granted operators are rim members of tier ≤ the dispatch centre level (solo shop level 6 here)
  for (const p of [...ps.board.values(), ...ps.hand.filter(Boolean), ...ps.temp]) {
    if (!isRim(p)) continue;
    assert.ok(DATA.chess[p.id].tier <= 6, `${p.id}: tier ≤ shop level`);
  }
  // 投资人不翻倍里程碑 (2026-10-16 用户口径): with 投资人 active the onGain handlers run ×2, but the milestone's
  // own counter is re-read per payment — a milestone pays exactly its 1 operator, never 2. (The granted operator's
  // own 「获得时」 traits DO fire ×2 — engine-generic investRepeat dispatch on the grant's onGain, not rim code.)
  ps.bonds.investShip = { active: true, layers: 0 };
  ps.addLayers('rimBillitonShip', 25);          // 75
  h.m.dispatch(ps, 'onPrepStart', { round: h.m.round });
  assert.equal(rim(), base + 3, 'milestone 75 paid exactly once despite 投资人');
  assert.equal(ps.counters['bond:rim:recruits'], 3, 'no double payment from the ×2 dispatch');
  h.invariants();
  h.m.dispose();
});
