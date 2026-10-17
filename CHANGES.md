# v0.2.6 mod 包 · 修改记录

按日期倒序追加。每条写清**改了什么 / 为什么 / 怎么验的**，路径都相对本包（`<mod>/v0.2.6/`）或本体树。

---

## 2026-10-17（第十一条）· 禁用抽取改加权：回到 5+5，远见/奇迹降权，可用干员 ≈90

### 改了什么

| 文件 | 改动 |
|---|---|
| `patches/01-mod-shared.patch` | ① 新增目标 `server/match/pool.js`：`drawDisabledBonds` 的 `sample()` 由均匀洗牌改为**按 `bond.weight` 的加权无放回抽样**（顺序 PPS；权重相等时与原均匀洗牌同分布）② 新增目标 `server/match/Match.js` + `server/match/match/setupVote.js`：禁集抽取改用**独立派生 rng**（`deriveSeed(seed,'bans')` / `'reroll-bans:N'`）——加权抽样的 rng 消耗与 shuffle 不同，若与 `rngSetup` 共流会把整条对局随机流挪动 ③ `tools/build-data.mjs`：`bans` 回到 **`{core:5,addon:5}`**（NORMAL/HARD/ABYSS），rule 文案改 weighted draw ④ `server/match/gamedata.js`：`DEFAULTS.bans` 同步 5+5 ⑤ `docs/research/00-INDEX.md`：禁用规则段重写为现行加权规则 |
| `files/tools/custom-content.mjs` | `BOND_WEIGHT_OVERRIDES` 扩充：`visiShip/miraShip` **2.5（0.25×）**、`swiftShip/preciShip/skillfulShip` **45（4.5×）**；自制盟约注入模板的 `weight` **1 → 10**（对齐官方「正常可抽」标尺——均匀抽时无差别，加权后必须对齐）；`emptyShip` 保持 10（协防仍可被抽中）；`investShip/maniShip/suntShip` 保持 0（永不被禁） |
| `patches/02-tests-calibration.patch` | `match/pool.test.js`（断言 5+5 + 新增加权分布断言：可用数 ≈90、远见 <15%、迅捷 >70%、协防 20–50%；`drawnDisabledBonds` 10 条）、`ui/match-info.test.js`（绝境 7+4 → 5+5）、`match/setup-reroll.test.js`（期望重算改成生产的新双流：waves 流 + 独立 `reroll-bans` 流）、`content/items.test.js`（拟态物质三处 seed 9 → 1：新禁集下 seed 9 会禁掉溯光星源）、`match/bot.test.js`（切片数下界 8 → 7）、`match/feedback3-gift.test.js`（信标测试只在池内挑干员）、`playtest6-elite-to-board.test.js`（seed 1 → 2：新禁集禁了赫默）；`lobby-diy/board/feedback5-we2-diy-grants` 注释同步；`test/golden/*` 6 份快照重建 |
| `mod.json` | `version` 1.0.8 → **1.0.9**；`base.files 97 · patched 85 · owned 35 · removed 12 · generated 22`（+4 补丁目标：`pool.js`、`Match.js`、`setupVote.js`、`setup-reroll.test.js`） |

### 为什么

用户口径：**回到 5+5**、协防仍可被抽中、**调低「远见」「奇迹」的抽中概率**、可用干员数尽量贴近 90。
评估发现：**单独调远见/奇迹的概率不改变期望可用数**——枚举全部 792 个支线组合，含/不含它们的平均被禁数
几乎相同（32.246 vs 32.250），概率质量的重新分配在对局层面完全对消。因此把「降权远见/奇迹」与
「加权迅捷/精准/灵巧（成员最孤立的支线）」捆绑，落在 **期望被禁 35.07 / 可用 89.93 ≈ 90**（production × 20 万 seed）。

### 怎么验的

- `pool.test.js` 新增 2 万 seed 的分布断言（可用数 89.5–90.5 区间、远见/奇迹 <15%、迅捷 >70%、协防 20–50%）。
- 工作区全量 `node --test`：仅剩已知环境性失败；`test/golden/*` 全量重建后全绿。
- 纯净基线树安装 + `verify.mjs` 子集 0 fail（见发布记录）。

---

