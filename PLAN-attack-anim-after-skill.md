# 待核验的修复计划 · 技能结束后普通攻击播错 clip

> **状态（2026-10-15 更新）：已按本计划实施完毕**（业主给了逐干员的普攻口径后执行）。
> 实施与偏差见 `CHANGES.md` 的第二条；要点：
> - 采用方案的「双向重派」，但 ON 加了 `actor.skillClipHeld()` 守卫、OFF 用 `SKILL_STANCE_GRACE = 0.4 s` 迟滞
>   （业主的剑雨/临光报障 + 夜刀姿态都照顾到，**不需要**方案 B 的 sim 改动）。
> - 追加 `SKILL_ROLE_PATCHES`（按槽位/`attack` 键、逐字段）落实「技能有自己的姿态、普攻仍用普通攻击」的口径：
>   临光 S2、缄默德克萨斯 S3、弑君者 S2；并新增 `test/render/attack-clip-after-skill.test.js`。
> - 追加麒麟R夜刀的**攻击序列**（`attack.seq` / `skills[0].seq` + `spine.js _seqClip/windUp/attack`，断敌回到 idle 后从头循环）。
> - 复现脚本现在 **0 / 9 异常**；`verify` 273/273；对账 695/695；补丁在纯净 `16a0f9b` 上 `git apply --check` 均 0。
> - **不改**：傀影（骨架无 `Attack2`，业主确认不需要）。

**状态：尚未改任何源码。** 先请业主按 §4 人工核验 spine 动画（尤其 §4.3 的三个疑点），确认后我再动 `public/js/render/units.js`。

---

## 1. 现象

- **德克萨斯（`char_102_texas`）**：未开技能时普攻动画正确；释放二技能「剑雨」后，普攻播的像是技能片（实际是 `Skill`＝剑雨那 2.167 s 的片）。
- **耀骑士临光（`char_1014_nearl2`）**：技能结束后普攻变成技能动画（实际 `Skill_3`；静止时是 `Skill_3_Idle`）。
- 我另外排查了 6 位：**缄默德克萨斯 / 引星棘刺 / 弑君者 / 止颂 同样中招**；**傀影 / 望 不中招**（原因见 §3.3）。

## 2. 复现（不需要进游戏）

```bash
node <mod>/scripts/repro-skill-latch.mjs <本体源码检出>
```

脚本复刻渲染层真正收到的快照序列：`idle → 技能 on/off 事件 + 0.5 s ANIM.SKILL 窗口 → ANIM.ATTACK`，
然后打印「窗口结束后再普攻一次真正播的 clip」。2026-10-15 在适配树 `E:\ark\Stronghold-Protocol-v0.2.6-src` 实测：

| 干员 | 技能槽 | 普攻应播 | 普攻实际播 | 静止应播 | 静止实际播 | `skillOn` |
|---|---|---|---|---|---|---|
| `char_102_texas` 德克萨斯 | S2 剑雨 | `Attack_Loop` | **`Skill`** ⚠ | `Idle` | `Idle` | true |
| `char_1014_nearl2` 耀骑士临光 | S3 | `Attack_Loop` | **`Skill_3`** ⚠ | `Idle` | **`Skill_3_Idle`** ⚠ | true |
| `char_1023_ghost2` 傀影 | S2 | `Attack` | `Attack` | `Idle` | `Idle` | true |
| `char_1028_texas2` 缄默德克萨斯 | S2 | `Attack` | **`Skill_2_Loop`** ⚠ | `Idle` | **`Skill_2_Idle`** ⚠ | true |
| `char_1039_thorn2` 引星棘刺 | S2 | `Attack` | **`Skill_2`** ⚠ | `Idle` | `Idle` | true |
| `char_1502_crosly` 弑君者 | S2 | `Attack_A` | **`Skill_2_Idle`** ⚠ | `Idle` | **`Skill_2_Idle`** ⚠ | true |
| `char_2027_wang` 望 | S2 | `Attack_1_A` | `Attack_1_A` | `Idle` | `Idle` | true |
| `char_4011_lessng` 止颂 | S2 | `Attack` | **`Skill_2_Loop`** ⚠ | `Idle` | **`Skill_2_Idle`** ⚠ | true |
| `char_1029_yato2` 麒麟R夜刀 | S3 | `Attack1` | **`Skill_Attack1`** ⚠ | `Idle` | **`Skill_Idle`** ⚠ | true |

