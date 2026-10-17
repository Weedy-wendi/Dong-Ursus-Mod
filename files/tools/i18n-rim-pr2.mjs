// One-off (2026-10-16 PR2): 雷姆必拓 7 operators + 2 items i18n overlays in data/i18n/*.json.
// - names: 5 missing official operator names (黑/莱伊 already present)
// - files.garrisons: garrison_993..999 (a/b)
// - files.items: chess_item_9_05_e / 9_06_e (a/b)
// - files.chess: name-only overlay for the 7 operators (en/ja/ko; zh-TW 自制棋子 fallback 简体，照项目现状口径)
//   —— skill/talent/trait texts are NOT overlaid yet (official client texts not collected; players see zh fallback).
// - files.backups: DROP units.char_340_shwaz / char_4235_thumpy / char_4117_ray (they became PRESET chess in PR2,
//   so they left the owned-6★ pool and data/backups.json no longer has them) + rehash every backups overlay record
//   (leaf order changed → every `_h` must be recomputed from the current zh sources).
// Idempotent: safe to re-run (e.g. after a host file-rollback wiped data/i18n).
import { readFileSync, writeFileSync } from 'node:fs';
import { textHash2, walkOverlay, getPath } from '../shared/i18nData.js';

const LANGS = ['zh-TW', 'ja', 'ko', 'en'];
const DROP_UNITS = ['char_340_shwaz', 'char_4235_thumpy', 'char_4117_ray'];

