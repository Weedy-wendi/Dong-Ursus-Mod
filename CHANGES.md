# v0.2.6 mod 包 · 修改记录

按日期倒序追加。每条写清**改了什么 / 为什么 / 怎么验的**，路径都相对本包（`<mod>/v0.2.6/`）或本体树。

---

## 2026-10-16（第六条）· v1.0.5：卸载默认「彻底删除本 mod 的东西」，且不误伤别的 mod

### 改了什么

| 文件 | 改动 |
|---|---|
| `scripts/mod.mjs` | 无记录卸载：**mod 自有路径一律删除**（基线提交里不存在的文件，不再按指纹判断"是否本包版本"），内容与本包不同的先另存 `.mod-dong-ursus/backup-removed-<时间>/`；本体原有文件从基线还原；只有「确实是本 mod 的内容」才回退，其余保留并列出（`--force` 才整文件回退）；新增 `--keep-changed`；`stripModContent()` 在「树里已无本 mod 补丁产物」时跳过反向套补丁（避免 `-R --reject` 撒 .rej） |
| `mod.json` | `version` 1.0.4 → **1.0.5**（指纹集合不变） |

### 为什么

用户在「多人版本」的 fork 树上反复遇到「uninstall 删不掉本 mod」。实测诊断出两个原因：
1. 他手上那份包是 **v1.0.0**——v1.0.0 的无记录卸载只打印手工步骤，本来就不动文件（无记录卸载是 v1.0.2 才有的）；
2. 即使换成新包，那棵树里有 **5 个文件是更早版本的 mod 文件**（`custom-content.mjs` 48421B vs 当前 48831B、`yato2.js` 26062B vs 26554B 等），旧策略「内容与本包指纹不符 → 当你改过 → 保留」会把它们留下。

### 怎么验的

复刻出用户那棵树的状态：85 个装前文件都在基线、补丁已反解（0/73）、12 个上游文件已还原、无 `state.json`、29 个自有文件里 24 个与本包一致 + 5 个是「旧版本」内容、另有别的 mod 在 `meta.js` 留下的未提交改动。

| 步骤 | 结果 |
|---|---|
| `uninstall`（默认） | 「树里已无本 mod 的补丁产物（0/73）→ 跳过反向套补丁」（**没有撒 .rej**）；「自有文件：删除 28 · 还原 0 · 删除前另存 5 个」+ 另存目录；生成物 22/22 还原；「本 mod 指纹：已清空 ✅」 |
| 别的 mod | 标记完好；`git status` 只剩它的 1 个文件 |
| 本体原有文件 | `data/assets.json` 保留并等于基线（`git diff` 为空） |
| `--keep-changed` | 那 5 个被保留并明确告知 |

10/10 断言通过。

补充：卸载时的生成物改为**优先重跑 `build-data`**（`data/*.json` 是「当前源码的函数」，这样别的 mod / fork 自己的数据改动——例如 `data/config.json` 里的玩家上限——不会被回退），工具链不可用或失败时才按基线 `git checkout` 还原。

---

## 2026-10-16（第五条）· v1.0.4：update 的版本判定改成双侧（本体里装的 + 本地包）

### 改了什么

| 文件 | 改动 |
|---|---|
| `scripts/mod.mjs` | `cmdUpdate()` 重写判定：候选分别与「本体里装的版本」（`state.json` 的 `modVersion`；无记录时用候选指纹核对树内容）和「本地包版本」比较，得出 `needTree` / `needPkg` 两个独立结论；输出改成两行结论 + `--check` 预告将执行什么 |
| `mod.json` | `version` 1.0.3 → **1.0.4**（指纹集合不变） |

### 为什么

用户实测：**本地包已经是最新（v1.0.3），但本体里装的还是旧版**，`update` 却说「已是最新版本，无需更新」→ 游戏里的 mod 永远更新不到。根因：旧实现只拿候选版本跟**本地包**版本比（`cmpVersion(cand.version, local.version)`），完全没有看本体里的安装记录。

### 怎么验的

复刻树 = 85 装前文件 + 22 生成物 + `package.json` + `index.js` + `git init`；用`state.json` 造出「本体里装着 v1.0.0」的记录，另做三个包副本（本地包最新 / 本地包旧 / 候选包）：

| 场景 | `--check` 输出 | 结果 |
|---|---|---|
| ① 本地包最新 + 本体里装的是 v1.0.0（**用户实测的 bug**） | 「本体里装的是 v1.0.0 → 需要装 v1.0.3」「本地包已经是 v1.0.3」「将执行 把本体里的 mod 更新到 v1.0.3」 | ✅ 会去装本体，且不刷新包 |
| ② 本体里已是候选 + 本地包是 v1.0.0 | 「本体里已经是 v1.0.3」「本地包是 v1.0.0 → 需要刷新到 v1.0.3」「将执行 刷新本地包目录」 | ✅ 只刷新包，不动本体 |
| ③ 两边都最新 | 「本体与本地包都已是这个版本，无需更新」 | ✅ 什么都不做 |
| ④ 场景 ① 真跑（不带 `--check`） | 「① 用候选包对本体树执行 install」→ 复刻树里两个补丁都套上（说明本体确实被更新） | ✅ 本体安装失败时不去刷新本地包、也不改包内容 |

