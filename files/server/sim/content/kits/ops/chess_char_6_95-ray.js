// server/sim/content/kits/ops/chess_char_6_95-ray.js — 莱伊 (char_4117_ray) kit, tier 6 (PRESET).
// Conventions of the tier-6 kits: ../shared/tier6.js; kit contract and rules: ../README.md.
//
// 6_95(预设) 莱伊 — 猎手 (hunter)，2026-10-16 PR2 自 op-ray.js 改造转预设（同批 op-kit 退役，注册由调用方
// 负责）。数值全部来自 chess.json 记录（官方 blackboard；模组/潜能差异已由 build-data 折入记录）。
//   - 特性（猎手）「攻击时需要消耗子弹且攻击力提升至120%，不攻击时会缓慢地装填子弹（最多8发）」：kit 自带
//     装填（trait install / canAttack / afterAttack —— 引擎 hunter profile 只留给雪猎；一次装填是攻击循环的
//     一个动作，历时基础攻击间隔，不受攻速影响，装 1 发；入场满弹）。可对空、阻挡 1 由数据承担。
//     HUN-X《跳舞的月光》(uniequip_002_ray) 追加「子弹数量为空时下次装填额外加装1发子弹」（trait bb
//     extra_add，stage3 = 1，已折入记录的 trait.bb）。
//   - T1 巡哨伙伴：可在攻击范围内部署沙地兽（token_10034_ray_sndbst，手牌棋子，玩家侧发放）侦察 —— 延伸
//     攻击范围与技能触发范围、优先攻击区域内目标且物理伤害 ×(1+damage_scale)、25s 后退场 [ASSUMED: 侦察
//     随驻留结束]、莱伊退场强制撤回、重部署计时（DP 消耗；S2 期间 ×(1+respawn_time)）；S2 期间命中其区域
//     的子弹在它撤退时回收（HUN-X 空弹加装优先，至多弹匣上限）。
//   - T2 入神：攻击同一目标时每次攻击 ATK +atk（至多 max_stack_cnt 层），换目标即失，离场清空。
//   - 默认技能 S2 广域警觉 (skchr_ray_2)（AUTO/攻回，持续时间无限 = toggle，只作用自身/召唤物 → 满蓝即放
//     `trigger: 'SP_FULL'`，owner's AUTO rule）：范围 4-10，ATK +atk；沙地兽再部署时间 ×(1+respawn_time)；
//     被动 = 上面的子弹回收。
//   - 特质 garrison_999 猎手的直觉（garrison 条目只是展示，引擎不处理 —— kit 实现）：<战斗中>【雷姆必拓】
//     【精准】两条**已激活**盟约层数合计每满 3 层 → 本干员攻击力 +1%（普通）/ +2%（精锐），**无重量额外
//     增伤**（2026-10-16 用户口径，删除「重量≥3 改 +3%/+6%」）。persist buff 的 atkPct（直接乘算口径 ——
//     与 garrison_983 早露 chess_char_6_99-poca.js 同款写法）。「已激活/层数」内联读
//     battle.getPlayer(pid).bonds[id]（kit 禁 import support/index.js —— kits_layout.test.js）。
//   - S1/S3 是 PRESET 商店棋子不可选，不搬。
//   重量字段 = unit.weight（= s.massLevel，含失重修正）。

import { num, talentBb, traitBb, skillRec, up} from '../shared/tier1.js';
import { genericSkillSpec } from '../../generic.js';
import { acquireTargets, effectiveProfile } from '../../../ai.js';
import { sortEnemyTargets } from '../../../targeting.js';
import { bodyInKeys } from '../../../body.js';
import { startCountdown } from '../../tokens.js';

const S2 = 'skchr_ray_2';
export const SANDBEAST = 'token_10034_ray_sndbst';
/** 巡哨伙伴: the 沙地兽's scouting when its def carries no duration (PRTS: "持续25秒"). */
const LIFE_FALLBACK = 25;
/** Seconds between two tries of a 沙地兽 that left to come back (tile busy, DP short, 莱伊 away). */
const RETRY = 0.25;
const TRANCE_KEY = 'talent:ray:trance';
/** garrison_999 猎手的直觉：读的两条盟约、层数步长与每 3 层的攻击力（普通 garrison_999_a / 精锐 _b）。 */
const BOND_BONDS = ['rimBillitonShip', 'preciShip'];
const BOND_KEY = 'garrison:ray:byLayer';
const BOND_DIV = 3;
const BOND_ATK = (golden) => (golden ? { base: 0.02 } : { base: 0.01 });   // 无重量额外增伤（2026-10-16 用户口径）

