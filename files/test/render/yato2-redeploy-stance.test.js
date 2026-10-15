// test/render/yato2-redeploy-stance.test.js — 麒麟R夜刀 player report (2026-10-14): a deploy-time passive skill's
// stance never (re)showed after a redeploy. Three stacked causes, all client-visible: the sim fired the 'skill'
// events before the 'spawn'/'deploy' ones (fixed server-side, skills.js _firePassiveAnim), the anim-role resolver
// never named the bare Start_N launch clips (fixed, tools/assets/anim-roles.mjs), and — this file — the view's
// revive() path cleared the stance: SpineActor.revive resets skillOn, the 'skill' event had landed on the dead
// actor, and a unit without a Back model swaps no model on standing up, so nothing ever replayed the stance.
// The fix: render/units.js sync() re-derives the ON side from the sim's state of record (UF.SKILL / ANIM.SKILL).
// Headless fake PIXI + the real manifest entry (data/assets.json), like issue25-downback.test.js.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installFakePixi, fakeViewCtx } from './fakepixi.js';
import { presetCamera } from '../../public/js/render/projection.js';
import { spineEntry } from '../../public/js/assets.js';
import { ANIM } from '../../shared/constants.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const M = JSON.parse(readFileSync(path.join(ROOT, 'data/assets.json'), 'utf8'));
const YATO = 'char_1029_yato2';

let fake, UnitView;
before(async () => {
  fake = installFakePixi();
  ({ UnitView } = await import('../../public/js/render/units.js'));
});
after(() => fake.restore());

const tick = () => new Promise((r) => setImmediate(r));
const settle = async () => { await tick(); await tick(); };
const cam = () => presetCamera('normal', { width: 1280, height: 720 });
let clockT = 0;
const frames = (v, n, dt = 1 / 60) => { for (let i = 0; i < n; i++) { clockT += dt; v.update(dt, cam(), clockT); } };
const sample = (o = {}) => ({ x: 5, y: 10, hp: 1000, maxHp: 1000, sp: 0, spMax: 0, flags: 0, anim: 0, vx: 0, vy: 0, el: null, elFill: 0, elUntil: 0, elDur: 0, ...o });

function store() {
  const refs = new Map();
  return {
    refs,
    picture: () => null,
    image: async () => null,
    hasBack: () => false,                      // 麒麟R夜刀 has no Back skeleton: a redeploy swaps no model
    spineEntry: (id, o) => spineEntry(M, id, o),
    spine: {
      acquire: async (e) => { refs.set(e.skel, (refs.get(e.skel) || 0) + 1); return { animations: Object.keys(e.animations || {}).map((name) => ({ name })) }; },
      restart: () => false,
      release: (e) => { refs.set(e.skel, (refs.get(e.skel) || 1) - 1); },
      peek: () => null,
    },
  };
}
const front = () => M.chars[YATO].spine.front;

async function op() {
  const s = store();
  const v = new UnitView(fakeViewCtx(fake.P, { assets: s, cam }), { id: 7, side: 'ally', kind: 'chess', defId: YATO, spine: YATO, tier: 1, x: 5, y: 10, maxHp: 1000, dir: 'RIGHT', skillIndex: 1 });
  await settle();
  frames(v, 5);
  return v;
}

describe('a deploy-time passive stance across a redeploy (no Back model, no model swap)', () => {
  test('the stance replays after the revive cleared it: the snapshot ANIM.SKILL re-derives it', async () => {
    const v = await op();
    assert.equal(v.actor.entry, front(), 'the Front model (no Back)');
    // first deploy: the 'skill' on event — Start_2 plays, then the Skill_2 clip
    v.setSkill(true);
    assert.equal(v.actor.skillOn, true);
    assert.equal(v.actor.current, 'Start_2', 'the launch clip plays');
    // knocked out mid-window: the off event is skipped (the sim guards it by deployment), the actor dies
    v.die();
    assert.equal(v.actor.dead, true);
    // the redeploy's own 'skill' on event arrives while the actor is still dead — ignored (setSkill returns on
    // this.dead); the actor holds its death clip
    v.setSkill(true);
    assert.equal(v.actor.current, 'Die', 'a dead actor plays no skill clip');
    // the deploy: the view revives the SAME actor (no model swap) — SpineActor.revive clears skillOn
    v.onDeploy();
    assert.equal(v.alive, true);
    assert.equal(v.actor.dead, false);
    assert.equal(v.actor.skillOn, false, 'revive cleared the stance');
    // the snapshot says the sim is inside the new stance window (animOf → ANIM.SKILL, no UF.SKILL for a passive):
    // sync re-derives the ON side
    v.sync(sample({ anim: ANIM.SKILL }), 1);
    assert.equal(v.actor.skillOn, true, 'the stance re-derived from ANIM.SKILL');
    assert.equal(v.actor.current, 'Start_2', 'the launch clip plays again');
    frames(v, 5);
    assert.equal(v.actor.mode, 'skillBegin', 'still in the skill window');
    // the window ends: the off event turns the stance off (no End clip on S2 — straight back to the base)
    v.setSkill(false);
    frames(v, 3);
    assert.equal(v.actor.skillOn, false);
    assert.equal(v.actor.mode, 'base');
    v.destroy();
    await settle();
  });

  test('the ON re-derivation does not flap a running stance over its own attack anims (animOf dips to ATTACK)', async () => {
    const v = await op();
    v.setSkill(true);
    frames(v, 2);
    assert.equal(v.actor.skillOn, true);
    // a stance passive's attack: the snapshot anim dips to ATTACK between SKILL windows (animOf), the flag stays
    // off for a passive — the reconciliation must NOT force the stance off there (the off event owns that)
    v.sync(sample({ anim: ANIM.ATTACK }), 2);
    assert.equal(v.actor.skillOn, true, 'the stance survives an attack frame');
    v.sync(sample({ anim: ANIM.SKILL }), 2.1);
    assert.equal(v.actor.skillOn, true);
    // a plain idle frame without an off event (the window still runs in the sim): the stance holds
    v.sync(sample({ anim: ANIM.IDLE }), 2.2);
    assert.equal(v.actor.skillOn, true, 'the stance survives an idle frame inside the window');
    v.destroy();
    await settle();
  });
});