10/10 断言通过。

---

## 2026-10-16（第四条）· v1.0.3：与其他 mod 共存（反向套补丁）；修正 status 结论优先级

### 改了什么

| 文件 | 改动 |
|---|---|
| `scripts/lib/gitops.mjs` | 新增 `revertPatch()`：`git apply -R` → `-R --3way` → `-R --ignore-whitespace` → `-R --reject` |
| `scripts/mod.mjs` | 新增 `stripModContent()`（反向套补丁 + 指纹/备份兜底），install 的「先摘再装」与 uninstall 共用；install 的基线门改为「先让 git 试套，能套上就继续」；uninstall 的生成物在「树里还有别的改动」时改为重跑 `build-data`（失败则回退到 git 还原）；残留检查与退出码只算本 mod 的残留；`status` 结论优先级修正（有本 mod 内容时不再报「未安装」，并区分完整/半装） |
| `mod.json` | `version` 1.0.2 → **1.0.3**（指纹集合不变） |

### 为什么

用户反馈两条：① `status` 在「树里有 29/29 自有文件、但补丁产物 0/73」的树上报「未安装」——结论优先级写反了；② **本体上还装着别的 mod 时，卸载删不掉本 mod 的内容**——因为整文件级指纹比对在「文件里同时有别人的改动」时对不上，只能整文件保留。改成反向套补丁后，hunk 级别地只摘我们改过的段落。

### 怎么验的

复刻树 = 85 装前文件 + 22 生成物 + `package.json` + `index.js`；先注入「别的 mod 的改动」（`meta.js` 顶部、`build-data.mjs` 末尾各一段标记，都在本 mod hunk 之外），再模拟本 mod 的旧版安装（套两个补丁 + 放 29 自有文件 + 删 12 被替换文件 + 不写 state.json）：

| 步骤 | 结果 |
|---|---|
| `status` | 「检测到本 mod 的内容（自有文件 29/29 · 补丁产物 71/73 · 被删 12/12）；这是一次**不完整**的安装…」✅（不再说未安装） |
| `uninstall` | 「反向套补丁 2/2 · 其余回退 git 12 · 本机改动保留 2」；别的 mod 的两处标记**仍在**、本 mod 的 hunk 已摘掉；自有文件删除 28、12 个上游文件还原 |
| 残留检查 | 「本 mod 指纹：已清空 ✅」+「另有 2 个文件与基线不同，但不是本 mod 的内容（未动）」；`git status` 只剩别的 mod 的 2 个文件；退出码 0 |
| 再 `install` | 「这些差异看着不是本 mod 造成的，但本 mod 的补丁能干净套上 → 继续装」→ 两个补丁都套上、别的 mod 的标记依然在 |

---

## 2026-10-16（第三条）· v1.0.2：拉取默认走镜像；卸载不再需要安装记录

### 改了什么

| 文件 | 改动 |
|---|---|
| `scripts/lib/source.mjs` | 候选地址扩展：`MOD_SOURCE` → `--source` → `source.repo` → `MOD_MIRROR` → `source.mirrors` → 自动派生的 gitclone 形式；镜像支持「前缀」写法（`https://ghproxy.net` → `<前缀>/<源地址>`）；打印候选清单 |
| `scripts/mod.mjs` | `uninstall` 新增「无安装记录」路径：按 `mod.json` 重建并撤掉全部内容 + 残留检查；`restorePristine()` 加「本机改动默认保留」安全线（`--force` 才覆盖）与 `backup` 开关；`uninstall --force` 在「看不出有 mod 内容」时也能强制回基线 |
| `scripts/lib/gitops.mjs` | 新增 `pathsInCommit()`（区分本体原有文件与 mod 新增文件） |
| `tools/make-manifest.mjs` | 默认写入 `source.mirrors` |
| `mod.json` | `version` 1.0.1 → **1.0.2**；`source.mirrors` = `["https://gitclone.com/github.com/Weedy-wendi/Dong-Ursus-Mod"]`（指纹集合不变） |

### 为什么

- 玩家机器上 GitHub 常被 hosts 屏蔽或直连不稳，而 `update` 之前只试 `source.repo` + 自动派生的 gitclone 形式；现在包自带默认镜像、并且能临时换。
- `uninstall` 之前**没有安装记录就罢工**（只打印手工回退步骤）。玩家期望的是「卸载之后这个 mod 加过/改过的东西一个不留」。

### 怎么验的

复刻树 = 85 个装前文件 + 22 个生成物 + `package.json` + `server/sim/content/index.js`，`git init` 后模拟一次旧版安装（套两个补丁 + 放 29 个自有文件 + 删 12 个被替换文件 + **不写 state.json**）：

| 步骤 | 结果 |
|---|---|
| `uninstall` | 「装前文件：git 85 · 保留本机改动 0」「生成物：22/22 已还原」「自有文件：删除 28 · 还原 0」「已清理 .mod-dong-ursus/」 |
| 残留检查 | 「本 mod 指纹：已清空 ✅」「git status：空 ✅」；`dongShip.png` 已删、12 个被替换的上游文件已回来 |
| 手改一个被安装的文件后再 `uninstall` | 「保留本机改动 1」+ 提示「再跑一次 uninstall --force」；`git status` 只剩那 1 项 |
| 再 `uninstall --force` | 回到基线：「本 mod 指纹：已清空 ✅」「git status：空 ✅」 |
| 镜像候选 | `MOD_MIRROR='https://ghproxy.net, https://gitclone.com/github.com/Weedy-wendi/Dong-Ursus-Mod'` → 「候选地址 3 个」，前缀被正确拼成 `https://ghproxy.net/https://github.com/Weedy-wendi/Dong-Ursus-Mod`，`mod.json` 的默认镜像与自动派生项去重 |