## 2026-10-17（第十条）· 新增 5 条自制策略（天尊救我 / 雪原征召 / 完美偶像 / 以物易人 / 人形天灾）

### 改了什么

| 文件 | 改动 |
|---|---|
| `files/tools/custom-content.mjs` | 新增 **`CUSTOM_BANDS = 5`** 与 `injectCustomContent()` 的策略注入段：向 `act.bandDataListDict` / `ac.bandDataDict` 写 5 条 `band_palico / band_headbr / band_haruka / band_utage / band_ulika`（`totalHp` 31/22/26/24/22，落在官方 20–45 区间；`effectName` 即策略名），向 `act.effectInfoDataDict` / `effectBuffInfoDataDict` 写 `aceffect_band_9_02 / aceffect_band_9_05`（`buffs:[{key,bb,bbStr}]`，与官方策略同型） |
| `patches/01-mod-shared.patch` | ① 新增目标 `server/sim/content/bands/meta.js`：`K` 表新增 5 个处理器——**天尊救我**（`onBattleResult.lpLoss>0` 打标记 → `onRoundStart` 时按「已激活盟约层数最高、并列取盟约表序靠前、无激活则随机」定盟约，`ctx.rollChess({bond, tier: shopLevel+1（封顶 6）})` 给 1 名；固定 1 名，与损血量无关）② **雪原征召**（每回合首次 `g.refresh` 改写为「必出 1 名 ≤ 当前调度等级的乌萨斯干员且该格免费」，用 `counters` 记回合号）③ **完美偶像**（`onBattleResult.perfect` 打标记 → `onRoundStart` +2 资金）④ **以物易人**（`onSold` 计数普通干员，每满 2 名给 1 名 `tier ≤ shopLevel` 的【东】干员，计数每回合清零）⑤ **人形天灾**（`onRoundStart` +1 资金；`onPrice`/`onRoundStart`/手动刷新处把「含当前已激活盟约的干员」从商店格替换掉）② 新增目标 `docs/design/engine.md`：bands 描述改 45 ③ `tools/build-data.mjs`：40 条断言放宽为 `40 + CUSTOM_BANDS` |
| `patches/02-tests-calibration.patch` | 新增目标 `test/content/bands.test.js`（计数 40→45 + 5 条新策略逐条用例：天尊救我三分支〔无激活随机 / 单最高 / 并列取表序〕、雪原征召〔回合首刷免费乌萨斯 + 二次刷新恢复〕、完美偶像〔有损不发 / 无损 +2〕、以物易人〔1 卖不发 / 2 卖发 1 / 精锐不计数 / 跨回合清零〕、人形天灾〔回合开始 +1 资金 / 已激活盟约干员被替换、手动刷新同滤〕）与 `test/match/feedback1-gaps.test.js`（§21.26 绑定映射补 `凛冬:['ursusShip']`、`宴:['dongShip']`，自制策略跳过官方注记断言）；既有校准：`test/data.test.js` 策略数 40→45 |
| `files/public/assets/band/` | **新增 5 个策略立绘**：`band_palico.png`（泰拉大陆调查团）、`band_headbr.png`（凛冬）、`band_haruka.png`（遥）、`band_utage.png`（宴）、`band_ulika.png`（U-Official）——180×180 头像；palico/ulika 头像官方资源库缺失，从 Aceship 镜像补齐 |
| `files/data/assets.json` | `bands` 分支登记 5 个图标 URL，**`bonds` 分支补上此前缺失的 `dongShip`**（`/assets/bond/dongShip.png`——清单由 fetch-assets 从官方研究表 07-assets 生成，自制盟约不在研究表里，须手工维护，缺失会让 `URL helpers` / `assetUrls` 两个测试挂），`stats`（files/bytes/bonds/bands）同步 |
| `i18n/mod-i18n.json` | 新增 **`bands` 家族**：5 条 × 4 语言（en/ja/ko/zh-TW）的 `descRaw/desc/effectName`（ulika 无汉字名不写 `name` 叶，与「只译有汉字的叶子」约定一致）；`_h` 由 apply-i18n 按 `data/bands.json` 的 zh 源文本现算 |
| `i18n/apply-i18n.mjs` | 支持 `bands` 家族合并：`IDS.bands` 5 条、缺失即报错；覆盖率除补 `translated` 外**同步补 `texts`**（自制策略文案不在官方语料里，只补 translated 会把 pct 拉破地板——纯净树实测踩过 `bands: 93.3%`） |
| `mod.json` | `version` 1.0.7 → **1.0.8**；`base.files 93 · patched 81 · owned 35 · removed 12 · generated 22`（+4 补丁目标：`bands/meta.js`、`engine.md`、`bands.test.js`、`feedback1-gaps.test.js`；+5 owned 图标） |