/** The magazine of the trait ("最多8发"). */
const ammoMax = (unit) => Math.max(1, Math.floor(num(unit.profile?.ammoMax, 8)));
/** First talent of a normalised token def holding `key` (token talents keep no index). */
const tokTalent = (def, key) => (def?.talents ?? []).find((t) => t && t.bb && t.bb[key] != null) ?? null;

/** garrison_999: floor(Σ 已激活的【雷姆必拓】【精准】层数 / 3)（未激活的不计入）。 */
function bondSteps(battle, unit) {
  const ps = battle.getPlayer?.(unit.ownerId);
  if (!ps || !ps.bonds || typeof ps.bonds !== 'object') return 0;
  let total = 0;
  for (const id of BOND_BONDS) {
    const b = ps.bonds[id];
    if (b && b.active) total += Math.max(0, num(b.layers, 0));
  }
  return Math.floor(total / BOND_DIV);
}

/** The 沙地兽's kit: no attack, 无敌, 禁疗 (its untargetability comes from its trait text, simdata normalizeToken). */
function sandbeastKit() {
  return {
    skill: null,
    trait: { noAttack: true },
    talents: [],
    install(battle, t) {
      battle.addBuff(t, { key: 'ray:sandbeast', flags: { invulnerable: true, noHeal: true }, persist: true, allowDead: true });
    },
  };
}