顺带记一个环境事实：**Git for Windows 的系统级默认是 `core.autocrlf=true`**，所以新 `git init` 的仓库里 `git checkout` 会写出 CRLF（本体仓库自己设了 false）。补丁因此先走 `--ignore-whitespace` 兜底，指纹比对也容忍「仅换行符不同」。

---

## 2026-10-16（第二条）· v1.0.1：不再要求「纯净本体」—— status 只查版本与 mod 内容，旧版安装自动回退

### 改了什么

| 文件 | 改动 |
|---|---|
| `scripts/mod.mjs` | 新增 `classify()`（三态判定）与 `restorePristine()`（无安装记录时的自动回退）；`status` 结论与输出重写；`install` 前置判定重写；已装同版本且一致时走「无需重装」快路径 |
| `mod.json` | `version` 1.0.0 → **1.0.1**（指纹集合不变：base.files 85 / patched 73 / owned 29 / removed 12 / generated 22） |
| `README.md` · `SKILL.md` | 同步新口径（快速开始、更新日志、四条命令说明、注意事项第 7 条） |

### 为什么

玩家手上的本体很少是纯净的：装过旧版 mod、手改过文件、装过别的东西都很常见。原设计把「必须是纯净基线」当硬门槛，逼玩家手工 `git stash`；而**旧版安装没有 `state.json`**，实际上没有别的路可走。

### 怎么判的（只用 mod.json 自带的三组指纹，不依赖 git）

- **本体版本**：`<repo>/package.json` 的 `version` == `mod.json.base.version`（不符直接拒绝，exit 2）
- **本 mod 内容**：`owned` 的 29 个自有文件在树里 / `removed` 的 12 个被替换文件已删 / 存在 `state.json`
- **这 85 个「装之前」的文件是否在基线字节上**（容忍 CRLF ↔ LF）

→ 结论四态：版本不符 / 已安装（含漂移计数）/ 树里有 mod 内容但无安装记录 / 与本 mod 无关的改动。

### 怎么验的

复刻树：85 个基线文件 + `package.json` + `server/sim/content/index.js`，`git init` 后模拟一次旧版安装（套两个补丁 + 放 29 个自有文件 + 删 12 个被替换文件 + **不写 state.json**）：

| 步骤 | 结果 |
|---|---|
| `status` | 「本 mod 内容：自有文件 29/29 在树里 · 补丁产物 73/73 符合 · 被替换的上游文件已删 12/12」→「树里有本 mod 的内容 → 视为旧版安装 / 手工覆盖」 |
| `install --dry-run` | 「先用 git 从基线提交 <sha> 还原 85 个文件，再装」；改动前后 `git status --porcelain` 都是 111 项 → **零改动** |
| `install` | 「回退：git 85 · 备份 0 · 另存 73 个文件 → `.mod-dong-ursus/backup-legacy-<时间>/`」→ 两个补丁**都套用成功**（回退成功的铁证）；之后停在复刻树缺 `tools/` 的 build-data（测试树缺件，与逻辑无关） |
| 快路径 | 手工写入同版本、无漂移的 `state.json` → `install` 输出「已安装 v1.0.1，与安装时一致：无需重装」 |

本轮只动前置判定，没有重跑完整安装/卸载回归；v1.0.0 那轮的全套矩阵（纯净树往返 install→verify 274/274→uninstall、git 精确卸载后 `git status` 为空、update 的 --check/跨 base/真更新）仍然有效。

---

## 2026-10-16 · 命令行工具（install / update / uninstall / status）· GPL-3.0-or-later 许可与改动说明

### 新增

| 文件 | 作用 |
|---|---|
| `mod.json` | 包清单：`version`（mod 自己的 semver）· `base`（适配的本体版本 + 基线提交 + **85 个装前文件指纹**）· `patched`（73 个补丁产物指纹）· `owned`（29 个自有文件）· `removed`（12 个删除项）· `generated`（22 个生成物）· `source`（发布仓库 + 分支前缀）|
| `tools/make-manifest.mjs` | 生成/刷新 `mod.json`。指纹**取自基线提交的 git 对象**，不取工作区；`patched` 是「纯净副本 + 套两个补丁」后实测出来的字节 |
| `scripts/mod.mjs` | 命令行入口，四个子命令：`install` / `update` / `uninstall` / `status` |
| `scripts/lib/{util,manifest,state,gitops,source,zip}.mjs` | 工具 / 清单校验 / 安装状态与备份 / git 安全封装 / 拉包 / zip 读取 |
| `LICENSE` · `NOTICE` | GPL-3.0-or-later 原文（取自 SPDX license-list-data 的 GPL-3.0-or-later.txt）与依 §5(a) 的改动说明 |
| `patch 01` 里的 `.gitignore` | 给本体 `.gitignore` 加一行 `.mod-dong-ursus/`（安装记录与备份不进 `git status`、不被 `git clean -fd` 删） |

