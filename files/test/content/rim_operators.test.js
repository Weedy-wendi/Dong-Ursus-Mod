// test/content/rim_operators.test.js — 雷姆必拓 PR2 的 7 名新干员（暴行/火哨/蜜莓/黑/时隙/珊比/莱伊）kit smoke:
// both forms deploy with the right charId / default skill / hand-authored kit; the two layer-reading traits
// (黑 garrison_996 / 莱伊 garrison_999) react to bond layers; every default skill casts without engine errors.
// Run: node --test test/content/rim_operators.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeBattle, enemyRec, checkInvariants } from '../helpers/battleHarness.js';
import { KITS, skillSpecSource } from '../../server/sim/content/index.js';
import { getDefaultSource } from '../../server/sim/simdata.js';

const ds = getDefaultSource();
const dummy = (key, o = {}) => enemyRec({ key, hp: 1e9, speed: 0, atk: 0, ...o });
const ENEMIES = { e_dummy: dummy('e_dummy', { hp: 1e9, res: 0 }) };
const done = (h) => { checkInvariants(h.b); assert.equal(h.b.errors.length, 0, JSON.stringify(h.b.errors[0])); };
const rimBonds = (active = true, layers = 0) => ({ count: 3, active, tier: active ? 1 : 0, layers });

const OPS = [
  ['chess_char_1_96_a', 'chess_char_1_96_b', 'char_230_savage', 'skchr_savage_2'],   // 暴行 微差爆破
  ['chess_char_2_96_a', 'chess_char_2_96_b', 'char_493_firwhl', 'skchr_firwhl_2'],   // 火哨 焦土
  ['chess_char_3_95_a', 'chess_char_3_95_b', 'char_449_glider', 'skchr_glider_2'],   // 蜜莓 振奋
  ['chess_char_5_96_a', 'chess_char_5_96_b', 'char_340_shwaz', 'skchr_shwaz_2'],     // 黑 暮眼锐瞳
  ['chess_char_5_95_a', 'chess_char_5_95_b', 'char_4236_tmslot', 'skchr_tmslot_2'],  // 时隙 科技与传统仪式
  ['chess_char_6_96_a', 'chess_char_6_96_b', 'char_4235_thumpy', 'skchr_thumpy_2'],  // 珊比 慢慢走~
  ['chess_char_6_95_a', 'chess_char_6_95_b', 'char_4117_ray', 'skchr_ray_2'],        // 莱伊 S2
];

test('both forms of all 7 雷姆必拓 operators: identity, hand-authored kit, default skill = the signature S2', () => {
  for (const [a, b, charId, skillId] of OPS) {
    for (const [id, golden] of [[a, false], [b, true]]) {
      const h = makeBattle({ defs: { enemies: ENEMIES }, units: [{ chessId: id, row: 10, col: 5 }], autoFinish: false, timeLimit: 20 });
      const u = h.unit(1);
      assert.equal(u.def.charId, charId, `${id}: charId`);
      assert.equal(u.skill.id, skillId, `${id}: default skill`);
      assert.equal(skillSpecSource(ds.getChess(id), KITS), 'kit', `${id}: hand-authored preset kit`);
      assert.equal(!!ds.rawChess(id).module?.active, golden, `${id}: module ${golden ? 'on the elite' : 'none'}`);
      done(h);
    }
  }
});

