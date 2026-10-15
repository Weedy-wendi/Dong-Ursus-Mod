#!/usr/bin/env node
// 清理 overlay 里「数据已不存在」的陈旧记录——版本适配用：mod 把某些自选干员转成预设后，
// 重建的 data/*.json 不再有他们的备份条目，本体自带的 overlay 会残留这些记录，
// i18n-data 测试会报 "X is not a string in data/….json"。本脚本按 id 对照删除这些记录（幂等）。
// 用法: node <mod>/i18n/prune-stale.mjs [repoRoot=..]
// 只处理「按 id 索引」的平面记录族：chess / backups(units,tokens,diy) / tokens / bonds / garrisons /
// items / bands；不改数组型或深度嵌套的族（如有残留由 agent 按 i18n 测试输出手工删）。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = process.argv[2] ? (isAbsolute(process.argv[2]) ? process.argv[2] : join(process.cwd(), process.argv[2])) : join(here, '..', '..');

// overlay family → [data file, overlay→data 的子路径映射]
const FAMILIES = {
  chess: ['chess.json', (id) => [id]],
  backups: ['backups.json', (id) => (id === 'units' || id === 'tokens' || id === 'diy' ? null : ['units', id])],
  tokens: ['tokens.json', (id) => [id]],
  bonds: ['bonds.json', (id) => [id]],
  garrisons: ['garrisons.json', (id) => [id]],
  items: ['items.json', (id) => [id]],
  bands: ['bands.json', (id) => [id]],
};
const LANGS = ['en', 'ja', 'ko', 'zh-TW'];

for (const lang of LANGS) {
  const file = join(repo, 'data', 'i18n', `${lang}.json`);
  const src = readFileSync(file, 'utf8');
  const ov = JSON.parse(src);
  let out = null;
  for (const cand of [1, 2, 4, 0]) for (const nl of ['\n', '']) {
    if (JSON.stringify(ov, null, cand) + nl === src) { out = JSON.stringify(ov, null, cand) + nl; break; }
  }
  const indent = out && out.includes('\n ') ? (out.match(/\n(\s+)"/) || [])[1]?.length ?? 1 : (out && !out.includes('\n "') ? 0 : 1);
  if (out == null) { out = JSON.stringify(ov, null, 1) + '\n'; console.log(`[prune] ${lang}: 警告——原格式未精确匹配，按 1 空格缩进重写`); }
  let pruned = 0;
  for (const [fam, [dataFile, mapId]] of Object.entries(FAMILIES)) {
    const dataPath = join(repo, 'data', dataFile);
    if (!existsSync(dataPath)) continue;
    const data = JSON.parse(readFileSync(dataPath, 'utf8'));
    const node = ov.files?.[fam];
    if (!node || typeof node !== 'object') continue;
    for (const id of Object.keys(node)) {
      // backups 特殊：overlay 为 { units: {charId…}, tokens: {…}, diy: {…} }，按子节点逐 id 对照
      if (fam === 'backups' && (id === 'units' || id === 'tokens')) {
        const sub = node[id];
        const dataTable = data[id] || {};
        for (const cid of Object.keys(sub)) if (!(cid in dataTable)) { delete sub[cid]; pruned++; }
        continue;
      }
      if (fam === 'backups' && id === 'diy') {
        // diy 子树：operators / slots 按 data.backups.diy 同名键对照删除
        const rec = (p) => { let cur = data.diy; for (const k of p) { if (cur == null || typeof cur !== 'object' || !(k in cur)) return null; cur = cur[k]; } return cur; };
        const walkDiy = (o, d, p) => {
          for (const k of Object.keys(o)) {
            const target = rec([...p, k]);
            if (target == null) { delete o[k]; pruned++; continue; }
            if (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k]) && target && typeof target === 'object' && !Array.isArray(target)) walkDiy(o[k], target, [...p, k]);
          }
        };
        walkDiy(node[id], data.diy, []);
        continue;
      }
      if (fam === 'backups') continue;   // 其余嵌套族交给 agent 手工处理
      const path = mapId(id);
      if (!path) continue;
      let cur = data;
      let ok = true;
      for (const k of path) { if (cur == null || typeof cur !== 'object' || !(k in cur)) { ok = false; break; } cur = cur[k]; }
      if (!ok) { delete node[id]; pruned++; }
    }
  }
  if (pruned) writeFileSync(file, JSON.stringify(ov, null, indent) + (out.endsWith('\n') ? '\n' : ''));
  console.log(`[prune] ${lang}: 删除陈旧 overlay 记录 ${pruned} 条`);
}
console.log('[prune] 完成——重跑 node --test test/i18n-data.test.js 验证');