### 为什么

用户提出 5 条局内策略（其中 2 条未命名/未定立绘，由我定名并选立绘：雪原征召→凛冬、以物易人→宴），与官方 40 条同池轮选。绑定口径沿用 `shared/bandBonds.js`：desc 里写 `<乌萨斯>` / `<东>` 即自动获得「本局禁用」联动（雪原征召绑乌萨斯、以物易人绑东），bot 不会在对应盟约被禁时误选。

### 怎么验的

- 工作区 `node --test` 全量：仅剩 6 项环境性失败（asset index / websocket lobby ×2 / tracked-tree 等，与本轮无关）；golden 三件套 `node tools/golden.mjs --update` 重建后全绿（roster 54 / bonds 50 / fields 22 / matches 24 / standins 10 / diy 129）。
- 纯净基线树（git worktree @ `16a0f9b` + node_modules/.cache/vendor）：install 93/93 patch + 35/35 owned，`verify.mjs` 子集 **0 fail**（含新增 bands 用例与 i18n 覆盖率 100%）。

---

## 2026-10-17（第九条）· 禁用规则改「7 核心 + 4 支线」＋ 协防入池 ＋ 吉星 → 松桐

### 改了什么

| 文件 | 改动 |
|---|---|
| `files/tools/custom-content.mjs` | ① 新增 **`BOND_WEIGHT_OVERRIDES = { emptyShip: 10 }`**，在 `injectCustomContent()` 里改写官方 `bondDataDict.emptyShip.weight`（0→10）—— 协防从此进入禁用抽取池（支线池 11→12）；投资人 `investShip` / 调和 `maniShip` / 绝技 `suntShip` 保持 0（永不被抽中）② 棋子 `chess_char_3_96` 改绑 **`char_4199_makiri`（松桐）**：5★ 先锋 / 策士（counsellor）/ nationId higashi，tier 3、`identifier 9021`、`shopSortId 910` 全部沿用，**`moduleId: null`**（官方无模组；build-data 会给精锐形态写 inactive 占位，同蒂比 2_13），`defaultSkillIndex: 1`（S2 万手成局 —— S1 入场安排是 AUTO 技能，不能做默认），`bondIds ['dongShip','visiShip']`（【东】【远见】）③ 特质 **991_a/_b 重写**：`<休整期结束时>使已激活的【东】【远见】盟约层数+5 / +10`，`eventType SERVER_PREP_FIN` + `effectType SERVER_ADD_BOND` + `bb.count 5/10` + `bbStr { bond: 'dongShip,visiShip', conditionkey: 'character_target_inboard' }`（与官方 `garrison_69` 完全同型） |
| `files/server/sim/content/kits/ops/chess_char_3_96-makiri.js` | **新增** 松桐 kit：T1 慢手有筹 = 场上站满 30 秒一次性给范围内重装/辅助 `atkPct+atk`；S1 入场安排（AUTO）= 立即 `addDp(cost)`；S2 万手成局（默认）= `atkPct` + `hpRegenRatio` + 每秒 `addDp`（结束补最后一跳） |
| `files/server/sim/content/kits/ops/chess_char_3_96-kichi.js` | **删除**（吉星下线） |
| `files/server/sim/content/kits/ops/chess_char_3_97-yuki.js` | 注释同步（990 已改用 `ownLayers`，不再提吉星 991） |
| `files/data/assets.json` | `tools/fetch-assets.mjs` 重建：补入松桐头像 / 立绘 / Spine / 2 个技能图标 / 语音，吉星条目按设计裁掉 |
| `patches/01-mod-shared.patch` | ① **新增目标 `server/match/player/diy.js`**：`buildDiyStock()` 在判定前把 `economy.fallbackBondId`（= `emptyShip`）从**自选**槽位的 bonds 里摘掉 → 只挂兜底的 自选干员退化成 `bonds=[]`（永不因此被禁），带真实阵营盟约的自选干员照常连坐 ② **新增目标 `docs/PLAYING.md`**：删掉「协防不会被禁用」的绝对表述 ③ `tools/build-data.mjs`：`bans` 的 NORMAL/HARD/ABYSS 由 `{core:5,addon:5}` → **`{core:7,addon:4}`**（rule 文案同步）④ `server/match/gamedata.js`：`DEFAULTS.bans` 同步 7+4 ⑤ `server/sim/content/garrisons/meta.js`：991 处理器由 `ownLayers`（获得时）换成 **`bondListLayers`**（按 `bbStr.bond` 列举、`requireActive: true`，即「只给已激活的」），注册到 `act2autochess_gar_eff_991_a/_b`；990 白雪仍用 `ownLayers` ⑥ `server/sim/content/kits/index.js`：`chess_char_3_96-kichi.js` → `chess_char_3_96-makiri.js` ⑦ `tools/golden.mjs`：补位场景 `coop2-NORMAL-1-coverage-standins` → **`coop2-NORMAL-12-coverage-standins`**（吉星换人后 seed 1 的商店流不再派补位）⑧ `docs/research/00-INDEX.md`：禁用规则段落改成 7+4 + 协防入池 |
| `patches/02-tests-calibration.patch` | **新增目标** `test/match/bot.test.js`（bench 用例 seed 6→12）、`test/match/feedback3-gift.test.js`（候选干员加「在本局池内」约束）。既有校准：`match/pool.test.js` 断言 5+5→**7+4** 并新增「协防可被抽中 / 投资人永不入池」；`ui/match-info.test.js` 5+5→7+4；`lobby-diy.test.js` seed 4244→**4240**（走 `deriveSeed(seed,'setup')` 真实 rng 流筛，要求维多利亚不被禁）；`match/diy-shop.test.js` 改成断言「协防即使被抽中，自选原型仍保住在店」；`match/{board,merge,bot-smarter}` 手牌铺满的候选候选集扩到多阶；`match/playtest6-elite-to-board` 46→47、`match/feedback5-we2-diy-grants` 910→912；`content/garrisons_meta.test.js` 991 用例改 `SERVER_PREP_FIN` 口径（激活才加层）；`content/kits_t3.test.js` 新增松桐 3 条用例（T1 / S1 / S2） |
| `i18n/mod-i18n.json` | 991_a/_b × 4 语言的 `desc` / `descRaw` 换成休整期口径，按记录自身键顺序重算 `_h`（`mzmzmz` / `g5g5mz`），`eventTypeDesc` 同步「持续叠加」 |
| `mod.json` | `version` 1.0.6 → **1.0.7**；`base.files 89 · patched 77 · owned 30 · removed 12 · generated 22`（新增 2 个补丁目标 → base/patched 各 +4 条：`diy.js`、`PLAYING.md`、`bot.test.js`、`feedback3-gift.test.js`） |

