// server/sim/content/kits/ops/chess_char_3_96-kichi.js — 吉星 (char_4203_kichi) kit, tier 3 (自定义, 2026-10-13).
// Conventions of the tier-3 kits: ../shared/tier3.js; kit contract and rules: ../README.md. 5★ 狙击 / 散射手(reaperrange)。
// 数值全部来自官方数据表的 blackboard；技能/天赋/模组描述来自 PRTS 吉星。
//   - 形态：普通 _a = E1 Lv60 / rank 4 / 无模组；精锐 _b = E2 Lv55 / rank 7 / RPR-X 可疑的宣传页 stage 1
//     （数据承载 {hp110,atk37} + 特性更新「前方一横排攻击力提升至160%」—— 特性由职业层从数据读，kit 不重复实现）。
//   - 特性（散射手）「攻击范围内的所有敌人，对自己前方一横排的敌人攻击力提升至150%」：职业层承担
//     （professions.js reaperrange），本 kit 不重复实现。
//   - T1 好运连击！（精英 1 起）：上场后每击倒过**一种**敌人（内部 id 去重），自身造成的伤害 +6%，最多叠加
//     max_stack_cnt 次（E1 2 次 / E2 3 次，talentBb 按相位）；退场清空（PRTS 备注）。
//   - S1 欢迎您来！（非默认）：攻击间隔略微增大(+0.5)，每次攻击后攻击力 +atk，最多叠加 4 次（refresh 'stack'，
//     op-botany 攻速叠层同款写法），持续至技能结束。
//   - S2 吉星高照！（默认，见 chess.json defaultSkillIndex 1）：攻击间隔增大(+0.7)，攻击力 +atk；攻击时依次循环
//     对命中目标施加 停顿(attack@unmoveable)/束缚(attack@sluggish)/晕眩(attack@stun)（PRTS：每次攻击完成后更换，
//     每次开启技能总是从停顿开始循环）。
//   - 干员自身效果【采集单第 8 项】鸿运当头（garrison_991）：<获得干员时>自身所属盟约 +6/12 —— **不需要已激活**
//     （未激活也加，鸿雪 986 同口径；2026-10-13 用户确认）—— prep 事件，
//     走 garrisons/meta.js 自定义处理器 act2autochess_gar_eff_991_a/b（SERVER_GAIN），本 kit（战斗侧）不含它。

import { num, talentBb, skillRec, batMod, up } from '../shared/tier1.js';

const S1 = 'skchr_kichi_1';
const S2 = 'skchr_kichi_2';

const bbOf = (chess, id) => skillRec(chess, id)?.bb ?? {};
/** 敌人「种类」内部 id（击倒数去重用）：敌人的 def 记录键。 */
const speciesOf = (e) => e?.def?.enemyId ?? e?.def?.raw?.enemyId ?? e?.def?.key ?? e?.def?.name ?? null;

