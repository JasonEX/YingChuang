# 萤窗 YingChuang

[![User script generation](https://github.com/JasonEX/YingChuang/actions/workflows/build-and-push.yml/badge.svg)](https://github.com/JasonEX/YingChuang/actions/workflows/build-and-push.yml)

> 萤窗雪案——借一点萤光，安静读书。

萤窗是一个小说阅读 UserScript：在章节页上识别正文，换成干净、统一的阅读界面，并连续加载后续章节。

## 功能

- **智能正文识别**：通用检测器自动识别章节正文、标题与上下章链接，另有 15 个常见站点的内置规则。
- **连续阅读**：滚动到底自动加载下一章，也可以手动翻章。
- **阅读位置恢复**：重新打开读过的章节时，回到上次读到的位置（保留最近 200 章）。
- **目录与离线阅读**：目录抽屉支持搜索章节，可将全书缓存下来离线阅读。
- **排版定制**：主题、字体、字号、行距、字间距、段落缩进、内容宽度与页面边距，支持自定义 CSS。
- **简繁转换**：原文 / 简体 / 繁體 一键切换。简体模式保留“著、沈”等歧义写法（例如“看著”），不作词语、人名的语义纠正或日文字形修补。
- **内容清理**：内置广告与杂讯清理，可按站点添加自定义正则。
- **网站防护**：拦截弹窗与恶意跳转、移除遮罩层，恢复右键、选中与复制；分「标准」「强力」两档。
- **按站点自动进入**：可设置在某个站点直接进入阅读模式。

## 安装

1. 先安装 [Tampermonkey](https://www.tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/)。
2. 打开 [YingChuang.user.js][install_github]，扩展会自动提示安装。之后会从 GitHub 自动更新。

萤窗是全新的脚本，与旧版 My Novel Reader 互不相关，可以并存；旧版的设置与阅读进度不会迁移。

## 使用

打开小说章节页，检测到正文后右下角会出现「进入阅读模式」按钮；也可以在油猴菜单中选择「进入阅读模式」。

| 按键                  | 功能            |
| --------------------- | --------------- |
| `←` / `P`，`→` / `N`  | 上一章 / 下一章 |
| `空格` / `Shift+空格` | 向下 / 向上翻屏 |
| `↑` / `↓`             | 滚动            |
| `C`                   | 打开目录        |
| `S` / `,`             | 打开设置        |
| `Esc`                 | 关闭目录 / 设置 |
| `Enter`               | 返回本书目录页  |
| `Q`                   | 退出阅读模式    |

键盘导航可在设置中关闭；触屏设备可开启「左右滑动翻屏」。

自定义 CSS 导致界面无法操作时，可在油猴菜单中选择「清空自定义 CSS」。

遇到识别错误或站点问题，请在油猴菜单中选择「复制诊断信息」，附在 [Issue](https://github.com/JasonEX/YingChuang/issues) 里。

### 本地构建

- 运行 `npm install && npm run build`，油猴在"从文件安装"中选择 `scripts/YingChuang.user.js`。
- 开发调试可执行 `npm run dev` 持续构建，然后在油猴中指向同一文件。

## 开发

### 环境要求

- Node.js 22.22+ 或 24.15+（CI 使用 Node 24）
- npm（建议 10+）

### 技术栈

- **构建工具**: Vite 8 + vite-plugin-monkey
- **前端框架**: Vue 3 (Composition API) + Pinia
- **语言**: TypeScript 6
- **测试框架**: Vitest (jsdom) + Playwright（E2E）
- **代码规范**: ESLint + Prettier + lint-staged（Husky pre-commit）

### 常用命令

```bash
npm install                  # 安装依赖并安装 Husky 钩子
npm run dev                  # 监听文件变化自动构建到 scripts/
npm run build                # 生产构建，生成 scripts/YingChuang.user.js
npm run check:size           # 检查用户脚本原始与 gzip 体积预算
npm run profile:performance  # 生成本地压力场景 Chrome CPU Profile
npm run profile:performance:real # 额外生成真实站点启动 Profile
npm test                     # 运行全部单测（watch）
npm run test:run             # 单次运行全部单测
npm run test:coverage        # 生成 coverage 报告（已在 .gitignore）
npm run e2e:warmup           # 打开持久化浏览器 profile，手动通过 Cloudflare 后自动保存会话
npm run e2e:smoke            # 构建并在真实章节页注入脚本，验证阅读器实际渲染
npm run e2e:smoke:headed     # 有些站点不信任 headless 时，用有界面浏览器跑同一套 smoke
npm run e2e:smoke:cdp        # 连接已开启远程调试端口的真实 Chrome 会话做 smoke
npm run e2e:local            # 构建并运行本地固定页面 smoke
npm run lint                 # 基础语法检查
npm run lint:strict          # 不允许有 warnings
npm run lint:fix             # 自动修复可修复的 lint 问题
npm run typecheck            # TypeScript 类型检查（noEmit）
npm run typecheck:tests      # 测试代码 TypeScript 类型检查
npm run validate             # 完整本地验证（与 CI 一致）
npm run format               # Prettier 全量格式化
npx vitest run tests/unit/xxx.test.ts  # 运行单个测试
```

### 真实站点 E2E 测试

默认目标是一个可公开访问的章节页。切换目标站点时设置 `MNR_E2E_URL`：

```bash
MNR_E2E_URL="https://example.com/book/1/2.html" npm run e2e:warmup
MNR_E2E_URL="https://example.com/book/1/2.html" npm run e2e:smoke
```

`e2e:warmup` 会打开 Playwright 的持久化 Chromium profile。如果页面出现 Cloudflare
或站点验证，人工在弹出的浏览器里完成一次即可；脚本检测到目标页可读后会自动关闭浏览器并保留
cookie/profile。之后 `e2e:smoke` 会复用同一个 profile，自动构建、注入
`scripts/YingChuang.user.js`、断言阅读器 Shadow DOM 已挂载、正文长度达标、原页面已隐藏、
样式已注入，并保存截图到 `.test/mnr-e2e/`。

如果站点明显识别 Playwright 默认浏览器，可以改用真实 Chrome 的 CDP 会话。先在
Windows 启动一个独立 profile 的 Chrome：

```bash
"/mnt/c/Program Files/Google/Chrome/Application/chrome.exe" \
  --remote-debugging-port=9222 \
  --user-data-dir="C:\\temp\\mnr-cdp-profile"
```

在打开的 Chrome 里人工通过站点验证后，再从 WSL 运行：

```bash
MNR_E2E_CDP_ENDPOINT="http://127.0.0.1:9222" \
MNR_E2E_URL="https://example.com/book/1/2.html" \
npm run e2e:smoke:cdp
```

常用环境变量：

- `MNR_E2E_URL`：目标章节页，默认 `https://www.ciweimao.com/chapter/102930784`
- `MNR_E2E_PROXY`：显式代理；未设置时会读取 `HTTPS_PROXY` / `HTTP_PROXY`
- `MNR_E2E_PROFILE_DIR`：持久化浏览器 profile，默认 `.test/mnr-e2e-profile`
- `MNR_E2E_CDP_ENDPOINT`：真实 Chrome 的 CDP 地址，例如 `http://127.0.0.1:9222`
- `MNR_E2E_HEADLESS=false`：用有界面浏览器跑 smoke；等价于常用场景下的 `npm run e2e:smoke:headed`
- `MNR_E2E_MIN_CONTENT_CHARS`：阅读器正文最少字符数断言，默认 `1000`
- `MNR_E2E_USERSCRIPT`：注入的脚本路径，默认 `scripts/YingChuang.user.js`
- `MNR_E2E_ARTIFACT_DIR`：截图等产物目录，默认 `.test/mnr-e2e`
- `MNR_E2E_USER_AGENT`：覆盖浏览器 User-Agent
- `MNR_E2E_READER_TIMEOUT_MS` / `MNR_E2E_WARMUP_TIMEOUT_MS`：阅读器挂载与预热的超时

### 项目结构

```
├── src/
│   ├── index.ts             # 入口文件
│   ├── bootstrap.ts         # 启动逻辑
│   ├── meta.ts              # UserScript 元数据
│   ├── version.ts           # 版本号
│   ├── env.d.ts             # Vite/TS 全局类型
│   ├── core/                # 核心逻辑
│   │   ├── auto-enable/     # 自动启用相关
│   │   ├── constants/       # 常量
│   │   ├── detection/       # 智能内容检测
│   │   │   ├── ContentDetector.ts    # 内容检测器
│   │   │   ├── NavigationDetector.ts # 导航检测
│   │   │   ├── TitleDetector.ts      # 标题检测
│   │   │   ├── ChapterDocumentClassifier.ts # 章节页分类
│   │   │   └── ConfidenceScorer.ts   # 置信度评分
│   │   ├── parser/          # 内容解析
│   │   ├── converter/       # 繁简转换
│   │   ├── rules/           # 站点规则（sites/ 为内置规则）
│   │   ├── protection/      # 网站防护
│   │   ├── debug/           # 诊断信息
│   │   └── utils/           # 工具函数
│   ├── ui/                  # UI
│   │   ├── components/      # 组件
│   │   ├── composables/     # 组合式逻辑
│   │   └── stores/          # Pinia stores
│   └── typings/             # 类型定义
├── tests/
│   ├── unit/                # Vitest 单元测试
│   ├── e2e/                 # Playwright E2E（本地固定页面 + 真实站点）
│   └── testUtils/           # 测试辅助
├── scripts/                 # 构建输出 YingChuang.user.js（由 CI 提交）
└── coverage/                # 覆盖率输出（忽略提交）
```

### 注意事项

- 新增站点适配或较大改动时，提交前运行 `npm run validate`（与 CI 相同的完整校验）。

## 致谢

萤窗在 [ywzhaiqi][ywzhaiqi_github] 的 My Novel Reader 及 [821938089][upstream_github] 的维护版本基础上完全重写。感谢原作者与历代贡献者。

## 许可证

本项目以 [GPL-3.0-only](LICENSE) 发布。

[ywzhaiqi_github]: https://github.com/ywzhaiqi/userscript
[upstream_github]: https://github.com/821938089/MyNovelReader
[install_github]: https://raw.githubusercontent.com/JasonEX/YingChuang/master/scripts/YingChuang.user.js
