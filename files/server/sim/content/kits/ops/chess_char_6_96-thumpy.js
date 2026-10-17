// server/sim/content/kits/ops/chess_char_6_96-thumpy.js — 珊比 (char_4235_thumpy) kit, tier 6 (PRESET).
// Conventions of the tier-6 kits: ../shared/tier6.js; kit contract and rules: ../README.md.
//
// 6_96(预设) 珊比 — 本源铁卫 (primprotector)，2026-10-16 PR2 自 op-thumpy.js 改造转预设（同批 op-kit 退役，
// 注册由调用方负责）。数值全部来自 chess.json 记录（官方 blackboard；模组/潜能差异已由 build-data 折入记录）。
//   - 默认技能 S2 慢慢走~ (skchr_thumpy_2)：ATK/DEF +；施放时按 PRTS 顺序喷胶（自身格计入但不展开，
//     max_cnt − 1 = 4 格），每 interval 秒（含施放 [ASSUMED: 首拍在施放时]）对胶上每个地面敌人先停顿
//     后物理（无视无法选择；隐藏/隐匿/无敌不吃）；胶 lying 期间**其他干员**的物理伤害对胶上敌人附加
//     ep_damage_ratio[damage] × 她的 ATK 侵蚀损伤（她的 PRP-X 加成它；无来源伤害不触发）。触发用 kit 的
//     ACTIVE_RANGE 覆盖（胶面积大于自身射程 —— 余 S2 先例 §22.10；数据的重装 TAKE_DAMAGE 只看到自身格）。
//   - T1 探险理论：她受到的元素损伤 ×ep_damage_scale（priority 20，干员受元素损伤口径）；她造成物理伤害
//     时附带 ep_damage_ratio[trigger] × ATK 侵蚀损伤，或目标侵蚀爆发期间改为该冷却 −duration_dec 秒。
//   - T2 坚硬脚板：她造成的 HP 伤害标记敌人（退场/死亡清标记）；被标记敌人的侵蚀爆发（无论谁填的）⇒
//     她 DEF +def（PRP-X stage3 起 ATKN +atk，平铺，至多 max_stack_cnt 层 [ASSUMED: 离场清空]）与
//     shield_value 屏障（同一屏障 buff 累加，至多 scale × 最大生命）。
//   - 模组 PRP-X 出发的勇气 (uniequip_002_thumpy)：阻挡敌人时她造成的元素损伤 ×trait bb ep_damage_scale
//     （stage3 = 1.15，已折入记录的 trait.bb；stage1 / 未带模组时 bb 无该键 → 不装钩子）。
//   - 特质 garrison_998 勘测队：<进入休整期时>…—— prep 侧 meta.js handler 已完成（SERVER_PREP_START），
//     kit 不实现。S1/S3 是 PRESET 商店棋子不可选，不搬（含 S3 传送带与 ep_break_water）。

import { num, talentBb, traitBb, skillRec, up} from '../shared/tier1.js';
import { genericSkillSpec } from '../../generic.js';
import { offsetTile } from '../../../dir.js';
import { bodyInKeys } from '../../../body.js';
import { enemyStealthed } from '../../../targeting.js';
import { hasHp } from '../../../damage.js';
import { COLS } from '../../../constants.js';

const S2 = 'skchr_thumpy_2';
const SOLE = 'talent:thumpy:sole';
const BARRIER = 'talent:thumpy:barrier';
/** "占据4格" when the blackboard has no max_cnt (it counts her own tile too: max_cnt − 1). */
const TILES = 4;
/** Her facing-RIGHT frame: right hand, left hand, front ([dRow, dCol]; row 0 is the bottom row — sim/dir.js). */
const RIGHT = Object.freeze([-1, 0]);
const LEFT = Object.freeze([1, 0]);
const FRONT = Object.freeze([0, 1]);

const nz = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => Number.isFinite(v) && v !== 0));
/**
 * "可用地块" of the glue: passable ground of the field with no obstacle on it (a 射击台 / mound / 阻隔工事 tile is no
 * ground an enemy stands on; the mode's stages have no 假高台 / 坑洞 tiles).
 */
const usable = (battle, r, c) => battle.grid.groundPassable(r, c);

/**
 * S2's glue tiles (PRTS 备注 order): her own tile when usable (not counted, never spreads), then `count` tiles — the front
 * tile, its right, its left and its front (front unusable: her left, then her right), then spreading from the last sprayed
 * tile that has not spread yet to its right, left and front, until `count` tiles or nothing left to spread. Absolute keys.
 */
