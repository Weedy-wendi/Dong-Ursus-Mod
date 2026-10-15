<div align="center">

# 【东】＋【乌萨斯】

**给《卫戍协议：盟约》复刻版（Stronghold-Protocol）的本体，加两个真正能进对局结算的核心盟约阵营。**

<sub>2 条核心盟约 · 13 名预设干员 · 26 条特质 · 4 件装备 · 五语言文案 · 一条命令安装 / 升级 / 卸载</sub>

![baseline](https://img.shields.io/badge/baseline-Stronghold--Protocol%20v0.2.6%20source%20checkout-2f6feb?style=flat-square)
![mod](https://img.shields.io/badge/mod-v1.0.5-8957e5?style=flat-square)
![node](https://img.shields.io/badge/node-%3E%3D22-339933?style=flat-square)
![cli](https://img.shields.io/badge/cli-install%20%C2%B7%20update%20%C2%B7%20uninstall%20%C2%B7%20status-16a34a?style=flat-square)
![i18n](https://img.shields.io/badge/i18n-zh%20%C2%B7%20zh--TW%20%C2%B7%20en%20%C2%B7%20ja%20%C2%B7%20ko-0ea5e9?style=flat-square)
![verify](https://img.shields.io/badge/verify-274%20tests-8b5cf6?style=flat-square)
![license](https://img.shields.io/badge/license-GPL--3.0--or--later-blue?style=flat-square)

</div>

---

## 快速开始（Quick Start）

**前提**：本体是 **v0.2.6 的源码检出**（`git clone` 或源码包，**不是** Release 里的 `*-lite.zip`）、装了 `git`、Node.js **≥ 22**。

```bash
cd <本体源码检出根>                            # 必须是源码检出，不是 Release 里的 *-lite.zip

node <mod 包>/scripts/mod.mjs status    .   # ① 检查状态（只读）
node <mod 包>/scripts/mod.mjs install   .   # ② 一键安装
node <mod 包>/scripts/mod.mjs update    .   # ③ 更新到最新包（没有新版就什么都不做）
node <mod 包>/scripts/mod.mjs uninstall .   # ④ 卸载（默认彻底删掉本 mod 的东西）
node <mod 包>/scripts/verify.mjs        .   # ⑤ 验收：274 个用例应全绿
```

装完直接开局：牌池会多出 13 名预设棋子，【东】/【乌萨斯】按 3 / 6 人档激活，图标、文案、特质、装备全部就位。

> **本体不必是纯净的**：装过旧版 mod、或你手改过相关文件，`install` 都会自己处理 —— 有安装记录就先精确还原；没有记录（旧版安装 / 手工覆盖 / 半装）就**反向套补丁**把本 mod 的改动摘掉（同一个文件里别的 mod 或你自己的改动原样留下，被覆盖的当前字节先另存到 `.mod-dong-ursus/backup-legacy-<时间>/`）再装。剩下的差异若与本 mod 无关，会**先让 git 试套一遍**：能干净套上就继续，套不上才拒绝并指出哪个补丁套不上。

### 四条命令（= 上面的 ①~④）

| 命令 | 做什么 | 会不会动本体 |
|---|---|---|
| `mod.mjs status` | **本体版本对不对** + **树里有没有本 mod 的内容**（自有文件 N/29 · 补丁产物 N/73 · 被替换的上游文件 N/12）+ 安装记录与漂移 + 一句话结论（`--json` 可机读） | 只读 |
| `mod.mjs install` | 覆盖 29 个自有文件 → 套两个补丁 → 删 12 个被替换的上游文件（6 个旧 kit + 6 个旧测试）→ `build-data` → i18n 四连；装完按 102 个字节指纹复核 | 会（`--dry-run` 只体检） |
| `mod.mjs update` | 取 `base-<本体版本>` 分支的最新包，**分别**对比「本体里装的 mod」与「本地包」：该装本体就装、该刷新包就刷新（`--check` 只报） | 只在需要时动 |
| `mod.mjs uninstall` | 默认**彻底删除本 mod 的东西**：mod 自有文件一律删、补丁改动反向摘除、生成物重跑 `build-data` 重建；别人的改动保留并列出（`--keep-changed` 更保守、`--force` 更彻底） | 会 |

退出码：`0` 成功 · `2` 版本或基线不符 · `3` 用法或环境问题 · `4` 拉取失败 · `5` 补丁或复核失败。

### 三个常见情况

```bash
# 提示「这 85 个文件里有内容与基线不符，而且看不出是本 mod 造成的」
#   = 你手改过 / 装了别的 mod / 本体版本不对：先看它列出的文件，确认与本 mod 无关再决定
git stash push -u -m "快照"              # 可回退；然后重跑 install

# update 分成两侧判定：本体里装的 mod（看 .mod-dong-ursus/state.json）与本地包（看它自己的 mod.json）
#   包已最新但本体里是旧版 → 只装本体；本体已最新但包旧 → 只刷新包；都最新 → 什么都不做
node <mod 包>/scripts/mod.mjs update . --check     # 先看它打算做什么

# GitHub 连不上：update 会自动依次尝试 source.repo → source.mirrors（mod.json 里的默认镜像）
#   → 自动派生的 gitclone 形式；镜像可写完整 URL，也可只写前缀（如 https://ghproxy.net）
#   临时换镜像/换源（不改包）：
$env:MOD_MIRROR = 'https://ghproxy.net https://gitclone.com/github.com/<owner>/<repo>'
$env:MOD_SOURCE = 'https://github.com/<owner>/<repo>'

# 卸载（默认彻底：mod 自有文件一律删、别的改动保留并列出）
node <mod 包>/scripts/mod.mjs uninstall .              # 想连"看不出是谁的改动"一起回退：加 --force
node <mod 包>/scripts/mod.mjs uninstall . --keep-changed   # 保守：被你改过的 mod 文件也留下

# 完全离线：用本地包升级
node <mod 包>/scripts/mod.mjs update . --file <新包.zip 或解压后的目录>

# 只想看看会做什么，不改任何文件
node <mod 包>/scripts/mod.mjs install . --dry-run
```

### 它在你的本体里留下什么

- 安装记录与装前备份：`<本体>/.mod-dong-ursus/`（`state.json` + `backup/`，约 20 MB）。补丁 01 会把它加进本体 `.gitignore`，所以它不出现在 `git status` 里，也不会被 `git clean -fd` 删掉。
- 卸载走 git 时能做到「`git status --porcelain` 为空」；非 git 检出（源码 zip）走备份，同样逐字节还原。

---

## 更新日志（Changelog）

本包从 **v1.0.0** 起有自己的版本号（与本体版本解耦）；每条发布对应一个分支 `base-<本体版本>`，`mod.mjs update` 会挑「base 匹配且版本更高」的那条。逐条细节见 [`CHANGES.md`](CHANGES.md)。

### v1.0.5 — 2026-10-16

- **默认卸载 = 彻底删除本 mod 的东西**：mod 自有路径（基线提交里根本没有的文件：13 个 kit、13 个测试、`custom-content.mjs`、`dongShip.png` 等）**一律删除**，不再因为「内容与本包版本不一致」而整文件保留——**更早版本的 mod 文件**、你改过的 mod 文件都属于这一类，正是之前"卸载删不掉"的原因。内容与本包不同的会先另存到 `.mod-dong-ursus/backup-removed-<时间>/` 再删，报告里给出路径。本体原有文件（如 `data/assets.json`）照旧从基线还原。
- **不误伤别的 mod**：只有「确实是本 mod 的内容」（内容等于本 mod 的补丁产物、或属于安装时被删掉的那 12 个文件）才回退；既不是基线、也不是本 mod 产物的文件（更早版本的 mod / 别的 mod / 你自己改的）**保留并列出**，要连它们一起回退到基线才用 `--force`。
- **反向套补丁加保护**：树里已经没有本 mod 的补丁产物时直接跳过，不再对整棵树 `-R --reject` 撒出成片 `.rej`。
- **生成物优先重跑 `build-data`**：`data/*.json` 是「当前源码的函数」，重跑才能保住别的 mod / fork 自己的数据改动（例如 `data/config.json` 里的玩家上限）；工具链不可用或失败时才按基线 `git checkout` 还原。
- 新增 `--keep-changed`：保守模式，连「被你改过的 mod 自有文件」也留下。

### v1.0.4 — 2026-10-16

- **修 `update` 的核心判定**：以前它拿「候选版本」跟**本地包**的版本比，于是「本地包已经是最新、但本体里装的还是旧版」时会直接说「已是最新，无需更新」——本体永远更新不到（实测 bug）。现在**两个对象分开比**：
  · **本体里的 mod** → 看 `<本体>/.mod-dong-ursus/state.json` 记录的版本；没有安装记录时用**候选自己的指纹**判断树里是不是已经是这份内容；有漂移/缺文件 → 重新装一遍来修复；
  · **本地 mod 包目录** → 看它自己 `mod.json` 的版本。
  四种结果各自明确：**只装本体** / **只刷新包** / **两边都做** / **都最新**。`--check` 会先说清「将执行什么」。
- `update` 的输出改为两行结论（本体里的 mod 怎么样 · 本地包怎么样），任一侧失败都会停下来说明怎么查看/还原。

### v1.0.3 — 2026-10-16

- **与其他 mod 共存**：卸载/升级不再只靠「整文件指纹」，而是先**反向套补丁**（`git apply -R`，必要时 `-R --3way`）——只摘掉本 mod 改过的那几段，同一个文件里别的 mod 或你自己的改动**原样留下**。实测：在「别的 mod 已改过 `meta.js` / `build-data.mjs`」的树上卸载，本 mod 两个补丁全部反解、29 个自有文件处理干净、12 个被替换的上游文件还原，而别的 mod 的标记完好、`git status` 里只剩它自己的 2 个文件。
- **install 也放开了**：这 85 个文件与基线不符时，先让 git 试套一遍 —— 补丁能干净套上就继续（装完仍按 102 个指纹复核），套不上才拒绝并指出哪个补丁套不上（`--force` 可硬装，会落 `.rej`）。
- **status 结论的优先级修正**：树里有本 mod 的文件/数据时不再报「未安装」，而是「检测到本 mod 的内容（自有文件 N/29 · 补丁产物 N/73 · 被替换的上游文件 N/12）」，并区分**完整**与**不完整（半装）**两种情形。
- **残留检查更准**：只把**本 mod 的残留**算失败；与基线不同但属于别的改动的文件只做告知（退出码不受影响）。

### v1.0.2 — 2026-10-16

- **拉取默认走镜像**：`mod.json` 新增 `source.mirrors`，`update` 依次尝试 `source.repo` → `source.mirrors` → 自动派生的 gitclone 形式；镜像可写完整 URL 或**前缀**（`https://ghproxy.net` 会拼成 `<前缀>/<源地址>`）。运行时用 `MOD_MIRROR` / `MOD_SOURCE` 临时覆盖，`--source` 依然优先。失败时会列出**远端实际有哪些分支**。
- **卸载不再需要安装记录**：没有 `.mod-dong-ursus/state.json` 时，`uninstall` 直接按 `mod.json` 重建「本 mod 加了什么」并全部撤掉 —— 85 个装前文件回退到基线（git 优先、备份兜底）、22 个生成物还原、28 个 mod 新增文件删除、`data/assets.json` 这类本体原有文件还原、`.mod-dong-ursus/` 清理；收尾做**残留检查**（本 mod 指纹应为空、`git status` 应为空）。
- **本机改动默认保留**：只回退「确实是本 mod 造成的差异」（内容等于本 mod 的产物、或属于安装时被删掉的那 12 个文件）；其余差异视为你自己的改动，保留并报告，`--force` 才强制覆盖。**卸载后不需要再手工删任何东西。**
- 修掉两处会让无记录卸载在最后一步崩掉的字段名错误。

### v1.0.1 — 2026-10-16

- **不再要求「纯净本体」**：`status` 改成只回答两件事 —— 本体版本对不对、树里有没有本 mod 的内容；结论分四态：版本不符 / 已安装（含漂移）/ 树里有 mod 内容但无安装记录 / 与本 mod 无关的改动。
- **旧版安装自动回退**：树上有本 mod 内容但没有安装记录时（旧 `install.mjs` 装的、或手工覆盖过），`install` 会自动把这 85 个文件回退到基线再装 —— 不用再手工 `git stash`。回退优先用 git（连安装时被删掉的 12 个上游文件一起还原），git 不可用则用上一次安装留下的备份；当前字节会先另存到 `.mod-dong-ursus/backup-legacy-<时间>/`，不会悄悄丢东西。
- **同版本重装变快**：已装同版本且与安装时一致时，`install` 直接说「无需重装」（要强制重装加 `--force`）。
- `--dry-run` 会在动手前说清「会回退哪些文件、走 git 还是备份」，且**零改动**。

### v1.0.0 — 2026-10-16

- **命令行工具**：`scripts/mod.mjs` 提供 `install` / `update` / `uninstall` / `status`；`scripts/install.mjs` 保留为兼容入口。
- **包清单 `mod.json`**：登记 mod 版本、适配本体（`v0.2.6` + 基线提交 `16a0f9b`）与逐文件指纹（装前 85 / 补丁产物 73 / 自有文件 29 / 删除 12 / 生成物 22），由 `tools/make-manifest.mjs` 生成。
- **精确卸载**：安装时记录每个被触碰文件的装前/装后字节（`state.json` + `backup/`），卸载优先 `git checkout`，备份兜底；本机改过的文件默认保留并报告，可 `--force` 重试。
- **只在纯净基线上安装**：装前逐字节校验 85 个基线文件；树上已有旧版安装记录时先精确还原。实测「把新版补丁直接覆盖到旧版树上」会落 **71 个 `.rej`** 而只真正改到 1 个文件。
- **不信 git 的退出码**：套完补丁按 102 个产物指纹复核（`git apply` 在仓库子目录里会静默跳过并返回 0）。
- **换行符钉死**：补丁相关的 git 命令一律 `core.autocrlf=false` + `core.eol=lf`，避免机器上的全局 autocrlf 把新增行写成 CRLF；校验对「仅换行符不同」宽容。
- **许可**：补上 `LICENSE`（GPL-3.0-or-later 原文）与 `NOTICE`（依 §5(a) 的改动说明）；patch 01 新增一行本体 `.gitignore`。

### v1.0.0 之前（本包首次版本化之前的改动，按日期倒序）

| 日期 | 改了什么 |
|---|---|
| 2026-10-16 | 鸿雪 `986` 付与对象「身后」→「**身前**」；麒麟R夜刀 `992` 三处数值上调（再部署 −75%、部署时失 50% 当前生命并获得 **2× 损失量**的屏障、【狂龙症】+50% 攻击） |
| 2026-10-15（四） | 【乌萨斯】每层系数改为 `+3.6%+0.06%·L`、上限 `54%+0.9%·L`；补齐两个打包缺陷（补丁缺 `spine.js`、测试文件重复声明常量） |
| 2026-10-15（三） | 补上【东】盟约图标 `dongShip.png`（本体素材集缺这一张） |
| 2026-10-15（二） | 修「技能结束后普通攻击播技能 clip」＋按技能槽位的普攻口径，新增钉子测试 |
| 2026-10-15 | 发射 clip 放行名单收窄为 6 个宿主干员；嵯峨 `S2/S3` 清单侧修正落地 |

---

## 这是什么

这不是一份文案补丁，而是**两条从零实装的核心盟约**外加一整套自制内容，全部经本体的数据管线注入：

| 内容 | 规模 | 落地位置 |
|---|---|---|
| 【东】`dongShip`、【乌萨斯】`ursusShip` | 2 条核心盟约（3 / 6 人档，含战斗实现） | `patches/01` → `bonds/core.js`；参数在 `files/tools/custom-content.mjs` |
| 预设棋子（干员 kit） | 13 名 | `files/server/sim/content/kits/ops/chess_char_*_9*.js` |
| 特质 | 26 条（`garrison_980_a` ~ `992_b`） | 各 kit + `garrisons/meta.js` |
| 装备 | 4 件（普通 / 进阶，可合成） | `custom-content.mjs` → `items/battle.js` |
| 文案 | 四语言 overlay（zh-TW / en / ja / ko） | `i18n/mod-i18n.json` + 合并脚本 |
| 盟约图标 | 【东】随包分发；【乌萨斯】用本体既有阵营 LOGO | `files/public/assets/bond/dongShip.png` |

你不需要手改本体：`mod.mjs install` 按「**覆盖 mod 自有文件 → 套两个补丁 → 删被替换的上游 kit → `build-data` 重建 data → i18n 四连**」的顺序执行，装完再按指纹复核。

## 装完你会看到的数字（v0.2.6 实测）

| 指标 | 数值 |
|---|---|
| 棋子 | `292`（其中可见非 DIY `125`：16 / 19 / 22 / 24 / 22 / 22） |
| 盟约 | `25`（核心 `10` = 官方 `8` + 【东】【乌萨斯】） |
| 特质 | `275` · 装备 `123` · 效果 `371` · 合奏带 `40` |
| backups | base `146`（PRESET `87`）· 自选 6★ 池 `66` |
| 语音 | JP `199` 人 / `2786` 行 |

数据全部由 `tools/build-data.mjs` 现场生成，包里不存手改的 `data/*.json`。

## 两条盟约

| 盟约 | 激活 | 核心 | 3 人档机制 | 6 人档追加 |
|---|---|---|---|---|
| 【东】`dongShip` | 3 人 | 是 | 干员伤害 ×(1+15%+0.7%×层数)×(1+0.4%×已损失生命比例)；【死战】首次致命以 1 HP 存活 4 秒后视为被击倒撤离（傀儡师改切替身）；开技能时全体掉 10% 当前生命转屏障 | 攻击 +60%、额外掉 15% 转屏障、<50% 生命时攻击 +120% |
| 【乌萨斯】`ursusShip` | 3 人 | 是 | 开技能时其他【乌萨斯】干员攻击 +3.6%+0.06%/层（累计，上限 54%+0.9%×层数）；开启者周围八格自然技回 +40%（不叠加，取最高） | 技回覆盖为 +80%；带 1 件装备攻击 ×1.75、2 件 ×2.5（覆盖制，非连乘） |

- 盟约图标放在**本体**的 `public/assets/bond/<bondId>.png`，URL 由 `data/assets.json` 的 `bonds` 映射给出。
- 官方 23 条盟约里没有这两个，清单生成端 `tools/assets/plan.mjs:550` 的 `fallbackCampLogo` 分支就用**阵营 LOGO** 兜底：【乌萨斯】的 `ursusShip.png` 来自本体已有的 `ui/campLogo/logo_ursus.png`；【东】的 `dongShip.png`（内容 = `logo_higashi.png`）随本包分发，装完即补上。
- 另有官方干员通过 `BOND_OVERRIDES` 补入盟约：折桠（2_17）、古米（1_10）→【乌萨斯】；风丸、水月、星熊、铃兰、遥 →【东】；斩业星熊在【炎】之外再得【东】；斥罪在【叙拉古】之外再得【乌萨斯】。

## 干员 ×13

| 干员 | 档 | 盟约 | 特质 |
|---|---|---|---|
| 伯塔尼 | 2 | 乌萨斯 | 病床巡视 981（每盟约每场上限 8/16 层） |
| 吉星 | 3 | 东 | 鸿运当头 991（自身盟约 +6/12，无需激活） |
| 白雪 | 2 | 东 / 灵巧 | 武库清点 990（已激活层数最高盟约 +3/6） |
| 烈夏 | 3 | 乌萨斯 | 道具获取 987 |
| 缠丸 | 3 | 东 / 不屈 | 恶鬼血战 988（每场首次 <70% 生命 → 各已激活盟约 +12/24） |
| 赫拉格 | 4 | 乌萨斯 | 血怒 982（击杀触发：来源盟约 +2/4，每盟约每场上限 8/16 层） |
| 鸿雪 | 4 | 乌萨斯 | 盟约层数 986（<休整期结束时>自身 + **身前**干员 +4/8） |
| 嵯峨 | 5 | 东 / 坚守 | 同门切磋 989（自身 + 身前干员，每场首次 <70% → 各已激活盟约 +5/10） |
| 乌啾 | 5 | 乌萨斯 | 病床巡视 984（上限 8/16 层） |
| 维伊 | 5 | 乌萨斯 | 奥术共鸣 985（已激活层合计） |
| 麒麟R夜刀 | 6 | 东 / 突袭 / 不屈 | 麒麟之魂 992（三层各按激活计入：每 3 层攻 +1/2%、每秒失 100 血；再部署 −75%、部署时失 50% 当前生命并获得 **2× 损失量**的屏障、【狂龙症】期间攻击力 +50%） |
| 怒潮凛冬 | 6 | 乌萨斯 / 迅捷 / 坚守 | 潮涌共鸣 980 |
| 早露 | 6 | 乌萨斯 / 精准 | 雪崩攻势 983（已激活层合计） |

## 装备 ×4

| 装备 | 阶 / 价 | 普通 → 进阶 |
|---|---|---|
| 东国鬼面（副装备，可映射 →【东】） | T2 / 2 金 | 开技能流失 10% → 20% 当前生命，技能期间攻击 +30% → +45% |
| 残心一闪（签名装备，不可映射） | T6 / 4 金 | 攻击 +40% → +60%；【东】攻击转弱点伤害；与鬼面同带 → 首次 <50% 生命获 50% 上限屏障 |
| 乌萨斯军粮（副装备，可映射 →【乌萨斯】） | T3 / 2 金 | 生命 +25% → +50%；每 5 秒回 4% → 5% 最大生命 |
| 冰原咆哮（签名装备，不可映射） | T6 / 4 金 | 攻击 +45% → +65%；每 1 名其他【乌萨斯】干员攻 +4% → +6%（至多 +20% → +30%）；与军粮同带 → 上限 +30% → +45% |

## 特质 ×26

`980` 潮涌共鸣 · `981`/`984` 病床巡视 · `982` 血怒 · `983` 雪崩攻势 · `985` 奥术共鸣 · `986` 盟约层数 · `987` 道具获取 · `988` 恶鬼血战 · `989` 同门切磋 · `990` 武库清点 · `991` 鸿运当头 · `992` 麒麟之魂（均为 `_a` / `_b` 两档）。

处理器分工：`986`/`987`/`990`/`991` 是 `garrisons/meta.js` 里的自定义 `SERVER_*` 处理器；其余真效果在各干员 kit；护盾 / 流失 / 流血在 `bonds/core.js` 的 `installDong`。

另有一处官方特质覆盖（`GARRISON_OVERRIDES`）：水月的 `garrison_07`「每叠加 3 层，本干员攻击力 +1/2%」补入【东】后，文案与读层盟约都由【阿戈尔】改为【阿戈尔】【东】（按两者**已激活**层数合计）。

## 它是怎么工作的

```text
tools/custom-content.mjs            本包唯一数据源（盟约 / 棋子 / 特质 / 装备 / 文案参数）
        │  injectCustomContent(ctx)
        ▼
node tools/build-data.mjs           官方赛季数据表 + 注入 → data/*.json（盟约 25 / 特质 275 / 装备 123 …）
        │
        ▼
i18n 四连                            build-i18n（迁移本体既有翻译）→ apply-i18n（合并本包记录）
                                     → prune-stale（清「数据已不存在」的陈旧记录）→ rehash-families（重算 _h）
```

`install` 的五步顺序（每一步都会按指纹复核）：

1. **覆盖** `files/` 下 29 个 mod 自有文件（含整文件覆盖 `tools/custom-content.mjs` 与 `data/assets.json`）；
2. **套两个补丁**：`patches/01-mod-shared.patch`（23 个上游共享文件的改动：`bonds/core.js`、`garrisons/meta.js`、`items/battle.js`、`kits/index.js`、`skills.js`、`battle/deploy.js`、`render/units.js`、`render/spine.js`、`tools/assets/*`、`build-data` 接线、本体 `.gitignore` 一行等）与 `patches/02-tests-calibration.patch`（50 个既有测试的计数 / 口径校准）；
3. **清理**被替换的上游自选 kit（`op-headb2` / `op-helage` / `op-poca` / `op-bgsnow` / `op-veen` / `op-saga` 及其旧测试）——它们已转为预设棋子；
4. **重建数据** `node tools/build-data.mjs`；
5. **合并文案** i18n 四连（`build-i18n` → `apply-i18n` → `prune-stale` → `rehash-families`）。

装前会在 `<本体>/.mod-dong-ursus/` 记下将被触碰的 135 个路径的装前字节，装完再按 `mod.json` 的 102 个产物指纹复核——**不看 git 的退出码**（它在仓库子目录里会静默跳过补丁并返回 0）。

## 包结构

```text
.
├─ README.md                本文件：快速开始 / 更新日志 / 内容与数值速查
├─ SKILL.md                 给 agent 的操作手册（安装 / 升级 / 卸载 / 适配 / 排障 / 维护）
├─ CHANGES.md               逐条修改记录（改了什么 / 为什么 / 怎么验的）
├─ mod.json                 包清单：版本 / 适配本体 / 基线指纹 / 补丁产物指纹
├─ LICENSE · NOTICE         GPL-3.0-or-later 原文 + 改动与版权说明
├─ files/                   mod 自有文件，整文件覆盖（29 个）
│   ├─ tools/custom-content.mjs                    唯一数据源
│   ├─ data/assets.json                            素材清单（含动画角色修正）
│   ├─ public/assets/bond/dongShip.png             【东】盟约图标
│   ├─ server/sim/content/kits/ops/chess_char_*_9*.js   13 个 kit
│   └─ test/**                                     13 个 mod 自有测试
├─ patches/                 补丁基线 = 本体该版本的 mod 前提交
│   ├─ 01-mod-shared.patch   上游共享文件（23 个，含给本体 .gitignore 加一行）
│   └─ 02-tests-calibration.patch   既有测试校准（50 个）
├─ i18n/                    mod-i18n.json + apply / prune-stale / rehash-families
├─ tools/make-manifest.mjs  生成/刷新 mod.json（发布前跑一次）
└─ scripts/
    ├─ mod.mjs              install · update · uninstall · status
    ├─ install.mjs          兼容入口（= mod.mjs install）
    ├─ lib/                 util · manifest · state · gitops · source · zip
    ├─ verify.mjs           mod 验收子集（20 个测试文件）
    ├─ check-anim-roles.mjs 动作角色对账
    └─ repro-skill-latch.mjs 「技能结束后普攻播技能 clip」的复现脚本
```

## 验证与测试

```bash
node <mod 包>/scripts/mod.mjs status <本体仓库根>          # 先看状态
node <mod 包>/scripts/verify.mjs <本体仓库根>              # mod 验收子集：20 个测试文件
node <mod 包>/scripts/check-anim-roles.mjs <本体仓库根>    # 逐模型对账「清单 == resolver + 修正」
node <mod 包>/scripts/repro-skill-latch.mjs <本体仓库根>   # 复现「技能结束后普攻播技能 clip」的闩锁
```

最近一次实测（2026-10-16）：

| 检查 | 结果 |
|---|---|
| `verify` 子集（本体适配树） | **274 / 274 通过**（0 fail / 0 skip） |
| `verify` 子集（纯净树装完后） | **274 / 274 通过** |
| `check-anim-roles` | **695 / 695 一致** |
| `repro-skill-latch` | **异常 0 / 9**（修复前 7/9） |
| 装完产物 vs 本体适配树 | 102 个文件里 **101 个逐字节一致**（唯一差异是旧安装尚未应用的 `.gitignore` 一行） |
| `uninstall` 后 | `git status --porcelain` **为空**（git 还原路径 107 个文件，0 残留） |

> 【乌萨斯】2026-10-15 的系数修订与 2026-10-16 的两处特质修订都被 `verify` 子集覆盖：`ursus_bond.test.js` 断言系数、`garrisons_meta.test.js` 断言 986 的付与对象、`kits_char_6_97.test.js` 断言 992 的新数值。上面两组 274/274 即这两次结果。

## 版本与兼容

- **本体必须是 v0.2.6 的源码检出**（补丁基线 `16a0f9b`）：需要 `tools/build-data.mjs`、`tools/build-i18n.mjs` 与 `test/`。**不必是纯净的** —— 装过旧版 mod 或手改过相关文件，`install` 会自动回退后重装。Release 里的整合包 / 精简包（`*-lite.zip`）**装不了这个 mod**——`install` 的前置校验会以「缺少 `tools/build-data.mjs`」直接拒绝，避免改到一半才失败。
- **mod 版本与本体版本解耦**：本包 `version` 是自己的 semver（当前 `v1.0.0`），`base.version` 才是适配的本体版本。发布侧一个本体版本一个分支（`base-0.2.6`），`update` 只挑 base 匹配且版本更高的那条。
- **一条命令升级 / 卸载**：`mod.mjs update` 按你的本体版本取对应分支的包（源在 `mod.json` 的 `source.repo`，可用 `--source` / `--file` / `--branch` 覆盖）；`mod.mjs uninstall` 精确还原到安装前。**不要**把新版包直接覆盖在装了旧版的树上——实测会落 71 个 `.rej` 且几乎不改内容。
- **拉取默认走镜像**：`update` 按 `source.repo` → `source.mirrors`（`mod.json` 自带默认值）→ 自动派生的 gitclone 形式依次尝试；可用 `MOD_SOURCE` / `MOD_MIRROR` / `--source` / `--file` 覆盖。发布分支（`base-<本体版本>`）没建好或镜像缓存没刷新时，会明确告诉你远端现有分支。
- **首次 `build-data` 需要网络**：缺 `.cache/gamedata` 时会从 GitHub 拉官方数据表。网络不稳时设 `HTTPS_PROXY`，或直接把本机已装仓库的 `.cache/gamedata/` 整目录拷过来（最快、可离线）。
- **另有一份面向 v0.2.4 的旧包**（历史分支，patch 01 = 17 文件 / patch 02 = 45 文件），与本体 v0.2.4 fork 配套；本包是 0.2.6 版。两者各自独立，不要混用脚本。

<details>
<summary><b>换本体版本时的适配流程（摘要）</b></summary>

1. 新本体落位（**源码检出**）后：`node scripts/mod.mjs status <本体仓库根>` 体检，再 `node scripts/mod.mjs install <本体仓库根>`；
2. 补丁若产生 `*.rej`：按 `SKILL.md`「冲突处理」的识别标志手工合入；
3. `node scripts/verify.mjs <本体仓库根>`，计数断言按 `SKILL.md` 清单校准；
4. 改了 `files/` 或补丁后，用 `node tools/make-manifest.mjs --repo <本体源码检出> --base-commit <新基线> --version <新版本>` 重生成 `mod.json`；
5. 全量测试前先 `node tools/golden.mjs --update`；
6. 换基线时更新 `files/data/assets.json`：以本体新 manifest 为基，把本包引用的 id（新棋子 / 盟约 / 装备 / 语音）合并进来，并按 `tools/fetch-assets.mjs` 的 `countStats` 重算 `stats`、按 `contentHash(body)` 重算 `hash`（注意清单末尾保留 LF）；
7. 合并**不会**带来动作角色（`anims`）的代码侧修正——那是 `tools/assets/anim-roles.mjs` + `spine.mjs` 的产物。装完跑一次 `check-anim-roles.mjs`，逐模型对账必须 100% 一致（v0.2.6 实测 695/695）；不一致就按 `SKILL.md`「维护」第 6 条重算清单（`anims` + `hash`，两份都写），钉子测试是 `test/render/anim-role-fixes.test.js`。

</details>

## 已知限制

- 全部文档与代码注释为中文；`README` / `SKILL.md` 面向中文读者。
- 与本体版本强绑定：换版本需重新生成补丁，`*.rej` 需人工合入；`mod.json` 的指纹也随之重算。
- **可以与别的 mod 共存**：卸载/升级走反向套补丁，只摘自己那几段；只有当别的 mod 改到了**本 mod 补丁的同一段**时才会冲突（那时会留下 `.rej`，需要人工处理）。
- `update` 的联网路径依赖发布分支 `base-<本体版本>` 存在；GitHub 被屏蔽的环境可用 `--source` 指向镜像地址，或用 `--file` 走本地包。
- 本包**不附带游戏美术资源**，唯一例外是随包的【东】盟约图标（取自本体自带的东国阵营 LOGO）。
- 文案有历史缺口：`garrison_986_a/b` 的 `ja` / `ko` / `zh-TW` 三条仍是中文（机制类文案未译），其余记录四语言齐全。
- 上面的测试数字来自 2026-10-16 的实跑（mod 验收子集 20 个文件）；尚未跑本体的**全量** `node --test test/`（需先 `node tools/golden.mjs --update`）。

## 文档索引

| 文档 | 内容 |
|---|---|
| [`SKILL.md`](SKILL.md) | 安装 / 升级 / 卸载 / 适配 / 测试 / 冲突处理 / 维护的完整操作手册（给 agent 用） |
| [`CHANGES.md`](CHANGES.md) | 按日期倒序的修改记录，每条含「改了什么 / 为什么 / 怎么验的」 |
| [`NOTICE`](NOTICE) · [`LICENSE`](LICENSE) | 改动与版权说明 · GPL-3.0-or-later 原文 |
| [`PLAN-attack-anim-after-skill.md`](PLAN-attack-anim-after-skill.md) | 「技能结束后普攻播技能 clip」的排查与修复方案 |
| `MIGRATION-0.2.4-to-0.2.6.md` · `BACKPORT-0.2.6-fixes-to-0.2.4.md` | 版本迁移与回填清单（在 0.2.4 仓库根目录，不在本包内） |

## 致谢与版权

- 本体：[**sganggs/Stronghold-Protocol**](https://github.com/sganggs/Stronghold-Protocol)（《卫戍协议：盟约》复刻项目，GPL-3.0-or-later）——本包只做注入与补丁，不含本体代码。
- 本包以 **GPL-3.0-or-later** 发布（见 [`LICENSE`](LICENSE)）；它包含对本体的修改，改动清单见 [`NOTICE`](NOTICE)、`mod.json` 与 `patches/*.patch`。
- 数据 / 文案：本体自带的 gamedata 与社区镜像 [Kengxxiao/ArknightsGameData](https://github.com/Kengxxiao/ArknightsGameData)（四语言文本来源见 `data/i18n/*.json` 的 `meta.source`）。
- 《明日方舟》及其角色、美术、音频版权归 **Hypergryph / Studio Montagne** 所有；本项目为非官方粉丝作品，仅供学习与交流使用。
