#!/usr/bin/env node
// 把 mod-i18n.json 里的四语言 overlay 记录合并进本体的 data/i18n/{en,ja,ko,zh-TW}.json。
// 幂等：重复运行只是覆盖同一批记录。必须先跑 node tools/build-data.mjs（zh 源文本来自注入的数据，
// overlay 的 _h 是对这些 zh 文本的哈希——只要 tools/custom-content.mjs 的文案没改，哈希就仍然匹配）。
// 用法: node <mod>/i18n/apply-i18n.mjs [repoRoot=..]
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = process.argv[2] ? (isAbsolute(process.argv[2]) ? process.argv[2] : join(process.cwd(), process.argv[2])) : join(here, '..', '..');
const mod = JSON.parse(readFileSync(join(here, 'mod-i18n.json'), 'utf8'));
const FAMILIES = ['bonds', 'garrisons', 'items'];
const LANGS = ['en', 'ja', 'ko', 'zh-TW'];
const IDS = {
  bonds: ['dongShip', 'ursusShip'],
  garrisons: [
    ...Array.from({ length: 13 }, (_, i) => [`garrison_${980 + i}_a`, `garrison_${980 + i}_b`]).flat(),
    // 2026-10-14：官方 garrison_07（水月）被 GARRISON_OVERRIDES 覆盖——文案补【东】后不再是官方客户端文本，
    // 与 980-992 同属「需手写四语言翻译」的情形，故一并合并
    'garrison_07_a', 'garrison_07_b',
  ],
  items: ['chess_item_9_01_e_a', 'chess_item_9_01_e_b', 'chess_item_9_02_e_a', 'chess_item_9_02_e_b',
    'chess_item_9_03_e_a', 'chess_item_9_03_e_b', 'chess_item_9_04_e_a', 'chess_item_9_04_e_b'],
  // 2026-10-17：自制策略（5 条）。records 的 _h 由本脚本按 data/bands.json 的 zh 源文本算（见下），
  // mod-i18n.json 里只写文案；每个策略的效果记录（aceffect_band_9_0x）从它派生。
  // 2026-10-18：+band_tutu；band_titi（独家签约）当日下架——见下方 REMOVED_BANDS 清理。
  bands: ['band_palico', 'band_headbr', 'band_haruka', 'band_utage', 'band_ulika', 'band_tutu'],
  // 已下架的自制策略：overlay（bands + 派生 effects）里的残留记录必须清掉——
  // zh 源已不存在会导致 stale≠0 / coverage 虚高。幂等：没有残留时是 no-op。
  removedBands: [{ id: 'band_titi', effectId: 'aceffect_band_9_07' }],
  // effects 记录（含 _h）：mod-i18n.json 里存在则直接用；不存在才从 bonds/items/bands 派生
  effects: ['bondeffect_dong', 'bondeffect_ursus', 'eff_9_01_e', 'eff_9_02_e', 'eff_9_03_e', 'eff_9_04_e'],
};

const leafCount = (famNode, ids) => ids.reduce((n, id) => {
  const rec = famNode?.[id];
  if (!rec) return n;
  const count = (o) => typeof o === 'string' ? 1
    : o && typeof o === 'object' ? Object.entries(o).filter(([k]) => k !== '_h').reduce((m, [, v]) => m + count(v), 0)
    : 0;
  return n + count(rec);
}, 0);

