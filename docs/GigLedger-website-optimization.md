# GigLedger 官网优化方案（按 PRD v3）

- 文档日期：2026-11-13（Asia/Shanghai）
- 抓取时间：2026-11-13 约 20:06–20:08（Asia/Shanghai）
- 修订：同日稍后（Asia/Shanghai），按 Dax 决定更新：第一版直接接 Google OAuth + D1；未登录试算只暂存在当前页面，不用 `localStorage`；主 CTA 打开计算器，次 CTA 为「Sign in with Google」；不再接通单独的等候名单邮箱收集；Privacy 须说明存储 Google 邮箱和姓名，以及删除账户的方式
- 适用对象：Codex（按第 8 节任务清单改站）；与《GigLedger-PRD-v3-supplement.md》一起使用
- 抓取方式：对下列 URL 使用 HTTP 拉取（WebFetch + curl），读取到的是当时线上 HTML 的真实文案。抓取成功，没有失败项
- 原则：不编造用户数、评分、媒体报道或任何社会证明。官网不再收集等候名单邮箱；次 CTA 改为直接「Sign in with Google」

已抓取并核对：

| 页面 | URL | 结果 |
| --- | --- | --- |
| 英文首页 | https://gigledger.xyz/en/ | 成功，HTTP 200 |
| 繁中首页 | https://gigledger.xyz/zh-TW/ | 成功，HTTP 200 |
| 英文原型 | https://gigledger.xyz/en/app | 成功，HTTP 200，`noindex` |
| 繁中原型 | https://gigledger.xyz/zh-TW/app | 成功，HTTP 200 |
| 英文 Privacy | https://gigledger.xyz/en/privacy.html （`/en/privacy` 同样可访问） | 成功 |
| 繁中 Privacy | https://gigledger.xyz/zh-TW/privacy.html | 成功 |
| 英文 Tax disclaimer | https://gigledger.xyz/en/tax-disclaimer.html | 成功 |
| 繁中 Tax disclaimer | https://gigledger.xyz/zh-TW/tax-disclaimer.html | 成功 |
| sitemap / robots | https://gigledger.xyz/sitemap.xml 、https://gigledger.xyz/robots.txt | 成功 |
| 致谢页 | https://gigledger.xyz/en/thanks.html → 308 到 `/en/thanks` | 成功，`noindex` |

---

## 1. 现状总结（基于真实文案）

### 1.1 站点结构

- 静态营销站，部署在 Cloudflare Pages，域名 `gigledger.xyz` / `www.gigledger.xyz`。
- 双语对等：`en` 与 `zh-TW`，有 canonical 和 hreflang（`en`、`zh-Hant-TW`、`x-default` 指向英文）。
- 主题色 `#f7f1e7`，OG 图 `https://gigledger.xyz/assets/og.png`（1200×630）。
- 原型 `/en/app`、`/zh-TW/app` 带 `<meta name="robots" content="noindex">`，sitemap 未收录原型，这是对的，保持。
- robots.txt 允许全站，只 Disallow `/en/thanks.html` 与 `/zh-TW/thanks.html`，并声明 sitemap。
- Privacy / Tax disclaimer 在 sitemap 中；这两页 HTML **没有** canonical / hreflang（首页有）。Privacy 的 meta description 直接复用了首页那句 freelancer 描述，未针对页面内容撰写。
- 发现一个链接缺陷：英文原型语言切换出现 `href="/zh-TW//app"`（双斜杠）。请一并修掉。

### 1.2 英文首页真实文案与板块

**Meta**

- Title：`GigLedger — Know what you actually take home`
- Description：`A simple ledger for freelancers. Track income, platform fees, expenses, and fixed costs, then see your true profit and tax reserve target.`
- OG title：`Know what you actually take home.`
- OG description：`One ledger for freelance income, fixed costs, true profit, and tax reserves.`
- OG alt：`GigLedger dashboard preview with sample income, fees, fixed costs, profit, and tax reserve.`

**导航与 CTA**

- 导航：Why GigLedger (`#daily`) / How it works (`#how`) / FAQ (`#faq`) / 繁體中文 / 主按钮 `Join the waitlist`（指向 `#waitlist`）
- Hero 主 CTA：`Join the waitlist`
- Hero 次 CTA：`Try the calculator`（指向 `/en/app`）
- 也就是说，现在最醒目的行动是「留邮箱」，不是「3 分钟算出 Daily Floor」。

**Hero**

