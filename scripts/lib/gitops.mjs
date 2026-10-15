// scripts/lib/gitops.mjs —— 只做 git 的「安全封装」
// 铁律：git 的退出码不可信。补丁套完必须由调用方按 mod.json 的字节指纹复核
// （实测：git apply 在仓库子目录里会静默跳过所有补丁并返回 0；同一棵树上「已应用」也会被跳过）。
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { exists, posix, run, runToFile, tempDir, rmrf, warn } from './util.mjs';

/** git 是否可用（返回版本号字符串或 null） */
export function gitVersion(cwd) {
  const r = run('git', ['--version'], { cwd, capture: true, allowFail: true });
  return r.code === 0 ? r.out.trim() : null;
}
export const gitAvailable = (cwd) => gitVersion(cwd) !== null;

/** root 自己是不是一个 git 工作树的根（不是「恰好位于某个仓库内」） */
export function isRepoRoot(root) {
  const r = run('git', ['rev-parse', '--show-toplevel'], { cwd: root, capture: true, allowFail: true, ceiling: root });
  if (r.code !== 0) return false;
  try { return resolve(r.out.trim()) === resolve(root); } catch { return false; }
}

export function revParse(root, rev) {
  const r = run('git', ['rev-parse', '--verify', '--quiet', rev], { cwd: root, capture: true, allowFail: true, ceiling: root });
  return r.code === 0 ? r.out.trim() : null;
}

export function hasCommit(root, sha) {
  if (!sha) return false;
  return run('git', ['cat-file', '-e', `${sha}^{commit}`], { cwd: root, capture: true, allowFail: true, ceiling: root }).code === 0;
}

/** 从某个提交取出一个 blob 的字节（写进 outFile） */
export function blobToFile(root, commit, rel, outFile) {
  return runToFile('git', ['cat-file', 'blob', `${commit}:${rel}`], { cwd: root, outFile, ceiling: root });
}

/** 用某个提交还原指定文件（分批，避免命令行过长）。返回失败的批次内容。 */
export function checkoutPaths(root, commit, rels, { chunk = 60 } = {}) {
  const failed = [];
  for (let i = 0; i < rels.length; i += chunk) {
    const part = rels.slice(i, i + chunk);
    const r = run('git', ['checkout', commit, '--', ...part], { cwd: root, capture: true, allowFail: true, ceiling: root });
    if (r.code !== 0) failed.push(...part);
  }
  return failed;
}

// 补丁相关命令一律钉死换行符处理：patch 里的内容是 LF，产物也必须是 LF。
// 不钉的话，git 会用**全局** core.autocrlf（Windows 上常为 true）把新增行写成 CRLF——
// 实测后果：在非 git 检出的树上装完，73 个补丁产物全是 CRLF，与本体适配树（LF）逐字节不一致。
const LF = ['-c', 'core.autocrlf=false', '-c', 'core.eol=lf'];

/** 补丁能否正向/反向套用（只用于给人话结论，不作为成败依据） */
export function patchCheck(root, patchAbs) {
  const fwd = run('git', [...LF, 'apply', '--check', '-p1', patchAbs], { cwd: root, capture: true, allowFail: true, ceiling: root }).code === 0;
  const rev = fwd ? false : run('git', [...LF, 'apply', '--check', '--reverse', '-p1', patchAbs], { cwd: root, capture: true, allowFail: true, ceiling: root }).code === 0;
  return { forward: fwd, reverse: rev };
}

/** 补丁涉及的文件（从 patch 文本里读 diff --git 行） */
export function patchTargets(patchAbs) {
  try {
    const text = readFileSync(patchAbs, 'utf8');
    return [...text.matchAll(/^diff --git a\/(.+?) b\//gm)].map((m) => posix(m[1]));
  } catch { return []; }
}

/** 在给定文件集合里找残留的 *.rej */
export function collectRejects(root, rels) {
  return (rels ?? []).filter((rel) => exists(join(root, ...(rel + '.rej').split('/')))).map((rel) => rel + '.rej');
}

/**
 * 套一个补丁。不做「已应用」判定——由调用方按指纹复核结果。
 * 顺序：正向 → （失败）--ignore-whitespace（CRLF 工作区）→ 收集 .rej 后判定失败。
 * @returns {{ ok: boolean, mode: string, rejects: string[], err: string }}
 */
export function applyPatch(root, patchAbs) {
  for (const [mode, extra] of [['apply', []], ['ignore-whitespace', ['--ignore-whitespace']]]) {
    const r = run('git', [...LF, 'apply', '-p1', ...extra, patchAbs], { cwd: root, capture: true, allowFail: true, ceiling: root });
    if (r.code === 0) return { ok: true, mode, rejects: [], err: '' };
  }
  const rej = run('git', [...LF, 'apply', '--reject', '-p1', patchAbs], { cwd: root, capture: true, allowFail: true, ceiling: root });
  return {
    ok: false,
    mode: 'reject',
    rejects: collectRejects(root, patchTargets(patchAbs)),
    err: (rej.err || rej.out || '').trim().split('\n')[0] || '',
  };
}

/** 用 git 浅克隆一个分支到 dest。返回 { ok, err } */
export function cloneBranch(url, branch, dest) {
  const r = run('git', ['clone', '--depth', '1', '--single-branch', '--branch', branch, url, dest], { capture: true, allowFail: true });
  return { ok: r.code === 0, err: (r.err || r.out || '').trim() };
}

export { tempDir, rmrf, warn };
