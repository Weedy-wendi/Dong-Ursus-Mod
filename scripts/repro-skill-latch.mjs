#!/usr/bin/env node
// 复现「技能结束后 skillOn 被闩住 → 普通攻击还在放技能 clip」的问题（临时诊断用，修复后可当反向验证）。
//
// 用法: node <mod>/scripts/repro-skill-latch.mjs [repoRoot=..]
//   repoRoot = 装好 mod 的本体源码检出（要有 test/render/fakepixi.js 与 data/assets.json）
//
// 原理：复刻渲染层实际收到的快照序列
//   idle → 技能 on/off 事件（瞬发技能在同一 tick 里 on→off）+ 0.5 s ANIM.SKILL 窗口 → ANIM.ATTACK（普攻）
// 打印每个干员在「窗口结束后再普攻一次」时真正播的 clip，与 roles.attack.loop 对比。
//
// 期望（修复后）：普攻一律播 roles.attack.loop，静止时播 roles.idle。
// 现状（2026-10-15，未修）：只要该技能的 clip 不是普攻 clip（skills[i].via !== 'attack'），普攻就会播技能 clip。
import { readFileSync } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = process.argv[2]
  ? (isAbsolute(process.argv[2]) ? process.argv[2] : join(process.cwd(), process.argv[2]))
  : join(here, '..', '..');
const imp = (rel) => import(pathToFileURL(join(repo, rel)).href);

const { installFakePixi, fakeViewCtx } = await imp('test/render/fakepixi.js');
const { presetCamera } = await imp('public/js/render/projection.js');
const { spineEntry } = await imp('public/js/assets.js');
const { ANIM } = await imp('shared/constants.js');
const M = JSON.parse(readFileSync(join(repo, 'data/assets.json'), 'utf8'));

const fake = installFakePixi();
const cam = presetCamera('normal', { width: 1280, height: 720 });
const { UnitView } = await imp('public/js/render/units.js');
let clockT = 0;

const store = () => ({
  picture: () => null,
  image: async () => null,
  hasBack: () => false,
  spineEntry: (id, o) => spineEntry(M, id, o),
  spine: {
    acquire: async (e) => ({ animations: Object.keys(e.animations || {}).map((name) => ({ name })) }),
    restart: () => false,
    release: () => {},
    peek: () => null,
  },
});
const sample = (anim, flags) => ({ x: 5, y: 10, hp: 1000, maxHp: 1000, sp: 0, spMax: 0, flags, anim, vx: 0, vy: 0 });
const tick = () => new Promise((r) => setImmediate(r));

/** @returns {{id:string, side:string, idx:number, expected:string, got:string, idleGot:string, skillOn:boolean}} */
async function probe(id, side, skillIndex) {
  clockT = 0;
  const opts = { id: 7, side: 'ally', kind: 'chess', defId: id, spine: id, tier: 1, x: 5, y: 10, maxHp: 1000, dir: 'RIGHT', skillIndex };
  const v = new UnitView(fakeViewCtx(fake.P, { assets: store(), cam }), opts);
  await tick(); await tick();
  const actor = v.actor;
  const log = [];
  const st = actor.spine.state;
  const set = st.setAnimation;
  st.setAnimation = (i, name, loop) => { log.push(name); return set(i, name, loop); };
  const step = (n, anim) => { for (let i = 0; i < n; i++) { clockT += 1 / 60; v.sync(sample(anim, 0), clockT); v.update(1 / 60, cam, clockT); } };

  step(30, ANIM.IDLE);
  v.setSkill(true); v.setSkill(false);
  step(30, ANIM.SKILL);            // sim 的技能动画窗口（SKILL_ANIM_WINDOW = 0.5 s）
  step(60, ANIM.ATTACK);           // 窗口结束，回到普攻态
  // 静止时该播什么：SpineActor._idleName()（skillOn 被闩住时它会返回技能的 idle）
  const idleGot = actor._idleName();
  log.length = 0;
  actor.attack(1.05);              // 一次普通攻击
  step(6, ANIM.ATTACK);
  return {
    id, side, idx: skillIndex,
    expected: actor.roles.attack?.loop,
    got: log[0] || actor.current,
    idleGot,
    idleExpected: actor.roles.idle,
    skillOn: actor.skillOn,
    mode: actor.mode,
  };
}

const CASES = [
  ['char_102_texas', 'front', 1], ['char_1014_nearl2', 'front', 2],
  ['char_1023_ghost2', 'front', 1], ['char_1028_texas2', 'front', 1], ['char_1039_thorn2', 'front', 1],
  ['char_1502_crosly', 'front', 1], ['char_2027_wang', 'front', 1], ['char_4011_lessng', 'front', 1],
  ['char_1029_yato2', 'front', 2],
];

const rows = [];
for (const [id, side, idx] of CASES) rows.push(await probe(id, side, idx));

const pad = (s, n) => String(s ?? '').padEnd(n);
console.log(`[repro] 本体: ${repo}`);
console.log(`${pad('干员', 20)} ${pad('面', 5)} ${pad('技能槽', 6)} ${pad('普攻应播', 14)} ${pad('普攻实际播', 14)} ${pad('静止应播', 12)} ${pad('静止实际播', 12)} skillOn`);
let bad = 0;
for (const r of rows) {
  const wrong = r.got !== r.expected || (r.idleExpected && r.idleGot !== r.idleExpected);
  if (wrong) bad++;
  console.log(`${pad(r.id, 20)} ${pad(r.side, 5)} ${pad('S' + (r.idx + 1), 6)} ${pad(r.expected, 14)} ${pad(r.got, 14)} ${pad(r.idleExpected, 12)} ${pad(r.idleGot, 12)} ${r.skillOn}${wrong ? '  ⚠' : ''}`);
}
console.log(`[repro] 异常 ${bad} / ${rows.length}：技能窗口结束后普攻/静止播错 clip 的干员`);
fake.restore();
process.exit(bad ? 1 : 0);