- 标题：`Know what you actually take home.`
- 副标题：`Track income, platform fees, expenses, and fixed costs in one ledger. See your true profit, and how much to set aside for taxes.`
- 三个勾选：`Built for freelance income` / `Manual entry + CSV import` / `Estimates, not tax advice`
- 演示账本示例数据：Gross income `$4,800`，Platform fees `−$480`，Other expenses `−$480`，Fixed costs `−$900`，True profit `$2,940`。收入趋势为 Jan–Jun。

**Daily Floor 区块（`#daily`）**

- 眉题：`The number most tools miss.`
- 标题：`Your daily floor.`
- 正文：`Rent. Software. Insurance. The costs that keep running whether you bill a client or not. GigLedger turns them into one number you can act on.`
- 示例说明：`Example: $900 in monthly business fixed costs at 100% business use.`
- 计算公式写成：`Monthly fixed costs × 12 ÷ 365`，但展示值为 **`$30 per day`**。按 PRD 精确值应为 `$29.59`。产品内必须用 $29.59；营销若继续用 $30，需改成 “about $30”，不能把 $30 写成该公式的精确结果。
- 拆解示例：Coworking `$18 / day`，Software `$7 / day`，Insurance `$5 / day`。

繁中首页同一演示区还展示了 `每日底線 $30/天` 和 `預留稅款 $620 僅供預估`。英文首页 Web 抓取摘要未把 $620 放进主演示数字，但税作为核心承诺出现在副标题和功能块里。$620 与 15% 或与 $2,940 利润都对不上（15% × 净收入 $4,320 = $648），示例数字需要重算，不能继续放一个来源不明的税金额。

**功能区块：「Everything you need to see what's left.」**

- Scattered income, one place.（点名 Upwork, Fiverr, Stripe, and direct clients）
- Fixed costs, finally visible.
- Set aside the right amount.（税储备，已标注 estimate, not tax advice）
- Reports you can hand over.：**明确承诺** `Monthly, quarterly, and annual views you can export for your accountant, lender, or landlord.`  
  这与新 PRD 冲突：第一版只做月度 + CSV，不做季报/年报/PDF。

**三步骤（`#how`）**

1. Add your fixed costs
2. Add or import income
3. See what's actually left

**受众：「For work that doesn't fit one platform.」**

- Platform freelancers（Upwork, Fiverr, Toptal, marketplace）
- Independent creators（sponsorships, subscriptions, digital products）
- Consultants and studios

独立创作者已经在受众里，但主标题和 meta 仍把产品说成 freelancer ledger，一人公司 / AI 订阅 / 跑道都还没成为主叙事。

**同步政策（即将过时）**

- 眉题：`No magic sync. Not yet.`
- 标题：`Start with what works. Add automation when it's reliable.`
- 正文：`GigLedger starts with manual entries and CSV import. Platform connections come later, after the core numbers are right.`
- ✓ In the first version：Manual income and expense entry；CSV import with duplicate detection；Fixed costs and daily floor
- × Not in the first version：No bank passwords；No scraping your platform accounts；No tax filing on your behalf

「不收银行密码、不抓取、不代报税」仍要保留。但「官方同步以后再说」必须改：新 PRD 规定 Stripe 与 App Store Connect 是第一版 Pro 能力。

**FAQ（`#faq`）**

- 开场：`The short version: we would rather be clear than overpromise.`
- Does GigLedger file my taxes? → No，只有 estimate 和 reserve target。
- Does it connect to Upwork or Stripe? → **`Not in the first version.`** You can add income manually or import a CSV. Official integrations are planned after the core ledger is stable.  
  这句必须改，否则和即将上线的 Stripe / App Store 同步直接矛盾。
- What counts as a fixed cost? → coworking, software, insurance, hosting, accounting。个人成本可另记，且「are not treated as deductible」。新 PRD 已去掉「可抵扣」标记，这句要改，避免听上去像税务裁定。
- Can I use it outside the US? → 第一版税估为美国自僱设计，其他地区仍可用账本。
- What happens to my data? → 可导出和删除；不要银行密码或 SSN；链到 privacy。
- When will it launch? → The first version is in development. Join the waitlist...

**结尾等候名单（`#waitlist`）**