`scripts/install.mjs` 改为兼容入口（= `mod.mjs install`）。

### 为什么

- **升级**：本体版本不变时把「最新版 mod」同步进本体，此前只有「重跑 install.mjs」，而它只对**纯净基线**或**同一个 mod 版本**成立。
- **卸载**：此前没有卸载路径，只能手工 `git` 还原或重新解包本体。
- `update` 用「每个本体版本一个发布分支 `base-<本体版本>`」（方案 B）：分支由本地本体版本决定，包内 `mod.json.base` 再自我声明一次，两个条件都满足才装，避免跨版本混装。

### 关键实现决定（都有实测依据）

1. **install 只在纯净基线上装**：`mod.json.base.files` 逐字节校验 85 个文件；树上有旧版安装记录时先精确还原。实测「新版补丁直接覆盖旧版树」→ 正向/反向 `--check` 皆失败 → `--reject` 落 **71 个 `.rej`**、只有 1 个文件被改动。
2. **不信 git 的退出码**：套完补丁按 `patched`+`owned`（102 个文件）复核。实测 `git apply` 在仓库子目录里会静默跳过并返回 0。
3. **卸载优先 git、备份兜底**：`git checkout <基线提交> -- <文件>`（显式提交，绕开「索引里暂存过 mod」的坑；`.gitignore` 那一行已让状态目录不进索引），git 不可用/提交不可达时用 `.mod-dong-ursus/backup/`；**这台电脑改过的文件默认保留并报告**。
4. **补丁相关 git 命令钉死 `core.autocrlf=false` + `core.eol=lf`**：否则 git 会用机器上的全局 autocrlf 把新增行写成 CRLF。实测后果：在非 git 检出的树上装完，**73 个补丁产物全是 CRLF**，与本体适配树（LF）逐字节不一致——指纹也因此全错，`status` 会把参考树判成"与基线不符"。修正后才 72/73 对上（剩的 1 个是旧安装尚未应用的 `.gitignore`）。
5. **校验对 CRLF/LF 差异宽容**：Windows 上 `git archive` / `autocrlf=true` 的签出会让 `.gitignore` 这类文件变 CRLF，逐字节比对会误判——`verifySet` / `driftCheck` 把"只有换行符不同"单独归类，不算不一致。
6. **git 调用一律带 `GIT_CEILING_DIRECTORIES`**：本体树若恰好是别的 git 仓库的子目录，不挡的话补丁路径会按外层仓库根解析并被静默跳过。

### 怎么验的

- 纯净树往返：`git archive <基线提交>` 解到临时目录 → `install` → `verify` → `uninstall` → 与基线逐文件比对（0 差异）→ 再 `install` 的产物与参考适配树逐字节一致（102 个文件里 101 个相同，唯一差异是 `.gitignore`——旧安装还没拿到这条新补丁）。
- 版本守卫：把本体 `package.json` 的版本改成别的值 → `install` 拒绝且**树零改动**。
- 漂移保护：手工改一个被安装的文件 → `uninstall` 报告并保留该文件；`--force` 才还原。
- git 还原路径：本体 git worktree（基线提交）→ `install` → `uninstall` → `git status --porcelain` 为空。
- `update`：用 `--file <本地改版目录>` 走完「对比包 → 调新包 install → 同步本地包目录」，并验证 `--check` 不动手、跨 base 版本拒绝。

---

## 2026-10-16 · 鸿雪 986 付与对象改「身前」；麒麟R夜刀 992 三处数值上调（再部署 -75%、屏障 2×、狂龙症 +50% 攻击）

### 1. 鸿雪（`garrison_986_a/b`）—— 付与对象：身后 → 身前

| 项 | 改前 | 改后 |
|---|---|---|
| 文案（`files/tools/custom-content.mjs`） | `<休整期结束时>自身和身后干员的所属盟约层数+4/8` | `<休整期结束时>自身和**身前**干员的所属盟约层数+4/8` |
| `bbStr.dir` | `behind` | `front` |
| 实装（`patches/01` → `server/sim/content/garrisons/meta.js`） | `positionLayers()` 用 `behindPiece(ctx, me)` | 用 `frontPiece(ctx, me)` |

触发时机（`SERVER_PREP_FIN` = 休整期结束时）、层数（+4 / +8）与 `requireActive:false`（未激活也加）口径均不变。

### 2. 麒麟R夜刀（`garrison_992_a/b`）—— 三处数值上调

| 项 | 改前 | 改后 |
|---|---|---|
| 再部署时间 | -50%（`s.redeployMul` 0.5） | **-75%**（**0.25**） |
| 【狂龙症】部署屏障 | 等量于损失生命（1×） | **损失生命值的 2 倍** |
| 【狂龙症】攻击力 | 无 | **+50%** |
| 【东】【突袭】【不屈】每叠 3 层攻击力 | +1% / +2% | 不变 |
| 【狂龙症】每秒流失 | 100 点 | 不变 |