`skillOn` **9/9 全部被闩成 true**（闩锁是普遍的）；是否"看得见"只取决于该技能槽有没有自己的 clip。

## 3. 根因（一条 8 行的补丁 + sim 的动画窗口）

### 3.1 触发链

1. `public/js/render/units.js:983`（本体原有）：`if ((prevFlags ^ this.flags) & UF.SKILL) this.setSkill(!!(this.flags & UF.SKILL));`
   —— **唯一**的 OFF 通路：靠 `UF.SKILL` 标志位的**边沿**。
2. `public/js/render/units.js:984-991`（**本 mod 在 patch 01 里新加的 8 行**，2026-10-14 为修麒麟R夜刀重部署姿态）：
   ```js
   if (this.actor && !this.actor.dead && !this.actor.skillOn
     && ((this.flags & UF.SKILL) || this.anim === ANIM.SKILL)) this.actor.setSkill(true);
   ```
   它**只补 ON，不补 OFF**（注释里写的假设是"off 归 off 事件 / flags 管"）。
3. `server/sim/snapshot.js:99`：`if (t < (u.skillAnimUntil ?? -1)) return ANIM.SKILL;`
   —— 快照的动画码只看**窗口**，不看技能是否还开着。
   `server/sim/skills.js:571`：一次技能施放即 `u.skillAnimUntil = b.time + SKILL_ANIM_WINDOW`（`SKILL_ANIM_WINDOW = 0.5`，`skills.js:70`）。
   （部署期被动走 `skills.js:310 _firePassiveAnim` → `skills.js:318`，窗口长度取 `spec.skillAnim`，没写就是 0.5 s。）
4. 于是：技能事件 `on→off` 在同一 tick 内走完（瞬发技能）或 25 s 后才 off（持续技能），
   而 `anim === ANIM.SKILL` 还会继续 **0.5 s**；这 0.5 s 里第 2 条把 `skillOn` 重新拉成 true。
   窗口一过 `anim` 变回 `ATTACK`，`UF.SKILL` 从未有过边沿 → **`setSkill(false)` 再也不会被调用** → 闩住。
5. 闩住后的两个可见后果（`public/js/render/spine.js`）：
   - `spine.js:617 _attackClip()`：`if (this.skillOn && sk && this.has(sk.loop) && sk.via !== 'attack' …) return sk;` → **普攻改播技能 clip**。
   - `spine.js:476 _idleName()`：`if (this.skillOn && sk && this.has(sk.idle)) return sk.idle;` → **静止时站在技能的 idle**（临光/缄默德克萨斯/弑君者/止颂/麒麟R夜刀）。

### 3.2 是本 mod 引入的（不是本体 bug）

`git diff <mod 前提交> -- public/js/render/units.js` 只有那 8 行；v0.2.4 包的 `patches/01-mod-shared.patch:63` 也有同一块
→ **两个包都中招**。修麒麟R夜刀重部署姿态时用的"动画码兜底"没有配套的关闭条件。

### 3.3 为什么傀影 / 望 例外

他们的技能槽数据是 `via: 'attack'`（`roles.skill.loop` 就是普攻 clip），`_attackClip()` 的 `sk.via !== 'attack'` 一票否决，
所以闩锁在**动画上**看不出来（他们本来也没有专属技能动画）。但 `skillOn` 依旧是闩住的 —— 一旦以后给他们的技能换上有专属 clip 的角色，就会立刻表现为同一个 bug。

### 3.4 为什么现有测试没抓到

- 本体渲染测试大多直接驱动 `SpineActor`（如 `test/render/feedback4-texas-skill-clip.test.js`），**不经过 `UnitView.sync()`**，碰不到那 8 行。
- 走 `UnitView` 的测试用的是敌人/木桩（没有技能槽）。
- 唯一覆盖这 8 行为的是 `test/render/yato2-redeploy-stance.test.js`，而它只断言"姿态**要出现**"，没断言"技能结束后要回到普攻"。