test('garrison_996 (黑): each kill grants +3/+6 layers to EVERY ACTIVE bond of her player; cap 5 triggers per battle (owner decision 2026-10-18); inactive bonds do not count', () => {
  const act = (layers) => ({ count: 3, active: true, tier: 1, layers });
  const field = (golden, bs) => makeBattle({
    defs: { enemies: ENEMIES },
    bonds: bs,
    units: [{ chessId: golden ? 'chess_char_5_96_b' : 'chess_char_5_96_a', row: 10, col: 5 }],
    autoFinish: false, timeLimit: 30, seed: 7,
  });
  const layersOf = (h, id) => h.b.getPlayer(h.unit(1).ownerId).bonds[id].layers;
  const killN = (h, n) => {
    h.step(1);
    for (let i = 0; i < n; i++) h.b.kill(h.spawn('e_dummy', { pos: [12, 6] }), h.unit(1));
  };
  // 7 kills: the first 5 trigger (+3/+6 each), kills 6-7 no longer do
  let h = field(false, { rimBillitonShip: act(0), preciShip: act(0), dongShip: act(0), arcaneShip: rimBonds(false, 0) });
  killN(h, 7);
  assert.equal(layersOf(h, 'rimBillitonShip'), 15, 'normal: 5 triggers × 3');
  assert.equal(layersOf(h, 'preciShip'), 15, 'every active bond gains');
  assert.equal(layersOf(h, 'dongShip'), 15, '…including bonds beyond rim/preci');
  assert.equal(layersOf(h, 'arcaneShip'), 0, 'inactive bonds do not count');
  h = field(true, { rimBillitonShip: act(0), preciShip: act(0) });
  killN(h, 6);
  assert.equal(layersOf(h, 'rimBillitonShip'), 30, 'elite: 5 triggers × 6 (the 6th kill is past the cap)');
  done(h);
});

test('garrison_999 (莱伊): layers / 3 → ATK +1 %/step (elite +2 %); no weight-scaled bonus (owner decision 2026-10-16)', () => {
  // 盟约本体的攻击力（+20%+0.5%/层）与特质同属 directMods 的加算乘区（preciShip 未激活不计），
  // 所以面板 = base × (1 + 0.2 + 0.005×layers + 特质步数×每步) ；0 层基准 = base × 1.3。
  const field = (golden, layers) => makeBattle({
    defs: { enemies: ENEMIES },
    bonds: { rimBillitonShip: rimBonds(true, layers), preciShip: rimBonds(true, 0) },
    units: [{ chessId: golden ? 'chess_char_6_95_b' : 'chess_char_6_95_a', row: 10, col: 5 }],
    autoFinish: false, timeLimit: 30, seed: 7,
  });
  const atkOf = (h) => h.unit(1).s.atk;
  const baseOf = (golden) => { const h = field(golden, 0); h.step(1); return atkOf(h); };   // base × (1.2 + 0.1)
  let h = field(false, 9);
  h.step(1);
  close2(atkOf(h), baseOf(false) * ((1.245 + 0.03 + 0.1) / 1.3), '9 layers → 3 steps → +3 %');
  h = field(true, 9);
  h.step(1);
  close2(atkOf(h), baseOf(true) * ((1.245 + 0.06 + 0.1) / 1.3), 'elite: +6 %');
  done(h);

  function close2(got, want, msg) {
    assert.ok(Math.abs(got - want) <= Math.max(1e-6, Math.abs(want) * 1e-9), `${msg}: ${got} ≈ ${want}`);
  }
});

test('every default skill casts without engine errors (free cast, 2 s run)', () => {
  for (const [a, b] of OPS.map((o) => [o[0], o[1]])) {
    for (const id of [a, b]) {
      const h = makeBattle({ defs: { enemies: ENEMIES }, units: [{ chessId: id, row: 10, col: 5 }], autoFinish: false, timeLimit: 30, captureNoisy: true, seed: 11 });
      h.step(1);
      const u = h.unit(1);
      if (u.skill?.activate) u.skill.activate('test', { free: true });
      h.run(2);
      done(h);
    }
  }
});

// 数据侧：7 名干员都挂 993-999 的特质（buildGarrisons owners 镜像在 data.test 已断言），这里核对 garrisonIds 本身
test('the 7 operators carry their 993-999 garrisons (a on normal, b on elite)', () => {
  const chess = JSON.parse(readFileSync(new URL('../../data/chess.json', import.meta.url), 'utf8'));
  const dict = chess.chessDataDict ?? chess;
  const want = {
    chess_char_1_96: 'garrison_993', chess_char_2_96: 'garrison_994', chess_char_3_95: 'garrison_995',
    chess_char_5_96: 'garrison_996', chess_char_5_95: 'garrison_997', chess_char_6_96: 'garrison_998',
    chess_char_6_95: 'garrison_999',
  };
  for (const [base, gar] of Object.entries(want)) {
    assert.deepEqual(dict[`${base}_a`].garrisonIds, [`${gar}_a`], `${base}_a`);
    assert.deepEqual(dict[`${base}_b`].garrisonIds, [`${gar}_b`], `${base}_b`);
  }
});