改动点：`files/server/sim/content/kits/ops/chess_char_6_97-yato2.js`（`mods.redeployMul` 0.5 → 0.25、屏障 `loss` → `loss*2`、ONI buff 增 `mods.atkPct: 0.5`）+ `files/tools/custom-content.mjs` 的文案源。

### 3. 四语言 overlay（`i18n/mod-i18n.json`）

986_a/986_b/992_a/992_b 共 **16 条**（4 语言 × 4 条）的 `desc`/`descRaw` 随机制改写；`_h` 按重建后的 `data/garrisons.json` zh 文本重算（不改文案的 `eventTypeDesc` 与其余字节）：

| 记录 | 旧 `_h` | 新 `_h` |
|---|---|---|
| `garrison_986_a` | `e5e5mz` | `dudumz` |
| `garrison_986_b` | `2h2hmz` | `5q5qmz` |
| `garrison_992_a` | `f5f53p` | `dodo3p` |
| `garrison_992_b` | `bmbm3p` | `ydyd3p` |

`ja` / `ko` / `zh-TW` 的 986 两条本来就是中文（未翻译），本次只随机制改「身后→身前」，未代写译文。

### 4. 测试

| 项 | 结果 |
|---|---|
| `test/content/garrisons_meta.test.js` 986 用例 | 付与目标改到身前那格（`[10,5]`），并补一条「身后那格不再被加层」的反向断言 |
| `files/test/content/kits_char_6_97.test.js` | 新增「再部署 -75% / 屏障 = 损失 2 倍 / 狂龙症 attack +50%」数值用例 |
| 同文件旧用例「重生再部署后 cast 仍 active」 | 原断言按 **-50%** 的再部署时间标定（写在 `t=11`）：-75% 后单位 t≈5.5 s 就重部署、cast 于 t≈9.9 s 结束 → 改为「逐步推进到刚重部署那一刻」再断言（机制未回归，仅标定失效） |
| `node --test`（garrisons_meta / kits_char_6_97 / kits_char_4_99 / i18n-data） | 全部通过（i18n `stale=0`） |
| `scripts/verify.mjs`（20 个测试文件） | **274 / 274**（2026-10-16） |

### 验证（纯净基线 `16a0f9b` 的独立工作树）

| 检查 | 结果 |
|---|---|
| `git apply --check` 两个补丁 | 均 **exit 0** |
| 应用后与参考树逐字节对比 | **72 / 72 个目标文件 hash 完全一致** |
| 应用后是否产生 `*.rej` | **0** |
| 补丁目标数 | 01 = 22 文件、02 = 50 文件（未变） |

---

## 2026-10-15（第四条）· 【乌萨斯】每层系数 0.06% / 0.9% ＋ 补齐两个打包缺陷（补丁缺 `spine.js`、测试文件重复声明）

### 1. 【乌萨斯】3 人盟约公式改系数（只动系数，其他机制不动）

| 项 | 改前 | 改后 |
|---|---|---|
| 每次开技能给其他【乌萨斯】干员的攻击力 | +3.6% + **1%** × 层数 | +3.6% + **0.06%** × 层数 |
| 累计上限 | 54% + **1%** × 层数 | 54% + **0.9%** × 层数 |

改动点（生效值是 `tools/custom-content.mjs` 的 `bb`；`bonds/core.js` 读它，兜底默认只是防御）：

| 文件 | 改动 |
|---|---|
| `files/tools/custom-content.mjs` | `atk_per_start_per_layer` 0.01 → **0.0006**、`atk_cap_per_layer` 0.01 → **0.009**（`atk_per_start` 0.036 / `atk_cap_base` 0.54 不变） |
| `patches/01` → `server/sim/content/bonds/core.js` | 兜底默认 0.009 → 0.0006，注释同步为 `atk_per_start + 0.06%·L` / 上限 `+ 0.9%·L` |
| `files/test/content/ursus_bond.test.js` | 期望值随之改（0.01 → 0.0006 / 0.009） |
| `README.md` | 速查表的公式同步为 `+3.6%+0.06%/层（上限 54%+0.9%×层数）` |

局内 `effectDesc` 的数字是运行时按 `bb` + `descParamBaseList/descParamPerStackList` 实算的，**文案本身不改**。

### 2. 打包缺陷 A：`patches/01` 少了半个修复（从未修改 `spine.js`）

- **症状**：装完 mod 后 5 个 mod 测试挂在 `skillClipHeld is not a function`，且麒麟R夜刀的攻击序列卡在第 1 格。
- **原因**：`public/js/render/units.js` 的重派逻辑调用 `actor.skillClipHeld()`，而 `skillClipHeld()` / `_seqClip()` /
  `SEQUENCE_GAP` 全在 `public/js/render/spine.js`。旧补丁 01 只有 21 个目标，**从来没有这一段**
  （`tools/assets/spine.mjs` 是生成清单的另一个文件，不是它）。
- **修法**：以参考树重生成补丁 01，把 `public/js/render/spine.js` 加为目标（21 → **22** 个文件，+47 行）。

### 3. 打包缺陷 B：`patches/02` 里 `diy-bonds.test.js` 重复声明 `HSGMA2`