export default {
  chess_char_6_95_a: (bb, chess) => {
    const s2 = skillRec(chess, S2);
    const t0 = talentBb(chess, 0), t1 = talentBb(chess, 1);
    const extraAdd = Math.max(0, Math.floor(num(traitBb(chess).extra_add)));
    const b2 = bb;   // bb = 选中技能（S2 广域警觉）的 blackboard
    const picked = chess?.skill?.skillId ?? null;
    const tokenId = (chess?.talents ?? []).find((t) => t && t.tokenKey)?.tokenKey ?? SANDBEAST;
    const golden = !!chess?.isGolden;

    /** One reload: her base attack time (PRTS: ASPD never changes it; S3 的 -1.2 不搬). */
    const reloadInterval = (unit) => Math.max(0.05, num(unit.base?.bat, 1.6));
    const startReload = (unit) => {
      const m = unit.mem;
      m.rayReloading = true;
      if ((unit.trait.ammo ?? 0) <= 0 && extraAdd > 0) m.rayLoadExtra = (m.rayLoadExtra ?? 0) + extraAdd;   // HUN-X
      unit.atkCd = reloadInterval(unit);
    };
    const finishReload = (unit) => {
      const m = unit.mem;
      m.rayReloading = false;
      const add = 1 + Math.max(0, Math.floor(num(m.rayLoadExtra)));
      m.rayLoadExtra = 0;
      unit.trait.ammo = Math.min(ammoMax(unit), (unit.trait.ammo ?? 0) + add);
    };
    const resetTrait = (unit) => {
      unit.trait.ammo = ammoMax(unit);
      Object.assign(unit.mem, { rayReloading: false, rayLoadExtra: 0 });
    };

    /** garrison_999: 把当前步数的攻击力加成落到 persist buff 上（0 = 摘除；同名 replace）。 */
    const recomputeBond = (battle, unit) => {
      const { base } = BOND_ATK(golden);
      const atkPct = bondSteps(battle, unit) * base;
      const cur = unit.findBuff(BOND_KEY);
      if (!(atkPct > 0)) { if (cur) battle.removeBuff(unit, cur); return; }
      if (!cur || cur.mods?.atkPct !== atkPct) {
        battle.addBuff(unit, { key: BOND_KEY, persist: true, allowDead: true, refresh: 'replace', mods: { atkPct }, tags: ['talent'] });
      }
    };

    return {
    // 非默认技能（alt loadout）：genericSkillSpec 按该技能自己的记录生成 —— kit 覆盖要求每个可选技能有条目，
    // 行为与此前 generic 回退完全一致（详见 tools/kit-coverage.mjs 的 covered 口径）。
    skills: {
      'skchr_ray_1': genericSkillSpec(skillRec(chess, 'skchr_ray_1')),
      'skchr_ray_3': genericSkillSpec(skillRec(chess, 'skchr_ray_3'))
    },
      trait: {
        // 猎手 (PRTS 分支特性信息): her own reload, an action of the attack loop (canAttack runs once the cooldown is over)
        install(battle, unit) {
          resetTrait(unit);
          battle.on('deploy', (ctx) => { if (ctx.unit === unit) resetTrait(unit); }, { owner: unit });
        },
        canAttack(battle, unit) {
          const m = unit.mem;
          if (m.rayReloading) finishReload(unit);
          const max = ammoMax(unit), ammo = unit.trait.ammo ?? 0;
          if (ammo <= 0 || (ammo < max && !acquireTargets(battle, unit, effectiveProfile(unit)).length)) { startReload(unit); return false; }
          return true;
        },
        afterAttack(battle, unit) { unit.trait.ammo = Math.max(0, (unit.trait.ammo ?? 0) - 1); },
      },
      // 默认技能 = S2 广域警觉（数据 backup.skillIndex 1）。bb 即其 blackboard。
      skill: {
        kind: 'toggle',
        trigger: 'SP_FULL',
        mods: { atkPct: num(b2.atk) },
        targeting: s2?.rangeGrid ? { rangeGrid: s2.rangeGrid.map((p) => [p[0], p[1]]) } : undefined,
      },
      talents: [
        { install(battle, unit) { // 巡哨伙伴 + the 沙地兽 (and S2's bullet recovery)
          const m = unit.mem;
          const mine = (t) => !!t && t.kind === 'token' && t.defId === tokenId && t.ownerUnit === unit;
          // her placed 沙地兽 pieces run the 沙地兽's kit (set up here, before the battle starts — as 鸿雪's 打字机)
          for (const t of battle.allyUnits) {
            if (!mine(t) || t.alive || t.deployed) continue;
            if (t.kit) battle.offOwner(t);
            battle._setupUnit(t, sandbeastKit());
          }
          const ds = num(t0.damage_scale);
          m.rayArea = null;
          m.rayBullets = 0;
          if (unit.skill) unit.skill.addTriggerRange(() => (m.rayAreaKeys ? [m.rayAreaKeys] : []));
          const endArea = () => { m.rayArea = null; m.rayAreaKeys = null; m.rayBeast = null; battle.setExtraRange(unit, null); };
          battle.on('deploy', (ctx) => {
            const t = ctx.unit;
            if (!mine(t)) return;
            const life = num(tokTalent(t.def, 'duration')?.bb?.duration, LIFE_FALLBACK);
            m.rayBeast = t;
            m.rayAreaKeys = [...t.rangeKeys];
            m.rayArea = new Set(m.rayAreaKeys);
            m.rayBullets = 0;
            m.rayCounted = 0;
            battle.setExtraRange(unit, m.rayAreaKeys);
            startCountdown(battle, t, life); // a countdown summon (content/tokens.js): its bar = the life left
            const seq = t.deploySeq;
            battle.after(life, () => { if (t.alive && t.deploySeq === seq) battle.retreat(t, { reason: 'expired', permanent: true }); }, { owner: unit });
          }, { owner: unit });
          battle.on('death', (ctx) => {
            const t = ctx.unit;
            if (t === unit) { // "莱伊退场时强制撤退场上的沙地兽"
              for (const x of battle.allyUnits) if (mine(x) && x.alive) battle.retreat(x, { reason: 'retreat', permanent: true });
              return;
            }
            if (!mine(t) || battle.finished) return;
            t.removed = false; // the piece stays (Battle.redeploy needs it; its hooks are kept)
            if (m.rayBeast === t) endArea();
            // S2 passive: the bullets that hit in its area come back (ray_sndbst_collect → ray_tr_add: its count — ≤ its own
            // trait value — onto her magazine, HUN-X's extra_add first when she is empty, capped at her maximum)
            if (picked === S2 && m.rayBullets > 0 && up(unit)) {
              const back = Math.min(m.rayBullets, Math.max(1, Math.floor(num(t.def?.traitBb?.value, ammoMax(unit)))));
              const empty = (unit.trait.ammo ?? 0) <= 0 ? extraAdd : 0;
              unit.trait.ammo = Math.min(ammoMax(unit), (unit.trait.ammo ?? 0) + empty + back);
            }
            m.rayBullets = 0;
            const left = battle.time;
            battle.every(RETRY, (b, sched) => {
              if (t.alive || t.removed || b.finished) { sched.cancel(); return; }
              const mul = unit.skill && unit.skill.active && unit.skill.id === S2 ? Math.max(0, 1 + num(b2.respawn_time)) : 1;
              if (b.time + 1e-9 < left + Math.max(0, num(t.base.respawnTime)) * mul || !up(unit)) return;
              if (b.redeploy(t, { free: false })) sched.cancel();
            }, { owner: unit });
          }, { owner: unit, priority: -10 });
          // 自身优先攻击该区域内的目标 (after the enemies she blocks)
          battle.on('beforeAttack', (ctx) => {
            if (ctx.attacker !== unit || !m.rayArea || !ctx.targets.length) return;
            const area = m.rayArea, prof = ctx.profile ?? unit.profile;
            const all = battle.enemiesInKeys(unit.rangeKeys, unit, prof);
            for (const e of battle.blockedTargets(unit, prof)) if (!all.includes(e)) all.push(e);
            if (!all.some((e) => bodyInKeys(e, area))) return;
            sortEnemyTargets(battle, unit, all, prof.priority ?? null);
            const rank = (e) => (e.blockedBy === unit ? 0 : bodyInKeys(e, area) ? 1 : 2);
            const order = all.map((e, i) => ({ e, i, r: rank(e) })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.e);
            ctx.targets = order.slice(0, ctx.targets.length);
          }, { owner: unit, priority: 10 });
          // ×(1 + damage_scale) on her physical damage to an enemy of the area
          if (ds > 0) {
            battle.on('hit', (ctx) => {
              if (ctx.source !== unit || !m.rayArea || !ctx.target || ctx.target.side !== 'enemy' || ctx.dmg.type !== 'phys') return;
              if (bodyInKeys(ctx.target, m.rayArea)) ctx.dmg.mul *= 1 + ds;
            }, { owner: unit });
          }
          // S2 passive: count the bullets of her attacks that hit an enemy of the area (one per attack)
          if (picked === S2) {
            battle.on('damaged', (ctx) => {
              const d = ctx.dmg, e = ctx.target;
              if (ctx.source !== unit || !m.rayArea || !d || !d.isAttack || !e || e.side !== 'enemy') return;
              if ((d.attackId && d.attackId === m.rayCounted) || !bodyInKeys(e, m.rayArea)) return;
              m.rayCounted = d.attackId;
              m.rayBullets++;
            }, { owner: unit });
          }
        } },
        { install(battle, unit) { // 入神: +atk per attack on the same target (≤ max_stack_cnt), lost on a new target
          const atk = num(t1.atk), max = Math.max(1, Math.floor(num(t1.max_stack_cnt, 3)));
          if (!(atk > 0)) return;
          const m = unit.mem;
          m.rayTrance = null;
          m.rayStacks = 0;
          battle.on('deploy', (ctx) => { if (ctx.unit === unit) { m.rayTrance = null; m.rayStacks = 0; } }, { owner: unit });
          battle.on('beforeAttack', (ctx) => {
            const t = ctx.attacker === unit ? ctx.targets[0] : null;
            if (!t) return;
            if (m.rayTrance !== t) { m.rayTrance = t; m.rayStacks = 0; }
            m.rayStacks = Math.min(max, m.rayStacks + 1);
            battle.addBuff(unit, { key: TRANCE_KEY, mods: { atkPct: atk * m.rayStacks }, tags: ['talent'] });
          }, { owner: unit, priority: -10 });
        } },
      ],
      install(battle, unit) {
        // ---- 特质 garrison_999 猎手的直觉（kit 实现）----
        // 基础段：【雷姆必拓】【精准】已激活层数合计每满 3 层 → 攻击力 +1%/+2%（persist buff 的 atkPct，
        // 直接乘算 —— garrison_983 早露 poca 同款口径）；install 初算 + layerGain 后 battle.after(0) 防抖重算。
        recomputeBond(battle, unit);
        let pending = false;
        battle.on('layerGain', () => {
          if (pending) return;
          pending = true;
          battle.after(0, () => { pending = false; recomputeBond(battle, unit); }, { owner: unit });
        }, { owner: unit });
      },
    };
  },
};