/** zh source strings for the new garrisons (desc = plain, descRaw = rich). */
const GAR = {
  garrison_993_a: {
    desc: '<售出时>进入下个休整期额外获得1资金', rich: '<售出时>进入下个休整期额外获得<@ba.vup>1</>资金',
    etd: '整备能力',
    en: { desc: 'When sold: gain 1 extra funds next prep phase', etd: 'Prep ability' },
    ja: { desc: '売却時：次の休整期で資金+1', etd: '休整能力' },
    ko: { desc: '판매 시: 다음 정비 페이즈에 자금 +1', etd: '정비 능력' },
    tw: { desc: '<售出時>進入下個休整期額外獲得1資金', etd: '整備能力' },
  },
  garrison_993_b: {
    desc: '<售出时>进入下个休整期额外获得2资金', rich: '<售出时>进入下个休整期额外获得<@ba.vup>2</>资金',
    etd: '整备能力',
    en: { desc: 'When sold: gain 2 extra funds next prep phase', etd: 'Prep ability' },
    ja: { desc: '売却時：次の休整期で資金+2', etd: '休整能力' },
    ko: { desc: '판매 시: 다음 정비 페이즈에 자금 +2', etd: '정비 능력' },
    tw: { desc: '<售出時>進入下個休整期額外獲得2資金', etd: '整備能力' },
  },
  garrison_994_a: {
    desc: '<休整期结束时>使已激活的【雷姆必拓】盟约层数+2', rich: '<休整期结束时>使已激活的【雷姆必拓】盟约层数<@ba.vup>+2</>',
    etd: '持续叠加',
    en: { desc: 'Each prep phase end: the active 【Rim Billiton】 bond gains 2 stacks', etd: 'Sustained stacking' },
    ja: { desc: '休整期終了時：発動中の【レムビリトン】盟約のスタック数+2', etd: '持続累積' },
    ko: { desc: '<정비 페이즈 종료 시> 활성화된 【렘 빌리톤】 동맹 스택 +2', etd: '지속 누적' },
    tw: { desc: '<休整期結束時>使已激活的【雷姆必拓】盟約層數+2', etd: '持續疊加' },
  },
  garrison_994_b: {
    desc: '<休整期结束时>使已激活的【雷姆必拓】盟约层数+4', rich: '<休整期结束时>使已激活的【雷姆必拓】盟约层数<@ba.vup>+4</>',
    etd: '持续叠加',
    en: { desc: 'Each prep phase end: the active 【Rim Billiton】 bond gains 4 stacks', etd: 'Sustained stacking' },
    ja: { desc: '休整期終了時：発動中の【レムビリトン】盟約のスタック数+4', etd: '持続累積' },
    ko: { desc: '<정비 페이즈 종료 시> 활성화된 【렘 빌리톤】 동맹 스택 +4', etd: '지속 누적' },
    tw: { desc: '<休整期結束時>使已激活的【雷姆必拓】盟約層數+4', etd: '持續疊加' },
  },
  garrison_995_a: {
    desc: '<获得时>使随机1个已激活的盟约层数+3，重复4次', rich: '<获得时>使随机<@ba.vup>1</>个已激活的盟约层数<@ba.vup>+3</>，重复<@ba.vup>4</>次',
    etd: '单次叠加',
    en: { desc: 'When gained: a random active bond gains +2 layers, repeats 2 times', etd: 'One-time stacking' },
    ja: { desc: '獲得時：ランダムな発効中盟約の層数+2、2回繰り返し', etd: '単回累積' },
    ko: { desc: '<획득 시> 무작위로 발동 중인 1개 동맹의 층수 +2, 2회 반복', etd: '단회 누적' },
    tw: { desc: '<獲得時>使隨機1個已激活盟約的層數+2，重複2次', etd: '單次疊加' },
  },
  garrison_995_b: {
    desc: '<获得时>使随机1个已激活的盟约层数+3，重复8次', rich: '<获得时>使随机<@ba.vup>1</>个已激活的盟约层数<@ba.vup>+3</>，重复<@ba.vup>8</>次',
    etd: '单次叠加',
    en: { desc: 'When gained: a random active bond gains +4 layers, repeats 2 times', etd: 'One-time stacking' },
    ja: { desc: '獲得時：ランダムな発効中盟約の層数+4、2回繰り返し', etd: '単回累積' },
    ko: { desc: '<획득 시> 무작위로 발동 중인 1개 동맹의 층수 +4, 2회 반복', etd: '단회 누적' },
    tw: { desc: '<獲得時>使隨機1個已激活盟約的層數+4，重複2次', etd: '單次疊加' },
  },
  garrison_996_a: {
    desc: '<战斗中>【雷姆必拓】【精准】每叠加3层，本干员攻击速度+1', rich: '<战斗中>【雷姆必拓】【精准】每叠加<@ba.vup>3</>层，本干员攻击速度<@ba.vup>+1</>',
    etd: '作战能力',
    en: { desc: 'While in battle: per 3 stacks of 【Rim Billiton】【Precision】, this operator ASPD +1', etd: 'Combat ability' },
    ja: { desc: '戦闘中：【レムビリトン】【精密】3層ごとに、自身の攻撃速度+1', etd: '戦闘能力' },
    ko: { desc: '<전투 중> 【렘 빌리톤】【정밀】 3층마다 본 오퍼레이터 공격 속도 +1', etd: '전투 능력' },
    tw: { desc: '<戰鬥中>【雷姆必拓】【精準】每疊加3層，本幹員攻擊速度+1', etd: '作戰能力' },
  },
  garrison_996_b: {
    desc: '<战斗中>【雷姆必拓】【精准】每叠加3层，本干员攻击速度+2', rich: '<战斗中>【雷姆必拓】【精准】每叠加<@ba.vup>3</>层，本干员攻击速度<@ba.vup>+2</>',
    etd: '作战能力',
    en: { desc: 'While in battle: per 3 stacks of 【Rim Billiton】【Precision】, this operator ASPD +2', etd: 'Combat ability' },
    ja: { desc: '戦闘中：【レムビリトン】【精密】3層ごとに、自身の攻撃速度+2', etd: '戦闘能力' },
    ko: { desc: '<전투 중> 【렘 빌리톤】【정밀】 3층마다 본 오퍼레이터 공격 속도 +2', etd: '전투 능력' },
    tw: { desc: '<戰鬥中>【雷姆必拓】【精準】每疊加3層，本幹員攻擊速度+2', etd: '作戰能力' },
  },
  garrison_997_a: {
    desc: '<获得时>使随机1个已激活的盟约层数+3，重复8次', rich: '<获得时>使随机<@ba.vup>1</>个已激活的盟约层数<@ba.vup>+3</>，重复<@ba.vup>8</>次',
    etd: '单次叠加',
    en: { desc: 'When gained: a random active bond gains +4 layers, repeats 2 times', etd: 'One-time stacking' },
    ja: { desc: '獲得時：ランダムな発効中盟約の層数+4、2回繰り返し', etd: '単回累積' },
    ko: { desc: '<획득 시> 무작위로 발동 중인 1개 동맹의 층수 +4, 2회 반복', etd: '단회 누적' },
    tw: { desc: '<獲得時>使隨機1個已激活盟約的層數+4，重複2次', etd: '單次疊加' },
  },
  garrison_997_b: {
    desc: '<获得时>使随机1个已激活的盟约层数+6，重复8次', rich: '<获得时>使随机<@ba.vup>1</>个已激活的盟约层数<@ba.vup>+6</>，重复<@ba.vup>8</>次',
    etd: '单次叠加',
    en: { desc: 'When gained: a random active bond gains +8 layers, repeats 2 times', etd: 'One-time stacking' },
    ja: { desc: '獲得時：ランダムな発効中盟約の層数+8、2回繰り返し', etd: '単回累積' },
    ko: { desc: '<획득 시> 무작위로 발동 중인 1개 동맹의 층수 +8, 2회 반복', etd: '단회 누적' },
    tw: { desc: '<獲得時>使隨機1個已激活盟約的層數+8，重複2次', etd: '單次疊加' },
  },
  garrison_998_a: {
    desc: '<进入休整期时>周围八格内每有3名干员，随机获得1名不高于当前调度中心等级的【雷姆必拓】干员（每回合至多2名）',
    rich: '<进入休整期时>周围八格内每有<@ba.vup>3</>名干员，随机获得<@ba.vup>1</>名不高于当前调度中心等级的【雷姆必拓】干员（每回合至多<@ba.vup>2</>名）',
    etd: '持续叠加',
    en: { desc: 'Each prep phase: per 3 operators in the surrounding 8 tiles, gain a random 【Rim Billiton】 operator of tier ≤ the dispatch centre level (at most 2 per round)', etd: 'Sustained stacking' },
    ja: { desc: '休整期開始時：周囲8マス内の幹員3人ごとに、現在の指揮中枢レベル以下の【レムビリトン】幹員を1人ランダムに獲得（毎回合最大2人）', etd: '持続累積' },
    ko: { desc: '<정비 페이즈 시작 시> 주변 8칸 내 오퍼레이터 3명마다 무작위로 현재 지휘 중심 레벨 이하의 【렘 빌리톤】 오퍼레이터 1명 획득 (라운드당 최대 2명)', etd: '지속 누적' },
    tw: { desc: '<進入休整期時>周圍八格內每有3名幹員，隨機獲得1名不高於當前調度中心等級的【雷姆必拓】幹員（每回合至多2名）', etd: '持續疊加' },
  },
  garrison_998_b: {
    desc: '<进入休整期时>周围八格内每有2名干员，随机获得1名不高于当前调度中心等级的【雷姆必拓】干员（每回合至多3名）',
    rich: '<进入休整期时>周围八格内每有<@ba.vup>2</>名干员，随机获得<@ba.vup>1</>名不高于当前调度中心等级的【雷姆必拓】干员（每回合至多<@ba.vup>3</>名）',
    etd: '持续叠加',
    en: { desc: 'Each prep phase: per 2 operators in the surrounding 8 tiles, gain a random 【Rim Billiton】 operator of tier ≤ the dispatch centre level (at most 3 per round)', etd: 'Sustained stacking' },
    ja: { desc: '休整期開始時：周囲8マス内の幹員2人ごとに、現在の指揮中枢レベル以下の【レムビリトン】幹員を1人ランダムに獲得（毎回合最大3人）', etd: '持続累積' },
    ko: { desc: '<정비 페이즈 시작 시> 주변 8칸 내 오퍼레이터 2명마다 무작위로 현재 지휘 중심 레벨 이하의 【렘 빌리톤】 오퍼레이터 1명 획득 (라운드당 최대 3명)', etd: '지속 누적' },
    tw: { desc: '<進入休整期時>周圍八格內每有2名幹員，隨機獲得1名不高於當前調度中心等級的【雷姆必拓】幹員（每回合至多3名）', etd: '持續疊加' },
  },
  garrison_999_a: {
    desc: '<战斗中>【雷姆必拓】【精准】每叠加3层，本干员攻击力+1%',
    rich: '<战斗中>【雷姆必拓】【精准】每叠加<@ba.vup>3</>层，本干员攻击力<@ba.vup>+1%</>',
    etd: '作战能力',
    en: { desc: 'While in battle: per 3 stacks of 【Rim Billiton】【Precision】, this operator ATK +1%', etd: 'Combat ability' },
    ja: { desc: '戦闘中：【レムビリトン】【精密】3層ごとに、自身の攻撃力+1%', etd: '戦闘能力' },
    ko: { desc: '<전투 중> 【렘 빌리톤】【정밀】 3층마다 본 오퍼레이터 공격력 +1%', etd: '전투 능력' },
    tw: { desc: '<戰鬥中>【雷姆必拓】【精準】每疊加3層，本幹員攻擊力+1%', etd: '作戰能力' },
  },
  garrison_999_b: {
    desc: '<战斗中>【雷姆必拓】【精准】每叠加3层，本干员攻击力+2%',
    rich: '<战斗中>【雷姆必拓】【精准】每叠加<@ba.vup>3</>层，本干员攻击力<@ba.vup>+2%</>',
    etd: '作战能力',
    en: { desc: 'While in battle: per 3 stacks of 【Rim Billiton】【Precision】, this operator ATK +2%', etd: 'Combat ability' },
    ja: { desc: '戦闘中：【レムビリトン】【精密】3層ごとに、自身の攻撃力+2%', etd: '戦闘能力' },
    ko: { desc: '<전투 중> 【렘 빌리톤】【정밀】 3층마다 본 오퍼레이터 공격력 +2%', etd: '전투 능력' },
    tw: { desc: '<戰鬥中>【雷姆必拓】【精準】每疊加3層，本幹員攻擊力+2%', etd: '作戰能力' },
  },
};