## 4. 请你先人工核验（**改源码之前**）

### 4.1 要看的 spine 动画（本体树里的文件 + clip 表）

文件位置：`<本体>/public/assets/spine/op/<charId>/front/<charId>.skel`（`back/` 是背面模型）。
下表 clip 名与时长直接来自 `data/assets.json` 的 `animations`（= 骨架里的片）。

| 干员 | 需要核对的 clip | 数据里各状态的角色 | 核验要点 |
|---|---|---|---|
| 德克萨斯 `char_102_texas` | `Skill`(**2.167s**)、`Attack_Start`(0.5)、`Attack_Loop`(1)、`Attack_End`(0.5)、`Idle`(2)、`Start`(1) | 本槽 `{begin:null, loop:Skill, end:null}`；普攻 `{Attack_Start→Attack_Loop→Attack_End}`；静止 `Idle` | `Skill` 是不是「剑雨」那一击？普攻是不是那套三连？**背面模型没有 `Skill` 片**（数据里因此是 `via:'attack'`），对不对？ |
| 耀骑士临光 `char_1014_nearl2` | `Skill_3`(1.5)、`Skill_3_Idle`(1.333)、`Skill_3_Down`(1.5)、`Skill_1_Begin/Idle/Loop`、**`Skill_2_Die`(1.167)**、`Attack_Begin/Loop/End`、`Idle`(2.667) | 本槽(index 2) `{begin:null, loop:Skill_3, end:null, idle:Skill_3_Idle}`；**index 1 的 loop 被解析成 `Skill_2_Die`** | ① `Skill_3`/`Skill_3_Idle` 是不是她三技能的姿态？② **她的二技能到底有没有专属动画**——`Skill_2_Die` 看着像"倒地"片，解析器可能是抓错（骨架里没有别的 `Skill_2_*`）。这条要你定：是保持、改成 `via:'attack'`、还是手写一个修正？ |
| 缄默德克萨斯 `char_1028_texas2` | `Start_2/Start_3`(1)、`Skill_2_Loop`(0.933)、`Skill_2_End`(0.1)、`Skill_2_Idle`(3)、`Skill_3_*` | S2 `{Start_2→Skill_2_Loop→Skill_2_End, idle:Skill_2_Idle}`；S3 `{Start_3→Skill_3_Loop→Skill_3_End, idle:Skill_3_Idle}` | 起手/循环/收尾对应关系是否与官方一致（注意 `Skill_2_End` 只有 0.1s） |
| 引星棘刺 `char_1039_thorn2` | `Start_2`(1)、`Skill_2`(1.5)、`Skill`(1.5)、`Skill_3_Loop`(1.5)、`Skill_3_Idle`(5)、`Attack`(1.5) | S2 `{Start_2→Skill_2, end:null, idle:null}` | `Skill_2` 是不是她二技能的动画？二技能没有收尾片、也没有专属 idle，对吗？ |
| 弑君者 `char_1502_crosly` | `Start_2`(1)、`Skill_2_Idle`(1.667)、`Skill_2_End`(1.3)、`Skill_3_Loop`(4)、`Skill_3_End`(0.5)、`Attack_A/B` | S2 `{Start_2→Skill_2_Idle→Skill_2_End, idle:Skill_2_Idle}` | **循环片是 `Skill_2_Idle`**（不是 `_Loop`）：她二技能是不是"摆姿态"类技能？ |
| 望 `char_2027_wang` | `Start_2`(1)、`Attack_1_A/B`(0.833)、`Skill_3_Begin/Loop/Idle/End`、`Idle`(8.333) | S2 `{Start_2→Attack_1_A, via:attack}` | 二技能确实没有专属动画（只有起手 `Start_2`）？ |
| 止颂 `char_4011_lessng` | `Start_2`(1)、`Skill_2_Loop`(1.5)、`Skill_2_End`(0.167)、`Skill_2_Idle`(4)、`Skill_3_*` | S2 `{Start_2→Skill_2_Loop→Skill_2_End, idle:Skill_2_Idle}` | 同上对照 |
| 傀影 `char_1023_ghost2` | `Start_2`(1)、`Attack`(1.2)、`Skill_1`(1)、`Skill_3_Begin/Loop/Idle/End`、`Idle_B`(10) | S2 `{Start_2→Attack, via:attack}` | 二技能只有起手、没有专属循环？ |
| 麒麟R夜刀 `char_1029_yato2` | `Start_1/2/3`(1)、`Skill_Attack1..4`(≈1)、`Skill_End`(0.5)、`Skill_3_End`(0.667)、`Skill_2`(3.433)、`Skill_Idle`(4)、`Attack1..3`(1) | S3 `{Start_3→Skill_Attack1→Skill_3_End, idle:Skill_Idle}` | 起手/循环/收尾对应关系 |

