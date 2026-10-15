// scripts/lib/source.mjs —— 「拉取包」：从本地 zip/目录，或从 git 远端的一个分支取回 mod 包
// 方案 B（每个本体版本一个分支 base-<版本>）下的选取规则：分支名由本地本体版本决定，包里
// 的 mod.json 再做一次自我声明校验（base.version / base.commit），两道都要过。
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { cloneBranch } from './gitops.mjs';
import { tryLoadManifest } from './manifest.mjs';
import { extractPackageZip } from './zip.mjs';
import { die, exists, rmrf, say, tempDir, warn } from './util.mjs';

/** 远端仓库地址的规范化：把 gitclone 这类镜像的写法也认出来 */
export function normalizeRepoUrl(url) {
  return String(url).replace(/\.git$/, '').replace(/\/+$/, '');
}

/** 从一个本地目录或 zip 取包 */
export function stageFromFile(file) {
  if (!exists(file)) die(`找不到 --file 指定的路径：${file}`, 3);
  const st = statSync(file);
  if (st.isDirectory()) {
    if (!exists(join(file, 'mod.json'))) die(`--file 指向的目录里没有 mod.json：${file}`, 3);
    return { dir: file, origin: `本地目录 ${file}`, cleanup: null };
  }
  if (!/\.zip$/i.test(file)) die(`--file 只支持目录或 .zip：${file}`, 3);
  const tmp = tempDir('mod-pkg-');
  const dir = extractPackageZip(file, tmp);
  if (!exists(join(dir, 'mod.json'))) die(`这个 zip 里没有 mod.json（不是 mod 包？）：${file}`, 3);
  return { dir, origin: `本地 zip ${file}`, cleanup: tmp };
}

/** 候选远端地址：显式 --source 优先，其次 mod.json 的 source.repo；镜像写法自动补一份 */
export function candidateUrls({ explicit, manifestRepo }) {
  const list = [];
  const push = (u) => { const n = normalizeRepoUrl(u); if (n && !list.includes(n)) list.push(n); };
  if (explicit) push(explicit);
  if (manifestRepo) push(manifestRepo);
  for (const u of [...list]) {
    // github.com/<o>/<r> → 补一个 gitclone 镜像形式（本机 GitHub 直连被 hosts 屏蔽时的常见绕行）
    const m = /^https:\/\/github\.com\/(.+)$/.exec(u);
    if (m) push(`https://gitclone.com/github.com/${m[1]}`);
  }
  return list;
}

/**
 * 克隆 base-<版本> 分支取包。
 * @returns {{ dir: string, origin: string, cleanup: string|null }}
 */
export function stageFromRepo({ baseVersion, branchPrefix = 'base-', branch: branchOverride = null, urls, attempts = 2 }) {
  const branch = branchOverride || `${branchPrefix}${baseVersion}`;
  const problems = [];
  for (const url of urls) {
    for (let i = 1; i <= attempts; i++) {
      const dest = join(tempDir('mod-src-'), 'pkg');
      const r = cloneBranch(url, branch, dest);
      if (r.ok && exists(join(dest, 'mod.json'))) {
        return { dir: dest, origin: `${url} （分支 ${branch}）`, cleanup: null };
      }
      problems.push(`${url} #${i}: ${(r.err || '克隆成功但里面没有 mod.json').split('\n')[0]}`);
      rmrf(dest);
      if (i < attempts) say(`  ${url} 第 ${i} 次失败，重试…`);
    }
  }
  warn('拉取失败。可尝试：');
  warn(`  1) 换成本地包：--file <mod 包.zip | 解压后的目录>`);
  warn(`  2) 显式指定可用地址：--source <url>（例如 https://gitclone.com/github.com/<owner>/<repo>）`);
  warn(`  3) 若 GitHub 被 hosts 屏蔽而用 gitclone 镜像：确认 git 的 insteadOf 是 https://gitclone.com/github.com（少了 /github.com 会 404）`);
  for (const p of problems.slice(-4)) warn(`     · ${p}`);
  die(`没能取到 ${branch} 分支的包`, 4);
}

/** 统一入口：--file 优先，其次远端 */
export function stagePackage({ file, source, manifest, baseVersion, branch = null }) {
  if (file) return stageFromFile(file);
  const urls = candidateUrls({ explicit: source, manifestRepo: manifest?.source?.repo });
  if (!urls.length) die('没有可用的源地址：mod.json 里缺少 source.repo，也没有 --source/--file', 3);
  const br = branch || `${manifest?.source?.branchPrefix ?? 'base-'}${baseVersion}`;
  say(`拉取远端包（分支 ${br}）…`);
  return stageFromRepo({ baseVersion, branchPrefix: manifest?.source?.branchPrefix, branch, urls });
}

export { tryLoadManifest };
