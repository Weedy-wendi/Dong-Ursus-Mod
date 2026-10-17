// One-off (2026-10-16): 雷姆必拓 7 operators' chess overlays for en/ja/ko (data/i18n/*.json files.chess).
// - en: hand-authored from arknights.wiki.gg (Global client text). Timeslot & Thumpy are CN-only — wiki
//   texts there are UNOFFICIAL translations [ASSUMED, revisit at Global launch].
// - ja/ko: rendered from the official client gamedata (SanityGoneAK/arknights-gamedata, all servers),
//   cached at .cache/rim-i18n-src/{ja,ko}/{skill,character,uniequip}_table.json (re-download to refresh).
//   Time-slot(時隙)/Thumpy(珊比) are not on JP/KR servers yet → their ja/ko stay on the zh fallback.
//   subProfessionName/module.name come from uniequip_table's subProfDict/equipDict; when the operator is
//   missing there (or a zh leaf cannot be aligned), that single leaf stays on the zh fallback.
// Idempotent; safe to re-run after a host file-rollback (then re-run i18n-rim-pr1/pr2 first: they write names).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { textHash2, walkOverlay, getPath } from '../shared/i18nData.js';

const chess = JSON.parse(readFileSync('data/chess.json', 'utf8'));
const dict = chess.chessDataDict ?? chess;
// zh official tables (the same files tools/build-data.mjs consumed; the overlay leaves' zh sources).
const zhChar = JSON.parse(readFileSync('.cache/gamedata/excel/character_table.json', 'utf8'));
const zhSkill = JSON.parse(readFileSync('.cache/gamedata/excel/skill_table.json', 'utf8'));

