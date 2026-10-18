// server/sim/content/kits/ops/chess_char_5_96-shwaz.js — 黑 (char_340_shwaz) kit, tier 5 (PRESET).
// Conventions of the tier-5 kits: ../shared/tier5.js; kit contract and rules: ../README.md.
//
// 5_96(预设) 黑 — 重射手 (closerange)，2026-10-16 PR2 自 op-shwaz.js 改造转预设（同批 op-kit 退役，
// 注册由调用方负责）。数值全部来自 chess.json 记录（官方 blackboard；模组/潜能差异已由 build-data 折入
// 记录），此处不写死。
//   - 默认技能 S2 暮眼锐瞳 (skchr_shwaz_2)：ATK +bb.atk 持续技，T1 概率提至 bb['talent@prob']。
//     S1/S3 是 PRESET 商店棋子不可选，不搬（op-kit 的对应实现随文件退役）。
//   - T1 破甲箭头（talent 0）：每次攻击一掷（prob；技能段读 talent@prob），命中段当次伤害 ×atk_scale
//     （攻击力倍率，乘技能自身倍率；闪避不触发），命中后目标 defDown −20% 5s（最终 ×0.8，同名取最高）。
//     ARC-X（uniequip_002_shwaz）对本天赋无 NAMED 改动（stage1 仅属性：再部署 −25 由 stats 管线承担），
//     无需 op-kit 的 pierceBb 合并 —— 记录的 talents 已是折算结果，直接读。
//   - T2 交叉火力（talent 1）：场上存在黑和另外至少一名【狙击】干员时全体【狙击】干员 ATK +bb.atk，
//     0.5s 光环刷新（同名取最高）。ARC-X stage2+ 的「携带」分档本棋子（tier5 精锐 = stage1）不可达，
//     分支按描述判定保留（数据驱动，记录若改为携带文案仍正确）。
//   - ARC-Y 老剃刀不适用：本棋子 moduleId = uniequip_002_shwaz 即 ARC-X，op-kit 的正前方 install 块删除。
//   - 特质 garrison_996 卡池爆满（garrison 条目只是展示，引擎不处理 —— kit 实现）：<战斗中>每击杀
//     <1>名敌人，自身已激活的盟约层数 +3（普通）/ +6（精锐），每场战斗最多触发 5 次（2026-10-18 用户口径，
//     推翻 2026-10-16 的「层数合计每满 3 层 → 攻速 +1/+2 不设上限」）。走 battle.addLayers（伯塔尼/牛彦/
//     嵩鸫先例：走 layerGain hook + 逐盟约上限 clamp，kit 禁 import support/index.js —— kits_layout.test.js）。
// 层只经 addLayers 增长（自身已激活的全部盟约逐条 +N），不做周期轮询。

import { num, talentBb, up, skillRec} from '../shared/tier1.js';
import { genericSkillSpec } from '../../generic.js';
import { hasHp } from '../../../damage.js';

const S2 = 'skchr_shwaz_2';
/** 交叉火力's buff（光环与编队版共用：每干员一个效果，取最高）。 */
const CROSSFIRE = 'talent:shwaz:crossfire';
/** 交叉火力's refresh interval (s), as installAura. */
const AURA_EVERY = 0.5;
/** garrison_996 卡池爆满：每击杀 +N 层（普通 _a / 精锐 _b）与每场战斗触发上限。 */
const KILL_ADD = (golden) => (golden ? 6 : 3);
const KILL_CAP = 5;

/** A 【狙击】 operator (summons are never operators). */
const isSniperOp = (a) => !!a && a.kind === 'op' && a.def?.profession === 'SNIPER';

/** 交叉火力's blackboard 与是否按「携带」（编队，ARC-X stage2+）读 —— 文案数据驱动。 */
function crossfireOf(chess) {
  const t = (chess?.talents ?? []).find((x) => x && x.index === 1) ?? null;
  return { atk: num(t?.bb?.atk), squad: /携带/.test(String(t?.desc ?? '')) };
}