### 为什么

用户两条口径：① **协防干员也进禁用池（自选除外）、投资人永不禁用、采用 n+4 规则**，并要求对比原版禁用后的可用人数做评估；② **删除吉星、加入 tier3 松桐（东 / 远见）**，特质为 `<休整期结束时>使已激活的【东】【远见】+5/10`。

评估（脚本 `禁用机制评估.mjs`，结论表在工作区的 `禁用机制速查.md` §12）：

- 闭式解（不放回抽取）先过保真校验：重建原版池（112 可见 / 8 核心 / 11 支线、3+4）得 **22.01 禁 / 89.99 可用**，与 `docs/research` 的 22 / 90 锚点逐位吻合；闭式 = 20 万次 MC = production 3000 seed 三方一致。
- 协防入池后（125 可见 / 10 核心 / 12 支线）：6+4 → 92.94 可用、**7+4 → 88.32**、8+4 → 83.61。6+4 与 7+4 跨在 90 两侧，7+4 绝对偏差更小，故采用（回退只需改 `bans` 一个数字）。
- 实测 `drawDisabledBonds` × 3000 seed：NORMAL+ 平均禁 **36.65** / 可用 **88.35**；FUNNY 28.14；TRAINING 0；**投资人中签 0.00%**。
- 代价：核心侧压力上升（每核心平均可用 6.0–7.3，原版 8.0–8.7），阿戈尔 6.7→**4.8**（门槛 3），"连调和都凑不齐" **0.27%**；其余核心 ≤0.05%。支线侧反而更宽松（压力全在核心侧，是「n 核心 + 4 支线」的必然结果）。
- 协防入池后新增可被禁：魔王 33.3%、铃兰 15.6%、调香师/松果 9.1%、迷迭香 1.8%（此前 100% 免疫）。
- 自选豁免无副作用：`backups.diy.operators` 81 条里 46 条是 `['emptyShip']`、**0 条**「协防 + 阵营」，所以 `diy.js` 那行 filter 只命中兜底情形。

