// scripts/lib/manifest.mjs —— mod.json 的读取与校验
// mod.json 是「包对基线的承诺」：base = 装之前的本体重建指纹；patched/owned = 装之后应有的字节。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { die, exists, posix, readJson, sha256, warn } from './util.mjs';

export const MANIFEST_FILE = 'mod.json';

/** 把 CRLF 归一成 LF 后再比较（Windows 上 autocrlf / .gitattributes 会把部分文件签出成 CRLF） */
const normalizeEol = (buf) => {
  const s = buf.toString('latin1');
  return s.includes('\r') ? Buffer.from(s.replace(/\r\n/g, '\n'), 'latin1') : buf;
};

/** 读取并做最小结构校验（不校验文件本身，那是 verify 的事） */
export function loadManifest(modRoot) {
  const file = join(modRoot, MANIFEST_FILE);
  if (!exists(file)) die(`缺少 ${MANIFEST_FILE}：这个 mod 包不完整（应由 tools/make-manifest.mjs 生成）`, 3);
  let m;
  try { m = readJson(file); } catch (e) { die(`${MANIFEST_FILE} 不是合法 JSON：${e.message}`, 3); }
  for (const k of ['mod', 'version', 'base', 'owned', 'patched', 'removed', 'generated']) {
    if (!(k in m)) die(`${MANIFEST_FILE} 缺少字段 ${k}`, 3);
  }
  if (!m.base?.version || !m.base?.files || typeof m.base.files !== 'object') die(`${MANIFEST_FILE} 的 base 不完整（需要 version / files）`, 3);
  return m;
}

/** 读一个模块自己的 mod.json（不做 die，调用方要自己处理） */
export function tryLoadManifest(modRoot) {
  const file = join(modRoot, MANIFEST_FILE);
  if (!exists(file)) return null;
  try { return readJson(file); } catch { return null; }
}

/**
 * 逐文件比对 root 下的文件与期望集 { rel: {size, sha256} }。
 * 只有换行符不同（CRLF ↔ LF）的算 eol，不算 mismatch——那在 Windows 上是正常的签出差异。
 * @returns {{ ok: string[], eol: string[], missing: string[], mismatch: string[] }}
 */
export function verifySet(root, set) {
  const ok = [], eol = [], missing = [], mismatch = [];
  for (const [rel, want] of Object.entries(set ?? {})) {
    const abs = join(root, ...rel.split('/'));
    let buf;
    try { buf = readFileSync(abs); } catch { missing.push(rel); continue; }
    if (buf.length === want.size && sha256(buf) === want.sha256) { ok.push(rel); continue; }
    const n = normalizeEol(buf);
    if (n.length === want.size && sha256(n) === want.sha256) { eol.push(rel); continue; }
    mismatch.push(rel);
  }
  return { ok, eol, missing, mismatch };
}

/** 检查一组路径是否都不存在（mod 自有文件在纯净基线上应当不存在） */
export function findPresent(root, rels) {
  const out = [];
  for (const rel of rels ?? []) if (exists(join(root, ...rel.split('/')))) out.push(rel);
  return out;
}

/** 检查一组路径是否都存在（安装时被删除的上游文件，在基线上应当存在） */
export function findAbsent(root, rels) {
  const out = [];
  for (const rel of rels ?? []) if (!exists(join(root, ...rel.split('/')))) out.push(rel);
  return out;
}

/** 把校验结果折成一句人话 */
export function verdict(v) {
  const eol = v.eol?.length ? `、${v.eol.length} 个仅换行符不同` : '';
  if (!v.missing.length && !v.mismatch.length) return `${v.ok.length} 个文件全部一致${eol}`;
  return `${v.ok.length} 个一致、${v.missing.length} 个缺失、${v.mismatch.length} 个内容不同${eol}`;
}

/** 打印一组不一致（缺失/不同）的明细，最多 n 条 */
export function reportBad(v, what, n = 8) {
  for (const rel of [...v.missing, ...v.mismatch].slice(0, n)) {
    warn(`  ${v.missing.includes(rel) ? '缺失' : '不同'}：${rel}`);
  }
  const more = v.missing.length + v.mismatch.length - n;
  if (more > 0) warn(`  …（还有 ${more} 个）`);
  if (v.eol?.length) warn(`  仅换行符不同（CRLF/LF，Windows 签出常见，视为一致）：${v.eol.slice(0, 5).join('、')}${v.eol.length > 5 ? ' …' : ''}`);
  if (v.missing.length || v.mismatch.length) warn(`${what}：${verdict(v)}`);
}