function glueTiles(battle, unit, count) {
  const keys = [];
  const sprayed = new Set();
  const list = [];
  const abs = (lr, lc) => offsetTile(unit.tileR, unit.tileC, lr, lc, unit.dir);
  const spray = (lr, lc) => {
    if (list.length >= count || sprayed.has(`${lr},${lc}`)) return;
    const [r, c] = abs(lr, lc);
    if (!usable(battle, r, c)) return;
    sprayed.add(`${lr},${lc}`);
    list.push({ lr, lc, spread: false });
    keys.push(r * COLS + c);
  };
  const near = ([lr, lc], [dr, dc]) => [lr + dr, lc + dc];
  if (usable(battle, unit.tileR, unit.tileC)) { sprayed.add('0,0'); keys.push(unit.tileR * COLS + unit.tileC); }
  const front = [0, 1];
  if (usable(battle, ...abs(...front))) {
    for (const d of [[0, 0], RIGHT, LEFT, FRONT]) spray(...near(front, d));
  } else {
    for (const d of [LEFT, RIGHT]) spray(...near([0, 0], d));
  }
  while (list.length < count) {
    let at = null;
    for (let i = list.length - 1; i >= 0; i--) if (!list[i].spread) { at = list[i]; break; }
    if (!at) break;
    at.spread = true;
    for (const d of [RIGHT, LEFT, FRONT]) spray(...near([at.lr, at.lc], d));
  }
  return keys;
}