`emptyShip` 的 `weight=0` 原本就是「禁用免疫」标签（`pool.js` 只把 `weight>0` 的盟约放进抽取池），改它只影响「谁可被禁」，战斗侧零改动（`bond.weight` 的运行时消费者只有 `pool.js:35`）。

松桐沿用原槽位（`chess_char_3_96`）是为了不触动 `backups` / 商店序 / 编号体系；她官方无模组，精锐形态因此走「inactive 占位 module」分支。

### 怎么验的

| 步骤 | 结果 |
|---|---|
| `node tools/build-data.mjs` | 通过，计数不变：chess 292 / 可见 125 / bonds 25 / garrisons 275 / items 123 / effects 371 |
| data 抽查 | `emptyShip.weight = 10`、`config.bans.NORMAL = {core:7,addon:4}`、`chess_char_3_96_a.name = 松桐` 且 `bonds = ['dongShip','visiShip']`、991 两条为 `SERVER_PREP_FIN` + `bond: 'dongShip,visiShip'` |
| `node --check` | 改动文件（`custom-content.mjs` / `build-data.mjs` / `gamedata.js` / `diy.js` / `meta.js` / `kits/index.js` / `chess_char_3_96-makiri.js`）全部通过 |
| 内容测试 | `test/content/` 146/146；`garrisons_meta`（991 新用例）、`kits_t3`（松桐 3 条）全绿 |
| i18n | `build-i18n --lang {en,ja,ko,zh-TW} --refresh` 四语言全量重建 + `apply-i18n` 合并（38 条/语言）；`test/i18n-data.test.js` **11/11**（stale=0） |
| 素材 | `tools/fetch-assets.mjs --allow-shrink` 补入松桐、裁掉吉星；`test/assets.test.js` **54/54** |
| 全量 `node --test` | 6356 项 **6327 pass / 8 fail**；8 条与改动无关（tracked-tree、符号链接权限、windows-bundle、asset index、并发下的 websocket lobby / 性能阈值——单跑 `lobby.test.js` + `perf.test.js` 68/68 全绿） |
| `scripts/verify.mjs`（mod 测试子集） | **277 pass / 0 fail** |
| 补丁回环 | `make-manifest` 在**纯净基线副本**上套用两个补丁 **0 `.rej`**；`patches/01` 25 目标 / 91625 B、`patches/02` 52 目标 / 109293 B |
| 指纹对账 | `patched 77/77`、`owned 30/30`、`base.files 89/89` 逐字节等于工作区（`base.files` 直接取自基线 git 对象） |

---


### 改了什么

