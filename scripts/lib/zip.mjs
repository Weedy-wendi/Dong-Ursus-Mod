// scripts/lib/zip.mjs —— 极简 zip 读取（stored / deflate、zip64、UTF-8 名称）
// 解析逻辑参照本体 tools/package-update.mjs 的 readZip（本体与本 mod 同为 GPL-3.0-or-later），
// 按 mod 的需要精简，并补上解压时的路径校验（拒绝绝对路径与 .. 逃逸）。
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { ensureDir } from './util.mjs';

const SIG = { eocd: 0x06054b50, loc64: 0x07064b50, eocd64: 0x06064b50, central: 0x02014b50, local: 0x04034b50 };
const U32 = 0xffffffff;

function readAt(fd, pos, len) {
  const buf = Buffer.alloc(len);
  let got = 0;
  while (got < len) {
    const n = fs.readSync(fd, buf, got, len - got, pos + got);
    if (n <= 0) throw new Error('zip 意外结束');
    got += n;
  }
  return buf;
}

/** 中央目录里某一项的名字：优先进程位 11 标记的 UTF-8，否则看 Info-ZIP 的 Unicode Path 额外字段 */
function entryName(cd, p, flags, nameLen, extraLen) {
  const raw = cd.subarray(p + 46, p + 46 + nameLen);
  if (!(flags & 0x800)) {
    for (let q = p + 46 + nameLen, end = q + extraLen; q + 4 <= end;) {
      const id = cd.readUInt16LE(q);
      const len = cd.readUInt16LE(q + 2);
      if (id === 0x7075 && len >= 5 && cd[q + 4] === 1 && q + 4 + len <= end
        && (typeof zlib.crc32 !== 'function' || (zlib.crc32(raw) >>> 0) === cd.readUInt32LE(q + 5))) {
        return cd.toString('utf8', q + 9, q + 4 + len);
      }
      q += 4 + len;
    }
  }
  return raw.toString('utf8');
}

/** 遍历 zip 里的每个文件项（跳过目录），回调 (name, data) */
export function readZip(zipPath, onFile) {
  const fd = fs.openSync(zipPath, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const tailLen = Math.min(size, 22 + 65535);
    const tail = readAt(fd, size - tailLen, tailLen);
    let e = -1;
    for (let i = tailLen - 22; i >= 0; i--) if (tail.readUInt32LE(i) === SIG.eocd) { e = i; break; }
    if (e < 0) throw new Error('不是 zip 文件（找不到中央目录结尾）');
    let count = tail.readUInt16LE(e + 10);
    let cdSize = tail.readUInt32LE(e + 12);
    let cdOffset = tail.readUInt32LE(e + 16);
    if (count === 0xffff || cdSize === U32 || cdOffset === U32) {
      const locPos = size - tailLen + e - 20;
      const loc = locPos >= 0 ? readAt(fd, locPos, 20) : null;
      if (!loc || loc.readUInt32LE(0) !== SIG.loc64) throw new Error('缺少 zip64 定位记录');
      const rec = readAt(fd, Number(loc.readBigUInt64LE(8)), 56);
      if (rec.readUInt32LE(0) !== SIG.eocd64) throw new Error('缺少 zip64 结尾记录');
      count = Number(rec.readBigUInt64LE(32));
      cdSize = Number(rec.readBigUInt64LE(40));
      cdOffset = Number(rec.readBigUInt64LE(48));
    }
    const cd = readAt(fd, cdOffset, cdSize);
    let p = 0;
    for (let n = 0; n < count; n++) {
      if (p + 46 > cd.length || cd.readUInt32LE(p) !== SIG.central) throw new Error('中央目录损坏');
      const flags = cd.readUInt16LE(p + 8);
      const method = cd.readUInt16LE(p + 10);
      const crc = cd.readUInt32LE(p + 16);
      let packedSize = cd.readUInt32LE(p + 20);
      let rawSize = cd.readUInt32LE(p + 24);
      const nameLen = cd.readUInt16LE(p + 28);
      const extraLen = cd.readUInt16LE(p + 30);
      const commentLen = cd.readUInt16LE(p + 32);
      let offset = cd.readUInt32LE(p + 42);
      const name = entryName(cd, p, flags, nameLen, extraLen);
      if (packedSize === U32 || rawSize === U32 || offset === U32) {
        for (let q = p + 46 + nameLen, end = q + extraLen; q + 4 <= end;) {
          const id = cd.readUInt16LE(q);
          const len = cd.readUInt16LE(q + 2);
          if (id === 1) {
            let r = q + 4;
            if (rawSize === U32) { rawSize = Number(cd.readBigUInt64LE(r)); r += 8; }
            if (packedSize === U32) { packedSize = Number(cd.readBigUInt64LE(r)); r += 8; }
            if (offset === U32) { offset = Number(cd.readBigUInt64LE(r)); r += 8; }
            break;
          }
          q += 4 + len;
        }
      }
      p += 46 + nameLen + extraLen + commentLen;
      if (name.endsWith('/')) continue;
      if (flags & 1) throw new Error(`${name}: 加密的 zip 项不受支持`);
      const local = readAt(fd, offset, 30);
      if (local.readUInt32LE(0) !== SIG.local) throw new Error(`${name}: 本地头损坏`);
      const packed = readAt(fd, offset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28), packedSize);
      let data;
      if (method === 0) data = packed;
      else if (method === 8) data = zlib.inflateRawSync(packed);
      else throw new Error(`${name}: 压缩方式 ${method} 不受支持（只支持 stored / deflate）`);
      if (data.length !== rawSize) throw new Error(`${name}: 解压后 ${data.length} 字节，目录声明 ${rawSize}`);
      if (typeof zlib.crc32 === 'function' && (zlib.crc32(data) >>> 0) !== crc) throw new Error(`${name}: CRC 不匹配（zip 损坏）`);
      onFile(name, data);
    }
  } finally {
    fs.closeSync(fd);
  }
}

/** 解压到 destDir（做路径逃逸校验）。返回解出来的相对路径列表。 */
export function extractZip(zipPath, destDir) {
  const out = [];
  readZip(zipPath, (name, data) => {
    const rel = name.replaceAll('\\', '/');
    if (rel.startsWith('/') || /^[A-Za-z]:/.test(rel)) throw new Error(`zip 里有绝对路径：${name}`);
    const parts = rel.split('/');
    if (parts.some((s) => s === '..' || s === '' || s === '.')) throw new Error(`zip 里有可疑路径：${name}`);
    const abs = path.join(destDir, ...parts);
    ensureDir(path.dirname(abs));
    fs.writeFileSync(abs, data);
    out.push(rel);
  });
  return out;
}

/**
 * 解压一个「发布 zip」并返回包根目录：
 * GitHub 的分支 zip 顶层会多一层 <repo>-<branch>/，这里自动剥掉。
 */
export function extractPackageZip(zipPath, destDir) {
  const rels = extractZip(zipPath, destDir);
  if (rels.some((r) => r === 'mod.json')) return destDir;
  const tops = new Set(rels.map((r) => r.split('/')[0]));
  if (tops.size === 1) {
    const top = [...tops][0];
    const inner = path.join(destDir, top);
    if (fs.existsSync(path.join(inner, 'mod.json'))) return inner;
  }
  return destDir;
}