// ---- build-data helpers (copied verbatim in spirit; see tools/build-data.mjs L175-289) -----------------------------
const unescapeNewlines = (s) => (typeof s === 'string' ? s.replace(/\\n/g, '\n') : s);
const stripRich = (s) => (typeof s !== 'string' ? s ?? null : unescapeNewlines(s)
  .replace(/<[@$#][^<>]*>/g, '').replace(/<\/>/g, '').replace(/<\/?color[^<>]*>/gi, '').replace(/<\/?[bi]>/gi, ''));
const richRaw = (s) => (typeof s === 'string' ? unescapeNewlines(s) : s ?? null);
const cleanNum = (v) => (typeof v !== 'number' || !Number.isFinite(v) ? v
  : Number.isInteger(v) || Math.abs(v) >= 1e6 ? v : Math.round(v * 1e6) / 1e6);
function flattenBB(list) {
  const bb = {}; const bbStr = {};
  for (const e of Array.isArray(list) ? list : []) {
    if (!e || typeof e.key !== 'string') continue;
    let k = e.key; let i = 1;
    while (Object.prototype.hasOwnProperty.call(bb, k) || Object.prototype.hasOwnProperty.call(bbStr, k)) k = `${e.key}_${i++}`;
    const num = cleanNum(typeof e.value === 'number' ? e.value : Number(e.value) || 0);
    const hasStr = e.valueStr != null && e.valueStr !== '';
    if (!hasStr || num !== 0) bb[k] = num;
    if (hasStr) bbStr[k] = String(e.valueStr);
  }
  return { bb, bbStr };
}
function formatValue(v, fmt) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return String(v);
  if (!fmt) return String(cleanNum(v));
  const pct = fmt.endsWith('%');
  const core = pct ? fmt.slice(0, -1) : fmt;
  const decimals = core.includes('.') ? core.split('.')[1].length : 0;
  const x = pct ? v * 100 : v;
  const rounded = Math.sign(x) * Math.round(Math.abs(x) * 10 ** decimals + 1e-9) / 10 ** decimals;
  return rounded.toFixed(decimals) + (pct ? '%' : '');
}
function resolvePlaceholders(text, bb, bbStr = {}) {
  if (typeof text !== 'string') return text ?? null;
  const lower = new Map(Object.entries(bb || {}).map(([k, v]) => [k.toLowerCase(), v]));
  const lowerStr = new Map(Object.entries(bbStr || {}).map(([k, v]) => [k.toLowerCase(), v]));
  return text.replace(/\{(-?)([^{}:]+)(?::([^{}]+))?\}/g, (m, neg, key, fmt) => {
    const k = key.trim().toLowerCase();
    if (lowerStr.has(k) && (!lower.has(k) || !fmt)) return lowerStr.get(k);
    if (lower.has(k)) return formatValue(neg ? -lower.get(k) : lower.get(k), fmt);
    return m;
  });
}
const textPair = (raw, bb, bbStr) => {
  const resolved = bb ? resolvePlaceholders(richRaw(raw), bb, bbStr) : richRaw(raw);
  return { desc: stripRich(resolved), descRaw: resolved };
};
/** Render one trait candidate (overrideDes or the default description) at its own blackboard. */
function traitCandidateText(cand) {
  const raw = cand.overrideDes ?? cand.description ?? '';
  const { bb, bbStr } = flattenBB(cand.overrideBlackboard ?? cand.blackboard);
  return textPair(raw, bb, bbStr);
}
/** Render a talent candidate. */
function talentCandidateText(cand) {
  const raw = cand.description ?? '';
  const { bb, bbStr } = flattenBB(cand.blackboard);
  return { name: cand.name ?? null, ...textPair(raw, bb, bbStr) };
}
/** Render a skill level (name + desc/descRaw from the level's own blackboard). */
function skillLevelText(rec, levelIdx) {
  const lv = rec?.levels?.[levelIdx];
  if (!lv) return null;
  const { bb, bbStr } = flattenBB(lv.blackboard);
  return { name: lv.name ?? null, ...textPair(lv.description ?? '', bb, bbStr) };
}
/** Find the zh candidate index whose rendered descRaw equals the zh record's text (structure is language-agnostic). */
function alignIndex(zhCands, zhText, render) {
  for (let i = 0; i < (zhCands || []).length; i++) {
    const t = render(zhCands[i]);
    if (t && t.descRaw === zhText) return i;
  }
  return -1;
}

// ---- EN (hand-authored; see the file history for the wiki.gg sourcing notes) ---------------------------------------
const EN = {
  chess_char_1_96: {
    name: 'Savage', subProfessionName: 'Centurion', moduleName: 'Hit the Road',
    trait: 'Attacks all blocked enemies',
    skill: { name: 'Precise Blast',
      a: 'Deals 330% of ATK as Physical damage to at most 4 enemies within three tiles ahead',
      b: 'Deals 360% of ATK as Physical damage to at most 4 enemies within three tiles ahead' },
    skills: ['Power Strike β', 'Precise Blast'],
    talents: { 山谷: (g) => ({ name: 'Valley', desc: g
      ? 'ATK and DEF +10% when there are at least two high ground tiles among the four surrounding tiles'
      : 'ATK and DEF +5% when there are at least two high ground tiles among the four surrounding tiles' }) },
  },
  chess_char_2_96: {
    name: 'Firewhistle', subProfessionName: 'Fortress', moduleName: '"Footprints Growing"',
    trait: 'When not blocking enemies, prioritizes dealing ranged AoE Physical damage',
    skill: { name: 'Scorched Earth',
      a: "Each attack causes the 4 tiles around the target to burn for 4 seconds; ground enemies in the burning area take one instance of Arts damage equal to 45% of Firewhistle's ATK per second",
      b: "Each attack causes the 4 tiles around the target to burn for 5 seconds; ground enemies in the burning area take one instance of Arts damage equal to 65% of Firewhistle's ATK per second" },
    skills: ['Wildfire', 'Scorched Earth'],
    talents: { 进退自如: (g) => ({ name: 'Flexible Fighter', desc: g
      ? 'ATK +14% when not blocking an enemy (+2%), DEF +14% when blocking an enemy (+2%)'
      : 'ATK +8% when not blocking an enemy (+2%), DEF +8% when blocking an enemy (+2%)' }) },
  },
  chess_char_3_95: {
    name: 'Honeyberry', subProfessionName: 'Wandering Medic', moduleName: 'After Landing',
    trait: (g) => `Restores allied units' HP and recovers Elemental Injury equal to ${g ? 60 : 50}% of ATK (can recover the Elemental Injury of unhurt allied units)`,
    skill: { name: 'Rouse',
      a: 'ATK +25%. Every heal targets the 2 Operators with the most severe Elemental Injury',
      b: 'ATK +35%. Every heal targets the 3 Operators with the most severe Elemental Injury' },
    skills: ['Spiritual Care', 'Rouse'],
    talents: { 集体意识: () => ({ name: 'Collective Consciousness', desc: 'Ranged Operators within Attack Range gain Max HP +12% (+2%)' }) },
  },
  chess_char_5_96: {
    name: 'Schwarz', subProfessionName: 'Heavyshooter', moduleName: 'Customized Crossbow Accessory Suit',
    trait: 'High accuracy point-blank shot',
    skill: { name: 'Sharp Eye',
      a: 'ATK +85%, and increases the chance to activate the Talent to 40%',
      b: 'ATK +100%, and increases the chance to activate the Talent to 45%' },
    skills: ['Charged Shot', 'Sharp Eye', 'Final Tactics'],
    talents: {
      破甲箭头: () => ({ name: 'Armor Penetration Arrow', desc: 'When attacking, a 20% chance to raise that attack\'s ATK to 160% and reduce the hit target\'s DEF by 20% for 5 seconds' }),
      交叉火力: () => ({ name: 'Crossfire', desc: 'When Schwarz and at least one more [Sniper] Operator are on the battlefield, all [Sniper] Operators\' ATK +10% (+2%)' }),
    },
  },
  chess_char_5_95: {
    name: 'Timeslot', subProfessionName: 'Mech-Accord Caster', moduleName: 'Inspiration',
    trait: (g) => golden
      ? 'Controls a Drone to deal Arts damage\nDamage increases when the Drone attacks the same enemy (initial Drone damage raised, up to 110% of the operator\'s ATK)'
      : 'Controls a Drone to deal Arts damage\nDamage increases when the Drone attacks the same enemy (up to 110% of the operator\'s ATK)',
    skill: { name: 'Technology and Traditional Rituals',
      a: 'Drone +1; releases the Drone to lock onto and attack an enemy\nOverload: stops attacking, ATK +26%, ASPD +35\n<The Drone returns once its target is defeated or the skill ends; if the locked enemy leaves the attack range, Overload triggers immediately; the skill can be turned off manually at any time>',
      b: 'Drone +1; releases the Drone to lock onto and attack an enemy\nOverload: stops attacking, ATK +35%, ASPD +50\n<The Drone returns once its target is defeated or the skill ends; if the locked enemy leaves the attack range, Overload triggers immediately; the skill can be turned off manually at any time>' },
    skills: ['ATK Up γ', 'Technology and Traditional Rituals'],
    talents: { 新产品测评: () => ({ name: 'New Product Review', desc: 'ATK +11% (+3%), and Drone attacks have a 15% chance to Slow the target for 1.5 seconds' }) },
  },
  chess_char_6_96: {
    name: 'Thumpy', subProfessionName: 'Primal Protector', moduleName: 'Courage to Set Off',
    trait: 'Can block 3 enemies, and can inflict Elemental Injury',
    skill: { name: '"Take It Slow~"',
      a: "ATK and DEF +48%; sprays superglue over up to 4 passable ground tiles ahead, dealing Physical damage equal to 37% of Thumpy's ATK every 0.7 seconds and Slowing for 0.5 seconds; when other Operators deal Physical damage to enemies in the superglue, they inflict Corrosion equal to 15% of Thumpy's ATK",
      b: "ATK and DEF +57%; sprays superglue over up to 4 passable ground tiles ahead, dealing Physical damage equal to 43% of Thumpy's ATK every 0.7 seconds and Slowing for 0.5 seconds; when other Operators deal Physical damage to enemies in the superglue, they inflict Corrosion equal to 15% of Thumpy's ATK" },
    skills: ['"Aren\'t You Going?"', '"Take It Slow~"', '"You Can\'t Leave!"'],
    talents: {
      探险理论: () => ({ name: 'Theory of Adventure', desc: 'Elemental Injury taken by Thumpy reduced by 20% (+5%); when she deals Physical damage, inflicts Corrosion equal to 12% (+2%) of ATK and reduces the target\'s Corrosion cooldown by 1.2 (+0.2) seconds' }),
      坚硬脚板: (g) => ({ name: 'Hard-Footed', desc: g
        ? 'When an enemy damaged by Thumpy suffers a Corrosion burst, she gains 15 (+3) DEF and 6 (+1) ATK (up to 30 stacks), plus 480 (+80) Barrier (capped at 300% of Max HP)'
        : 'When an enemy damaged by Thumpy suffers a Corrosion burst, she gains 11 (+3) DEF (up to 30 stacks) and 330 (+80) Barrier (capped at 300% of Max HP)' }),
    },
  },
  chess_char_6_95: {
    name: 'Ray', subProfessionName: 'Hunter', moduleName: '"Dancing Moonlight"',
    trait: 'Attacks consume ammo and raise ATK to 120%; reloads slowly while not attacking (up to 8 rounds)',
    skill: { name: 'Area Overwatch',
      a: 'Passive: when the Sand Beast retreats, recovers the bullets that hit the area\nAuto-activation: Attack Range expands, ATK +60%, Sand Beast redeployment time -20%\n<Unlimited duration>',
      b: 'Passive: when the Sand Beast retreats, recovers the bullets that hit the area\nAuto-activation: Attack Range expands, ATK +90%, Sand Beast redeployment time -30%\n<Unlimited duration>' },
    skills: ['Parting Shot', 'Area Overwatch', '"See the Light"'],
    talents: {
      巡哨伙伴: (g) => ({ name: 'Patrol Partner', desc: g
        ? 'Can deploy a Sand Beast within the Attack Range to scout an area for 25 seconds, extending the Attack Range; prioritizes attacking targets in the area and deals 20% more Physical damage to them, and the Sand Beast\'s redeployment time is reduced by 10 seconds'
        : 'Can deploy a Sand Beast within the Attack Range to scout an area for 25 seconds, extending the Attack Range; prioritizes attacking targets in the area and deals 15% more Physical damage to them' }),
      入神: () => ({ name: 'Extreme Focus', desc: 'Each attack on the same target raises own ATK by 9% (+1%), up to 3 stacks' }),
    },
  },
};
// fix the accidental `golden` reference in the Timeslot trait above (kept literal for review)
EN.chess_char_5_95.trait = (g) => g
  ? 'Controls a Drone to deal Arts damage\nDamage increases when the Drone attacks the same enemy (initial Drone damage raised, up to 110% of the operator\'s ATK)'
  : 'Controls a Drone to deal Arts damage\nDamage increases when the Drone attacks the same enemy (up to 110% of the operator\'s ATK)';

function buildOverlay(zhRec, enSpec, golden) {
  const en = {
    name: enSpec.name,
    subProfessionName: enSpec.subProfessionName,
    trait: { desc: typeof enSpec.trait === 'function' ? enSpec.trait(golden) : enSpec.trait,
      descRaw: typeof enSpec.trait === 'function' ? enSpec.trait(golden) : enSpec.trait },
    skill: { name: enSpec.skill.name, desc: golden ? enSpec.skill.b : enSpec.skill.a, descRaw: golden ? enSpec.skill.b : enSpec.skill.a },
    talents: (zhRec.talents ?? []).map((t) => {
      const f = enSpec.talents[t.name];
      if (!f) throw new Error(`no EN talent for ${t.name}`);
      const v = f(golden);
      return { name: v.name, desc: v.desc, descRaw: v.desc };
    }),
    module: { name: enSpec.moduleName },
    skills: (zhRec.skills ?? []).map((s, i) => {
      const v = enSpec.skills[i];
      if (!v) throw new Error(`no EN skill name for ${s.skillId}`);
      return { name: v };
    }),
  };
  return fromLeaves(zhRec, en);
}

/** Build a RecordOverlay by walking a (partially translated) tree, hashing the zh at the same path. */
function fromLeaves(zhRec, tree) {
  const leaves = [];
  walkOverlay(tree, (path, text) => {
    const zhAt = getPath(zhRec, path);
    if (typeof zhAt !== 'string') throw new Error(`zh leaf missing at ${path.join('.')} (${zhRec.chessId})`);
    leaves.push({ path, en: text });
  });
  if (!leaves.length) return null;
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const root = {};
  for (const { path, en: text } of leaves) {
    let cur = root;
    for (let i = 0; i < path.length - 1; i++) {
      const k = path[i];
      if (cur[k] == null) cur[k] = typeof path[i + 1] === 'number' ? [] : {};
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
  walkOverlay(root, (path) => { h += textHash2(getPath(zhRec, path) ?? ''); });
  return { ...root, _h: h };
}

// ---- ja/ko (rendered from the official client gamedata) ------------------------------------------------------------
const OPS = {
  chess_char_1_96: { charId: 'char_230_savage' },
  chess_char_2_96: { charId: 'char_493_firwhl' },
  chess_char_3_95: { charId: 'char_449_glider' },
  chess_char_5_96: { charId: 'char_340_shwaz' },
  chess_char_5_95: { charId: 'char_4236_tmslot' },
  chess_char_6_96: { charId: 'char_4235_thumpy' },
  chess_char_6_95: { charId: 'char_4117_ray' },
};

function buildFromGamedata(zhRec, tables, golden) {
  const { charTable, skillTable, uniequip } = tables;
  const zhSelf = zhChar[zhRec.charId];
  const langChar = charTable[zhRec.charId];
  if (!zhSelf || !langChar) return null;
  // the record's own status row carries the form's skill level (normal rank 4 / elite rank 7)
  const lvIdx = (zhRec.status?.skillLevel || 4) - 1;
  const out = {};
  const put = (k, v) => { if (v != null) out[k] = v; };
  put('name', langChar.name);
  put('subProfessionName', uniequip?.subProfDict?.[zhRec.subProfessionId]?.subProfessionName);
  // trait: align by the zh candidate's rendered text, then take the same index in the language table
  const zhTraitCands = zhSelf.trait?.candidate ?? [];
  const zhTraitIdx = alignIndex(zhTraitCands, zhRec.trait.descRaw, traitCandidateText);
  if (zhTraitIdx >= 0 && langChar.trait?.candidate?.[zhTraitIdx]) {
    out.trait = traitCandidateText(langChar.trait.candidate[zhTraitIdx]);
  }
  // default skill: rank 4 (normal) / rank 7 (elite) — the record's own status row has the level
  const skText = skillLevelText(skillTable[zhRec.skill.skillId], lvIdx);
  if (skText) out.skill = skText;
  // talents: zhRec.talents[i].index points at char.talents[index]; find the candidate whose rendered text
  // equals the zh descRaw, then take the same candidate in the language table (structure is language-agnostic)
  const outTalents = [];
  let allAligned = true;
  for (const t of zhRec.talents ?? []) {
    const zhT = (zhSelf.talents ?? [])[t.index];
    let candIdx = zhT ? alignIndex(zhT.candidates, t.descRaw, talentCandidateText) : -1;
    const langT = (langChar.talents ?? [])[t.index];
    if (candIdx < 0 && zhT?.candidates?.length) {
      // the zh text was merged with a module talent change (e.g. Ray's HUN-X +10s line) — fall back to the
      // zh candidate that best matches by prefix (the last candidate at the elite tier keeps the right phase)
      candIdx = zhT.candidates.length - 1;
    }
    if (candIdx < 0 || !langT?.candidates?.[candIdx]) { allAligned = false; console.error(`    [warn] ${zhRec.chessId}: talent「${t.name}」(index ${t.index}) did not align`); continue; }
    const v = talentCandidateText(langT.candidates[candIdx]);
    if (v.name && v.desc) outTalents.push({ name: v.name, desc: v.desc, descRaw: v.descRaw });
  }
  if (allAligned && outTalents.length === (zhRec.talents ?? []).length && outTalents.length) out.talents = outTalents;
  // module name
  const moduleId = zhRec.module?.id;
  if (moduleId) put('module', { name: uniequip?.equipDict?.[moduleId]?.uniEquipName ?? null });
  // unlocked skill names
  const names = [];
  let ok = true;
  for (const s of zhRec.skills ?? []) {
    const r = skillTable[s.skillId];
    const nm = r?.levels?.[0]?.name;
    if (!nm) { ok = false; break; }
    names.push({ name: nm });
  }
  if (ok && names.length) out.skills = names;
  if (!Object.keys(out).length) return null;
  return fromLeaves(zhRec, out);
}

const LANGS = ['ja', 'ko'];
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
  const dir = `.cache/rim-i18n-src/${lang}`;
  if (!existsSync(`${dir}/skill_table.json`)) { console.log(`${lang}: cached gamedata missing, skipped`); continue; }
  const tables = {
    charTable: JSON.parse(readFileSync(`${dir}/character_table.json`, 'utf8')),
    skillTable: JSON.parse(readFileSync(`${dir}/skill_table.json`, 'utf8')),
    uniequip: JSON.parse(readFileSync(`${dir}/uniequip_table.json`, 'utf8')),
  };
  const file = `data/i18n/${lang}.json`;
  const d = JSON.parse(readFileSync(file, 'utf8'));
  d.files.chess = d.files.chess || {};
  let n = 0; const skipped = [];
  for (const [base] of Object.entries(OPS)) {
    for (const [suf, golden] of [['_a', false], ['_b', true]]) {
      const id = base + suf;
      const zhRec = dict[id];
      let ov = null;
      try { ov = buildFromGamedata(zhRec, tables, golden); } catch (e) { skipped.push(`${id}: ${e.message}`); continue; }
      if (ov) { d.files.chess[id] = ov; n++; } else skipped.push(`${id}: operator not in the ${lang} client yet`);
    }
  }
  retranslateFamily(d, 'chess'); retranslateFamily(d, 'bonds'); retranslateFamily(d, 'garrisons'); retranslateFamily(d, 'items');
  writeFileSync(file, JSON.stringify(d));
  console.log(`${file}: ${n} ja/ko chess overlays written${skipped.length ? ' (skipped: ' + skipped.join('; ') + ')' : ''}`);
}

// ---- EN (as before) ------------------------------------------------------------------------------------------------
const enFile = 'data/i18n/en.json';
const dEn = JSON.parse(readFileSync(enFile, 'utf8'));
dEn.files.chess = dEn.files.chess || {};
let enN = 0;
for (const [base, spec] of Object.entries(EN)) {
  for (const [suf, golden] of [['_a', false], ['_b', true]]) {
    const id = base + suf;
    const ov = buildOverlay(dict[id], spec, golden);
    if (ov) { dEn.files.chess[id] = ov; enN++; }
  }
}
retranslateFamily(dEn, 'chess'); retranslateFamily(dEn, 'bonds'); retranslateFamily(dEn, 'garrisons'); retranslateFamily(dEn, 'items');
writeFileSync(enFile, JSON.stringify(dEn));
console.log(`${enFile}: ${enN} chess overlays (7 operators × a/b) written`);