| 文件 | 改动 |
|---|---|
| `files/tools/custom-content.mjs` | ① 【东】`bb.dmg_base` 0.25→**0.45**、`dmg_per_layer` 0.007→**0.006**、`dmg_per_lost_hp` 0.004→**0.003**（显示键 `dmg_disp_base` 1.25→**1.45**、`dmg_disp_per` 0.007→**0.006**）；公式 = `×(1+45%+0.6%×层数)×(1+0.3%×已损失生命比例)` ② 【乌萨斯】`sp_regen_6` 0.8→**1.0**（6 人档技回 80%→100%，仍是覆盖不是叠加）+ `effectDesc` 文案 ③ 嵯峨 `bondIds` `steadShip`→**`swiftShip`**（【东】【坚守】→【东】【迅捷】） ④ 伯塔尼 981 文案：加层目标由【乌萨斯】【助力】收窄为**仅【乌萨斯】**、+2/4→**+3/6**、上限 8/16→**12/24** ⑤ 乌啾 984 文案：+2/4→**+3/6**、上限 8/16→**12/24** ⑥ 白雪 990 文案：「已激活的层数最高的盟约 +3/6」→「**自身所属盟约 +4/8**（无需激活盟约）」，`bb.count` 3/6→4/8 ⑦ 麒麟R夜刀 992 文案：屏障 → **90% 物理与法术减伤** |
| `files/server/sim/content/kits/ops/chess_char_2_98-botany.js` | `CRY_BONDS`（乌萨斯+助力两元组）→ 单一 `CRY_BOND = 'ursusShip'`；`cryPer` 4/2→**6/3**、`cryCap` 16/8→**24/12**（unit.mem 记账键沿用 `botanyCryUrsus`） |
| `files/server/sim/content/kits/ops/chess_char_5_98-turdus.js` | `layerPer` 4/2→**6/3**、`layerCap` 16/8→**24/12**（加层目标仍为【乌萨斯】【迅捷】两盟约） |
| `files/server/sim/content/kits/ops/chess_char_6_97-yato2.js` | 【狂龙症】`grantOni()` **去掉屏障分支**：部署时仍失去当前生命 50%，但改为挂 `mods = { atkPct: 0.5, physTakenMul: 0.1, artsTakenMul: 0.1 }` —— 90% 物理/法术减伤（庇护语义，只减物理与法术，不动真伤），持续到死亡/撤退；`garrison:yato2:shield` 这个 key 已无引用 |
| `files/server/sim/content/kits/ops/chess_char_3_97-yuki.js` | 注释同步（990 新口径；战斗侧不含该特质） |
| `patches/01-mod-shared.patch` | `bonds/core.js`：【东】`dmg_base/dmg_per_layer/dmg_per_lost_hp` 兜底默认值与注释、【乌萨斯】`sp_regen_6` 兜底 1.0。`garrisons/meta.js`：990 处理器改用 `ownLayers`（与 991 吉星同口径），删除已无用的 `topLayers()`；**并清除一个阻断性语法错误**——`gainRandomItems()` 闭包后多出一个 `}`，`node --check` 报 `SyntaxError: Unexpected token '}'`，即装完的 mod 一 `import` 这个模块就崩（特质/备战侧整条链不可用） |
| `files/test/content/{dong_bond,ursus_bond,kits_char_2_98,kits_char_5_98,kits_char_6_97}.test.js`、`patches/02`（`garrisons_meta.test.js`） | 期望值按新数值改写；990 测试改成「自身所属盟约全部 +4/8（无需激活）」；`ursus_bond` 的叠层上限断言里 `0.0012×8`→**`0.0012×12`**（齐鸣上限 8→12 会把单次最大加层从 6.36% 抬到 6.84%） |
| `i18n/mod-i18n.json` | 8 条特质 × 4 语言 `desc/descRaw` 改数值重算 `_h`；【乌萨斯】盟约 `effectDesc/effectDescRaw` × 4 语言（+100%，并把 ja/ko/zh-TW 缺的 6 人档那半句补齐）；`effects.bondeffect_ursus` 的 `desc/descRaw` 对齐成该盟约的 effectDesc（与 `apply-i18n.mjs` 的派生口径一致） |
| `mod.json` | `version` 1.0.5 → **1.0.6**；指纹集合不变（`base.files 85 · patched 73 · owned 30 · removed 12 · generated 22`） |

### 为什么

用户第八条口径给出的七项改动（见上表 ①–⑦）。两处需要点明的执行口径：

- **伯塔尼按字面执行**：加层目标**收窄为仅【乌萨斯】**（原为【乌萨斯】【助力】两盟约各加）。乌啾那条用户点名了【乌萨斯】【迅捷】两盟约、伯塔尼只点名【乌萨斯】，因此判断为有意收窄；**若本意是保留助力**，把 `CRY_BOND` 改回两元组、译文里补回【助力】即可。
- **满级/普通形态**：`+3/6`、`12/24`、`+4/8` 一律「普通/精锐」两档（`_a` 取小值、`_b` 取大值），与项目内既有写法一致。

`meta.js` 的多余 `}` 是 2026-10-16 第七条改动后遗留（当时未复跑测试，所以 patch 01 里也带着它）——不修的话 `install` 会稳定产出坏文件。

### 怎么验的