- 眉题：`Early access`
- 标题：`Know your real number before the next invoice.`
- 说明：`Join the waitlist for launch updates and early access.`
- 表单 label：`Email address`，按钮：`Join the waitlist`
- 附注：`Only launch updates. Unsubscribe anytime.` + Privacy 链接
- 页面明确写着：`Preview only. Connect the waitlist endpoint before launch.`
- 表单 `data-success-message` 为：`Preview only — the waitlist isn't connected yet, so your email wasn't stored.`
- 致谢页 `/en/thanks` 文案是 `You're on the list. We'll send launch updates and early-access details. No noise.` 该页 `noindex`。  
  **关键问题（抓取时的现状）：等候名单尚未接通，致谢页却写「You're on the list.」。** 按 Dax 新决定，不要去接通这份表单，而是下线等候名单，改用计算器 +「Sign in with Google」（见第 2 节）。

页脚：`A clearer ledger for independent work.` / `Pre-launch preview` / © 2026 GigLedger. All rights reserved. / Privacy / Tax disclaimer。

### 1.3 繁中首页（真实文案要点）

- Title：`GigLedger — 看清你實際拿到多少`
- Description：`為自由工作者而做的簡單帳本。記錄收入、平台手續費、支出與固定成本，看清實際利潤與預留稅款。`
- Hero：`看清你實際拿到多少。` / `在同一個帳本裡記錄收入、平台手續費、支出與固定成本，看清實際利潤，也知道該為稅款預留多少。`
- 主 CTA：`加入等候名單`；次 CTA：`試用計算器` → `/zh-TW/app`
- 功能、步骤、FAQ 与英文对等，包括「第一版不會」串接 Upwork 或 Stripe、以及月/季/年報承诺。
- 表单成功文案：`目前僅為預覽，等候名單尚未接通，因此沒有儲存你的電子郵件。`
- 底部另有：`目前為預覽版。上線前請接上等候名單端點。`
- 结尾标题：`下一張發票之前，先知道真正的數字。`

定位问题和英文相同。另外，PRD 已提出：**目标用户是美国人，第二语言却是繁中，两者不对齐。** 在 Dax 决定「繁中服务在亚洲收美元的华语一人公司」还是「公开渠道先只做英文」之前，不要把繁中页写成台湾/中国大陆报税产品，也不要新增多一套本地税务承诺。决定前：文案与英文同步更新，但不加繁中专属市场宣传。

### 1.4 原型 `/en/app`、`/zh-TW/app`

英文：

- Title：`Prototype — GigLedger`，`noindex`，无 canonical。
- 标题：`Your real ledger, in three steps.`
- 说明：`This prototype shows the core calculation. Add fixed costs and income to see your daily floor and true take-home.`
- 指标：Daily floor、Gross income、Platform fees、Net income、Fixed costs（This month）、True profit、Tax reserve。
- 税的当前文案是硬伤：`15% planning placeholder · Estimate only`（繁中：`15% 規劃用預設值 · 僅供預估`）。
- 页脚：`Prototype only. Tax reserve is a planning placeholder, not tax advice.`
- 固定成本字段：Name, Amount (USD), Cycle（Daily / Weekly / Every 2 weeks / Monthly / Quarterly / Yearly）, Business use %（默认 100）。
- 收入字段：Date（抓取当日默认 2026-11-13）、Source（Upwork / Fiverr / Stripe / Direct client）、Client or project、Amount (USD)、Platform fee (USD)。
- **没有** localStorage / sessionStorage（源码中未使用），刷新即清空。这是抓取时的现状。按新决定，第一版**也不**改成浏览器本地持久化：未登录试算只暂存在当前页面，刷新或离开会丢失，必须靠「用 Google 保存」写入账号。
- **没有** 支出、CSV、订阅模板、跑道、登录。第一版要补上 Google 登录，而不是补 localStorage。
- 源码引用 `/app-proto.js`、`/app.js`。

### 1.5 Privacy 与 Tax disclaimer（仍为上线前草稿）

英文 Privacy 标题：`Privacy notice — GigLedger`。正文有草稿眉题：`Pre-launch draft. This notice must be reviewed before launch.` 关键三句：

1. `This preview page is a static site. It does not send or store the email address you type into the waitlist form.`
2. `There is no account system, and no income, expense, or tax data is collected because the product is not live yet.`
3. `Before launch, this notice must be replaced with the legal entity, contact details, retention period, processors, and instructions for requesting deletion.`

繁中 Privacy 对等：`這個預覽頁面是靜態網站，不會傳送或儲存你在等候名單表單輸入的電子郵件。` 另有 `上線前草稿。正式上線前仍需完成法律審閱。`

英文 Tax disclaimer：

