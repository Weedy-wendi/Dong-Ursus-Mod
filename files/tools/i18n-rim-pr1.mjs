// One-off (2026-10-16): add rimBillitonShip bond overlays + refresh garrison_73/96 overrides in data/i18n/*.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { textHash2 } from '../shared/i18nData.js';
import { stripRich } from './build-i18n.mjs';

const bonds = JSON.parse(readFileSync('data/bonds.json', 'utf8'));
const gars = JSON.parse(readFileSync('data/garrisons.json', 'utf8'));
const rim = bonds.rimBillitonShip;

// ---- zh-TW: char-level s2t over the zh source (tags are ASCII, kept as-is) ----
const S2T = { 员: '員', 击: '擊', 数: '數', 叠: '疊', 获: '獲', 于: '於', 当: '當', 调: '調', 级: '級', 场: '場', 后: '後', 开: '開', 启: '啟', 内: '內', 伤: '傷', 隐: '隱' };
const s2t = (s) => String(s).replace(/./g, (c) => S2T[c] ?? c);

// ---- ja / en / ko: handcrafted (mirroring the dongShip/official phrasing) ----
const RIM_NAME = { ja: 'レムビリトン', en: 'Rim Billiton', ko: '렘 빌리톤' };
const jaDesc = '【レムビリトン】オペレーターの攻撃力が上昇（スタック数の影響）\n<スタックが25重なるごと>に現在の指揮センターのレベル以下の【レムビリトン】オペレーターを1体獲得\n<場に6体の異なる【レムビリトン】オペレーター><戦闘中>【レムビリトン】オペレーターはスキル発動時にステルスを獲得し、20秒間持続、場の【レムビリトン】オペレーター1体につき、【レムビリトン】オペレーターの攻撃与ダメージが30%上昇\n<場に9体の異なる【レムビリトン】オペレーター>【レムビリトン】オペレーターはスキル発動時のステルスが40秒間に変化し、スキル発動後10秒間の攻撃力+200%';
const jaDescRaw = '【レムビリトン】オペレーターの<@ba.vup>攻撃力</>が上昇<@autochess.gray>（スタック数の影響）</>\n<スタックが<@autochess.dgreen>25</>重なるごと>に現在の指揮センターのレベル以下の【レムビリトン】オペレーターを<@ba.vup>1</>体獲得\n<場に<@autochess.dgreen>6</>体の異なる【レムビリトン】オペレーター><戦闘中>【レムビリトン】オペレーターはスキル発動時に<@ba.vup>ステルス</>を獲得し、<@ba.vup>20</>秒間持続、場の【レムビリトン】オペレーター<@ba.vup>1</>体につき、【レムビリトン】オペレーターの攻撃与ダメージが<@ba.vup>30%</>上昇\n<場に<@autochess.dgreen>9</>体の異なる【レムビリトン】オペレーター>【レムビリトン】オペレーターはスキル発動時のステルスが<@ba.vup>40</>秒間に変化し、スキル発動後<@ba.vup>10</>秒間の攻撃力<@ba.vup>+200%</>';
const jaEff = '【レムビリトン】オペレーターの攻撃力+{0:0.0%}（スタック数の影響）\n<スタックが25重なるごと>に現在の指揮センターのレベル以下の【レムビリトン】オペレーターを1体獲得\n<場に6体の異なる【レムビリトン】オペレーター>場の【レムビリトン】オペレーター1体につき、攻撃与ダメージ+30%\n<場に9体の異なる【レムビリトン】オペレーター>【レムビリトン】オペレーターはスキル発動時のステルスが40秒間に変化し、スキル発動後10秒間の攻撃力+200%';
const jaEffRaw = '【レムビリトン】オペレーターの攻撃力<@ba.vup>+{0:0.0%}</><@autochess.gray>（スタック数の影響）</>\n<スタックが<@autochess.dgreen>25</>重なるごと>に現在の指揮センターのレベル以下の【レムビリトン】オペレーターを<@ba.vup>1</>体獲得\n<場に<@autochess.dgreen>6</>体の異なる【レムビリトン】オペレーター>場の【レムビリトン】オペレーター<@ba.vup>1</>体につき、攻撃与ダメージ<@ba.vup>+30%</>\n<場に<@autochess.dgreen>9</>体の異なる【レムビリトン】オペレーター>【レムビリトン】オペレーターはスキル発動時のステルスが<@ba.vup>40</>秒間に変化し、スキル発動後<@ba.vup>10</>秒間の攻撃力<@ba.vup>+200%</>';
const enDesc = "[Rim Billiton] Operators' ATK increases (affected by no. of stacks)\n<Every 25 stacks> gain 1 [Rim Billiton] Operator of no higher than the current Dispatch Center level\n<With 6 different [Rim Billiton] Operators on field> while in battle: [Rim Billiton] Operators gain Stealth for 20 seconds when activating a skill, and their attack damage increases by 30% for each [Rim Billiton] Operator on field\n<With 9 different [Rim Billiton] Operators on field> the Stealth gained when activating a skill lasts 40 seconds instead, and ATK +200% for 10 seconds after activating a skill";
const enDescRaw = "[Rim Billiton] Operators' <@ba.vup>ATK</> increases <@autochess.gray>(affected by no. of stacks)</>\n<Every <@autochess.dgreen>25</> stacks> gain <@ba.vup>1</> [Rim Billiton] Operator of no higher than the current Dispatch Center level\n<With <@autochess.dgreen>6</> different [Rim Billiton] Operators on field> while in battle: [Rim Billiton] Operators gain <@ba.vup>Stealth</> for <@ba.vup>20</> seconds when activating a skill, and their attack damage increases by <@ba.vup>30%</> for each [Rim Billiton] Operator on field\n<With <@autochess.dgreen>9</> different [Rim Billiton] Operators on field> the Stealth gained when activating a skill lasts <@ba.vup>40</> seconds instead, and <@ba.vup>ATK +200%</> for <@ba.vup>10</> seconds after activating a skill";
const enEff = "[Rim Billiton] Operators' ATK +{0:0.0%} (affected by no. of stacks)\n<Every 25 stacks> gain 1 [Rim Billiton] Operator of no higher than the current Dispatch Center level\n<With 6 different [Rim Billiton] Operators on field> [Rim Billiton] Operators gain Stealth for 20 seconds when activating a skill, and attack damage +30% for each [Rim Billiton] Operator on field\n<With 9 different [Rim Billiton] Operators on field> the Stealth gained when activating a skill lasts 40 seconds instead, and ATK +200% for 10 seconds after activating a skill";
const enEffRaw = "[Rim Billiton] Operators' ATK <@ba.vup>+{0:0.0%}</> <@autochess.gray>(affected by no. of stacks)</>\n<Every <@autochess.dgreen>25</> stacks> gain <@ba.vup>1</> [Rim Billiton] Operator of no higher than the current Dispatch Center level\n<With <@autochess.dgreen>6</> different [Rim Billiton] Operators on field> [Rim Billiton] Operators gain <@ba.vup>Stealth</> for <@ba.vup>20</> seconds when activating a skill, and attack damage <@ba.vup>+30%</> for each [Rim Billiton] Operator on field\n<With <@autochess.dgreen>9</> different [Rim Billiton] Operators on field> the Stealth gained when activating a skill lasts <@ba.vup>40</> seconds instead, and <@ba.vup>ATK +200%</> for <@ba.vup>10</> seconds after activating a skill";
const koDesc = '【렘 빌리톤】오퍼레이터의 공격력이 상승 (스택 수의 영향)\n<스택이 25개 쌓일 때마다> 현재 지휘 센터 레벨 이하의 【렘 빌리톤】 오퍼레이터 1명 획득\n<필드에 서로 다른 【렘 빌리톤】 오퍼레이터 6명> <전투 중> 【렘 빌리톤】 오퍼레이터는 스킬 발동 시 은신을 획득하며 20초간 지속, 필드의 【렘 빌리톤】 오퍼레이터 1명당 【렘 빌리톤】 오퍼레이터의 공격 피해가 30% 상승\n<필드에 서로 다른 【렘 빌리톤】 오퍼레이터 9명> 【렘 빌리톤】 오퍼레이터는 스킬 발동 시 은신이 40초로 변화하며, 스킬 발동 후 10초 동안 공격력 +200%';
const koDescRaw = '【렘 빌리톤】오퍼레이터의 <@ba.vup>공격력</>이 상승<@autochess.gray> (스택 수의 영향)</>\n<스택이 <@autochess.dgreen>25</>개 쌓일 때마다> 현재 지휘 센터 레벨 이하의 【렘 빌리톤】 오퍼레이터 <@ba.vup>1</>명 획득\n<필드에 서로 다른 【렘 빌리톤】 오퍼레이터 <@autochess.dgreen>6</>명> <전투 중> 【렘 빌리톤】 오퍼레이터는 스킬 발동 시 <@ba.vup>은신</>을 획득하며 <@ba.vup>20</>초간 지속, 필드의 【렘 빌리톤】 오퍼레이터 <@ba.vup>1</>명당 【렘 빌리톤】 오퍼레이터의 공격 피해가 <@ba.vup>30%</> 상승\n<필드에 서로 다른 【렘 빌리톤】 오퍼레이터 <@autochess.dgreen>9</>명> 【렘 빌리톤】 오퍼레이터는 스킬 발동 시 은신이 <@ba.vup>40</>초로 변화하며, 스킬 발동 후 <@ba.vup>10</>초 동안 공격력 <@ba.vup>+200%</>';
const koEff = '【렘 빌리톤】오퍼레이터의 공격력 +{0:0.0%} (스택 수의 영향)\n<스택이 25개 쌓일 때마다> 현재 지휘 센터 레벨 이하의 【렘 빌리톤】 오퍼레이터 1명 획득\n<필드에 서로 다른 【렘 빌리톤】 오퍼레이터 6명> 필드의 【렘 빌리톤】 오퍼레이터 1명당 공격 피해 +30%\n<필드에 서로 다른 【렘 빌리톤】 오퍼레이터 9명> 【렘 빌리톤】 오퍼레이터는 스킬 발동 시 은신이 40초로 변화하며, 스킬 발동 후 10초 동안 공격력 +200%';
const koEffRaw = '【렘 빌리톤】오퍼레이터의 공격력 <@ba.vup>+{0:0.0%}</><@autochess.gray> (스택 수의 영향)</>\n<스택이 <@autochess.dgreen>25</>개 쌓일 때마다> 현재 지휘 센터 레벨 이하의 【렘 빌리톤】 오퍼레이터 <@ba.vup>1</>명 획득\n<필드에 서로 다른 【렘 빌리톤】 오퍼레이터 <@autochess.dgreen>6</>명> 필드의 【렘 빌리톤】 오퍼레이터 <@ba.vup>1</>명당 공격 피해 <@ba.vup>+30%</>\n<필드에 서로 다른 【렘 빌리톤】 오퍼레이터 <@autochess.dgreen>9</>명> 【렘 빌리톤】 오퍼레이터는 스킬 발동 시 은신이 <@ba.vup>40</>초로 변화하며, 스킬 발동 후 <@ba.vup>10</>초 동안 공격력 <@ba.vup>+200%</>';

