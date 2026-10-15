// scripts/lib/state.mjs —— 安装状态与备份（<本体树>/.mod-dong-ursus/）
// state.json 是「这台机器装了什么」：每个被触碰文件的装前字节（before）与装后字节（after）。
// 卸载/升级全靠它；没有它就只能靠 git 猜。备份目录 backup/<相对路径> 存放 before 的副本，
// 这样即使本体不是 git 检出（Download ZIP 的源码包），也能精确还原。
import { join } from 'node:path';
import { digestFile, exists, readFileSync, readJson, rmrf, sha256, writeJson, ensureDir, copyFile, posix } from './util.mjs';

export const STATE_DIR = '.mod-dong-ursus';
export const STATE_FILE = 'state.json';
export const BACKUP_DIR = 'backup';

export const stateDir = (repo) => join(repo, STATE_DIR);
export const statePath = (repo) => join(stateDir(repo), STATE_FILE);
export const backupRoot = (repo) => join(stateDir(repo), BACKUP_DIR);
export const backupPath = (repo, rel) => join(backupRoot(repo), ...rel.split('/'));

export function loadState(repo) {
  const f = statePath(repo);
  if (!exists(f)) return null;
  try {
    const st = readJson(f);
    if (!st || st.format !== 1 || !Array.isArray(st.entries)) return null;
    return st;
  } catch { return null; }
}

export function saveState(repo, st) { writeJson(statePath(repo), st); }

/** 备份一个文件（装前字节）。返回是否真的备份了。 */
export function backUp(repo, rel) {
  const src = join(repo, ...rel.split('/'));
  if (!exists(src)) return false;
  copyFile(src, backupPath(repo, rel));
  return true;
}

/** 丢弃状态目录（keepBackup=true 只删 state.json，留备份供人工核对） */
export function clearState(repo, { keepBackup = false } = {}) {
  rmrf(keepBackup ? statePath(repo) : stateDir(repo));
}

/**
 * 装前状态：给一组路径记录 { path, kind, before }。
 * kind：文件存在 → modified；不存在 → created。
 */
export function snapshot(repo, paths) {
  const entries = [];
  for (const rel of paths) {
    const before = digestFile(join(repo, ...rel.split('/')));
    entries.push({ path: posix(rel), kind: before ? 'modified' : 'created', before, after: null });
  }
  return entries;
}

/** 把这些路径（安装时被删除的上游文件）标记为 deleted */
export function snapshotDeleted(repo, paths) {
  return paths.map((rel) => ({
    path: posix(rel), kind: 'deleted', before: digestFile(join(repo, ...rel.split('/'))), after: null,
  }));
}

/**
 * 漂移检查：当前树与状态记录的 after 是否一致。
 * 仅换行符不同（CRLF ↔ LF）不算漂移——Windows 上的签出/编辑器差异，不该被当成「用户改过」。
 * @returns {{ drifted: {path, reason}[], missing: string[], eolOnly: string[] }}
 */
export function driftCheck(repo, st) {
  const drifted = [], missing = [], eolOnly = [];
  const normalize = (buf) => {
    const s = buf.toString('latin1');
    return s.includes('\r') ? Buffer.from(s.replace(/\r\n/g, '\n'), 'latin1') : buf;
  };
  for (const e of st.entries) {
    const abs = join(repo, ...e.path.split('/'));
    const now = digestFile(abs);
    if (e.kind === 'deleted') {
      if (now) drifted.push({ path: e.path, reason: '安装时被删除，现在又被放回来了' });
      continue;
    }
    if (!now) { missing.push(e.path); continue; }
    if (!e.after) continue;
    if (now.size === e.after.size && now.sha256 === e.after.sha256) continue;
    try {
      const n = normalize(readFileSync(abs));
      if (n.length === e.after.size && sha256(n) === e.after.sha256) { eolOnly.push(e.path); continue; }
    } catch { /* 读不到就按漂移处理 */ }
    drifted.push({ path: e.path, reason: '内容与安装时不一致（这台电脑改过它）' });
  }
  return { drifted, missing, eolOnly };
}

/** 汇总状态，供 status 命令展示 */
export function summarize(st) {
  const by = { created: 0, modified: 0, deleted: 0, generated: 0 };
  for (const e of st.entries) by[e.kind] = (by[e.kind] ?? 0) + 1;
  return by;
}

export { ensureDir };