- Title：`Tax disclaimer — GigLedger`
- Description（本页是独立撰写的，可用）：`GigLedger provides estimates for planning only. It is not a tax, legal, or accounting advisor.`
- 正文三句：仅供规划预估，不是税务/法律/会计顾问；规则会变、依辖区而异，第一版预估为美国自雇情境；申报或做税务决定前咨询专业人士。
- 该页没有「草稿」眉题，但内容仍偏短，且还在说「The first estimates are designed for US self-employment scenarios」——需改成「第一版是用户自设预留比例，不是按美国税法计算的应纳税额」。

**只要开始用 Google 登录或把账本写入 D1，Privacy 必须在同一天改掉「不会存储电子邮件」「目前没有账号系统」这些句子，并写明会存储 Google 账号的邮箱和姓名，以及如何删除账户。** 否则是虚假陈述。不要为了等候名单去存储邮箱。

---

## 2. 逐区块修改方案

下列英文是建议上线文案；括号内是给 Dax / Codex 的中文说明。未决定的价格不要写死。不要加入「加入了 xx 位创始人」这类无来源社会证明。

### 2.1 Hero：标题、副标题、勾选、CTA

**现有：** `Know what you actually take home.` + 收入/手续费/支出/固定成本/预留税款 + 主 CTA 是等候名单。

**改为：**

- 眉题（可选）：`For one-person companies`  
  （中文说明：把受众从「零工接案」换成一人公司，但不要求立刻改品牌名。）
- 标题：`Your daily cost. Your real profit.`  
  （中文说明：对应新一句话定位「一人公司的每日成本和真实利润」，比原标题更接近 Daily Floor 这个主卖点。）
- 副标题：`GigLedger turns AI subscriptions and other fixed costs into one Daily Floor — how much you need to earn each day. Then it shows true profit, and how many days of runway you have left.`  
  （中文说明：主讲 Daily Floor、AI 订阅和现金跑道；税不再抢第一句。到手利润仍在，但降为结果而不是唯一承诺。）
- 三个勾选改为：  
  1. `Built for one-person companies`（一人公司，而不是只写 freelance income）  
  2. `See your Daily Floor in 3 minutes — no account needed to try`（可以不登录先试算；保存要走 Google）  
  3. `Estimates, not tax advice`（这条保留，可信且已有）
- **主 CTA：** `Calculate your Daily Floor in 3 minutes` → `/en/app`（繁中 → `/zh-TW/app`）  
  （中文说明：主按钮直达不用登录的计算器。试算只暂存在当前页面，刷新或离开会丢失，结果页再用「用 Google 保存」。）
- **次 CTA：** `Sign in with Google` → Google OAuth 入口（已登录则进 Dashboard）  
  （中文说明：等候名单改为直接注册/登录。导航和页脚里的 `Join the waitlist`、`#waitlist` 表单、`/en/thanks` 致谢页一并下线或改成指向计算器 / Sign in，不要再收集邮箱，也不要再写 “You're on the list.”）
- **只有 Google OAuth 已经可用时，才把次 CTA 做成真正的 Sign in 按钮。** 不要先放一个会 404 的登录按钮。

演示账本建议改一版示例（仍是虚构演示，必须标注 Sample / 範例資料，不得伪装成真实用户）：

- 固定成本突出 AI 订阅 + 一项办公成本
- 展示 Daily Floor（精确算法，营销可写 about $30，旁注公式）
- 增加 Runway 示例，例如存款 $8,000、Daily Floor 约 $30 时，「若不再有新收入，约可撑 260+ 天」
- 预留税款要么改为用户自设比例后的演示（如 28% × 净收入）并写 `Estimate only`，要么先不放具体税额，避免再出现来源不明的 $620

### 2.2 Daily Floor 区块

保留眉题 `The number most tools miss.` 和标题 `Your daily floor.` 这两个已经对的部分。

正文改为：

`AI tools. Software. Rent. The costs that keep running whether you ship or not. GigLedger turns them into one number you can act on: your Daily Floor.`

（中文说明：把 AI 工具放到租金前面，符合新用户场景。）

示例行：

- 公式旁若展示 $30，必须写 `about $30 / day` 或直接展示 `$29.59 / day`（$900 × 12 ÷ 365）。
- 拆解示例建议改成更像一人公司的组合，例如：Coworking / Cursor + ChatGPT + Claude / Insurance，并保证加总与 Daily Floor 一致，不要再出现三行日成本相加对不上主数字的情况。现有 Coworking $18 + Software $7 + Insurance $5 = $30，是为凑整，和 $900/月并不严格相等。要么声明这是 rounded illustration，要么改成可核对的数字。

