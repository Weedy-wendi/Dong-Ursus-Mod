// scripts/lib/util.mjs —— 【东】+【乌萨斯】mod 命令行工具的公共工具
// 哈希 / 文件 / 子进程 / 报告。非 mod 逻辑，改这里要谨慎（三个命令都依赖它）。
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, rmSync, copyFileSync, openSync, closeSync, mkdtempSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

export const posix = (s) => s.split(sep).join('/');
export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
export { readFileSync, writeFileSync, readdirSync, statSync };

/** 文件摘要 {size, sha256}；不存在/不是普通文件 → null */
export function digestFile(abs) {
  try { const b = readFileSync(abs); return { size: b.length, sha256: sha256(b) }; } catch { return null; }
}
export const exists = (abs) => existsSync(abs);
export function readJson(abs) { return JSON.parse(readFileSync(abs, 'utf8')); }
export function writeJson(abs, obj) { mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, JSON.stringify(obj, null, 2) + '\n'); }
export function ensureDir(abs) { mkdirSync(abs, { recursive: true }); }
export function rmrf(abs) { rmSync(abs, { recursive: true, force: true }); }
export function copyFile(absSrc, absDst) { mkdirSync(dirname(absDst), { recursive: true }); copyFileSync(absSrc, absDst); }
export function tempDir(prefix = 'mod-cli-') { return mkdtempSync(join(tmpdir(), prefix)); }

/** 递归列出目录下所有文件的 POSIX 相对路径 */
export function walkFiles(root, base = root, out = []) {
  if (!existsSync(root)) return out;
  for (const name of readdirSync(root)) {
    const abs = join(root, name);
    const st = statSync(abs);
    if (st.isDirectory()) walkFiles(abs, base, out);
    else out.push(posix(relative(base, abs)));
  }
  return out;
}

/** 把一批可能为空的目录删掉（自底向上，只删空目录，且不越过 stopAt） */
export function pruneEmptyDirs(dirs, stopAt) {
  const stop = stopAt.replace(/[\\/]+$/, '');
  for (const d of [...new Set(dirs)].sort((a, b) => b.length - a.length)) {
    let cur = d;
    while (cur.length > stop.length && (cur.startsWith(stop + sep) || cur.startsWith(stop + '/'))) {
      try { readdirSync(cur); } catch { break; }            // 不存在 → 停
      try { rmSync(cur); } catch { break; }                  // 非空 → 停
      cur = dirname(cur);
    }
  }
}

/** x.y.z[-pre] 比较：-1 / 0 / 1 */
export function cmpVersion(a, b) {
  const parse = (v) => {
    const m = /^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/.exec(String(v));
    if (!m) throw new Error(`不是合法版本号: ${v}`);
    return { n: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] ?? null };
  };
  const x = parse(a), y = parse(b);
  for (let i = 0; i < 3; i++) if (x.n[i] !== y.n[i]) return x.n[i] < y.n[i] ? -1 : 1;
  if (x.pre === y.pre) return 0;
  if (x.pre === null) return 1;
  if (y.pre === null) return -1;
  return x.pre < y.pre ? -1 : 1;
}

/**
 * 跑子进程。capture=false → 直接继承终端（构建/打补丁这类要看输出的用它）；
 * capture=true → stdout/stderr 落到临时文件再读（管道 stdio 在某些受限环境下会被拒绝）。
 */
export function run(cmd, args, { cwd, capture = false, allowFail = false, quiet = false, env = null, ceiling = null } = {}) {
  // ceiling：把 git 的仓库向上搜索挡在这一层（本体树若恰好是另一个 git 仓库的子目录，
  // 不挡的话 git apply 会把补丁路径按外层仓库根解析并静默跳过）。
  const childEnv = env ?? (ceiling ? { ...process.env, GIT_CEILING_DIRECTORIES: ceiling } : undefined);
  if (!capture) {
    try { execFileSync(cmd, args, { cwd, stdio: quiet ? 'ignore' : 'inherit', env: childEnv }); return { code: 0, out: '', err: '' }; }
    catch (e) {
      const code = e.status ?? 1;
      if (allowFail) return { code, out: '', err: '' };
      throw new Error(`命令失败（exit ${code}）：${cmd} ${args.join(' ')}`);
    }
  }
  const dir = tempDir('mod-run-');
  const outF = join(dir, 'out'), errF = join(dir, 'err');
  const fo = openSync(outF, 'w'), fe = openSync(errF, 'w');
  let code = 0;
  try { execFileSync(cmd, args, { cwd, stdio: ['ignore', fo, fe], env: childEnv }); }
  catch (e) { code = e.status ?? 1; }
  finally { closeSync(fo); closeSync(fe); }
  const out = readFileSync(outF, 'utf8'), err = readFileSync(errF, 'utf8');
  rmrf(dir);
  if (code !== 0 && !allowFail) {
    const e = new Error(`${cmd} ${args.join(' ')} → exit ${code}：${err.trim().split('\n')[0] || ''}`);
    e.code = code; e.out = out; e.err = err;
    throw e;
  }
  return { code, out, err };
}

/** 跑子进程并把 stdout 写进文件（二进制安全，用于 git cat-file blob 这类） */
export function runToFile(cmd, args, { cwd, outFile, env = null, ceiling = null }) {
  mkdirSync(dirname(outFile), { recursive: true });
  const fd = openSync(outFile, 'w');
  const childEnv = env ?? (ceiling ? { ...process.env, GIT_CEILING_DIRECTORIES: ceiling } : undefined);
  let code = 0;
  try { execFileSync(cmd, args, { cwd, stdio: ['ignore', fd, 'ignore'], env: childEnv }); }
  catch (e) { code = e.status ?? 1; }
  finally { closeSync(fd); }
  return code;
}

// ---- 报告 ----
export const say = (m) => console.log('[mod] ' + m);
export const warn = (m) => console.warn('[mod] ⚠ ' + m);
export const head = (m) => console.log('\n[mod] ' + m);
export function die(msg, code = 1) { console.error('[mod] ✖ ' + msg); process.exit(code); }

/** 列表摘要：最多列 5 个，其余折成 "… (+N)" */
export function brief(list, n = 5) {
  if (!list.length) return '无';
  return list.slice(0, n).join('、') + (list.length > n ? ` …（共 ${list.length} 个）` : '');
}