- **症状**：`test/match/diy-bonds.test.js` 整体 `SyntaxError: Identifier 'HSGMA2' has already been declared`，文件无法加载。
- **修法**：删掉重复那行，保留与数据一致的 `// 斩业星熊: 炎 + 东`；同一次重生成还清掉了混进补丁的
  **13 个 `*.rej` 新文件**（旧补丁会在安装时往本体树里写出 `test/**/*.test.js.rej` 垃圾）：63 → **50** 个文件。

### 验证（纯净基线 `16a0f9b` 的独立工作树）

| 检查 | 结果 |
|---|---|
| `git apply --check` 两个补丁 | 均 **exit 0** |
| 应用后与参考树逐字节对比 | **72 / 72 个目标文件 hash 完全一致**（含 `spine.js`） |
| 应用后是否产生 `*.rej` / `*.orig` | **0** |
| `node --check test/match/diy-bonds.test.js` | **exit 0**（SyntaxError 消失） |
| `node tools/build-data.mjs` | 15 files；`data/bonds.json` 的 `ursusShip.bb` = `0.036 / 0.0006 / 0.54 / 0.009` |

按业主要求，本次**未跑测试**（上表只做打包与语法级校验）。开发者那棵参考树里 `diy-bonds.test.js` 的重复声明
也一并修掉了（补丁本来就由它生成）。

---

## 2026-10-15（第三条）· 补上【东】盟约图标 `dongShip.png`

### 问题

清单 `data/assets.json` 里 `bonds.dongShip = "/assets/bond/dongShip.png"`（`ursusShip` 同理），
但 **0.2.6 本体素材集里没有这张图**：`public/assets/bond/` 只有 23 张官方盟约图标，而
`data/bonds.json` 里的 `dongShip` / `ursusShip` 是 mod 造的核心盟约（官方 23 条里都没有）。
后果：东国盟约图标 404 / 占位，并且让本体 `test/assets.test.js:697`「every manifest path exists on disk」常挂。

### 改动

| 位置 | 改动 |
|---|---|
| 本体 `public/assets/bond/dongShip.png`（新增） | 由本体自带的东国阵营 LOGO `public/assets/ui/campLogo/logo_higashi.png` 复制而来：sha256 `021C9163F998…`、32409 B |
| `files/public/assets/bond/dongShip.png`（新增，包内第 **29** 个自有文件） | 同一份内容随包分发；`install.mjs` 对 `files/` 整目录 walk 覆盖，装完本体就有这张图，不再依赖 `npm run setup` 事后补下 |

**为什么可以用阵营 LOGO**：清单生成端 `tools/assets/plan.mjs:550` 对「没有官方盟约图标的 bond」走
`fallbackCampLogo` 分支——乌萨斯的 `ursusShip.png` 本来就是这么来的（上游 `arts/camplogo/logo_ursus.png`，
与本体 `public/assets/ui/campLogo/logo_ursus.png` 字节一致）。东国同理。

### 验证

| 检查 | 结果 |
|---|---|
| 清单引用 ↔ 落盘（判据同 `assets.test.js:700`：存在且 size > 0） | 本体树 11258 个 URL **缺失 0**（改前缺失 1：`/assets/bond/dongShip.png`） |
| 三份文件一致性 | 本体 `bond/dongShip.png` = 包内 `files/public/assets/bond/dongShip.png` = 本体 `ui/campLogo/logo_higashi.png`，sha256 均 `021C9163F998920D5879CF36A1A7F1E6B95C625E45B7EFFCD9843A976F39EBE1` |
| 包内 `files/` 文件数 | 28 → **29**（`SKILL.md` 两处计数已同步） |

**不需要改** `files/data/assets.json`：URL 早已指向该路径，重建 data 不会改变它。

---

## 2026-10-15（第二条）· 修「技能结束后普通攻击播技能 clip」+ 按槽位的普攻口径

业主报障：德克萨斯放完剑雨后、耀骑士临光技能结束后，**普通攻击变成了技能 clip**。
排查结论与实施方案见 `PLAN-attack-anim-after-skill.md`（本次已实施）。

### 根因（是 mod 自己引入的闩锁）

| 环节 | 事实 |
|---|---|
| `units.js`（patch 01 于 2026-10-14 新增的 8 行） | 为修麒麟R夜刀重部署姿态，只补 `setSkill(true)`（条件：`UF.SKILL` 标志位 **或** `anim === ANIM.SKILL`），**从不补 OFF** |
| `snapshot.js animOf:99` / `skills.js:571` | 一次施放后 `ANIM.SKILL` 还会持续 0.5 s（`SKILL_ANIM_WINDOW`），与技能是否还开着无关 |
| 结果 | 瞬发技能（剑雨）的 off 事件过后，那 0.5 s 把 `skillOn` 重新拉成 true；窗口一过 `anim` 回到 `ATTACK`，而 `UF.SKILL` 从未有过边沿 → `setSkill(false)` 再也不被调用 → **闩住** |
| 后果 | `spine.js:617 _attackClip()` 返回技能 clip（普攻变技能动画）、`spine.js:476 _idleName()` 返回技能 idle（静止站姿错） |

### 改动

