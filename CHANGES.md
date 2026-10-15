# v0.2.6 mod 包 · 修改记录

按日期倒序追加。每条写清**改了什么 / 为什么 / 怎么验的**，路径都相对本包（`<mod>/v0.2.6/`）或本体树。

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