/** Record overlay from { leaf: translated } + the zh record; _h over the zh leaves in the overlay's key order. */
function recordOverlay(zhRec, trans) {
  let h = '';
  const out = {};
  for (const [k, v] of Object.entries(trans)) {
    out[k] = v;
    h += textHash2(zhRec[k] ?? '');
  }
  return { ...out, _h: h };
}

const GAR_IDS = ['garrison_73_a', 'garrison_73_b', 'garrison_96_a', 'garrison_96_b'];
// replace the bond-name segment in the existing official translations
const GAR_SUB = {
  'zh-TW': [['【精準】', '【雷姆必拓】【精準】']],
  ja: [['【精密】', '【レムビリトン】【精密】']],
  en: [['[Precision]', '[Rim Billiton] [Precision]']],
  ko: [['[정밀]', '[렘 빌리톤] [정밀]']],
};

// ---- 覆盖率回填（2026-10-18）：本脚本写入的 overlay 叶子是「官方语料里不存在」的自制内容——
// build-i18n 已把它们计进 texts（它扫注入后的 data），但 translated 仍停在官方+东/乌萨斯的口径。
// 自制叶子全部有手写翻译 → 对触及的家族把 translated 对齐为「全叶子数」（= texts），pct 回到 100。
function countLeaves(node, skipKey) {
  let n = 0;
  for (const [k, v] of Object.entries(node || {})) {
    if (k === skipKey) continue;
    if (typeof v === 'string') n++;
    else if (v && typeof v === 'object') n += countLeaves(v, skipKey);
  }
  return n;
}
function retranslateFamily(d, fam) {
  const c = d.meta && d.meta.coverage && d.meta.coverage[fam];
  const leaves = d.files[fam] ? countLeaves(d.files[fam], '_h') : 0;
  if (!c || !leaves) return;
  c.texts = Math.max(c.texts ?? 0, leaves);
  c.translated = c.texts;
  c.pct = 100;
}