| 步骤 | 结果 |
|---|---|
| `node tools/build-data.mjs` | 计数不变：chess 292 / bonds 25 / garrisons 275 / items 123 / effects 371；10 条既有 warning（模组 trap 缺表等） |
| data 抽查 | `bondeffect_dong.bb` = 0.45 / 0.006 / 1.45 / 0.006 / 0.003；`bondeffect_ursus.bb.sp_regen_6` = 1、`effectDesc` 含 `+100%`；`chess_char_5_97_a/b.bonds` = `["dongShip","swiftShip"]`；981/984/990/992 的 6 条 garrison 文案为新值 |
| `node --check` | 7 个改动文件全部通过（改动前 `garrisons/meta.js` 报 `Unexpected token '}'`） |
| i18n | 8 条特质 + 盟约 effectDesc + effects 派生记录 × 4 语言重写并重算 `_h`；`node --test test/i18n-data.test.js` **11/11 pass**（`stale=0`、`applied=leaves`） |
| `node --test`（本次相关 7 个文件） | 95 项：**94 pass / 1 fail** → 唯一失败是 `ursus_bond` 那条**测试自身的旧上界**（齐鸣上限 8→12 后单次最大加层变大），改成 `0.0012×12` 后 **5/5 pass** |
| `scripts/verify.mjs`（mod 测试子集） | 277 项：**277 pass / 0 fail** |
| 补丁回环 | `patches/01` 23 个目标 / **70522 B**、`patches/02` 50 个目标 / **90541 B**；与上一个提交逐行 diff，`01` 只有 core.js/meta.js 那 4 段 hunk、`02` 只有 `garrisons_meta.test.js` 的 990 用例 |
| `tools/make-manifest.mjs` | 两个补丁在纯净基线上套用成功、0 `.rej`；`base.files 85 · patched 73 · owned 30 · removed 12 · generated 22` |

---

## 2026-10-16（第七条）· 七项数值修订（用户口径）

### 改了什么

| 文件 | 改动 |
|---|---|
| `files/tools/custom-content.mjs` | ① 【东】`bb.dmg_base` 0.15→**0.25**、显示键 `dmg_disp_base` 1.15→**1.25**（每层 0.7%、每 1% 已损生命 0.4% 不变）② 缠丸 988 / 嵯峨 989 的 `garrisonDesc` 统一成「**自身已激活的盟约 +12/24**」（取消 2026-10-14 的按盟约分档）③ 【乌萨斯】`atk_per_start` 0.036→**0.054**、`atk_per_start_per_layer` 0.0006→**0.0012**、`atk_cap_per_layer` 0.009→**0.012**（`atk_cap_base` 54% 不变）④ 赫拉格 982 文案 **+3/6、上限 9/18** ⑤ 伯塔尼 981 / 乌啾 984 文案 **+2/4**（上限仍 8/16）⑥ 烈夏 987 文案写明排除名单 |
| `files/server/sim/content/kits/ops/chess_char_3_99-gyuki.js`、`chess_char_5_97-saga.js` | `TH` 统一 `golden ? 24 : 12`（缠丸原为 { dongShip: 16/8, indomShip: 8/4 } 分档） |
| `files/.../chess_char_4_98-helage.js` | `killGain` 4/2→**6/3**、`killCap` 16/8→**18/9** |
| `files/.../chess_char_2_98-botany.js`、`chess_char_5_98-turdus.js` | 每次开技每名【乌萨斯】加的层数 2/1→**4/2**（`cryCap`/`layerCap` 仍 16/8） |
| `files/.../chess_char_5_98-turdus.js` | **范围键修正**：`a.tileR * 1000 + a.tileC` → `a.tileR * COLS + a.tileC`（引擎建 `rangeKeySet` 用的是 `r*COLS+c`；原写法永远匹配不上，导致「范围内每名【乌萨斯】」实际只数到她自己） |
| `patches/01-mod-shared.patch` | 本体侧两处，都只用本体已有接口（**不新增补丁目标**）：`bonds/core.js` 东/乌萨斯兜底默认值 + 注释；`garrisons/meta.js` 新增 `LETO_ITEM_EXCLUDE` 名单、`maxTier` 封顶 5、以及**重试采样**实现排除 |
| `files/test/content/dong_bond.test.js`（新）、`kits_char_{2,4,5}_98.test.js`、`ursus_bond.test.js` | 【东】伤害公式新增测试；三条特质的期望值按新数值改写 |
| `i18n/mod-i18n.json` | 12 条特质 × 4 语言的 `desc`/`descRaw` 按各自语言改数值并重算 `_h`（144 行） |
| `scripts/verify.mjs` | 测试清单加 `test/content/dong_bond.test.js` |
| `mod.json` | 重新生成指纹：`owned` 29→**30**（+dong_bond.test.js）；`patched` 仍 **73**、`base.files` 仍 **85**、`removed`/`generated` 不变 |

