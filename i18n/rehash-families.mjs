#!/usr/bin/env node
// 重算 overlay 里「家族级聚合 _h」——版本适配用。
// 背景：data/i18n/*.json 的 backups（units/tokens/diy）子节点带家族级 _h（按 overlay 叶子顺序
// 对 data/*.json 的 zh 源文本逐叶 textHash2 拼接，见 shared/i18nData.js applyRecordOverlay 的消费方式）。
// 本体升级 / build-i18n 迁移旧记录后，这些 _h 对不上重建的 data/*.json → 整族 stale。
// 本脚本按当前 data + 当前 overlay 叶子重算 _h（幂等）。必须在 build-data 与 prune-stale 之后运行。
// 用法: node <mod>/i18n/rehash-families.mjs [repoRoot=..]
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = process.argv[2] ? (isAbsolute(process.argv[2]) ? process.argv[2] : join(process.cwd(), process.argv[2])) : join(here, '..', '..');
const { textHash2, walkOverlay, getPath } = await import('file://' + join(repo, 'shared', 'i18nData.js').replace(/\\/g, '/'));

const LANGS = ['en', 'ja', 'ko', 'zh-TW'];
// 家族级 _h 的节点：overlay family → { file: data 文件, subs: [overlay 子节点名] }
const AGG_NODES = {
  backups: { file: 'backups.json', subs: ['units', 'tokens', 'diy'] },
};

let total = 0;
for (const lang of LANGS) {
  const file = join(repo, 'data', 'i18n', `${lang}.json`);
  const src = readFileSync(file, 'utf8');
  const ov = JSON.parse(src);
  // 自探测缩进与尾换行（round-trip）
  let out = null, indent = 1, nl = '\n';
  for (const cand of [1, 2, 4, 0]) for (const n of ['\n', '']) {
    if (JSON.stringify(ov, null, cand) + n === src) { out = JSON.stringify(ov, null, cand) + n; indent = cand; nl = n; break; }
  }
  if (out == null) { console.log(`[rehash] ${lang}: 警告——原格式未精确匹配，按 1 空格缩进重写`); out = JSON.stringify(ov, null, 1) + '\n'; }

  for (const [fam, { file: dataFile, subs }] of Object.entries(AGG_NODES)) {
    const node = ov.files?.[fam];
    if (!node || typeof node !== 'object') continue;
    const data = JSON.parse(readFileSync(join(repo, 'data', dataFile), 'utf8'));
    for (const key of subs) {
      const subNode = node[key];
      const base = data[key];
      if (!subNode || typeof subNode !== 'object' || !base || typeof base !== 'object') continue;
      let h = '';
      let missing = 0;
      for (const [id, rov] of Object.entries(subNode)) {
        if (id === '_h') continue;
        const baseRec = base[id];
        if (baseRec == null) { // 数据里已没有该记录——prune-stale 应已删除；此处跳过并告警
          walkOverlay(rov, () => { missing++; h += textHash2(''); });
          console.log(`[rehash] ${lang}: 警告——${fam}.${key}.${id} 不在 data 里（先跑 prune-stale）`);
          continue;
        }
        walkOverlay(rov, (p) => {
          const zh = getPath(baseRec, p);
          if (typeof zh !== 'string') missing++;
          h += textHash2(typeof zh === 'string' ? zh : '');
        });
      }
      const prev = typeof subNode._h === 'string' ? subNode._h : '';
      if (prev !== h) { delete subNode._h; subNode._h = h; total++; }
      console.log(`[rehash] ${lang}: ${fam}.${key}._h 已重算（${h.length / 2} 叶${missing ? `，${missing} 叶 zh 缺失！` : ''}${prev === h ? '，原值一致' : ''}）`);
    }
  }
  writeFileSync(file, JSON.stringify(ov, null, indent) + nl);
}
console.log(`[rehash] 完成——更新 ${total} 处 _h；重跑 node --test test/i18n-data.test.js 验证（应 stale=0）`);
