// server/sim/content/kits/ops/chess_char_2_96-firwhl.js — 火哨 (char_493_firwhl) kit, tier 2 (2026-10-16 PR2 新建).
// Conventions of the tier-2 kits: ../shared/tier2.js; kit contract and rules: ../README.md.
//
// 2_96 火哨 (堡垒 fortress，普通 E1Lv60 / 精锐 E2Lv55)。数值全部取自 data/chess.json 的 blackboard，此处不写死：
//   进退自如 (天赋 T1)：未阻挡敌人时攻击力 +atk，阻挡敌人时防御力 +def —— 两个 toggleBuff 按
//     unit.blocking.length 切换（先例 chess_char_2_03-slchan.js / chess_char_2_08-bubble.js）。
//   焦土 S2 (skchr_firwhl_2，默认技能，数据 TAKE_DAMAGE 触发，duration 17s)：每次攻击在目标周围
//     地面产生持续 projectile_life_time 秒的燃烧区域，区域内的地面敌人每秒受 burn.atk_scale × ATK
//     法术伤害 —— 地面 tile 追踪照 op-thumpy.js S2 胶水的思路自行实现：unit.mem 里 tileKey → 到期
//     时间，battle.every(1) 独立心跳对区域内的地面敌人（enemiesInKeys canHitFly:false）结算，技能
//     结束后余燃继续烧完各自时长。
//     [ASSUMED] 「目标周围四格」按任务口径取目标格的 3×3 邻域（含目标所在格，燃烧覆盖被攻击目标本格）；
//     [ASSUMED] 多次攻击铺出的区域重叠时同一敌人每秒仍只结算一次（不按区域叠加）；[ASSUMED] 燃烧
//     结算不受选中规则限制之外的隐匿/无敌豁免，走 enemiesInKeys 的常规可选判定；[ASSUMED] 火哨退场
//     后余燃按既有时长继续结算（区域独立于施法者）。
//   S1 灼热扫射 (skchr_firwhl_1，非默认)：下次攻击造成 atk_scale 物理伤害并留下 burn_duration 秒燃烧，
//     generic spec 覆盖主伤害，kit 不重复实现（燃烧部分在 S1 被选为技能时由 generic 兜底）。
//   特质 garrison_994（自然技力回复）走官方 attr_common_global_buff 数据通路，不在本 kit；
//   堡垒分支「不阻挡敌人时优先远程群体物理攻击」由职业层承担（professions.js fortress），不重复实现。

import { COLS } from '../../../constants.js';
import { num, talentBb, toggleBuff, skillRec} from '../shared/tier1.js';
import { genericSkillSpec } from '../../generic.js';

const S2 = 'skchr_firwhl_2'; // 焦土（默认技能，见 data 的 isDefault）

/** 燃烧铺贴范围：目标格的 3×3 邻域（任务口径，见头注 [ASSUMED]）。 */
const BURN_AREA = [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export default {
  chess_char_2_96_a: (bb, chess) => {
    const t = talentBb(chess, 0); // 进退自如 { atk, def }
    const life = () => num(bb['attack@projectile_delay_time'], num(bb.projectile_life_time, 4));
    const burnScale = () => num(bb['attack@burn.atk_scale'], num(bb['burn.atk_scale'], 0));

    return {
    // 非默认技能（alt loadout）：genericSkillSpec 按该技能自己的记录生成 —— kit 覆盖要求每个可选技能有条目，
    // 行为与此前 generic 回退完全一致（详见 tools/kit-coverage.mjs 的 covered 口径）。
    skills: {
      'skchr_firwhl_1': genericSkillSpec(skillRec(chess, 'skchr_firwhl_1'))
    },
      // 默认技能放顶层 `skill`（content/index.js selectSkillSpec: 默认技能必须只在这里）。
      skill: {
        kind: 'duration',
        onStart({ battle, unit }) {
          unit.mem.firwhlBurn = new Map(); // tileKey → 到期时间（battle.time + life）
        },
        // onHit：每次攻击一次（主目标），在目标周围铺燃烧格（区域描述 fx 给客户端）。
        onHit({ battle, unit, target }) {
          if (!target || !target.alive) return;
          const m = unit.mem.firwhlBurn ?? (unit.mem.firwhlBurn = new Map());
          const tr = Math.round(target.y), tc = Math.round(target.x);
          const until = battle.time + life();
          for (const [dr, dc] of BURN_AREA) {
            const r = tr + dr, c = tc + dc;
            if (!battle.grid.inRect(r, c) || !battle.grid.groundPassable(r, c)) continue;
            m.set(r * COLS + c, until);
          }
          battle.fx('zone', { x: tc, y: tr, radius: 1.2, dur: life(), id: unit.id, skill: 'firwhl:burn' });
          // 独立心跳：每秒对仍燃烧的格子上的地面敌人结算一次法术伤害；区域清空/全部到期即自毁。
          if (!unit.mem.firwhlPulse) {
            unit.mem.firwhlPulse = battle.every(1, (b, sc) => {
              const burn = unit.mem.firwhlBurn;
              if (!burn || !burn.size) { sc.cancel(); unit.mem.firwhlPulse = null; return; }
              let latest = 0;
              for (const [k, exp] of burn) {
                if (exp <= b.time) burn.delete(k);
                else if (exp > latest) latest = exp;
              }
              if (!burn.size) { sc.cancel(); unit.mem.firwhlPulse = null; return; }
              for (const e of b.enemiesInKeys([...burn.keys()], unit, { canHitFly: false })) {
                if (!e.alive) continue;
                b.dealDamage(unit, e, { amount: unit.s.atk * burnScale(), type: 'arts', isSkill: true, canDodge: false, tags: ['zone', 'skill'] });
              }
              if (b.time >= latest) { sc.cancel(); unit.mem.firwhlPulse = null; }
            });
          }
        },
      },
      talents: [{
        install(battle, unit) {
          // 进退自如：未阻挡敌人 → atk%；阻挡敌人 → def%（互斥切换，每 tick 复查）。
          toggleBuff(battle, unit, 'firwhl:t1_atk', () => unit.blocking.length === 0, { atkPct: num(t.atk) });
          toggleBuff(battle, unit, 'firwhl:t1_def', () => unit.blocking.length > 0, { defPct: num(t.def) });
        },
      }],
    };
  },
};