### 2.3 功能区块：增、改、删

原四块里：

- **收入**：保留「一个地方看散落收入」，但补充三种来源：Stripe 与 App Store 官方同步（Pro，可标 Coming soon，直到验收通过）、CSV 导入（Upwork / PayPal / Fiverr 等）、手动录入。不要再写「第一版不连接 Stripe」。
- **固定成本**：保留，并写明订阅记在固定成本里，不会和一次性支出重复计算。
- **税**：标题不要用 `Set aside the right amount`（「right」过满）。改为 `Set your own tax reserve.` 说明常见参考范围 25%–30%，比例由用户决定，`Estimate only / Not tax advice`。
- **报表**：删除 quarterly and annual，以及 landlord/lender 这种第一版做不到的承诺。改为 `Export a clean monthly CSV for yourself or your accountant.`

### 2.4 新增区块（插入在功能区与三步骤之间，或三步骤之后、FAQ 之前）

均使用真实可交付的能力来写；尚未做完的同步能力统一标 `Coming soon`，不要写成已经能授权 Stripe。

1. **AI 订阅花费 / 订阅体检**  
   - 标题建议：`See what you actually spend on AI.`  
   - 正文：预置常见 AI 工具模板；扣费前 3 天询问「常用 / 偶尔 / 没用」；连续两个月选「没用」会标红并建议取消；每个订阅有「打开产品」和「管理订阅」。明确写：`We don't claim to track your usage automatically.`  
   （中文说明：这是最好传播的一块，也是分享卡片的来源。）

2. **现金跑道**  
   - 标题建议：`How many days could you last?`  
   - 正文：输入手头现金，按 Daily Floor 看「不接新单还能撑多少天」；有近 3 个月数据时，再给一个按平均收入计算的读法。

3. **Stripe / App Store 同步**  
   - 标题建议：`Official sync for Stripe and App Store. Coming soon.`  
   - 正文：第一版 Pro 将支持官方 Stripe 同步，以及 App Store Connect API（销售报告与财务报告分开：已售出 / 已到账）。Upwork、PayPal 等用 CSV。不收银行密码，不抓取账号。在功能未通过验收前，只标明 Coming soon，不要放一个会报错的「Connect Stripe」，也不要再导向等候名单。

4. **分享卡片示例**  
   - 标题建议：`A card worth posting.`  
   - 用设计好的演示卡（「My Daily Floor is $X/day」「I spend $Y/month on AI tools」），标明 Sample。提供 Share on X 的预期样式。不要在卡片上写假用户数。

5. **价格（无等候名单）**  
   - 免费：最多 5 个订阅，手动录入，可看 Daily Floor 和跑道。  
   - Pro：不限数量，Stripe 与 App Store 同步、扣费提醒、CSV 导入导出。  
   - 价格写 `Pricing available after private beta` 或 `Price TBD`，**不要编造 $9/$12 这类未经验证的数字。**  
   - 这一区的行动按钮用 `Calculate your Daily Floor in 3 minutes` 或 `Sign in with Google`，**不再放邮箱收集表单。**

### 2.5 三步骤

改为与 3 分钟上手一致：

1. `Pick the subscriptions you already pay for`（可加上一项其他固定成本）
2. `Enter a rough monthly income`（可选手头现金和预留税比例）
3. `See your Daily Floor, runway, and what's left`

不要再把「先登录、再开始」写进步骤。

### 2.6 受众区块

保留三位受众，但顺序和措辞对齐 P0：

1. Independent builders and one-person companies（Stripe、App Store、数字产品、AI 应用）——放到第一位
2. Independent creators
3. Consultants（平台接案仍可保留，但不要继续把 Upwork/Fiverr 当唯一主角）

`For work that doesn't fit one platform.` 可保留，这句仍然成立。

### 2.7 「No magic sync」区块

整块重写，避免和 Pro 同步承诺打架，同时保住红线。

建议标题：`Official APIs where they exist. No bank passwords. No scraping.`

建议正文：

`GigLedger starts with a calculator you can use in three minutes, with manual entry and CSV import. Pro adds official Stripe and App Store Connect sync. We will not ask for bank passwords, scrape your accounts, or file taxes for you.`

✓ 第一版会有：无需登录即可试算 Daily Floor；用 Google 保存到账号；手动录入；CSV；固定成本 / 订阅体检；现金跑道；Pro 的官方 Stripe / App Store 同步（未交付前标 Coming soon）。

