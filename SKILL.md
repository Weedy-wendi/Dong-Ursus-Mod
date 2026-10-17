---
name: dong-ursus-mod-install
description: 把【东】+【乌萨斯】自制阵营 mod 包安装/升级/卸载/适配到 Stronghold-Protocol 本体仓库。当用户要求安装 mod 包、升级到新版 mod、卸载 mod、更新本体后重新适配 mod、排查 mod 安装失败、把本体新改动同步/打包回 mod 包、或询问 mod 包内容与测试方式时使用。覆盖命令行（mod.mjs 的 install / update / uninstall / status）、补丁套用/重生成、数据重建、i18n 合并、测试验证与版本冲突处理。
---

# 【东】+【乌萨斯】mod 安装技能

本 mod 包给 Stronghold-Protocol（卫戍协议：盟约）本体新增两个自制核心盟约阵营：
【东】（dongShip）与【乌萨斯】（ursusShip），含 13 名自制/转预设干员、26 条特质、4 件装备、
13 个 kit、以及配套测试与四语言翻译。所有内容经 `tools/custom-content.mjs` 注入官方赛季数据，
由 `node tools/build-data.mjs` 生成 `data/*.json`——**绝不手改 data/**。

## 包结构

```
mod-dong-ursus/
├─ SKILL.md                  本技能
├─ README.md                 内容与数值速查（人工阅读）
├─ files/                    mod 自有文件（整文件覆盖/新增，30 个）
│   ├─ tools/custom-content.mjs                 注入管线（mod 的唯一数据源，整文件 mod 所有）
│   ├─ data/assets.json                         素材 manifest（整文件覆盖：含麒麟R夜刀技能动画、
│   │                        嵯峨 S2/S3 动画互换修正等 anims 映射；若本体升级带出新素材条目，
│   │                        需以本体版为基合并后再覆盖）
│   ├─ public/assets/bond/dongShip.png           【东】盟约图标（本体素材集缺这一张，装完即补上；
│   │                        内容 = 东国阵营 LOGO `ui/campLogo/logo_higashi.png`，sha256 021C9163…、32409 B）
│   ├─ server/sim/content/kits/ops/chess_char_*.js  13 个 kit
│   └─ test/content/kits_char_*.test.js + ursus_bond.test.js + dong_bond.test.js + test/render/yato2-redeploy-stance.test.js
│      + test/render/anim-role-fixes.test.js + test/render/attack-clip-after-skill.test.js    14 个 mod 测试
├─ patches/                  （基线 = 该版本体源码检出的 mod 前提交；见「维护」一节）
│   ├─ 01-mod-shared.patch   上游共享文件的 mod 修改（25 个文件），含 **fork 基线接线**：
│   │                        · bonds/core.js（installDong/installUrsus）、garrisons/meta.js、
│   │                          items/battle.js、kits/index.js、professions.js、
│   │                          match/gamedata.js（bans 7 核心 + 4 支线，与 build-data 生成的 config.json 双保险）、
│   │                          match/player/diy.js（自选槽位的禁用判定摘掉兜底盟约 emptyShip = 自选永不禁用）、
│   │                          skills.js + battle/deploy.js + render/units.js + render/spine.js
│   │                          （被动技能部署动画事件 + 客户端重部署姿态对账；`units.js` 调用的
│   │                          `skillClipHeld()` / `_seqClip()` / `SEQUENCE_GAP` 都在 spine.js，
│   │                          少了这段就 `skillClipHeld is not a function` + 夜刀攻击序列卡第 1 格）、
│   │                          chess_char_2_08-bubble kit 微调
│   │                        · tools/assets/anim-roles.mjs（裸 Start_N 起手补全 + **放行名单**
│   │                          `LAUNCH_CLIP_MODELS`：麒麟R夜刀 + 傀影/缄默德克萨斯/引星棘刺/弑君者/望/止颂
│   │                          各 S2（与 S3）；名单外一律不动，嵯峨的 Skill_2_* 属她第三招故不在名单）与
│   │                          spine.mjs（char_362_saga 预设修正；**含 index 0 槽位**，见「维护」第 6 条）
│   │                        · tools/build-data.mjs：import custom-content + 在任何 builder 之前
│   │                          `injectCustomContent(ctx)` + bonds/visible 计数断言按 `CUSTOM_*` 放大 +
│   │                          config 生成处 bans 7 核心 + 4 支线（**缺了这些，mod 内容根本不会进 data**）
│   │                        · tools/fetch-assets.mjs：`dataExtras` 为注入棋子规划素材
│   │                        · tools/golden.mjs：coop2-NORMAL-3/26/67-coverage-diy 覆盖场景
│   │                        · docs/research/00-INDEX.md（7+4 抽取说明）、docs/PLAYING.md、04-items.json、07-assets.json
│   └─ 02-tests-calibration.patch  既有测试的计数/口径校准（52 个文件；文件删除不在补丁里，
│   │                        统一走 install.mjs 的 REMOVED 清单；golden/*.json 快照除外；
│   │                        补丁里**不得出现 `*.rej`** 这类产物文件）
├─ mod.json                  包清单：版本 / 适配本体 / 基线指纹 base.files(89) / 补丁产物 patched(77)
│                            / 自有文件 owned(30) / 删除 removed(12) / 生成物 generated(22) —— 由 tools/make-manifest.mjs 生成
├─ LICENSE / NOTICE          GPL-3.0-or-later 原文 + 依 §5(a) 的改动说明
├─ i18n/                     四语言 overlay（2 盟约 + 28 特质〔26 自制 + 覆盖的官方 garrison_07〕+ 8 装备记录 + 6 条 effects 派生记录）
│                            + 合并脚本 + rehash-families.mjs
├─ tools/make-manifest.mjs   生成/刷新 mod.json（发布前跑一次）
└─ scripts/
    ├─ mod.mjs               命令行：install / update / uninstall / status
    ├─ install.mjs           兼容入口（= mod.mjs install）
    ├─ lib/                  util · manifest · state · gitops · source · zip
    ├─ verify.mjs            mod 测试子集
    └─ check-anim-roles.mjs  动作角色对账：清单 anims == resolver + 按模型修正表的产物
```

## 命令行：install / update / uninstall / status

```bash
node <mod包路径>/scripts/mod.mjs status    <本体仓库> [--json]          # 只读体检
node <mod包路径>/scripts/mod.mjs install   <本体仓库> [--dry-run] [--force] [--no-backup]
node <mod包路径>/scripts/mod.mjs update    <本体仓库> [--check] [--file <zip|目录>] [--source <url>] [--branch <分支>]
node <mod包路径>/scripts/mod.mjs uninstall <本体仓库> [--force] [--keep-backup]
```

- `install`：只要求两件事 —— **本体版本对**（`<repo>/package.json` 的 version == `mod.json.base.version`）与**有 git**。树上已有本 mod 内容时自动分情况处理：
  · 有安装记录 → 精确还原（git 优先、备份兜底）再装；
  · 没有记录（旧 `install.mjs` 装的 / 手工覆盖过）→ 自动把这 89 个「装之前」的文件回退到基线再装，当前字节先另存到 `.mod-dong-ursus/backup-legacy-<时间>/`；
  · 已装同版本且与安装时一致 → 直接说「无需重装」（`--force` 强制重装）。
  装完按 `mod.json` 的 103 个产物指纹复核（**git 退出码不可信**）。
  这 89 个文件与基线不符时（别的 mod / 你自己的改动）：先让 git 试套一遍，**能干净套上就继续**；套不上才拒绝并指出哪个补丁套不上（`--force` 可硬装，会落 `.rej`）。
- `update`：按方案 B 取 `base-<本体版本>` 分支（分支名可 `--branch` 覆盖），对比包内 `mod.json` 的 `base` 与版本号；只有 base 匹配且版本更高才执行，用**新包自己**跑 `install`，然后同步本地包目录。
  地址候选顺序：`MOD_SOURCE` → `--source` → `mod.json.source.repo` → `MOD_MIRROR` → `mod.json.source.mirrors` → 自动派生的 `gitclone` 形式。镜像可写完整 URL 或前缀（`https://ghproxy.net` → `https://ghproxy.net/<源地址>`）。拉取失败会列出**远端现有分支**（"没有 base-0.2.6，这个分支还没发布？"就是这一行给的结论）。`--file` 支持本地目录/zip（离线），`--check` 只看不动。
  **版本判定是双侧的**（这是 v1.0.4 修的 bug）：① **本体里装的 mod** 看 `<本体>/.mod-dong-ursus/state.json` 的 `modVersion`（没有记录时用候选自己的 `patched`/`owned` 指纹判断树里是不是已经是这份内容；有漂移/缺文件则重装修复）→ 决定**要不要装本体**；② **本地包目录**看它自己 `mod.json` 的 `version` → 决定**要不要刷新包**。四种组合各自执行：只装本体 / 只刷新包 / 两边都做 / 都最新（什么都不做）。`--no-sync-package` 关掉 ②；`--force` 让两侧都执行。
- `uninstall`（两条路，都会做到「本 mod 的东西一个不留」）：
  · **有安装记录** → 按 `state.json` 精确还原（git 优先、备份兜底）；
  · **没有安装记录**（旧版 `install.mjs` 装的 / 手工覆盖过 / 半装）→ 先**反向套补丁**（`git apply -R`，必要时 `-R --3way`）把本 mod 改过的那几段摘掉（同一个文件里别的 mod / 你自己的改动原样留下），再回退被删的上游文件、22 个生成物还原、29 个 mod 新增文件删除、本体原有文件（如 `data/assets.json`）还原、`.mod-dong-ursus/` 清理，收尾打印**残留检查**（只把本 mod 的残留算失败）。
  生成物怎么处理：**优先重跑 `build-data`** —— `data/*.json` 是「当前源码的函数」，重跑才能保住别的 mod / fork 自己的数据改动（例如 `data/config.json` 里的玩家上限）；工具链不可用或失败时才按基线 `git checkout` 还原。
  默认**彻底删除本 mod 的东西**：
  · mod 自有路径（基线提交里不存在的文件）**一律删除**，不看指纹——更早版本的 mod 文件、你改过的 mod 文件也删；内容与本包不同的先另存到 `.mod-dong-ursus/backup-removed-<时间>/` 再删（报告里给路径）；
  · 本体原有文件（如 `data/assets.json`）从基线还原；
  · 只有「确实是本 mod 的内容」（内容等于本 mod 补丁产物、或属于安装时被删掉的那 12 个文件）才回退，别的改动（更早版本的 mod / 别的 mod / 你自己改的）**保留并列出**；
  · `--force`：连那些保留的文件一起回退到基线；`--keep-changed`：更保守（被你改过的 mod 自有文件也留下）。
  · 树里已无本 mod 补丁产物时**跳过反向套补丁**（不会撒 .rej）。
- `status`：**本体版本对不对** + **树里有没有本 mod 的内容**（自有文件 N/30、补丁产物 N/77、被替换的上游文件已删 N/12）+ 安装记录与漂移 + 一句话结论。**不要求纯净本体**。结论优先级：版本不符 → 有安装记录 → **检测到本 mod 内容**（再分「完整」与「不完整（半装）」）→ 纯净基线 → 与本 mod 无关的改动。残留检查只把本 mod 的残留算失败。
- 兼容入口：`scripts/install.mjs` 仍可用（= `mod.mjs install`）。

`<本体>/.mod-dong-ursus/`：`state.json`（这台机器装了什么：每个被触碰文件的装前/装后字节）+ `backup/`（装前副本）。补丁 01 会往本体 `.gitignore` 加一行 `.mod-dong-ursus/`，所以它不出现在 `git status` 里，也不会被 `git clean -fd` 删掉。

## 安装方式

**前置：本体必须是源码检出。** install.mjs 的第一步校验要求 `tools/build-data.mjs`、`package.json`、
`server/sim/content/index.js` 三者齐全；Release 的整合包/精简包（`Stronghold-Protocol-v<版本>-lite.zip`）
只带运行与部署所需文件（没有 `tools/build-data.mjs`、`tools/build-i18n.mjs`、`test/`、
`docs/research/04-items.json`），所以**装不了 mod**——`npm run setup` 也救不了（它只装运行期依赖、
下素材、并诊断数据，不会补回开发工具链）。校验存在的意义：install.mjs 的顺序是
「覆盖文件 → 套补丁 → 删被替换的 op-* → build-data → i18n」，没有前置校验就会改到一半才在
build-data 处失败，留下装了一半的本体。

```bash
cd <本体仓库根目录>
node <mod包路径>/scripts/install.mjs .
```

install.mjs 依次执行（全部幂等，重复运行安全）：
1. 覆盖/新增 `files/` 下 30 个 mod 自有文件（含整文件覆盖 `tools/custom-content.mjs` 与
   `data/assets.json`——若你在本体侧改过这两个文件，先 diff 备份）；
2. 删除被替换的上游自选 kit：`op-headb2/op-helage/op-poca/op-bgsnow/op-veen/op-saga.js` 与旧测试
   `op_headb2/op_helage/op_poca/op_bgsnow/op_saga/op_veen.test.js`（他们的机制已转成预设棋子 kit）；
3. `git apply` 两个补丁。幂等判定：正向 check 失败时试反向 check，通过即视为已安装过并跳过；
   都失败 = 与本体版本冲突 → `git apply --reject` 尽量套用并落盘 `*.rej`，进入下面的「冲突处理」；
4. `node tools/build-data.mjs` 重建 data（首次运行会下载 gamedata，见注意事项）；
5. i18n 四连：`tools/build-i18n.mjs`（迁移本体既有翻译到新结构）→ `i18n/apply-i18n.mjs`
   （合并 mod 的 44 条记录，effects 记录含 `_h`）→ `i18n/prune-stale.mjs`（删除「数据已不存在」的陈旧 overlay 记录，
   典型场景：mod 把自选干员转预设后，本体 overlay 残留其 backups/diy 备份条目）→
   `i18n/rehash-families.mjs`（重算 backups units/tokens/diy 的家族级聚合 `_h`——build-i18n 迁移的
   旧 `_h` 对不上重建后的 data/*.json，不重算会整族 stale）。

## 注意事项（务必读）

1. **gamedata 下载**：`build-data.mjs` 缺 `.cache/gamedata` 时会从 GitHub 拉取官方数据表。
   GitHub 直连不稳时设置镜像或代理：`HTTPS_PROXY` 指向本地代理，或把本机已装仓库的
   `.cache/gamedata/` 整目录拷贝过来（最快、离线可用）。
2. **custom-content.mjs 是整文件覆盖**：安装会覆盖本体里的同名文件。若本体版本升级后该文件被
   上游加了新字段（理论上不会——它不是上游文件），先 diff 再覆盖。
3. **计数断言清单**（补丁套用失败时按此手工校准；下面是 **v0.2.6 基线**实测的「纯净值 → 装 mod 后」，
   2026-10-15）：
   - `test/data.test.js`：chess 266→292、可见非 DIY 112→125（每档 **16/19/22/24/22/22**）、
     bonds 23→25、核心盟约 8→10、items 115→123、garrisons 249→275、effects 361→371。
   - `test/backups.test.js`：base 133→146（PRESET 74→87），保留「自定义预设棋子没有官方商店行」的
     skip 守卫；自选 6★ 池 72→66；核心盟约 8→10；派生盟约统计表
     （`{ emptyShip: 31, yanShip: 13, … 'siracusaShip+ursusShip': 1, … }`）；被排除干员名单里
     去掉 `char_1029_yato2`（她已是预设棋子）。
   - `test/match/pool.test.js`：池 112→125、两枚被 ban 后 110→123、HARD 抽 10 个禁用盟约（7→10）、
     L6 档位份额 12.15/16.69/26.44/25.63/11.75/7.34 %（容差 0.005）、L2 0.4213/0.5787。
   - `test/content/kits_alt_t2.test.js`：tier-2 棋子 17→19。
   - `test/match/loadout.test.js`、`test/sim/loadout.test.js`、`test/ui/loadout.test.js`：
     可见棋子 112/113→125。
   - `test/feedback7-voices.test.js`：JP 语音 192→199 人 / 2688→2786 行。
   - `test/match/diy-bonds.test.js`：多盟约干员 `[HUANG]`→`[HUANG, HSGMA2, CROSLY]`（新增 HSGMA2 常量）、
     `OPS[CROSLY].bonds` → `['siracusaShip', 'ursusShip']`。
   - `test/content/op_haruka.test.js` / `op_hsgma2.test.js`：遥 `emptyShip`→`dongShip`、
     斩业星熊 `['yanShip']`→`['yanShip', 'dongShip']`。
   - `test/assets-diy.test.js`：`dataExtras` 的 extraOperators = backups units + 研究表没有的 chess charId。
   - 种子类：`bot-smarter` seed 11→67、`playtest6-elite-to-board` seed 47→1、`diy-shop` seed 11→3、
     `sim/robustness` 性能测试 seed 7→13（可用 `SP_PERF_SEED` 覆盖重标）；`funnel-redeploy` 改走
     `give()` 取子（卡池变大后商店流整体平移，写死的路线不再成立）。
   - `test/golden/*.json`：**不随包分发**——装完先跑 `node tools/golden.mjs --update`（约 2 分钟）再跑全量。
4. **冲突处理**：`*.rej` 落盘后，按 reject 的目标文件对照本清单手工合入。mod 段落的识别标志：
   - `bonds/core.js`：`function installUrsus` / `function installDong`（函数体 + 底部安装表里的
     `ursusShip:` / `dongShip:` 两行）；
   - `garrisons/meta.js`：`// ---- 2026-10-1x 自制特质` 注释起的 `H['act2autochess_gar_eff_98x']` 块
     （980-992，共 26 个）与配套 helper；
   - `items/battle.js`：`MASK_KEY/CANYIN_KEY/RATION_KEY/ROAR_KEY` 四常量 + `BY_ITEM` 里
     `chess_item_9_01_e` ~ `chess_item_9_04_e` 四个条目；
   - `kits/index.js`：`KIT_FILES` 各档数组里的 mod kit 文件名（2_98 / 3_96 / 3_97 / 3_98 / 3_99 /
     4_98 / 4_99 / 5_97 / 5_98 / 5_99 / 6_97 / 6_98 / 6_99，并删除 2_99-gyuki 旧行）；
   - `professions.js`：`SUB` 表里的 `siegesniper: P({})`；
   - `skills.js` / `battle/deploy.js` / `render/units.js`：`_firePassiveAnim` / `_animWin` 与 sync() 的
     ON 侧姿态对账块（`anim===ANIM.SKILL → setSkill(true)`）；
   - `tools/assets/spine.mjs`：`PREFAB_SPINE_ROLES` 里的 `char_362_saga` 条目（嵯峨 S2/S3 互换）；
     `anim-roles.mjs`：`LAUNCH_CLIP_MODELS`（麒麟R夜刀 `Start_N`/`Skill_N_End` 起手补全的**白名单**——
     必须保持收窄：这条规则曾对所有模型生效，会给 texas2 S2/S3、thorn2 S2、crosly S2/S3、lessng S2
     多出起手剪辑；全量重建素材前务必确认它仍是白名单）；
   - `tools/build-data.mjs`：`injectCustomContent` + `CUSTOM_VISIBLE_CHESS` / `CUSTOM_BOND_COUNT` +
     `bans: { … core: 7, addon: 4 … }`；`tools/fetch-assets.mjs`：`dataExtras` 的注入棋子循环；
     `tools/golden.mjs`：`coverage-diy` 覆盖场景；
   - `docs/research/00-INDEX.md`：7+4 抽取的 Remake adjustment 段；
     `04-items.json`：4 条 `chess_item_9_0x_e_a` 条目 + `meta.counts`；
     `07-assets.json`：`ursusShip` 阵营 logo 条目。
5. **上游内容增长 / 换基线**：新本体若自带新干员/盟约，上表「纯净本体值」会变——先跑一遍 mod 测试子集，
   按失败断言的实际值更新计数（mod 的注入常量 `CUSTOM_*` 在 custom-content.mjs 头部，build-data
   的自检会自动加算）。换版本（如 v0.2.4 → v0.2.6）时还要注意：mod 的补丁是**假定 fork 基线已经带有
   注入接线**写的，纯净上游没有——`tools/build-data.mjs` 的接线/计数/bans、`tools/fetch-assets.mjs`
   的 `dataExtras`、`tools/golden.mjs` 的覆盖场景、`docs/research/00-INDEX.md` 的说明段、`op-saga.js`
   的删除都属于这一类，必须一并补上（漏了最典型的症状：`data/bonds.json` 里没有 dongShip，
   build-data 报出来的还是纯净计数）。
   找全这类差异的可靠办法：拿一份**装 mod 前**的同一版本体（`git log` 里通常有 pre-mod 快照提交），
   `git diff <pre-mod> <装好 mod>` 得到完整改动清单，再与 mod 包的 patch / `files/` 清单对账，
   剩下的就是「基线自带但没进补丁」的部分。
   验证用纯净基线对照：`git worktree add --detach <tmp> <基线提交>`，用 junction 复用
   `node_modules`/`.cache`/`public/vendor`，先 `git apply --check` 两个补丁，再完整走一遍 install 流程
   （含 build-data 与 i18n），最后与适配好的树做逐文件哈希比对（应完全一致）。
6. **不要提交 golden 快照回 mod 包**：golden 是本体版本的函数。
7. **升级走 CLI，不要手工覆盖**：实测把新版补丁直接套到装了旧版 mod 的树上，正向与反向 `--check` 都失败 → `--reject` 落 **71 个 `.rej`**、而真正被改动的文件只有 1 个。`mod.mjs install` 自己会处理「树上已有 mod 内容」：有 `.mod-dong-ursus/state.json` 就按记录精确还原；**没有记录**（旧版安装/手工覆盖）就把 `mod.json` 里 `base.files` 那 89 个文件回退到基线（git 优先，其次 `.mod-dong-ursus/backup/`），当前字节另存 `backup-legacy-<时间>/`。`update` 负责取包 + 比版本 + 调新包安装。
8. **补丁相关的 git 命令必须钉死换行符**：`core.autocrlf=false` + `core.eol=lf`。不钉的话，机器上的全局 autocrlf 会把新增行写成 CRLF——实测在非 git 检出的树上装完，77 个补丁产物全变 CRLF，与本体适配树（LF）逐字节不一致（`scripts/lib/gitops.mjs` 的 `LF` 常量已内建）。另一侧：校验对"仅换行符不同"宽容，Windows 签出的 `.gitignore` 这类文件不会被误判。
9. **git 的退出码不可信**：`git apply` 在**仓库的子目录**里会静默跳过所有补丁并返回 0；在「恰好等于补丁产物」的树上前向 `--check` 也返回 0。所以套完补丁必须按 `mod.json` 的 `patched` / `owned` 指纹复核（CLI 已内建），别信退出码。
9. **Windows 的 `core.autocrlf` 有两个坑，都已内建处理**：① 套补丁的 git 命令一律钉死 `core.autocrlf=false` + `core.eol=lf`，否则系统级默认（Git for Windows 常为 true）会把补丁新增行写成 CRLF；② 所有指纹比对容忍「仅换行符不同」。另外 `git checkout` 在 `autocrlf=true` 的仓库里会写出 CRLF，补丁会先走 `--ignore-whitespace` 兜底，装完仍以指纹复核为准。
10. **改过 `files/` 或补丁后要重生成 `mod.json`**：`node tools/make-manifest.mjs --repo <本体源码检出> --base-commit <基线提交> [--version x.y.z]`；指纹取自基线的 git 对象，不取工作区。版本号是 mod 自己的 semver，改动了就往上加（发布分支 `base-<本体版本>`）。

## 代码测试方式

```bash
# ① mod 测试子集（约 1 分钟，装完必跑）
node <mod包路径>/scripts/verify.mjs .

# ② 全量测试（先重算 golden 快照，约 2 分钟，再跑约 10 分钟）
node tools/golden.mjs --update
node --test                 # 注意：直接 node --test；写成 `node --test test/` 在 v0.2.6 的 Node 上会被当成模块
```

已知的**环境性**失败（与本 mod 无关，纯净基线同样如此）：`test/asset-index.test.js` 需要 Windows
建符号链接的权限（未开开发者模式时 EPERM）；`test/lobby.test.js` 的限流/洪泛、以及
`test/sim/robustness.test.js` / `test/sim/perf.test.js` 的性能阈值，在**满载并行**跑全量时会抖动——
单独跑这几个文件即通过（性能项可用 `SP_PERF_SEED` 换种子重标）。

verify 子集覆盖：数据完整性（计数/镜像一致性）、备份行、i18n stale=0、乌萨斯盟约、26 条特质、
4 件装备行为、机变卡覆盖、13 个 kit、发射 clip 放行名单（代码 ↔ `data/assets.json` 一致）。全绿标准：0 fail。
冒烟：`node server/index.js` 起服后，商店/道具补给应能出现东国鬼面/残心一闪/乌萨斯军粮/冰原咆哮，
整备区盟约条出现【东】【乌萨斯】。

## 维护：本体的新改动 → 同步回 mod 包

1. 先分类改动落在哪里：
   - **mod 自有文件**（`tools/custom-content.mjs`、13 个 kit、mod 测试、`data/assets.json`）→ 整文件拷进
     `files/` 的同名路径（`install.mjs` 会整目录 walk 覆盖）。`data/assets.json` 换基线时要**合并**
     而不是直接覆盖：以本体新版 manifest 为基，把 mod 引用的 id（新棋子 charId / 盟约 / 装备 / 语音）
     从旧 manifest 抄进来，再按 `tools/fetch-assets.mjs` 的 `countStats` 重算 `stats`、
     按 `assets/manifest.mjs` 的 `contentHash(body)` 重算 `hash`（`body` = manifest 去掉
     version/hash/generator/stats），最后同时写回本体与本包。
   - **本体共享文件的修改**（`bonds/core.js`、`garrisons/meta.js`、`items/battle.js`、`kits/index.js`、
     `professions.js`、`match/gamedata.js`、`skills.js`/`battle/deploy.js`/`render/units.js`、
     `tools/assets/*`、`tools/build-data.mjs`、`tools/fetch-assets.mjs`、`tools/golden.mjs`、
     `docs/research/*`）→ 落在 `patches/01-mod-shared.patch`。
   - **既有本体测试的计数/口径校准，以及往本体测试里新增用例** → 落在 `patches/02-tests-calibration.patch`。
2. **补丁基线固定为「该本体版本的 mod 前提交」**（v0.2.4 时是 `c354796`；v0.2.6 时是源码检出里那份
   pristine 初始提交），绝不能用 HEAD——HEAD 已含全部 mod 改动，diff 会得空。重生成 = 用该 patch 里
   所有 `diff --git` 列出的文件跑一次：
   ```bash
   git diff <基线> -- <文件列表…>        # 输出即新 patch 内容，写回原 .patch 文件
   ```
   实测：未改动的补丁能被**字节级复现**，因此「只差我这次改的那几块」一眼可辨（改动前先复现一次作对照）。
   归类规则：`test/**` 的改动进 patch 02，其余进 patch 01；`files/` 里的 mod 自有文件、以及
   `install.mjs` 的 `REMOVED` 清单里的删除都**不进补丁**；`data/*.json`、`test/golden/*` 是生成物，同样不进。
3. **手写翻译**（中文文案不走官方客户端的情形：自制特质、被覆盖的官方 garrison 等）→ 加进
   `i18n/mod-i18n.json`（四语言），并同步 `i18n/apply-i18n.mjs` 里对应的 `IDS` 清单。
   `_h` 必须按该记录**自身的键顺序**对 zh 文本哈希（`shared/i18nData.js` 的 `textHash2` / `walkOverlay`，
   walkOverlay 用 `Object.keys`）——**改了键顺序就要重算 `_h`**，`desc`/`descRaw` 不同时尤其容易错。
4. 更新计数文档：`README.md` 的速查表、本 SKILL 的包结构与计数（`files/` 文件数、i18n 记录数、特质数）。
   `files/` 的现有文件数可用脚本递归数一遍再写，别手算。
5. 校验（用户没要求跑游戏测试时也可做，成本低）：
   - `git worktree add --detach <tmp> <基线提交>` → 对新 patch 分别 `git apply --check`；
     进一步：把 `files/` 拷进去、按 `REMOVED` 删干净、套两个补丁、跑 `build-data` 与 i18n 四连，
     再与适配好的树逐文件哈希比对（这一步能证明「mod 包本身就能复现整棵适配树」）。
   - 用 `shared/i18nData.js` 的 `applyFileOverlay` 抽查新 i18n 记录对当前 `data/*.json` 是否 `stale=0`。
   - 清理：`git worktree remove --force` 可能因缺 `.git` 失败 → 用 `git worktree prune` + 手工删目录。
6. **动作角色的代码与数据必须成对改**（`tools/assets/anim-roles.mjs`、`tools/assets/spine.mjs` 的
   `PREFAB_SPINE_ROLES` / `LOCAL_SPINE_ROLES`）：运行时读的是 `data/assets.json` 里的 `anims`，代码只在
   **生成清单**时生效——只改代码不重算数据 = 游戏里毫无变化（v0.2.6 的嵯峨就是这么漏的：代码里早有
   S2/S3 互换修正，清单没跟上，全量测试也照过，因为当时没有任何测试盯着它）。
   - 核对办法（不需要素材、不需要网络）：`node <mod>/scripts/check-anim-roles.mjs <repo>` —— 拿清单自身的
     `animations`（clip → 时长）当输入，跑 `resolveRoles(...)`（`modelId` 用棋子 id，`skillIndices` = 主槽在前 +
     其余升序，敌人加 `numberedSkills`）+ `applyRoleFix(PREFAB_SPINE_ROLES[id])`，与清单的 `anims` 逐模型比对，
     必须 100% 一致（本次 695/695；脚本对不上会 exit 1）。
   - 只改 `anims` 时：重建单行 minified JSON + **末尾 LF**，并按 `assets/manifest.mjs` 的
     `contentHash(body)` 重算内部 `hash`（`body` = 去掉 version/hash/generator/stats）；本包与本体树两份都要写。
   - `test/render/anim-role-fixes.test.js` 是这件事的钉子：放行名单与清单对不上、或嵯峨的修正没落到数据里，都会红。
   - 另注：v0.2.6 的 `test/assets.test.js` 要求「多技能棋子的每个技能槽都有 clip」，所以嵯峨的
     `PREFAB_SPINE_ROLES` 条目必须连 index 0 一起给（她的 S1 充能是没有自身 clip 的被动）。
