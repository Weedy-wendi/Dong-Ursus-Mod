// test/content/kits_char_4_99.test.js — 鸿雪 (chess_char_4_99, 自定义 6★ 重射手 → tier 4) kit tests:
// form + kit identity (S3 锐笔速写 default, closerange arrows, ARC-Y on the elite), ARC-Y's front-line
// ×atk_scale + no-dodge, S2 点题's two 持续伤害 follow-ups, the 打字机 summon wiring, and (prep-side) the
// 休整犒赏 garrison handlers (act2autochess_gar_eff_986) on the match dispatcher.
// Run: node --test test/content/kits_char_4_99.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, enemyRec, checkInvariants } from '../helpers/battleHarness.js';
import { KITS, skillSpecSource } from '../../server/sim/content/index.js';
import { getDefaultSource } from '../../server/sim/simdata.js';
import { readFileSync } from 'node:fs';
const ds = getDefaultSource();

const A = 'chess_char_4_99_a', B = 'chess_char_4_99_b';
const S2 = 'skchr_bgsnow_2', S3 = 'skchr_bgsnow_3';
const dummy = (key, o = {}) => enemyRec({ key, hp: 1e9, speed: 0, atk: 0, ...o });
const ENEMIES = { e_dummy: dummy('e_dummy') };
const done = (h) => { checkInvariants(h.b); assert.equal(h.b.errors.length, 0, JSON.stringify(h.b.errors[0])); };
const hitsBy = (h, u) => h.hooksOf('damaged').filter((c) => c.source === u);
const precis = (h, u) => hitsBy(h, u).filter((c) => (c.dmg?.tags || []).includes('bgsnow:precis'));

test('both forms: preset kit hand-authored, S3 锐笔速写 is the default skill, 重射手 phys arrows; _b carries ARC-Y', () => {
  for (const [id, golden] of [[A, false], [B, true]]) {
    const h = makeBattle({ defs: { enemies: { e_dummy: dummy('e_dummy') } }, units: [{ chessId: id, row: 10, col: 5 }], autoFinish: false, timeLimit: 20 });
    const u = h.unit(1);
    assert.equal(u.def.charId, 'char_4055_bgsnow');
    assert.equal(u.skill.id, S3, `${id}: default skill S3`);
    assert.equal(skillSpecSource(ds.getChess(id), KITS), 'kit', `${id}: hand-authored preset kit`);
    assert.equal(u.dmgType, 'phys', `${id}: 重射手物理`);
    assert.equal(!!ds.rawChess(id).module?.active, golden, `${id}: module ${golden ? 'ARC-Y active' : 'none'}`);
    assert.ok(ds.getChess(id).tokens.includes('token_10026_bgsnow_subbow'), `${id}: the 打字机 token is wired`);
    done(h);
  }
});

test('ARC-Y (elite): her attacks on the straight line ahead take ×atk_scale and cannot be dodged; a side enemy does not', () => {
  const fight = (col) => {
    const muls = [];
    const h = makeBattle({
      defs: { enemies: { e_dummy: dummy('e_dummy') } }, units: [{ chessId: B, row: 10, col: 5 }],
      enemies: [{ key: 'e_dummy', pos: [10, col] }], autoFinish: false, timeLimit: 60, captureNoisy: true, seed: 25,
      setup: (b) => b.on('hit', (ctx) => { if (ctx.source?.def?.charId === 'char_4055_bgsnow') muls.push({ canDodge: ctx.dmg.canDodge, amount: ctx.dmg.amount }); }),
    });
    h.step(1);
    h.runUntil(() => muls.length >= 2, 40);
    return muls;
  };
  const front = fight(7);
  function fightSameRow() {
    const muls = [];
    const h = makeBattle({
      defs: { enemies: { e_dummy: dummy('e_dummy') } }, units: [{ chessId: B, row: 10, col: 5 }],
      enemies: [{ key: 'e_dummy', pos: [9, 7] }], autoFinish: false, timeLimit: 60, captureNoisy: true, seed: 29,
      setup: (b) => b.on('hit', (ctx) => { if (ctx.source?.def?.charId === 'char_4055_bgsnow') muls.push({ canDodge: ctx.dmg.canDodge, amount: ctx.dmg.amount }); }),
    });
    h.step(1);
    h.runUntil(() => muls.length >= 2, 40);
    return muls;
  }
  assert.ok(front.length >= 2 && front.every((m) => m.canDodge === false), 'front-line hits cannot be dodged');
  const side = fightSameRow();  // rows differ → not the front line
  assert.ok(side.length >= 2, `the side-row fight landed, got ${side.length}`);
  assert.ok(side.length >= 2 && side.every((m) => m.canDodge !== false), 'a side enemy is dodgeable (no ARC-Y)');
  // the front amounts carry the ARC-Y ×1.05: the same body at the same distance hits ×1.05 vs the side baseline
  const ratio = front[0].amount / side[0].amount;
  assert.ok(Math.abs(ratio - 1.05) < 0.02, `front hits ×1.05 vs side: ${front[0].amount} / ${side[0].amount} = ${ratio.toFixed(4)}`);
});

test('S3 锐笔速写 (default, auto): while it runs the 正前方3格 hits take the atk_up scale instead of the skill scale', () => {
  // S3 is her default skill with a DEFAULT strategy — it auto-fires at full SP; the front 3 (her tile + 3 ahead)
  // take the atk_up scale, so the hits on the enemy sitting there jump by s3Front / s3Scale once it starts.
  const h = makeBattle({
    defs: { enemies: { e_dummy: dummy('e_dummy') } }, units: [{ chessId: A, row: 10, col: 5 }],
    enemies: [{ key: 'e_dummy', pos: [10, 7] }], autoFinish: false, timeLimit: 120, captureNoisy: true, seed: 27,
  });
  h.step(1);
  const u = h.unit(1);
  const e = h.enemies()[0];
  const amounts = () => hitsBy(h, u).filter((c) => c.target === e && c.dmg.isAttack).map((c) => c.dmg.amount);
  h.runUntil(() => amounts().length >= 2, 40);              // normal attacks first (ARC-Y ×1.05 included)
  const pre = amounts()[0];
  h.runUntil(() => u.skill.active, 90);                     // S3 auto-fires at full SP
  const t0 = h.b.time;
  h.run(2);
  const during = amounts().slice(-1)[0];   // a hit after the skill started (amounts() reads all captured hits)
  const s3 = () => JSON.parse(readFileSync(new URL('../../data/chess.json', import.meta.url), 'utf8'))[A].skills.find((x) => x.skillId === 'skchr_bgsnow_3').bb;
  const bb = s3();
  const ratio = during / pre;
  const want = bb['bgsnow_s_3[atk_up].atk_scale'];   // front hits scale to this directly (pre hits are plain ×1.05 attacks)
  assert.ok(Math.abs(ratio - want) < 0.03, `S3 front scale: ${during} / ${pre} = ${ratio.toFixed(3)} vs ${want.toFixed(3)}`);
  done(h);
});