export default {
  chess_char_3_96_a: (bb, chess) => {
    const t0 = talentBb(chess, 0);          // 好运连击！：damage_scale / max_stack_cnt（E1 2 层、E2 3 层）
    const hasTalent = Array.isArray(chess?.talents) && chess.talents.length > 0;
    const b1 = bbOf(chess, S1), b2 = bbOf(chess, S2);

    const s1Spec = {
      kind: 'duration',
      duration: skillRec(chess, S1)?.duration ?? 33,
      mods: { batPct: batMod(num(b1.base_attack_time, 0.5), chess) },
    };
    // 停顿/束缚/晕眩循环（bb 键名与描述的对应按 PRTS 文案：unmoveable→停顿、sluggish→束缚、stun→晕眩）
    const CYCLE = Object.freeze([
      { status: 'sluggish', key: 'attack@unmoveable' },
      { status: 'bind', key: 'attack@sluggish' },
      { status: 'stun', key: 'attack@stun' },
    ]);
    const s2Spec = {
      kind: 'duration',
      duration: skillRec(chess, S2)?.duration ?? 27,
      mods: { batPct: batMod(num(b2.base_attack_time, 0.7), chess), atkPct: num(b2.atk, 0.45) },
    };

    return {
      skill: s2Spec,                        // 默认技能 = S2 吉星高照！（数据 defaultSkillIndex 1）
      skills: { [S1]: s1Spec },             // 只列非默认技能
      talents: [{
        install(battle, unit) {
          // ---- T1 好运连击！：每击倒过一种敌人 → 伤害 +6%（叠层），退场清空 ----
          if (!hasTalent) return;
          const ds = num(t0.damage_scale, 0.06), maxStacks = Math.max(1, Math.floor(num(t0.max_stack_cnt, 2)));
          const sync = () => {
            const n = Math.min(maxStacks, (unit.mem.kichiSpecies || new Set()).size);
            if (n > 0) {
              battle.addBuff(unit, { key: 'talent:kichi:lucky', persist: true, allowDead: true, visible: true, refresh: 'replace', data: { n }, mods: { dmgDealtMul: 1 + ds * n }, tags: ['talent'] });
            } else {
              const cur = unit.findBuff('talent:kichi:lucky');
              if (cur) battle.removeBuff(unit, cur);
            }
          };
          battle.on('kill', (c) => {
            if (c.killer !== unit || !up(unit)) return;
            const sp = speciesOf(c.victim);
            if (!sp) return;
            const set = unit.mem.kichiSpecies = unit.mem.kichiSpecies || new Set();
            if (set.has(sp)) return;
            set.add(sp);
            sync();
          }, { owner: unit });
          // 退场清空（PRTS 备注：吉星退场后将清空自身记录的 id）
          battle.on('deploy', (c) => { if (c.unit === unit) { unit.mem.kichiSpecies = new Set(); sync(); } }, { owner: unit });
          battle.on('death', (c) => { if (c.unit === unit) { unit.mem.kichiSpecies = new Set(); sync(); } }, { owner: unit });
        },
      }],
      install(battle, unit) {
        // ---- S1 欢迎您来！：每次攻击后攻击力叠加（≤4），技能结束撤销（refresh 'stack'）----
        const ds1 = num(b1.atk, 0.15), max1 = Math.max(1, Math.floor(num(b1.max_stack_cnt, 4)));
        if (ds1 > 0) {
          battle.on('attack', (c) => {
            if (c.attacker !== unit || !(unit.skill?.active && unit.skill.id === S1) || !up(unit)) return;
            battle.addBuff(unit, { key: 'skill:kichi:stack', refresh: 'stack', maxStacks: max1, duration: (skill_timeLeft(unit.skill) || 1e9) + 0.1, mods: { atkPct: ds1 }, tags: ['skill'] });
          }, { owner: unit });
          battle.on('skillEnd', (c) => {
            if (c.unit !== unit) return;
            const b = unit.findBuff('skill:kichi:stack');
            if (b) battle.removeBuff(unit, b);
          }, { owner: unit });
        }
        // ---- S2 吉星高照！：命中循环 停顿/束缚/晕眩，每次开技能从停顿开始 ----
        const durs = CYCLE.map((x) => ({ status: x.status, dur: num(b2[x.key], 1) }));
        if (durs.some((x) => x.dur > 0)) {
          battle.on('skillStart', (c) => { if (c.unit === unit) unit.mem.kichiCycle = 0; }, { owner: unit });
          battle.on('hit', (c) => {
            if (c.source !== unit || !c.target || c.target.side !== 'enemy') return;
            if (!(unit.skill?.active && unit.skill.id === S2)) return;
            const t = c.target;
            const d = c.dmg;
            if (!d || d.cancel || d.type === 'element' || !t.alive) return;
            const i = (unit.mem.kichiCycle || 0) % durs.length;
            unit.mem.kichiCycle = (unit.mem.kichiCycle || 0) + 1;
            const { status, dur } = durs[i];
            if (dur > 0) battle.applyStatus(t, status, { duration: dur, source: unit });
          }, { owner: unit });
        }
      },
    };
  },
};

/** The running skill's remaining time (for the stack buff's duration). */
function skill_timeLeft(skill) {
  return skill && skill.isTimed && Number.isFinite(skill.timeLeft) ? skill.timeLeft : null;
}