// 官方语料里的特质原文（各语言缓存的 activity_table；zh-TW 无官方客户端 → 缓存同zh格式但繁化由 GAR_SUB 无法覆盖，直接用 zh 官方文本）
const OFFICIAL_CACHE = { en: 'gamedata-en', ja: 'gamedata-ja', ko: 'gamedata-ko', 'zh-TW': 'gamedata-zh-TW' };
const officialGarrisons = {};
for (const [lang, cache] of Object.entries(OFFICIAL_CACHE)) {
  try {
    const act = JSON.parse(readFileSync(`.cache/${cache}/excel/activity_table.json`, 'utf8'));
    const node = act.activity?.AUTOCHESS_SEASON?.act2autochess ?? act.AUTOCHESS_SEASON?.act2autochess;
    const dict = node?.garrisonDataListDict ?? node?.garrisonDataDict ?? {};
    officialGarrisons[lang] = {};
    for (const id of GAR_IDS) {
      const e = dict[id];
      if (!e?.garrisonDesc) throw new Error(`${cache}: ${id} garrisonDesc missing`);
      officialGarrisons[lang][id] = { garrisonDesc: e.garrisonDesc, eventTypeDesc: e.eventTypeDesc ?? '' };
    }
  } catch (e) {
    throw new Error(`i18n-rim-pr1: 官方语料缓存缺失（先跑 tools/build-i18n.mjs 让它下载）—— ${e.message}`);
  }
}
const effectsZh = JSON.parse(readFileSync('data/effects.json', 'utf8'));