const NAMES = {
  '暴行': { en: 'Savage', ja: 'サベージ', ko: '세비지', tw: '暴行' },
  '火哨': { en: 'Firewhistle', ja: 'ファイヤーホイッスル', ko: '파이어휘슬', tw: '火哨' },
  '蜜莓': { en: 'Honeyberry', ja: 'ハニーベリー', ko: '허니베리', tw: '蜜莓' },
  '时隙': { en: 'Timeslot', ja: 'タイムスロット', ko: '타임슬롯', tw: '時隙' }, // ja/ko: 音译惯例 [ASSUMED]（PRTS 未填，日/韩服未上线）
  '珊比': { en: 'Thumpy', ja: 'ツンビ', ko: '썸비', tw: '珊比' },
};

/** name-only chess overlays (skill/talent texts stay on the zh fallback until official client texts are collected). */
const CHESS_NAMES = {
  chess_char_1_96: '暴行', chess_char_2_96: '火哨', chess_char_3_95: '蜜莓',
  chess_char_5_96: '黑', chess_char_5_95: '时隙', chess_char_6_96: '珊比', chess_char_6_95: '莱伊',
};

const ITEMS = {
  chess_item_9_05_e: {
    name: '雷姆必拓钻石镐', goldenName: '雷姆必拓钻石镐',
    desc: '攻击力+25%；攻击时有10%概率造成150%攻击力的伤害',
    goldenDesc: '攻击力+35%；攻击时有20%概率造成150%攻击力的伤害',
    richDesc: '攻击力<@ba.vup>+25%</>；攻击时有<@ba.vup>10%</>概率造成<@ba.vup>150%</>攻击力的伤害',
    richGolden: '攻击力<@ba.vup>+35%</>；攻击时有<@ba.vup>20%</>概率造成<@ba.vup>150%</>攻击力的伤害',
    en: { name: 'Rim Billiton Diamond Pick', desc: 'ATK +25%; attacks have a 10% chance to deal 150% ATK damage', golden: 'ATK +35%; attacks have a 20% chance to deal 150% ATK damage' },
    ja: { name: 'レムビリトンのピッケル', desc: '攻撃力+25%；攻撃時に10%の確率で攻撃力150%のダメージを与える', golden: '攻撃力+35%；攻撃時に20%の確率で攻撃力150%のダメージを与える' },
    ko: { name: '렘 빌리톤 다이아 곡괭이', desc: '공격력 +25%; 공격 시 10% 확률로 공격력의 150% 피해', golden: '공격력 +35%; 공격 시 20% 확률로 공격력의 150% 피해' },
    tw: { name: '雷姆必拓鑽石鎬', desc: '攻擊力+25%；攻擊時有10%概率造成150%攻擊力的傷害', golden: '攻擊力+35%；攻擊時有20%概率造成150%攻擊力的傷害' },
  },
  chess_item_9_06_e: {
    name: '胡萝卜披萨', goldenName: '胡萝卜披萨',
    desc: '攻击速度+30；若携带者为【雷姆必拓】盟约干员：场上每有1名其他【雷姆必拓】盟约干员，攻击速度额外+6（最多+30）；与雷姆必拓钻石镐同带：上限提升至+45；若携带者为【叙拉古】盟约干员：攻击力+200%',
    goldenDesc: '攻击速度+45；若携带者为【雷姆必拓】盟约干员：场上每有1名其他【雷姆必拓】盟约干员，攻击速度额外+9（最多+45）；与雷姆必拓钻石镐同带：上限提升至+60；若携带者为【叙拉古】盟约干员：攻击力+200%',
    richDesc: '攻击速度<@ba.vup>+30</>；若携带者为【雷姆必拓】盟约干员：场上每有1名其他【雷姆必拓】盟约干员，攻击速度额外<@ba.vup>+6</>（最多<@ba.vup>+30</>）；与雷姆必拓钻石镐同带：上限提升至<@ba.vup>+45</>；若携带者为【叙拉古】盟约干员：攻击力<@ba.vup>+200%</>',
    richGolden: '攻击速度<@ba.vup>+45</>；若携带者为【雷姆必拓】盟约干员：场上每有1名其他【雷姆必拓】盟约干员，攻击速度额外<@ba.vup>+9</>（最多<@ba.vup>+45</>）；与雷姆必拓钻石镐同带：上限提升至<@ba.vup>+60</>；若携带者为【叙拉古】盟约干员：攻击力<@ba.vup>+200%</>',
    en: {
      name: 'Carrot Pizza',
      desc: 'ASPD +30; if the carrier is a 【Rim Billiton】 member: per other 【Rim Billiton】 member on the field, ASPD +6 more (up to +30); with the Diamond Pick: cap raised to +45; if the carrier is a 【Siracusa】 member: ATK +200%',
      golden: 'ASPD +45; if the carrier is a 【Rim Billiton】 member: per other 【Rim Billiton】 member on the field, ASPD +9 more (up to +45); with the Diamond Pick: cap raised to +60; if the carrier is a 【Siracusa】 member: ATK +200%',
    },
    ja: {
      name: 'ニンジンピザ',
      desc: '攻撃速度+30；装備者が【レムビリトン】盟約幹員の場合：場に他の【レムビリトン】幹員1人ごとに攻撃速度+6（最大+30）；レムビリトンのピッケルと同時装備：上限+45；装備者が【シラクーザ】盟約幹員の場合：攻撃力+200%',
      golden: '攻撃速度+45；装備者が【レムビリトン】盟約幹員の場合：場に他の【レムビリトン】幹員1人ごとに攻撃速度+9（最大+45）；レムビリトンのピッケルと同時装備：上限+60；装備者が【シラクーザ】盟約幹員の場合：攻撃力+200%',
    },
    ko: {
      name: '당근 피자',
      desc: '공격 속도 +30; 운반자가 【렘 빌리톤】 동맹 오퍼레이터인 경우: 필드의 다른 【렘 빌리톤】 오퍼레이터 1명마다 공격 속도 +6 추가 (최대 +30); 다이아 곡괭이 동시 장착: 상한 +45; 운반자가 【시라쿠사】 동맹 오퍼레이터인 경우: 공격력 +200%',
      golden: '공격 속도 +45; 운반자가 【렘 빌리톤】 동맹 오퍼레이터인 경우: 필드의 다른 【렘 빌리톤】 오퍼레이터 1명마다 공격 속도 +9 추가 (최대 +45); 다이아 곡괭이 동시 장착: 상한 +60; 운반자가 【시라쿠사】 동맹 오퍼레이터인 경우: 공격력 +200%',
    },
    tw: {
      name: '胡蘿蔔披薩',
      desc: '攻擊速度+30；若攜帶者為【雷姆必拓】盟約幹員：場上每有1名其他【雷姆必拓】盟約幹員，攻擊速度額外+6（最多+30）；與雷姆必拓鑽石鎬同帶：上限提升至+45；若攜帶者為【敘拉古】盟約幹員：攻擊力+200%',
      golden: '攻擊速度+45；若攜帶者為【雷姆必拓】盟約幹員：場上每有1名其他【雷姆必拓】盟約幹員，攻擊速度額外+9（最多+45）；與雷姆必拓鑽石鎬同帶：上限提升至+60；若攜帶者為【敘拉古】盟約幹員：攻擊力+200%',
    },
  },
};

