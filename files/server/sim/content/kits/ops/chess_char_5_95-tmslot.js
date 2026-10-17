// server/sim/content/kits/ops/chess_char_5_95-tmslot.js — 时隙 (char_4236_tmslot) kit, tier 5 (2026-10-16 PR2 新建).
// Conventions of the tier-5 kits: ../shared/tier5.js; kit contract and rules: ../README.md.
//
// 5_95 时隙 (驭械术师 funnel，普通 E2Lv1 / 精锐 E2Lv60)。数值全部取自 data/chess.json 的 blackboard，此处不写死：
//   新产品测评 (天赋 T1)：攻击力 +atk（persist buff，tier1 statBuff）；浮游单元攻击时有 prob 概率使
//     目标停顿 sluggish 秒 —— 引擎把驭械术师的浮游单元结算为本体攻击的附带 hits（ai.js resolveHit，
//     伤害 tags 带 'funnel'），hit 钩子认 'funnel' 标记后 battle.rng.chance 判定并 applyStatus
//     'sluggish'（先例 chess_char_2_04-grabds.js / chess_char_6_98-headb2.js）。
//   科技与传统仪式 S2 (skchr_tmslot_2，默认技能，duration 40s)：浮游单元 +attack@cnt（skill.attack.hits
//     覆盖 profile.hits，attackOverride 与 base profile 合并、funnelMul 爬坡保留 —— ai.js
//     effectiveProfile / skills.js attackOverride），攻击力 +atk、攻击速度 +attack_speed（skill.mods）。
//     [ASSUMED] 简化：官方的「释放浮游单元锁定敌人攻击 / 锁定目标离开攻击范围立刻过载 / 过载后自身
//     停止攻击」流程引擎无浮游单元独立锁敌模型（compare 荒芜拉普兰德 S3 的虚拟 drone 群），本 kit 取
//     常驻简化：整个技能期间浮游单元 +1 且攻击力/攻速加成全程生效、本体继续普攻（未实现过载期停手）。
//   S1 攻击力强化·γ型 (skcom_atk_up[3]，非默认)：攻击力 +atk，generic spec 已覆盖，kit 不重复实现。
//   特质 garrison_997（获得时随机产层）走 prep 侧 meta.js，不在本 kit；
//   驭械术师分支（浮游单元法术伤害、同一敌人伤害爬坡 init/delta/max）由 professions.js funnel 承担
//   （trait bb init_atk_scale / delta_atk_scale / max_atk_scale 已进 profile），不重复实现。

import { num, talentBb, statBuff, onHitBy, skillRec} from '../shared/tier1.js';
import { genericSkillSpec } from '../../generic.js';

const S2 = 'skchr_tmslot_2'; // 科技与传统仪式（默认技能，见 data 的 isDefault）

export default {
  chess_char_5_95_a: (bb, chess) => {
    const t = talentBb(chess, 0); // 新产品测评 { atk, prob, sluggish }

    return {
    // 非默认技能（alt loadout）：genericSkillSpec 按该技能自己的记录生成 —— kit 覆盖要求每个可选技能有条目，
    // 行为与此前 generic 回退完全一致（详见 tools/kit-coverage.mjs 的 covered 口径）。
    skills: {
      'skcom_atk_up[3]': genericSkillSpec(skillRec(chess, 'skcom_atk_up[3]'))
    },
      // 默认技能放顶层 `skill`（content/index.js selectSkillSpec: 默认技能必须只在这里）。
      skill: {
        kind: 'duration',
        mods: { atkPct: num(bb.atk), aspd: num(bb.attack_speed) },
        // 浮游单元 +attack@cnt：本体 1 架 + cnt（attack.hits 覆盖，funnel 爬坡/法术类型保留在 profile）
        attack: { hits: 1 + Math.max(0, Math.floor(num(bb['attack@cnt'], 1))) },
      },
      talents: [{
        install(battle, unit) {
          // 新产品测评：攻击力 +atk（整场 persist）。
          statBuff(battle, unit, 'tmslot:t1', { atkPct: num(t.atk) });
          // 浮游单元命中（伤害 tags 'funnel'）时 prob 概率使目标停顿 sluggish 秒。
          const prob = num(t.prob, 0), slow = num(t.sluggish, 0);
          if (prob > 0 && slow > 0) {
            onHitBy(battle, unit, ({ target, dmg }) => {
              if (!target || !target.alive || !(Array.isArray(dmg?.tags) && dmg.tags.includes('funnel'))) return;
              if (battle.rng.chance(prob)) battle.applyStatus(target, 'sluggish', { duration: slow, source: unit });
            });
          }
        },
      }],
    };
  },
};