× 第一版不会有：银行密码、页面抓取、代为报税、完整税务引擎、银行同步。

### 2.8 FAQ 必改条目

| 问题 | 新回答要点 |
| --- | --- |
| Does GigLedger file my taxes? | 否。用户自设预留比例；我们提供 25%–30% 的常见参考；永远是 estimate，不是税务建议，也不代申报。 |
| Does it connect to Upwork or Stripe? | **改题为** `Does it connect to Stripe or the App Store?` 回答：Pro 将提供 Stripe 与 App Store Connect 官方同步（未上线则写 Coming soon）。Upwork、PayPal、Fiverr 用 CSV。没有银行密码，没有抓取。 |
| What counts as a fixed cost? | 订阅、软件、租金、保险、主机等会重复发生的成本。一次性花费记为支出。订阅不要在支出里再记一次。删掉「not treated as deductible」这种像税务裁定的话。 |
| Can I use it outside the US? | 账本可用。预留税款由用户自设。参考范围来自常见的美国自雇做法，不是你所在地的税法。 |
| What happens to my data? | 使用「Sign in with Google」后，我们会存储你的 Google 邮箱和姓名，以及你保存的账本数据。可在设置中导出，确认后立即删除账户。详情见 Privacy。 |
| When will it launch? | 仍可说第一版开发中 / 封闭测试。不要给没有排期的具体日期。引导去试算或「Sign in with Google」，不要再引导加入等候名单。 |

### 2.9 页脚与品牌句

- `A clearer ledger for independent work.` 改为 `Daily cost and real profit for a one-person company.`（或同等短句）
- `Pre-launch preview` 在进入封闭测试前可保留。页脚不再放 Join the waitlist。

---

## 3. 要删除或改掉的说法

以下句子不得原样留在首页、FAQ、原型或 OG 描述里（繁中对等句一并改）：

| 现有说法 | 原因 | 处理 |
| --- | --- | --- |
| `Join the waitlist` 作为主 CTA，以及致谢页 `You're on the list.` | 等候名单本来就未接通；现已改为直接 Google 登录，不再收集候补邮箱 | 主 CTA 改为计算器；次 CTA 改为 `Sign in with Google`；下线 `#waitlist` 表单和致谢页 |
| `Does it connect to Upwork or Stripe? / Not in the first version.` | 与新 PRD 冲突 | 按第 2.8 节重写 |
| `No magic sync. Not yet.` + `Platform connections come later` | 同上 | 改为官方 API / 不抓取 / 不收银行密码 |
| `Monthly, quarterly, and annual views you can export for your accountant, lender, or landlord.` | 第一版只有月度 + CSV，没有季报年报和 PDF | 缩小承诺 |
| `15% planning placeholder` / `15% 規劃用預設值` | 会误导（自雇税已约 15.3%，尚未含所得稅） | 全站删除 15% 默认计算 |
| `Set aside the right amount.` | 「right」像准确税务建议 | 改为自设比例 + 参考范围 |
| `are not treated as deductible` | 第一版已去掉可抵扣标记，且像税务裁定 | 删除 |
| `A simple ledger for freelancers` 作为唯一 SEO 描述 | 定位已扩大到一人公司 / AI 创作者 | 见第 4 节 |
| 演示税额 `$620`（来源无法与公开数字对上） | 不精确 | 重算或拿掉 |
| `$30 per day` 写成 `$900 × 12 ÷ 365` 的精确结果 | 精确值是 $29.59 | 加 about，或改显示 $29.59 |
| Privacy：`It does not send or store the email address...` / `There is no account system` | Google 登录上线后不再真实 | 与 OAuth 同一天改为：会存储 Google 邮箱和姓名，并写明删除账户的方式 |
| 任何新写的用户数、评价、媒体 logo | 产品红线禁止编造社会证明 | 不要新增 |

---

## 4. SEO：title / description / 关键词方向

在没有真实用户数据和外链之前，SEO 只做诚实描述，不上假评价、不堆砌无关词。

**英文首页建议**

- Title：`GigLedger — Know your daily cost and real profit`（约 55–60 字符，可接受）
- Meta description：`See your Daily Floor in 3 minutes. Track AI subscriptions, fixed costs, and income from Stripe, the App Store, and CSV imports. True profit and runway for one-person companies. Estimates, not tax advice.`
- OG title：`Your daily cost. Your real profit.`
- OG description：`Turn AI subscriptions and fixed costs into one Daily Floor. Then see true profit and how many days of runway you have left.`
- OG alt：更新为含 Daily Floor / subscriptions / runway 的演示图说明；若替换 `og.png`，需同时改尺寸仍为 1200×630。