### 为什么

用户第七条口径给出的七项数值（【东】3 人公式、缠丸/嵯峨叠层、乌萨斯 3 人公式、赫拉格/伯塔尼/乌啾加层、烈夏道具池）。
烈夏那条用**重试采样**实现（`ctx.rollItem({ maxTier: 5 })` 抽到排除项就再抽，最多 12 次）——故意**不去改本体 `rollItemId` 的接口**：本体共享文件在 fork 上常被改写，实测 IncreasePlayerCapacity fork 把 `server/match/match/spDraft.js` 整个重写（15496 B / 该段 114→154 行），一旦把它列为补丁目标，那个 fork 就会因为「85 个装前文件里 1 个与基线不符」被拒装（正向/反向 check 全失败、提示 `--force`）。排除名单 12 个 id，其中 7 个（突变细胞、画卷、教鞭、战栗/坚固/加速/灼燃维式重锤）本来就不在商店池里（`isShopItem` 要求 `!isGolden && !shopExcluded`），列全只为口径完整；真正被移出池子的是 **13 件 6 阶 + 5 件 5 阶**（信标/拟态物质/博士投影/商业包装方案/天马之盔），池子 55→37。
普通维式重锤 `chess_item_1_01_e_a` 保留。

### 怎么验的

| 步骤 | 结果 |
|---|---|
| `node tools/build-data.mjs` | chess 292 / bonds 25 / garrisons 275 / items 123（计数不变，只改数值）；10 条既有 warning（模组 trap 缺表等） |
| data 抽查 | `bondeffect_dong.bb` = 0.25 / 0.007 / 1.25 / 0.004；`bondeffect_ursus.bb` = 0.054 / 0.0012 / 0.54 / 0.012；12 条 garrison 文案为新值 |
| i18n 四连 | build-i18n 23781/24313（97.8%）→ apply-i18n en 44 / ja 38 / ko 38 / zh-TW 38 → prune-stale 3/4/4/4 → rehash-families 12 处；`test/i18n-data.test.js` **stale=0** |
| `node --test`（本次相关 6 个文件） | 31 项：**29 pass / 2 fail**（两条是我自己测试写法的假失败，已在下一次修掉） |
| 修完后重跑 `kits_char_2_98 / kits_char_5_98` | **9 pass / 0 fail** |
| `scripts/verify.mjs`（mod 测试子集 21 个文件） | 276 项：**273 pass / 3 fail**，3 条全部是本体树里**别人正在写的雷姆必拓（rimBillitonShip）WIP** 造成的（`data.test.js` 期望 26 盟约、`backups.test.js` 的 rim 计数、`build-data` 完整性自检），与本条改动无关 |
| 补丁回环 | `patches/01`：**23 个文件 / 75587 B** / 不含 spDraft.js / rim 命中 0；`git apply --check` + 实套到纯净基线后 **23/23 文件与预期状态逐字节一致** |
| `tools/make-manifest.mjs` | 补丁在纯净副本上套用成功、0 `.rej`；`base.files 85 · patched 73 · owned 30` |
| 那个 fork 上 `--dry-run` | `mod.mjs install <IncreasePlayerCapacity fork> --dry-run` → 「本体是基线 → 直接装」（修前：85 一致 / 1 内容不同 → 补丁套不上） |

**测试写法说明**：伯塔尼/乌啾这两条特质的原测试依赖「自然攒满技力开技」，但该阵型 110 s 内根本不会开技，旧断言其实是 `0 == 0` 通过。现在改成 `battle.emit('skillStart', { unit })` 直接触发（先 `step(1)` 让单位部署完成），断言真实数值。

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