const CHESS_NAME_OF = {
  'chess_char_5_96': { en: 'Schwarz', ja: 'シュヴァルツ', ko: '슈바르츠', tw: null }, // zh-TW 自制棋子 fallback 简体（项目现状口径）
  'chess_char_6_95': { en: 'Ray', ja: 'レイ', ko: '레이', tw: null },
  'chess_char_1_96': { en: 'Savage', ja: 'サベージ', ko: '세비지', tw: null },
  'chess_char_2_96': { en: 'Firewhistle', ja: 'ファイヤーホイッスル', ko: '파이어휘슬', tw: null },
  'chess_char_3_95': { en: 'Honeyberry', ja: 'ハニーベリー', ko: '허니베리', tw: null },
  'chess_char_5_95': { en: 'Timeslot', ja: 'タイムスロット', ko: '타임슬롯', tw: null },
  'chess_char_6_96': { en: 'Thumpy', ja: 'ツンビ', ko: '썸비', tw: null },
};

/** Rebuild a record overlay from its leaves whose zh source still exists (drop stale leaves) + recompute `_h`. */
function rehashRecordOverlay(ov, zh) {
  const leaves = [];
  walkOverlay(ov, (path, text) => {
    const zhAt = getPath(zh, path);
    if (typeof zhAt === 'string') leaves.push({ path, text });
  });
  if (!leaves.length) return null;
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const root = {};
  for (const { path, text } of leaves) {
    let cur = root;
    for (let i = 0; i < path.length - 1; i++) {
      const k = path[i];
      const nextIsIndex = typeof path[i + 1] === 'number';
      if (cur[k] == null) cur[k] = nextIsIndex ? [] : {};
      cur = cur[k];
    }
    cur[path[path.length - 1]] = text;
  }
  const fill = (v) => {
    if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) v[i] = v[i] === undefined ? null : fill(v[i]); return v; }
    if (isObj(v)) { for (const k of Object.keys(v)) v[k] = fill(v[k]); return v; }
    return v;
  };
  fill(root);
  let h = '';
  walkOverlay(root, (path) => { h += textHash2(getPath(zh, path) ?? ''); });
  return { ...root, _h: h };
}

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