**关键词方向（用于标题、H1、首段自然出现，不要做隐藏堆砌）**

- 主：Daily Floor、one-person company、real profit、AI subscriptions、runway
- 次：Stripe income、App Store Connect、freelance / indie developer ledger、tax reserve estimate
- 避免：tax filing、free tax software、automatic bookkeeping that syncs every bank、伪造的 “best tax app 2026”

**技术 SEO 修补（与文案一起做）**

- 为 Privacy、Tax disclaimer 补 canonical 与 hreflang，描述写成该页自己的摘要（Privacy 不要再复用首页 freelancer 描述）。
- 原型保持 `noindex`，不进 sitemap。
- 下线 `/en/thanks`、`/zh-TW/thanks` 等候名单致谢页（或 301 回首页）。若暂时保留，必须继续 `noindex`，且不得再声称「已加入名单」。
- 修掉 `/zh-TW//app` 双斜杠。
- 若新增 `#pricing` 等锚点，导航可加 Pricing，但无价格时不要做空页。

**繁中 SEO**

在第 14 项语言决策落地前，title / description 只做与英文同步的翻译，例如：`GigLedger — 看清每日成本與真實利潤`，不要写成「台灣稅務」或「美國報稅軟體」。hreflang 维持现状，除非 Dax 决定公开渠道改为英文-only（那时再从导航和 sitemap 降级繁中，而不是悄悄删掉已收录页）。

---

## 5. 繁中页面的处理

1. 先把本文第 2–4 节的结构改动同步到 `/zh-TW/`，保持双语板块一一对应，避免一个语言已是新定位、另一个还在讲「第一版不接 Stripe」。
2. 在 Dax 决定之前，繁中页顶部或 FAQ 不要新增「本產品協助中華民國／中國大陸報稅」；税的表述与英文一致：自设比例、参考来自常见美国自雇做法、僅供預估。
3. 建议在给 Dax 的发布说明里列出两个选项（PRD 第 14 节）：  
   - A：明确写「給主要收取美元的華語一人公司」；  
   - B：公开渠道先只推英文。  
4. 语言切换链接必须正确：`/en/app` ↔ `/zh-TW/app`，修复双斜杠。
5. 不要为了「看起来完整」先翻译一套尚未决定的价格或台湾税务文案。

---

## 6. 原型 `/app` 需要的改动

营销主 CTA 将把流量直接送进 `/app`，所以这一页不能再停留在「15% 占位、没有保存入口」的演示状态。详细验收见 PRD 第 5–6 节。第一版**不**做 `localStorage` 持久化。官网相关的最低改动如下：

1. 标题改为与新 CTA 一致，例如：`See your Daily Floor in three minutes.` 副文案写明：无需登录即可试算；结果只暂存在当前页面，刷新或离开会丢失；要用「用 Google 保存」写入账号。不要写「数据先保存在本机浏览器」。
2. 增加 3 步 Onboarding：选订阅模板 → 填大概月收入和可选存款、税比例 → 立刻出 Daily Floor / 跑道 / 对照。不先弹登录墙。
3. 未登录试算仅当前页暂存，结果页必须出现丢失提示。不实现 `localStorage` 或等价的浏览器本地保存。
4. 删除 15% 占位；未设比例时做出设置入口，不显示假金额。
5. 指标区按 PRD Dashboard 层级增加跑道、本月落后/领先，税与利润分列。
6. 收入来源增加 App Store、PayPal 等；手续费支持金额或百分比；日期字段标明到账日。
7. 固定成本区增加模板、「打开产品 / 管理订阅」、下次扣费日（提醒可在后续迭代出现，但字段先留下）。
8. 保持 `noindex`，页脚可以保留 Prototype / Preview，但不要再写 “tax reserve is a 15% placeholder”。
9. 结果页必须提供可用的「用 Google 保存」（第一版就要接通 Google OAuth + D1，不得是 Coming soon 或 404）。登录失败时当前页试算仍在。已登录用户进入自己的 Dashboard。分享卡片入口未做完前可隐藏，不要放坏掉的按钮。
10. 修语言切换双斜杠。

---

## 7. Privacy 与 Tax disclaimer 同步改法

**现在不要假装已经定稿。** 可以继续保留 “Pre-launch draft”，但内容必须跟真实数据处理一致。