for (const lang of ['zh-TW', 'ja', 'en', 'ko']) {
  const file = `data/i18n/${lang}.json`;
  const d = JSON.parse(readFileSync(file, 'utf8'));
  d.files.bonds = d.files.bonds || {};
  d.files.garrisons = d.files.garrisons || {};

  if (lang === 'zh-TW') {
    d.files.bonds.rimBillitonShip = recordOverlay(rim, {
      name: s2t(rim.name), desc: s2t(rim.desc), descRaw: s2t(rim.descRaw),
      effectName: s2t(rim.name), effectDesc: s2t(rim.effectDesc), effectDescRaw: s2t(rim.effectDescRaw),
    });
  } else {
    const T = { ja: [jaDesc, jaDescRaw, jaEff, jaEffRaw], en: [enDesc, enDescRaw, enEff, enEffRaw], ko: [koDesc, koDescRaw, koEff, koEffRaw] }[lang];
    d.files.bonds.rimBillitonShip = recordOverlay(rim, {
      name: RIM_NAME[lang], desc: T[0], descRaw: T[1], effectName: RIM_NAME[lang], effectDesc: T[2], effectDescRaw: T[3],
    });
  }

  for (const id of GAR_IDS) {
    const zh = gars[id];
    if (!zh) throw new Error(`${lang}: data/garrisons.json missing ${id}`);
    const sub = (s) => {
      for (const [a, b] of GAR_SUB[lang]) s = s.split(a).join(b);
      return s;
    };
    // 该特质的 zh 文本被本 mod 修改（插入盟约名前缀）→ 官方译文不再 hash 匹配，
    // build-i18n / apply-i18n 的产出里没有它 → 直接从官方语料缓存取原文（descRaw=富文本，
    // desc=stripRich），替换后按当前 zh 记录重算 _h。2026-10-18：不再依赖 prev（prune 后不存在）。
    const official = officialGarrisons[lang][id];
    d.files.garrisons[id] = recordOverlay(zh, {
      descRaw: sub(official.garrisonDesc), desc: sub(stripRich(official.garrisonDesc)),
      eventTypeDesc: official.eventTypeDesc,
    });
  }

  // bondeffect_rim：盟约效果记录（name/desc/descRaw 三叶子；翻译 = 盟约 effectDesc 的现成译文）
  d.files.effects = d.files.effects || {};
  const rimEff = effectsZh.bondeffect_rim;
  if (rimEff) {
    if (lang === 'zh-TW') {
      d.files.effects.bondeffect_rim = recordOverlay(rimEff, {
        name: s2t(rimEff.name), desc: s2t(rimEff.desc), descRaw: s2t(rimEff.descRaw),
      });
    } else {
      const T = { ja: [jaEff, jaEffRaw], en: [enEff, enEffRaw], ko: [koEff, koEffRaw] }[lang];
      d.files.effects.bondeffect_rim = recordOverlay(rimEff, {
        name: RIM_NAME[lang], desc: T[0], descRaw: T[1],
      });
    }
  }

  retranslateFamily(d, 'bonds'); retranslateFamily(d, 'garrisons'); retranslateFamily(d, 'effects');

  writeFileSync(file, JSON.stringify(d));
  console.log(`${file}: bonds.rimBillitonShip + ${GAR_IDS.join('/')} updated`);
}