| 文件 | 改动 |
|---|---|
| `patches/01` → `public/js/render/units.js` | 重派逻辑变成：**ON** 只在 actor 还没在播自己的 one-shot 技能片时生效（`actor.skillClipHeld()`）；**OFF** 需要 sim 动画窗口连续关闭 `SKILL_STANCE_GRACE = 0.4 s` 且 actor 的片播完（避免姿态被普攻的 anim 抖动误关，也避免永久闩住） |
| `patches/01` → `public/js/render/spine.js` | 新增只读判据 `skillClipHeld()`（`skillClipOnce` 窗口 / `skillEndPending` / `mode === 'skillEnd'`） |
| `patches/01` → `tools/assets/spine.mjs` | 新增 **`SKILL_ROLE_PATCHES`**（按槽位、逐字段的角色补丁，`applyRoleFix` 之后套用，`processModels` 调用） |
| `files/data/assets.json` | 三条补丁落到清单：临光 S2（骨架只有倒地片 `Skill_2_Die`）→ `Attack_Loop` + `via:'attack'`；缄默德克萨斯 S3、弑君者 S2 → `via:'attack'`（姿态/起手/收尾保留，普攻回落到干员自己的攻击 clip） |
| `files/test/render/attack-clip-after-skill.test.js`（新增） | 6 项：剑雨（瞬发）窗口后普攻回 `Attack_Loop`；临光 S3（`UF.SKILL` 承载）期间 `Skill_3`、结束后 `Attack_Loop`；止颂 S2 期间 `Skill_2_Loop`、标志位一清回 `Attack`；夜刀这类无标志位姿态「anim 抖动不误关、窗口结束才释放」；弑君者 S2/缄默德克萨斯 S3 姿态保留但普攻用普通 clip；临光 S2 用普通攻击 |
| `files/test/render/anim-role-fixes.test.js` | 补一条钉住这三条按槽位补丁 |
| `scripts/verify.mjs` | 挂上新测试；`scripts/check-anim-roles.mjs` 对账时也套 `SKILL_ROLE_PATCHES` |

### 验证证据（2026-10-15 实测）

| 检查 | 结果 |
|---|---|
| `node scripts/repro-skill-latch.mjs <repo>` | **异常 0 / 9**（修前 7 / 9，`skillOn` 9/9 闩住） |
| `node scripts/check-anim-roles.mjs <repo>` | **695/695**（清单 == resolver + 按模型修正 + 按槽位补丁） |
| `node scripts/verify.mjs <repo>` | **271/271** |
| 相关宿主测试（feedback4 / feedback3-skill-idle / loadout-skill / feedback2-doll / assets / assets-diy / unitview / feedback3-move-deploy） | **133/134**，唯一失败是既有的 `/assets/bond/dongShip.png` 不在树上（与本次改动无关） |
| patch 01 重生成 | 60486 → **65529 B**，与旧补丁对比只差 `units.js` 与 `tools/assets/spine.mjs` 两块；纯净 `16a0f9b` 上两个补丁 `git apply --check` 均 `exit 0` |
| 清单内部 hash | `bb2264a58c21` → `ee27539cf8ab` → **`c5c667cd4825`** |

### 业主口径里的第三项：麒麟R夜刀的攻击序列（本轮已实施）

| 位置 | 改动 |
|---|---|
| `patches/01` → `public/js/render/spine.js` | 新增攻击序列：角色上的 `seq` 数组（`attack.seq` / `skills[i].seq`）表示"每次攻击取下一格、循环"；`_seqClip()` 取本次该播的片，`windUp()` 成功时提交一格并由随后的 `attack()` 复用（一次攻击只推进一格），`_applyRoles()` / `setSkill()` 复位到第一格；**断敌复位**：距上次攻击超过 `SEQUENCE_GAP = 1.4 ×` 攻击间隔（= 回到 idle 的那段空档）则从头开始 |
| `patches/01` → `tools/assets/spine.mjs` | `SKILL_ROLE_PATCHES` 的键扩展为"技能槽 index 或 `attack`"；新增 `char_1029_yato2: { attack: {seq:['Attack1','Attack2','Attack3']}, 0: {seq:['Skill_Attack1'..'Skill_Attack4']} }` |
| `files/data/assets.json` | yato2 front/back 的 `attack` 与 `skills['0']` 带上 `seq`（清单内部 hash → **`107b645c168b`**） |
| `files/test/render/attack-clip-after-skill.test.js` | 新增 2 项：`Attack1→2→3→1` 连续循环 + 断敌后回到 `Attack1`；S1 期间 `Skill_Attack1→…→4→1` |

**傀影：不改**（骨架里没有 `Attack2`，业主已确认不需要改）。

> 0.2.4 包仍是旧行为（同一个闩锁在 `patches/01-mod-shared.patch:63`）；是否回填待定。

---

## 2026-10-15 · 发射 clip 放行名单扩到 6 个宿主干员；嵯峨修正落地；新增钉子测试

### 起因（业主实测）

上一版把「裸 `Start_N` / `Skill_N_End` 起手补全」收窄成 `LAUNCH_CLIP_MODELS` 白名单（只有麒麟R夜刀），
理由是 2026-10-14 认为这条规则会"给干员凭空发明一个起手 clip"。业主复核后确认**相反**：
把这 6 位保持 `begin: null`，技能起手依然不播；补上之后是
`Start → 技能 clip → 编号 End`，且技能结束后普攻仍是普通普攻、不会引用 Start/End。
所以 2026-10-14 的结论被推翻，名单扩到这 6 位。