> 说明：`data/assets.json` 里 `animations` 是"片名 → 时长"，`anims` 是"角色 → 片名"的映射；表格里的"角色"就是渲染器实际会取用的字段（`spine.js` 的 `_attackClip` / `_idleName` / `setSkill`）。

### 4.2 想"看见"哪个 clip 在播，三种手段（选一个我就去做）

1. **游戏内 clip HUD（推荐，最直观）**：我加一个只在调试开关下显示的角标（例如 URL 带 `?clip=1` 或 `SP_CLIP_HUD=1`），在单位头顶显示 `actor.current` / `mode` / `skillOn`。
   你上阵德克萨斯放剑雨，然后看普攻时角标是 `Attack_Loop` 还是 `Skill` —— 一次就能同时验证"数据角色对不对"和"闩锁 bug"。
   代价：要给 `public/js/render/units.js`（或调试模块）加**临时**代码，验证完删除。
2. **只 dump 不显示**：`node <mod>/scripts/check-anim-roles.mjs <repo>`（角色 vs 代码）＋我可以再给一个
   `dump-spine <charId>` 小工具，打印 clip 表/角色/"每个状态会播哪个 clip"；你拿 clip 名去任何 Spine 预览器或官方客户端对照。
   代价：看不到画面，只能对名字。
3. **独立预览页**：用 `public/vendor` 里的 pixi-spine 写一个本地页面，列出某模型的全部 clip，点一个播一个。
   代价：工作量最大（半天级），但能脱离游戏逐片比对。

### 4.3 请你定的三个数据疑点（先不动数据）

1. **耀骑士临光二技能**：`anims.skills[1].loop` 现在被解析成 **`Skill_2_Die`**（1.167 s）。骨架里确实没有别的 `Skill_2_*`。
   她二技能该播什么？保持 / 改成 `via:'attack'`（用普攻片）/ 手写修正？
2. **德克萨斯背面**：`back` 骨架没有 `Skill` 片，数据里 index 0/1 都是 `via:'attack'` —— 背面放剑雨时用普攻片，可以接受吗？
3. **嵯峨（本次已改）**：清单现在是 S2 普通挥砍、S3 `Skill_2` 起手/持续/收尾。这条是你 2026-10-14 的结论，本次只是把它落到数据里；顺便确认一次。

## 5. 修复方案（等你确认后再动手）

### 方案 A（推荐）：把"只补 ON"改成 ON/OFF 双向，并给 actor 一个"自己的窗口还没播完"的判据

`public/js/render/units.js`（替换现有 8 行）：

```js
// The skill stance re-derived from the sim's state of record (this snapshot). Two-sided: the ON side brings the
// stance back after a redeploy (麒麟R夜刀, 2026-10-14); the OFF side is what the sim's own anim window
// (snapshot.js animOf: ANIM.SKILL while t < u.skillAnimUntil) cannot express — otherwise the stance latches on
// for good and every later attack plays the skill clip (spine.js _attackClip / _idleName, owner report 2026-10-15).
const skillWanted = !!(this.flags & UF.SKILL) || this.anim === ANIM.SKILL;
if (this.actor && !this.actor.dead) {
  if (!this.actor.skillOn && skillWanted) this.actor.setSkill(true);
  else if (this.actor.skillOn && !skillWanted && !this.actor.skillClipHeld()) this.actor.setSkill(false);
}
```