export default {
  chess_char_5_96_a: (bb, chess) => {
    const t0 = talentBb(chess, 0);
    const cross = crossfireOf(chess);
    const golden = !!chess?.isGolden;

    return {
    // 非默认技能（alt loadout）：genericSkillSpec 按该技能自己的记录生成 —— kit 覆盖要求每个可选技能有条目，
    // 行为与此前 generic 回退完全一致（详见 tools/kit-coverage.mjs 的 covered 口径）。
    skills: {
      'skchr_shwaz_1': genericSkillSpec(skillRec(chess, 'skchr_shwaz_1')),
      'skchr_shwaz_3': genericSkillSpec(skillRec(chess, 'skchr_shwaz_3'))
    },
      // 默认技能 = S2 暮眼锐瞳（数据 backup.skillIndex 1）。空 attack 覆写：技能期间她的攻击带 dmg.isSkill
      // （破甲箭头的概率取 talent@prob 档）。bb 即选中技能（S2）的 blackboard。
      skill: { kind: 'duration', mods: { atkPct: num(bb.atk) }, attack: {} },
      talents: [
        { install(battle, unit) { // 破甲箭头: one roll per attack; ×atk_scale on a proc, then DEF cut on the target hit
          const scale = num(t0.atk_scale, 1), cut = -num(t0.def), dur = num(t0.defdown_duration, 5), base = num(t0.prob);
          const raised = num(bb['talent@prob'], base);
          battle.on('hit', (ctx) => {
            const d = ctx.dmg, t = ctx.target;
            if (ctx.source !== unit || !t || t.side !== 'enemy' || !d.isAttack || d.isSplash || d.type === 'element') return;
            const m = unit.mem;
            if (!d.attackId || m.shwazRollId !== d.attackId) {
              m.shwazRollId = d.attackId;
              const p = d.isSkill ? raised : base;
              m.shwazProc = p > 0 && battle.rng.chance(p);
              if (m.shwazProc) battle.fx('crit', { x: t.x, y: t.y, id: unit.id });
            }
            if (!m.shwazProc) return;
            d.amount *= scale;
            d.shwazPierce = true;
          }, { owner: unit });
          battle.on('damaged', (ctx) => {
            if (ctx.source !== unit || !ctx.dmg?.shwazPierce || !(cut > 0) || !hasHp(ctx.target) || ctx.target.side !== 'enemy') return;
            battle.applyStatus(ctx.target, 'defDown', { duration: dur, value: cut, source: unit });
          }, { owner: unit });
        } },
        { install(battle, unit) { // 交叉火力: field aura（「携带」编队分档按文案判定，ARC-X stage2+）
          const v = cross.atk;
          if (!(v > 0)) return;
          const give = (a, extra) => {
            const cur = a.findBuff(CROSSFIRE);
            if (cur && cur.source !== unit && (cur.data?.v ?? 0) > v && cur.timeLeft > 0.05) return;
            battle.addBuff(a, { key: CROSSFIRE, mods: { atkPct: v }, source: unit, data: { v }, ...extra });
          };
          if (cross.squad) {
            const squad = battle.allyUnits.filter((a) => isSniperOp(a) && a.ownerId === unit.ownerId);
            if (squad.some((a) => a !== unit)) for (const a of squad) give(a, { persist: true, allowDead: true, tags: ['talent'] });
            return;
          }
          battle.every(AURA_EVERY, () => {
            if (!up(unit)) return;
            const snipers = battle.alliesFor(unit).filter(isSniperOp);
            if (!snipers.some((a) => a !== unit)) return;
            for (const a of snipers) give(a, { duration: AURA_EVERY + 0.1, tags: ['aura'] });
          }, { owner: unit, immediate: true });
        } },
      ],
      install(battle, unit) {
        // ---- 特质 garrison_996 卡池爆满（kit 实现）----
        // <战斗中>每击杀 1 名敌人 → 自身（所在玩家）**已激活**的全部盟约各 +3/+6 层；每场战斗最多触发
        // 5 次（unit.mem 计数，跨多次部署持续——「每场战斗」口径）。走 battle.addLayers（'op' reason，
        // layerGain hook 与逐盟约上限 clamp 照常生效；layerGain 又会驱动雷姆必拓 3 人档的 ATK 重算）。
        let kills = 0;
        battle.on('kill', (ctx) => {
          if (ctx.killer !== unit || ctx.victim?.side !== 'enemy') return;
          if (kills >= KILL_CAP) return;
          kills++;
          const ps = battle.getPlayer?.(unit.ownerId);
          for (const [bondId, b] of Object.entries(ps?.bonds ?? {})) {
            if (b?.active) battle.addLayers(unit.ownerId, bondId, KILL_ADD(golden), 'op', { source: unit });
          }
        }, { owner: unit });
      },
    };
  },
};
