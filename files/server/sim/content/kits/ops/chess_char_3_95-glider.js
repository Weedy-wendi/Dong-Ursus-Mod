// server/sim/content/kits/ops/chess_char_3_95-glider.js — 蜜莓 (char_449_glider) kit, tier 3 (2026-10-16 PR2 新建).
// Conventions of the tier-3 kits: ../shared/tier3.js; kit contract and rules: ../README.md.
//
// 3_95 蜜莓 (行医 wandermedic，普通 E2Lv1 / 精锐 E2Lv60)。数值全部取自 data/chess.json 的 blackboard，此处不写死：
//   集体意识 (天赋 T1)：攻击范围内远程干员最大生命 +max_hp —— 远程判定用 def.position === 'RANGED'
//     （先例 op-chen2.js），范围判定用 unit.rangeKeySet（先例 chess_char_2_05-harold.js），installAura
//     每 0.5s 刷新（tier1 helper）；只认干员本体（kind === 'op'，召唤物不算干员）。
//   振奋 S2 (skchr_glider_2，默认技能，duration 25s)：攻击力 +atk（skill.mods），每次治疗以元素损伤
//     最严重的 attack@max_target 名干员为目标 —— 目标数扩展用引擎原生 targeting.maxTargets（ai.js
//     acquireTargets 的治疗分支），排序用 beforeAttack 按 elemLoad 替换 ctx.targets（照
//     chess_char_2_05-harold.js 重症优先的同一管线）。
//     [ASSUMED] 治疗目标 = 元素损伤最严重者优先，不足 max_target 时由引擎默认（hpRatio 升序）目标补足；
//     引擎治疗管线对满血目标只结算元素损伤回复（行医分支 elementHealRatio 由 professions.js 承担，
//     本 kit 不重复实现）。
//   S1 激励 (skchr_glider_1，非默认)：下次治疗以元素损伤最严重的 2 名干员为目标并附加持续元素损伤
//     回复 —— 非默认技能按任务范围不在此实现，被选时走 generic spec 兜底。
//   特质 garrison_995（获得时随机产层）走 prep 侧 meta.js，不在本 kit；
//   行医特质「恢复生命并回复元素损伤」由 professions.js wandermedic (elementHealRatio) 承担，不重复实现。

import { COLS, ELEMENT_GAUGE_MAX } from '../../../constants.js';
import { num, talentBb, installAura, alliesInGridOf, skillRec} from '../shared/tier1.js';
import { genericSkillSpec } from '../../generic.js';

const S2 = 'skchr_glider_2'; // 振奋（默认技能，见 data 的 isDefault）

/** 单位各元素损伤计量的最大值（先例 chess_char_2_05-harold.js elemLoad）。 */
const elemLoad = (a) => Math.max(a.elem.burn, a.elem.neural, a.elem.necrosis, a.elem.apoptosis, a.elem.erosion ?? 0);

export default {
  chess_char_3_95_a: (bb, chess) => {
    const t = talentBb(chess, 0); // 集体意识 { max_hp }
    const maxTargets = () => Math.max(1, Math.floor(num(bb['attack@max_target'], 1)));

    return {
    // 非默认技能（alt loadout）：genericSkillSpec 按该技能自己的记录生成 —— kit 覆盖要求每个可选技能有条目，
    // 行为与此前 generic 回退完全一致（详见 tools/kit-coverage.mjs 的 covered 口径）。
    skills: {
      'skchr_glider_1': genericSkillSpec(skillRec(chess, 'skchr_glider_1'))
    },
      // 默认技能放顶层 `skill`（content/index.js selectSkillSpec: 默认技能必须只在这里）。
      skill: {
        kind: 'duration', heal: true,
        mods: { atkPct: num(bb.atk) },
        // 治疗目标数扩展到 attack@max_target（引擎治疗分支按 prof.maxTargets 放宽，见 ai.js acquireTargets）
        targeting: { maxTargets: maxTargets() },
      },
      talents: [{
        install(battle, unit) {
          // S2 振奋的选目标排序：技能激活期间，每次治疗以元素损伤最严重的干员优先（引擎默认按 hpRatio）。
          battle.on('beforeAttack', (ctx) => {
            if (ctx.attacker !== unit || !unit.skill || unit.skill.id !== S2 || !unit.skill.active) return;
            const range = unit.rangeKeySet || new Set(unit.rangeKeys || []);
            const cands = [...(ctx.targets || []), ...alliesInGridOf(battle, unit).filter((a) => !ctx.targets?.includes(a) && elemLoad(a) > 0)]
              .sort((x, y) => elemLoad(y) - elemLoad(x) || x.hpRatio - y.hpRatio || x.deploySeq - y.deploySeq)
              .slice(0, maxTargets());
            if (cands.length) ctx.targets = cands;
          }, { owner: unit });

          // 集体意识：攻击范围内的远程干员 maxHp +max_hp%（光环节照 tier1 installAura，最强者不叠加）。
          const rangeSet = () => unit.rangeKeySet || new Set(unit.rangeKeys || []);
          installAura(battle, unit, {
            key: 'glider:t1',
            select: (a) => a.kind === 'op' && a.def?.position === 'RANGED' && rangeSet().has(a.tileR * COLS + a.tileC),
            mods: { hpPct: num(t.max_hp) },
          });
        },
      }],
    };
  },
};