Google 登录上线当天，英文 Privacy 至少改成（法律实体等未定时仍可保留 “Pre-launch draft”，但数据处理必须已经真实）：

- 你使用「Sign in with Google」后，我们会存储你 Google 账号中的邮箱和姓名，以及你保存到账本的数据。
- 数据存放在 Cloudflare（含 D1）。之后若接入 Stripe / App Store 密钥，须说明加密保存与撤销方式。
- 删除账户的方式：在设置中先导出，再确认删除；确认后立即删除该账号的邮箱、姓名和账本数据，不设冷静期（若 Dax 后来改了冷静期，以 Privacy 当时写法为准）。
- 删除「不会传送或储存等候名单里的电子邮件」「目前没有账号系统」等不再真实的句子。不要为等候名单单独收集邮箱。
- 补上本页自己的 meta description、canonical、hreflang。

Tax disclaimer 建议增加一句：

`In the first version, you choose your own reserve rate. GigLedger may show a common range of 25%–30% for US self-employment planning. It does not calculate your actual federal, self-employment, or state tax, and it does not file a return.`

繁中同步改写。不要承诺「准确税额」。

---

## 8. 给 Codex 的有序任务清单

按顺序执行。Google 登录一旦开始存储邮箱、姓名或账本数据，法律页必须在同一天发布，不要先上登录再过几天补 Privacy。全程保持在 Cloudflare 免费额度内。

1. **修复缺陷**：语言切换 `/zh-TW//app` 双斜杠；核对所有内外链。原型保持 `noindex`。
2. **先做 Google OAuth + D1，以及原型试算（不用 `localStorage`），再改首页 CTA。** 完成：去掉 15%、3 分钟 Onboarding、Daily Floor 与 $29.59 口径一致、当前页暂存、「用 Google 保存」能把试算写入账号（PRD 步骤 1–3）。若 OAuth 未就绪就放「Sign in with Google」，或仍显示 15% 占位，会伤害信任。
3. 重写英文首页 Hero、勾选、主/次 CTA：主 CTA 指向 `/en/app`，次 CTA 为「Sign in with Google」。演示数字可核对，税示例不再用不明来源的 $620；$30 与公式的关系写清楚。
4. 按第 2 节改 Daily Floor 区块、功能四块、三步骤、受众顺序。
5. 新增五个内容块：AI 订阅花费、现金跑道、Stripe/App Store Coming soon、分享卡片示例、免费/Pro 能力对照（价格 TBD）。价格区放计算器或 Sign in，**不要邮箱收集表单**。
6. 重写「No magic sync」和 FAQ，删除第 3 节所列过时或危险表述，并下线等候名单相关问题导向。
7. 更新英文 title / description / OG / twitter / og:image:alt；如替换 OG 图，同时导出 1200×630。
8. 为 Privacy、Tax disclaimer 补 canonical、hreflang、独立 description；按第 7 节改税免责声明，并写明存储 Google 邮箱和姓名、删除账户的方式。
9. 把第 3–8 步同步到 `/zh-TW/` 及繁中原型、法律页；不新增未决定的本地税务市场承诺。繁中次 CTA 用「使用 Google 登入」或同等用语。
10. **下线等候名单表单与致谢页**（`#waitlist`、`/en/thanks`、`/zh-TW/thanks`，以及导航/页脚的 Join the waitlist）。**不要接通等候名单后端。** Privacy 在 Google 登录上线同一天去掉「不会存储电子邮件」。
11. 全站再搜一遍 `15%`、`quarterly`、`annual views`、`Not in the first version`、`deductible`、`bank password`、`waitlist`、`Join the waitlist`、`localStorage`、`You're on the list` 相关句，确认与 PRD 一致。
12. 用真实浏览器走一遍：英文首页 → 主 CTA → 未登录 3 分钟出 Daily Floor → 页面提示刷新会丢失 → 点「用 Google 保存」后刷新数据仍在；次 CTA「Sign in with Google」可用；繁中同样走一遍。Privacy 与真实存储一致。将检查结果写进 PR 说明。

完成定义：首页主承诺已是 Daily Floor / 一人公司 / 3 分钟可先试算；主 CTA 进计算器，次 CTA 为 Sign in with Google；不再出现 15% 占位、「第一版不接 Stripe」和等候名单；季报年报承诺已撤；Privacy 已说明存储 Google 邮箱和姓名以及删除账户方式，且不编造社会证明。未登录刷新允许丢失试算，但登录保存后刷新仍在。品牌名与域名保持 GigLedger，除非 Dax 另行决定。
