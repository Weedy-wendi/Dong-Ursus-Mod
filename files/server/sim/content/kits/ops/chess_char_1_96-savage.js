// server/sim/content/kits/ops/chess_char_1_96-savage.js — 暴行 (char_230_savage) kit, tier 1 (2026-10-16 PR2 新建).
// Conventions of the tier-1 kits: ../shared/tier1.js; kit contract and rules: ../README.md.
//
// 1_96 暴行 (强攻手 centurion，普通 E1Lv55 / 精锐 E2Lv50)。数值全部取自 data/chess.json 的 blackboard，此处不写死：
//   山谷 (天赋 T1)：周围四格中有 cnt 格以上高地地形时攻击力/防御力 +atk/+def —— 引擎有地形数据
//     (battle.grid.tile(r, c).height === 'HIGH'，先例 chess_char_6_98-headb2.js highlandsAround)，按官方条件实现；
//     「周围四格」取上下左右四个正交邻格（无朝向旋转）。
//   微差爆破 S2 (skchr_savage_2，默认技能)：instant，对前方技能范围内至多 max_target 个敌人造成
//     atk_scale 攻击力的物理伤害 —— 范围用数据的 SKILL_RANGE 触发格 (def.skill.trigger.grid，即
//     skill_table customRangeGrid [[0,0],[0,1],[0,2],[0,3]])，敌人选取走 tier1 enemiesInGrid（先例
//     chess_char_2_03-slchan.js / op-judge.js）。
//   S1 横冲直撞 (skchr_savage_1，非默认)：本次攻击造成 atk_scale 物理伤害的普攻增幅，generic spec
//     (attack.atkScale) 已覆盖，kit 不重复实现。
//   特质 garrison_993（出售时获得资金）走 prep 侧 meta.js，不在本 kit。
//   精英特质追加「攻击被阻挡的敌人攻击力提升至110%」由职业/特质层承担（centurion），本 kit 不重复实现。

import { num, talentBb, toggleBuff, enemiesInGrid, skillRec } from '../shared/tier1.js';

const S2 = 'skchr_savage_2'; // 微差爆破（默认技能，见 data 的 isDefault）

export default {
  chess_char_1_96_a: (bb, chess, def) => {
    const t = talentBb(chess, 0); // 山谷 { cnt, atk, def }
    const scale = () => num(bb.atk_scale, 1);
    const maxTargets = () => Math.max(1, Math.floor(num(bb.max_target, 1)));

    return {
      // S1 强力击·β型（非默认）：「下次攻击的攻击力提高至 atk_scale」——instant + attack.atkScale 的普攻增幅
      // （generic 的同款映射，这里手写以满足 kit 覆盖要求；elite 形态同构，无需单独条目）。
      skills: {
        skchr_savage_1: { kind: 'instant', attack: { atkScale: num(skillRec(chess, 'skchr_savage_1')?.bb?.atk_scale, 1.85) } },
      },
      // 默认技能放顶层 `skill`（content/index.js selectSkillSpec: 默认技能必须只在这里）。
      skill: {
        kind: 'instant',
        onStart({ battle, unit }) {
          // 技能范围：数据的 SKILL_RANGE 触发格（normalizeChess 放进 def.skill.trigger.grid）
          const grid = def?.skill?.trigger?.grid ?? skillRec(chess, S2)?.trigger?.customRangeGrid ?? null;
          const foes = enemiesInGrid(battle, unit, grid, { n: maxTargets() });
          for (const e of foes) {
            if (!e.alive) continue;
            battle.dealDamage(unit, e, { amount: unit.s.atk * scale(), type: 'phys', isSkill: true, tags: ['skill'] });
          }
        },
      },
      talents: [{
        install(battle, unit) {
          // 山谷：上下左右四邻格中高地地形 ≥ cnt 格时常驻 atk/def%（条件每 tick 复查，进退高地自动增减）。
          const cnt = Math.max(1, Math.floor(num(t.cnt, 2)));
          const highlands = () => {
            let n = 0;
            for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
              const r = unit.tileR + dr, c = unit.tileC + dc;
              if (battle.grid.inRect(r, c) && battle.grid.tile(r, c).height === 'HIGH') n++;
            }
            return n;
          };
          toggleBuff(battle, unit, 'savage:valley', () => highlands() >= cnt, { atkPct: num(t.atk), defPct: num(t.def) });
        },
      }],
    };
  },
};
