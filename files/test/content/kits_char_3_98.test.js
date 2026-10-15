// test/content/kits_char_3_98.test.js — 烈夏 (chess_char_3_98, 自定义 5★ 领主, tier 3) kit tests:
// form + kit identity (S2 一呼百应 default, LOR-Y on the elite), S2's free activation of ready student skills +
// her ranged-scale fix while it runs, T1 快点快点!'s student ASPD, and the LOR-Y trait (≥2 enemies in range →
// ASPD, 0.1 s re-check). The 学生代表 garrison (SERVER_GAIN) runs on the match dispatcher — covered by the
// golden matches + data tests. Run: node --test test/content/kits_char_3_98.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, enemyRec, checkInvariants } from '../helpers/battleHarness.js';
import { KITS, skillSpecSource } from '../../server/sim/content/index.js';
import { getDefaultSource } from '../../server/sim/simdata.js';
const ds = getDefaultSource();

const A = 'chess_char_3_98_a', B = 'chess_char_3_98_b';
const S2 = 'skchr_leto_2';
const dummy = (key, o = {}) => enemyRec({ key, hp: 1e9, speed: 0, atk: 0, ...o });
const ENEMIES = { e_dummy: dummy('e_dummy') };
const done = (h) => { checkInvariants(h.b); assert.equal(h.b.errors.length, 0, JSON.stringify(h.b.errors[0])); };

test('both forms: preset kit hand-authored, S2 一呼百应 is the default skill; _b carries LOR-Y', () => {
  for (const [id, golden] of [[A, false], [B, true]]) {
    const h = makeBattle({ defs: { enemies: { e_dummy: dummy('e_dummy') } }, units: [{ chessId: id, row: 10, col: 5 }], autoFinish: false, timeLimit: 20 });
    const u = h.unit(1);
    assert.equal(u.def.charId, 'char_194_leto');
    assert.equal(u.skill.id, S2, `${id}: default skill S2`);
    assert.equal(skillSpecSource(ds.getChess(id), KITS), 'kit', `${id}: hand-authored preset kit`);
    assert.equal(u.def.profession, 'WARRIOR', `${id}: 近卫（领主分支，def 不携带 sub）`);
    assert.equal(!!ds.rawChess(id).module?.active, golden, `${id}: module ${golden ? 'LOR-Y active' : 'none'}`);
    done(h);
  }
});

test('S2 一呼百应: the casts open the ready student skill for free (her own S3 never auto-fires out of reach), hold the 快点快点! ASPD and the ranged-scale fix while running', () => {
  // 怒潮凛冬 fields OUT of her own S3 CUSTOM_RANGE reach (enemy at col 6, she at col 2): her DEFAULT strategy can
  // never fire her own skill, so EVERY activation of hers comes from 一呼百应's free one.
  const h = makeBattle({
    defs: { enemies: { e_dummy: dummy('e_dummy') } }, units: [
      { chessId: A, row: 10, col: 5 },
      { chessId: 'chess_char_6_98_a', row: 10, col: 2 },   // 怒潮凛冬 (student — unreachable for her own S3)
      { chessId: 'chess_char_1_02_a', row: 10, col: 4 },   // 角峰 (kjerag — untouched)
    ],
    enemies: [{ key: 'e_dummy', pos: [10, 6] }], autoFinish: false, timeLimit: 240, captureNoisy: true, seed: 31,
  });
  h.step(1);
  const u = h.unit(1);
  const student = h.b.allyUnits.find((x) => x.def?.charId === 'char_1051_headb2');
  const jiaofeng = h.b.allyUnits.find((x) => x.def?.charId === 'char_199_yak');   // 角峰（非学生）
  // 烈夏's S2 charges by time (28 SP) and the DEFAULT strategy casts it when the enemy is in reach (~28 s);
  // the cast chains the student's skill free.
  h.runUntil(() => student.skill.activations >= 1, 200);
  const jiaoActs0 = jiaofeng.skill.activations;
  assert.ok(h.hooksOf('skillStart').some((c) => c.unit === u), '烈夏\'s cast happened');
  assert.ok(student.skill.activations >= 1, 'the student\'s skill opened with hers (free)');
  // a second cast re-opens it; the non-student never moves
  h.runUntil(() => student.skill.activations >= 2, 240);
  assert.equal(jiaofeng.skill.activations, jiaoActs0, 'the non-student stays untouched');
  // while 烈夏's skill runs: the ranged-scale fix + the student ASPD
  if (u.skill.active) {
    assert.equal(u.profile.rangedScale, 1, 'her ranged attacks no longer lose ATK while the skill runs');
    const aspd = student.findBuff('talent:leto:students');
    assert.ok(aspd && aspd.mods.aspd > 0, `快点快点! holds student ASPD (${aspd && aspd.mods.aspd})`);
  }
  done(h);
});
test('LOR-Y (elite): ≥2 enemies in her range stack a temporary ASPD buff; one enemy does not', () => {
  const withEnemies = (n) => {
    const h = makeBattle({
      defs: { enemies: { e1: dummy('e1'), e2: dummy('e2'), e3: dummy('e3') } }, units: [{ chessId: B, row: 10, col: 5 }],
      enemies: [{ key: 'e1', pos: [10, 7] }, ...(n >= 2 ? [{ key: 'e2', pos: [10, 6] }] : []), ...(n >= 3 ? [{ key: 'e3', pos: [10, 8] }] : [])],
      autoFinish: false, timeLimit: 30, captureNoisy: true, seed: 33,
    });
    h.step(1);
    h.run(0.6);   // the 0.1 s re-check ticks
    return h.unit(1).findBuff('trait:leto:lor');
  };
  assert.ok(withEnemies(2), 'two enemies stack the LOR-Y ASPD');
  assert.equal(withEnemies(1), null, 'one enemy does not');
});