### 改动

| 文件 | 改动 | 为什么 |
|---|---|---|
| `patches/01-mod-shared.patch` → `tools/assets/anim-roles.mjs` | `LAUNCH_CLIP_MODELS` 从 1 个 → **7 个**（`char_1029_yato2` ＋ `char_1023_ghost2` / `char_1028_texas2` / `char_1039_thorn2` / `char_1502_crosly` / `char_2027_wang` / `char_4011_lessng`），并 `export` 出去供测试比对 | 这 6 位的骨架把某几招的起手 clip 命名为裸 `Start_N`（家族解析器只找 `Skill_N_Begin`/`Skill_N_Start`） |
| 同上 · `resolveSkill` | **攻击回退分支也补起手**：技能没有自己的 clip、退化成普攻 clip 的槽位（傀影 S2 / 望 S2），也把裸 `Start_N` 作为 `begin` | 起手补全原先只写在"技能家族"分支里，这两位拿不到 |
| `patches/01-mod-shared.patch` → `tools/assets/spine.mjs` | `PREFAB_SPINE_ROLES.char_362_saga` 补上 **index 0** 槽位（`SAGA_S1`） | 本体 `test/assets.test.js` 要求"多技能棋子的每个技能槽都有 clip"；该表是**整键替换**，漏写 index 0 会让 `skills['0']` 消失 |
| `files/data/assets.json` | 22 处 `skills[i].begin` 补全（6 位 × front/back）；嵯峨 front/back 的 `skills` 换成修正后的形状（S2 普通挥砍、S3 `Skill_2` 起手/持续/收尾，index 0 保留） | 运行时读的是**数据**，代码只在生成清单时生效（见 `SKILL.md` 维护第 6 条） |
| `files/test/render/anim-role-fixes.test.js`（新增） | 3 项钉子：① 放行名单 ↔ 清单一致；② 名单上每个起手槽有 `Start_N`、有编号 End 时用自己编号的 End、普攻不被起手/收尾污染；③ 嵯峨 S2/S3 形状 | 上一次"代码修了、数据没跟上"（嵯峨）没有任何测试盯着 |
| `scripts/check-anim-roles.mjs`（新增） | 逐模型对账：用清单自身的 `animations` 跑 `resolveRoles` + `applyRoleFix` 与 `anims` 比对 | 换基线合并清单后，必须证明"清单 == 代码产物" |
| `scripts/verify.mjs` | 子集挂上 `test/render/anim-role-fixes.test.js` | 让上面两项每次安装都被检查 |
| `SKILL.md` / `README.md` / `../MIGRATION-0.2.4-to-0.2.6.md` | 计数（`files/` 26→27、mod 测试 11→12）、包结构、维护第 6 条、迁移文档 §6.1/§8 ⑥ | 文档与包同步 |

### 数据层面的数字

- `data/assets.json` 内部 `hash`：`a7ba8890e431` → `bb2264a58c21`（`contentHash(body)`，body = 去掉 version/hash/generator/stats）
- 文件 SHA256：`151DF5D7F234A42D908224B57F77BC293013BF81DDFD5F4FBB5438116AAB5A12`（单行 minified + **末尾 LF**，本包与本体树逐字节相同）
- `patches/01-mod-shared.patch`：58389 B → **60486 B**（21 个文件；与旧补丁对比**只有** `anim-roles.mjs` / `spine.mjs` 两块不同，其余字节级复现）

### 验证证据（2026-10-15 实测）

| 检查 | 结果 |
|---|---|
| 逐模型对账 `node scripts/check-anim-roles.mjs <repo>` | **695/695 一致**（改前 6 处不一致，含嵯峨） |
| mod 验收子集 `node scripts/verify.mjs <repo>` | **264/264**（原 261 ＋ 新测试 3） |
| 两个补丁在纯净 `16a0f9b` worktree `git apply --check` | 均 `exit 0` |
| 相关宿主测试（`assets` / `assets-diy` / `feedback4-texas` / `feedback5-utage` / `feedback2-doll` / 多数 render） | 只挂 `assets.test.js`「every manifest path exists on disk」= `/assets/bond/dongShip.png` 不在树上——**与本次改动无关**（改动前后清单 URL 集合均为 11265 个、零差异；0.2.4 那棵树里有这张图）。该缺口已于同日「第三条」随包补上。 |

### 未做 / 待定

1. **0.2.4 包未回填**：根目录那份仍是旧行为（同样 6 位、同样不播起手）。回填 = 同样的 22 处 `begin` ＋ 补丁里同一块 hunk。
2. ~~**`dongShip.png`（【东】盟约图标）**：v0.2.6 的素材集里没有；真实安装靠 `npm run setup` 去镜像补下这个清单里列的文件。~~
   → **已随包解决**（见本文件开头的「2026-10-15（第三条）」）：图标作为 `files/public/assets/bond/dongShip.png` 由 `install.mjs`
   覆盖进本体，不再依赖 `npm run setup` 补下。
3. **新发现的问题**：技能结束后 `skillOn` 被闩住 → 普攻播技能 clip（德克萨斯 / 耀骑士临光等 7 位）。
   分析与修复方案见 `PLAN-attack-anim-after-skill.md`（**尚未改源码**，等业主核验）。