export default {
  chess_char_6_96_a: (bb, chess) => {
    const t0 = talentBb(chess, 0), t1 = talentBb(chess, 1);
    const tb = traitBb(chess);
    const b2 = bb;   // bb = 选中技能（S2 慢慢走~）的 blackboard
    const glueCount = Math.max(0, Math.round(num(b2.max_cnt, TILES + 1)) - 1);

    /** S2: one glue pulse — 停顿 first, then the physical hit (PRTS 备注), on every ground enemy on the glue. */
    const gluePulse = (battle, unit, glue) => {
      for (const e of battle.enemies) {
        if (!e.alive || e.hidden || e.isFlying || !bodyInKeys(e, glue) || enemyStealthed(e) || e.s.flags.invulnerable) continue;
        battle.applyStatus(e, 'sluggish', { duration: num(b2.sluggish), source: unit });
        if (e.alive) battle.dealDamage(unit, e, { amount: unit.s.atk * num(b2.atk_scale), type: 'phys', isSkill: true, ignoreSelect: true, tags: ['skill', 'thumpy:glue'] });
      }
    };

    return {
    // 非默认技能（alt loadout）：genericSkillSpec 按该技能自己的记录生成 —— kit 覆盖要求每个可选技能有条目，
    // 行为与此前 generic 回退完全一致（详见 tools/kit-coverage.mjs 的 covered 口径）。
    skills: {
      'skchr_thumpy_1': genericSkillSpec(skillRec(chess, 'skchr_thumpy_1')),
      'skchr_thumpy_3': genericSkillSpec(skillRec(chess, 'skchr_thumpy_3'))
    },
      // 默认技能 = S2 慢慢走~（数据 backup.skillIndex 1）。bb 即其 blackboard。
      skill: {
        kind: 'duration',
        // [ASSUMED] its glue acts on ground enemies only: 白铁's 铁钳号 alone does not open it (skills.js allyTargetsOk)
        allyTargets: false,
        // the owner's rule for a skill whose area is larger than her range (her tile): cast as soon as a ground enemy she
        // can affect is on the glue's first five tiles — her tile, the front one, its two sides and the one beyond
        // (glueTiles' PRTS order), as 余 S2's x-1 (§22.10); the data's 重装 TAKE_DAMAGE only saw her own tile
        trigger: { rule: 'ACTIVE_RANGE', grid: [[0, 0], [0, 1], [1, 1], [-1, 1], [0, 2]] },
        mods: nz({ atkPct: num(b2.atk), defPct: num(b2.def) }),
        onStart({ battle, unit }) {
          const keys = glueTiles(battle, unit, glueCount);
          unit.mem.thumpyGlue = { keys: new Set(keys), acc: 0 };
          const mid = (f) => keys.reduce((s, k) => s + f(k), 0) / Math.max(1, keys.length);
          battle.fx('zone', { x: mid((k) => k % COLS), y: mid((k) => Math.floor(k / COLS)), radius: 1.2, dur: num(skillRec(chess, S2)?.duration), id: unit.id, skill: 'thumpy:glue' });
          gluePulse(battle, unit, unit.mem.thumpyGlue.keys);
        },
        onTick({ battle, unit, dt }) {
          const g = unit.mem.thumpyGlue;
          if (!g) return;
          const iv = Math.max(0.05, num(b2.interval, 0.7));
          g.acc += dt;
          while (g.acc + 1e-9 >= iv && unit.alive) { g.acc -= iv; gluePulse(battle, unit, g.keys); }
        },
        onEnd({ unit }) { unit.mem.thumpyGlue = null; },
      },
      talents: [
        { install(battle, unit) { // 探险理论: 元素损伤 taken ×ep_damage_scale; her physical damage ⇒ 侵蚀损伤 or the burst −duration_dec s
          const taken = num(t0.ep_damage_scale, 1);
          if (taken !== 1) {
            battle.on('elementHit', (c) => {
              if (c.target === unit && c.dmg?.type === 'element') c.dmg.mul *= taken;
            }, { owner: unit, priority: 20 });
          }
          const ratio = num(t0['ep_damage_ratio[trigger]']), dec = num(t0.duration_dec);
          battle.on('damaged', (c) => {
            const t = c.target;
            if (c.source !== unit || c.type !== 'phys' || !(c.amount > 0) || !t || t.side !== 'enemy' || !hasHp(t)) return;
            const lock = t.findBuff('erosionBurst');
            if (lock) { if (dec > 0) lock.timeLeft = Math.max(0, lock.timeLeft - dec); return; }
            if (ratio > 0) battle.dealDamage(unit, t, { type: 'element', element: 'erosion', amount: unit.s.atk * ratio, tags: ['talent', 'thumpy:theory'] });
          }, { owner: unit, priority: -10 });
        } },
        { install(battle, unit) { // 坚硬脚板: her HP damage marks; a marked enemy's 侵蚀 burst ⇒ DEF (+ATK) stack and 屏障
          const def = num(t1.def), atk = num(t1.atk), shield = num(t1.shield_value), cap = Math.max(1, Math.floor(num(t1.max_stack_cnt, 1)));
          const capHp = num(t1.scale, 3);
          if (!(def || atk || shield)) return;
          const marks = () => unit.mem.thumpyMarks ?? (unit.mem.thumpyMarks = new Set());
          battle.on('deploy', (c) => { if (c.unit === unit) marks().clear(); }, { owner: unit });
          battle.on('death', (c) => { if (c.unit === unit) marks().clear(); }, { owner: unit });
          battle.on('damaged', (c) => {
            if (c.source === unit && c.target && c.target.side === 'enemy' && c.type !== 'element' && c.amount > 0) marks().add(c.target);
          }, { owner: unit, priority: 10 });
          battle.on('elementBurst', (c) => {
            const t = c.target;
            if (c.element !== 'erosion' || !t || t.side !== 'enemy' || !up(unit) || !marks().has(t)) return;
            if (def || atk) battle.addBuff(unit, { key: SOLE, refresh: 'stack', stacks: 1, maxStacks: cap, mods: nz({ defFlat: def, atkFlat: atk }), visible: true, tags: ['talent'] });
            if (shield > 0) {
              const max = capHp * unit.s.maxHp;
              const cur = unit.findBuff(BARRIER);
              if (cur) { cur.shield = Math.min(max, (cur.shield || 0) + shield); unit.markDirty(); }
              else battle.addBuff(unit, { key: BARRIER, shield: Math.min(max, shield), visible: true, tags: ['talent'] });
            }
            battle.fx('shield', { x: unit.x, y: unit.y, id: unit.id, talent: 'thumpy:sole' });
          }, { owner: unit });
        } },
      ],
      install(battle, unit) {
        // PRP-X: 阻挡敌人时，自身造成的元素损伤提升15%（trait bb ep_damage_scale，stage3 已折入记录）
        const epScale = num(tb.ep_damage_scale, 1);
        if (epScale !== 1) {
          battle.on('elementHit', (c) => {
            if (c.source === unit && c.dmg?.type === 'element' && c.target?.side === 'enemy' && unit.blocking.length > 0) c.dmg.mul *= epScale;
          }, { owner: unit });
        }
        // S2: another operator's physical damage on an enemy in the glue ⇒ ep_damage_ratio[damage] × her ATK 侵蚀损伤
        const rider = num(b2['ep_damage_ratio[damage]']);
        if (rider > 0) {
          battle.on('damaged', (c) => {
            const g = unit.mem.thumpyGlue, s = c.source, t = c.target;
            if (!g || !up(unit) || !s || s === unit || s.side !== 'ally' || s.kind !== 'op' || c.type !== 'phys' || !(c.amount > 0)) return;
            if (!t || t.side !== 'enemy' || t.isFlying || !hasHp(t) || !bodyInKeys(t, g.keys)) return;
            battle.dealDamage(unit, t, { type: 'element', element: 'erosion', amount: unit.s.atk * rider, tags: ['skill', 'thumpy:glue'] });
          }, { owner: unit });
        }
      },
    };
  },
};