for (const lang of LANGS) {
  const file = join(repo, 'data', 'i18n', `${lang}.json`);
  const src = readFileSync(file, 'utf8');
  const ov = JSON.parse(src);
  // 自探测缩进与尾换行：对候选缩进做 round-trip，精确匹配者为实际格式
  const nl = src.endsWith('\n') ? '\n' : '';
  const roundTrip = (cand) => JSON.stringify(ov, null, cand) + nl === src;
  const indent = [1, 2, 4, 0].find(roundTrip) ?? (() => { console.log(`[i18n] ${lang}: 警告——原格式未精确匹配，按 1 空格缩进重写`); return 1; })();
  ov.files = ov.files || {};
  let merged = 0;
  for (const fam of FAMILIES) {
    ov.files[fam] = ov.files[fam] || {};
    for (const id of IDS[fam]) {
      const rec = mod[lang]?.[fam]?.[id];
      if (!rec) throw new Error(`mod-i18n.json 缺少 ${lang}/${fam}/${id}`);
      ov.files[fam][id] = rec;
      merged++;
    }
  }
  // effects 记录：优先 mod-i18n.json 自带（含 _h）；缺失时从 bonds/items/bands 派生，并用 data/effects.json
  // 的 zh 源文本补算 _h（没有 _h 的记录会整条 stale）。只处理 data/effects.json 里真实存在的条目。
  ov.files.effects = ov.files.effects || {};
  const derived = [];
  const i18nData = await import('file://' + join(repo, 'shared', 'i18nData.js').replaceAll('\\', '/'));
  const zhEffects = JSON.parse(readFileSync(join(repo, 'data', 'effects.json'), 'utf8'));
  const withHash = (id, rec, zhSrc = zhEffects) => {
    const zhRec = zhSrc[id];
    if (!zhRec) return null; // data 里没有该条目——不派生（避免 "not a string" 断言失败）
    let h = '';
    i18nData.walkOverlay(rec, (p) => {
      const zh = i18nData.getPath(zhRec, p);
      h += i18nData.textHash2(typeof zh === 'string' ? zh : '');
    });
    return { ...rec, _h: h };
  };
  // 策略（bands）：mod-i18n.json 只写文案，_h 按 data/bands.json 的 zh 源文本现算（策略文案是自制内容，
  // 官方客户端里没有对应文本，只能手写四语言；族级同样需要 _h，否则整条 stale）。
  ov.files.bands = ov.files.bands || {};
  // 下架策略清理：先删残留记录（bands + 派生 effects），让后面的 coverage 差量修正（负 delta）把
  // translated/modI18nAdded 一并拉回正确值。
  for (const rb of IDS.removedBands) {
    if (ov.files.bands[rb.id]) { delete ov.files.bands[rb.id]; console.log(`[i18n] ${lang}: 移除下架策略 ${rb.id}`); }
    if (rb.effectId && ov.files.effects[rb.effectId]) { delete ov.files.effects[rb.effectId]; console.log(`[i18n] ${lang}: 移除下架策略效果 ${rb.effectId}`); }
  }
  const zhBands = JSON.parse(readFileSync(join(repo, 'data', 'bands.json'), 'utf8'));
  for (const id of IDS.bands) {
    const rec = mod[lang]?.bands?.[id];
    if (!rec) throw new Error(`mod-i18n.json 缺少 ${lang}/bands/${id}`);
    if (!zhBands[id]) throw new Error(`data/bands.json 缺少 ${id}（先跑 node tools/build-data.mjs）`);
    const hashed = withHash(id, rec, zhBands);
    if (!hashed) throw new Error(`data/bands.json ${id} 与 overlay 叶子对不上`);
    ov.files.bands[id] = hashed;
    merged++;
  }
  for (const id of IDS.effects) {
    const rec = mod[lang]?.effects?.[id];
    if (rec) derived.push([id, rec]);
  }
  for (const bid of IDS.bonds) {
    const id = 'bondeffect_' + bid.replace(/Ship$/, '');
    if (mod[lang]?.effects?.[id]) continue;
    const b = mod[lang]?.bonds?.[bid];
    if (b?.effectDesc) {
      const rec = withHash(id, { name: b.name, desc: b.effectDesc, descRaw: b.effectDescRaw });
      if (rec) derived.push([id, rec]);
    }
  }
  for (const base of ['9_01', '9_02', '9_03', '9_04']) {
    const num = base.split('_')[1];
    const id = 'eff_' + base + '_e';
    const it = mod[lang]?.items?.['chess_item_' + base + '_e_a'];
    if (!mod[lang]?.effects?.[id] && it?.desc) {
      const rec = withHash(id, { name: it.name, desc: it.desc, descRaw: it.descRaw });
      if (rec) derived.push([id, rec]);
    }
    // 精英形态的独立效果记录（eff_9g_XX_e，2026-10-18 补：此前一直漏派生 → 效果名回落中文；
    // 注意不能与普通形态共用 continue——mod.effects 已有普通记录时会把 elite 一起跳过）
    const gid = 'eff_9g_' + num + '_e';
    const ib = mod[lang]?.items?.['chess_item_' + base + '_e_b'];
    if (!mod[lang]?.effects?.[gid] && ib?.desc) {
      const rec = withHash(gid, { name: ib.name, desc: ib.desc, descRaw: ib.descRaw });
      if (rec) derived.push([gid, rec]);
    }
  }
  // 雷姆必拓盟约效果（若 mod-i18n.json 直接带了就用；否则由 rim pr1 写）
  if (!mod[lang]?.effects?.['bondeffect_rim']) {
    const rb = mod[lang]?.bonds?.rimBillitonShip;
    if (rb?.effectDesc) {
      const rec = withHash('bondeffect_rim', { name: rb.name ?? rb.effectName, desc: rb.effectDesc, descRaw: rb.effectDescRaw });
      if (rec) derived.push(['bondeffect_rim', rec]);
    }
  }
  for (const bid of IDS.bands) {
    const id = zhBands[bid]?.effectId;
    if (!id || mod[lang]?.effects?.[id]) continue;
    const b = mod[lang]?.bands?.[bid];
    if (b?.desc) {
      const rec = withHash(id, { name: b.effectName, desc: b.desc, descRaw: b.descRaw });
      if (rec) derived.push([id, rec]);
    }
  }
  for (const [id, rec] of derived) {
    if (!ov.files.effects[id]) merged++;
    ov.files.effects[id] = rec;
  }
  // 回填 coverage meta（en 的覆盖率地板由 i18n-data.test.js 断言；build-i18n 只覆盖官方内容）。
  // 幂等：meta.modI18nAdded 记录上次已计入的叶数，重跑只补差量。
  if (ov.meta?.coverage && ov.meta?.totals) {
    const per = { bonds: leafCount(ov.files.bonds, IDS.bonds),
      garrisons: leafCount(ov.files.garrisons, IDS.garrisons),
      items: leafCount(ov.files.items, IDS.items),
      bands: leafCount(ov.files.bands, IDS.bands),
      effects: leafCount(ov.files.effects, derived.map((d) => d[0])) };
    const prev = ov.meta.modI18nAdded ?? {};
    // 只补 translated、不动 texts：texts 是 build-i18n 按 data/*.json 逐叶数出来的，
    // 自制策略的文案在装包时（build-data 之后）就已经被数进 texts 了——这里再加一次会把分母撑大
    // （实测：+20 叶 → en 的 bands 覆盖率从 100 % 掉到 93.3 %，i18n-data.test.js 的 98 % 地板不过）。
    for (const [fam, n] of Object.entries(per)) {
      const c = ov.meta.coverage[fam];
      if (!c) continue;
      const delta = n - (prev[fam] ?? 0);
      // delta 可为负（下架策略删除记录后叶数减少，2026-10-18）：双向修正 translated
      if (delta !== 0) c.translated = Math.max(0, Math.min(c.texts ?? Infinity, (c.translated ?? 0) + delta));
      c.pct = c.texts ? Math.round((c.translated / c.texts) * 1000) / 10 : c.pct;
    }
    const dt = Object.entries(per).reduce((m, [fam, n]) => m + (n - (prev[fam] ?? 0)), 0);
    if (dt !== 0) ov.meta.totals.translated = Math.max(0, Math.min(ov.meta.totals.texts ?? Infinity, (ov.meta.totals.translated ?? 0) + dt));
    ov.meta.totals.pct = ov.meta.totals.texts ? Math.round((ov.meta.totals.translated / ov.meta.totals.texts) * 1000) / 10 : ov.meta.totals.pct;
    ov.meta.modI18nAdded = per;
  }
  writeFileSync(file, JSON.stringify(ov, null, indent) + nl);
  console.log(`[i18n] ${lang}: ${merged} 条 mod 记录已合并（含 effects 派生 ${derived.length} 条）`);
}
console.log('[i18n] 完成——可用 node --test test/i18n-data.test.js 验证（应 stale=0）');