`public/js/render/spine.js` 新增一个只读判据（放在 `setSkill` 附近）：

```js
/** Still inside the actor's own one-shot skill window (setSkill / update): the sim's anim window has closed, but
 *  cutting the clip with setSkill(false) right now would flash the base clip / skip the End clip. */
skillClipHeld() { return (this.skillClipOnce && this.clock < this.skillBeginUntil) || this.mode === 'skillEnd' || this.skillEndPending; }
```

- 效果：窗口结束且 actor 自己的片播完 → 关掉 `skillOn`，普攻回到 `Attack_*`，静止回到 `Idle`；麒麟R夜刀的姿态在窗口内不受影响（窗口内 `skillWanted` 仍为 true）。
- 影响面：只多一个 off 时机，不动 sim、不动数据。
- 需要配套的回归测试（见 §6）。

### 方案 B（更"干净"但动 sim）：让 sim 直接给被动姿态置 `UF.SKILL`，客户端回归纯标志位驱动

即撤掉那 8 行"动画码兜底"，改为在 `server/sim/skills.js`（部署期被动那条，`_firePassiveAnim` 的窗口起止）同时把 `UF.SKILL` 置/清。
优点：客户端只跟随 sim 的状态记录，理论上不会再出现"窗口与开关不一致"的闩锁；缺点：`UF.SKILL` 还有别的消费者（状态显示等），要先查一遍；麒麟R夜刀姿态的窗口是"部署期被动"，需要保证它在重部署、raid 换人时都被正确清掉。

### 方案 C（不推荐）：把受影响的技能数据改成 `via:'attack'`

等于放弃技能动画显示，直接抹掉这些技能的表现，本末倒置。

## 6. 改完后要跑的验证

1. `node <mod>/scripts/repro-skill-latch.mjs <repo>` → **异常 0 / 9**（现在 7/9）。
2. `node <mod>/scripts/verify.mjs <repo>` → 全绿（264＋新增回归项）。
3. `node --test test/render/yato2-redeploy-stance.test.js`（麒麟R夜刀姿态不能被改回"不出现"）。
4. 针对性再跑：`test/render/feedback4-texas-skill-clip.test.js`、`test/render/feedback3-skill-idle.test.js`、`test/render/loadout-skill.test.js`、`test/render/unitview.test.js`。
5. 新增回归测试（建议放进 mod 自有的 `files/test/render/`）：以 `UnitView.sync` 驱动，断言"瞬发技能窗口结束后普攻播 `Attack_*`、静止播 `Idle`"＋"持续技能结束后同样"，并覆盖名单里 7 位。
6. 补丁重生成 + 纯净 worktree `git apply --check`（`SKILL.md` 维护第 5 条）。

## 7. 排查表（本次结论）

| 干员 | 中招 | 原因 |
|---|---|---|
| 德克萨斯 `char_102_texas` | **是** | 剑雨 `Skill` 是独立片（`via` 未定义） |
| 耀骑士临光 `char_1014_nearl2` | **是** | `Skill_3` + `Skill_3_Idle` |
| 缄默德克萨斯 `char_1028_texas2` | **是** | `Skill_2/3_Loop` + `_Idle` |
| 引星棘刺 `char_1039_thorn2` | **是** | `Skill_2` |
| 弑君者 `char_1502_crosly` | **是** | `Skill_2_Idle` 被当作循环片 |
| 止颂 `char_4011_lessng` | **是** | `Skill_2_Loop` + `Skill_2_Idle` |
| 傀影 `char_1023_ghost2` | 否（`skillOn` 仍闩住） | 技能槽 `via:'attack'` → 普攻片不变 |
| 望 `char_2027_wang` | 否（`skillOn` 仍闩住） | 同上 |
| 麒麟R夜刀 `char_1029_yato2` | **是** | `Skill_Attack1` + `Skill_Idle` |

> 普遍性：闩锁与干员无关，凡"技能槽有自己的 clip（`via !== 'attack'`）"都会表现；名单之外还有大量干员同理，只是本次没逐个列。
> 这个 bug 在 **0.2.4 包** 里同样存在（`patches/01-mod-shared.patch:63` 是同一块代码）。