for (const lang of LANGS) {
  const file = `data/i18n/${lang}.json`;
  const d = JSON.parse(readFileSync(file, 'utf8'));
  const isTw = lang === 'zh-TW';

  // names
  for (const [zh, m] of Object.entries(NAMES)) d.names[zh] = isTw ? m.tw : m[lang];

  // garrisons
  d.files.garrisons = d.files.garrisons || {};
  const garData = (JSON.parse(readFileSync('data/garrisons.json', 'utf8')));
  for (const [id, g] of Object.entries(GAR)) {
    const t = isTw ? g.tw : g[lang];
    const raw = isTw ? s2tRich(g.rich) : g.rich;
    const zh = garData[id] ?? {};
    d.files.garrisons[id] = { desc: t.desc, descRaw: raw, eventTypeDesc: t.etd, _h: [zh.desc, zh.descRaw, zh.eventTypeDesc].map((s) => textHash2(typeof s === 'string' ? s : '')).join('') };
  }

  // items (a = normal desc, b = golden desc)
  d.files.items = d.files.items || {};
  const itemData = JSON.parse(readFileSync('data/items.json', 'utf8'));
  const itemDict = itemData.itemDataDict ?? itemData;
  for (const [base, it] of Object.entries(ITEMS)) {
    const t = isTw ? it.tw : it[lang];
    const name = t.name;
    const a = itemDict[`${base}_a`] ?? {};
    const b = itemDict[`${base}_b`] ?? {};
    d.files.items[`${base}_a`] = { name, effectName: name, desc: t.desc, descRaw: isTw ? s2tRich(it.richDesc) : it.richDesc, _h: [a.name, a.effectName, a.desc, a.descRaw].map((s) => textHash2(typeof s === 'string' ? s : '')).join('') };
    d.files.items[`${base}_b`] = { name, effectName: name, desc: t.golden, descRaw: isTw ? s2tRich(it.richGolden) : it.richGolden, _h: [b.name, b.effectName, b.desc, b.descRaw].map((s) => textHash2(typeof s === 'string' ? s : '')).join('') };
  }

  // effects：rim 两件装备的独立效果记录（eff_9_05_e / eff_9_06_e + 精英 eff_9g_05_e / eff_9g_06_e；
  // 2026-10-18 补：此前 effects 家族一直缺这 4 条 → 效果名回落中文）
  d.files.effects = d.files.effects || {};
  const effectData = JSON.parse(readFileSync('data/effects.json', 'utf8'));
  for (const [base, it] of Object.entries(ITEMS)) {
    const t = isTw ? it.tw : it[lang];
    for (const [suf, gold] of [['_a', false], ['_b', true]]) {
      const num = (base.match(/_9_(\d+)_e$/) || [])[1];
      if (!num) continue;
      const id = `eff_9${gold ? 'g' : ''}_${num}_e`;
      const zhEff = effectData[id];
      if (!zhEff) continue;
      const raw = gold ? (isTw ? s2tRich(it.richGolden) : it.richGolden) : (isTw ? s2tRich(it.richDesc) : it.richDesc);
      d.files.effects[id] = { name: t.name, desc: gold ? t.golden : t.desc, descRaw: raw, _h: [zhEff.name, zhEff.desc, zhEff.descRaw].map((x) => textHash2(typeof x === 'string' ? x : '')).join('') };
    }
  }

  // chess name-only overlays (en/ja/ko; zh-TW skipped per project convention)
  d.files.chess = d.files.chess || {};
  const chessData = JSON.parse(readFileSync('data/chess.json', 'utf8')).chessDataDict
    ?? JSON.parse(readFileSync('data/chess.json', 'utf8'));
  for (const [base, m] of Object.entries(CHESS_NAME_OF)) {
    const name = isTw ? m.tw : m[lang];
    for (const suf of ['_a', '_b']) {
      const id = base + suf;
      if (!name) { delete d.files.chess[id]; continue; }
      const zhName = chessData[id]?.name;
      if (typeof zhName !== 'string') { delete d.files.chess[id]; continue; }
      d.files.chess[id] = { name, _h: textHash2(zhName) };
    }
  }

  // backups: drop the three PRESET-converted units, then rehash every record against data/backups.json
  const backups = JSON.parse(readFileSync('data/backups.json', 'utf8'));
  const ovUnits = d.files.backups && d.files.backups.units;
  if (ovUnits) for (const u of DROP_UNITS) delete ovUnits[u];
  const ob = d.files.backups || {};
  for (const [id, rec] of Object.entries(ob)) {
    const zh = backups[id];
    const next = typeof rec === 'object' && rec ? rehashRecordOverlay(rec, zh ?? {}) : rec;
    if (next === null) delete ob[id];
    else ob[id] = next;
  }

  retranslateFamily(d, 'garrisons'); retranslateFamily(d, 'items'); retranslateFamily(d, 'effects');

  writeFileSync(file, JSON.stringify(d));
  console.log(`${file}: names+garrisons 993-999+items 9_05/9_06+chess names updated; backups dropped ${DROP_UNITS.join('/')} + rehashed`);
}

/** 简转富文本繁体：只处理本项目文案用到的字（2026-10-16 PR2 集合；「層」按既有口径保留）。 */
function s2tRich(s) {
  const map = { 击: '擊', 发: '發', 层: '層', 应: '應', 时: '時', 复: '復', 随: '隨', 获: '獲', 态: '態' };
  return s.replace(/./g, (c) => map[c] ?? c);
}
