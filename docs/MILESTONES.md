# Byte Vue Monitor 里程碑与验收记录

本分支 `codex/monitor-functional-history` 将辅助性的文档、图片和锁文件变更合并到相关功能提交中。现有源码与整理前保持一致；原分支及备份保留，此次整理不代表新增开发量。下列区间按本分支实际祖先链列出，均包含起止提交。

M5 的结束提交包含本页，故用唯一标题定位；执行 `git log -1 --format=%H --grep='^fix: exclude collector traffic with the default tracker$'` 获取其完整 SHA。交付索引也提供完整区间。

## 历史分组

### H1 建立 Vue SPA 监控原型

- 起始及结束：`b8dfa7865e9b434f3404b3d1e59c72d2e6ad3c68`。
- 独立目标：提供错误、性能、路由停留三个 hook，以及公共上报与浏览器工具，形成监控原型。
- 代码范围：index.js、lib 和 utils。
- 历史证据：根提交一次性加入原型代码。该阶段仍缺少完整包配置、可运行示例和可靠清理，不能表述为当前全部能力已经完成。

### H2 兼容可选 Vue 应用并补充原型说明

- 起始：`e2bc6db5325b9343ef24a3dbc96bde460fc675cc`。
- 结束：`e2bc6db5325b9343ef24a3dbc96bde460fc675cc`。
- 独立目标：根据是否传入 app 决定组件错误处理器注册，同时保留全局错误监听，补充 README 和示例图片。
- 代码范围：lib/useErrorMonitor.js、README 和 example 图片。
- 历史证据：该提交包含可选 app 的实际行为修改，原来的图片文件名和文档调整已合并到该功能提交。

## 本次开发里程碑

### M1 建立可运行工程与独立事件上报

- 起始：`1ba5df9680ab3dd2b772843bd920ccbe59e29237`。
- 结束：`1ba5df9680ab3dd2b772843bd920ccbe59e29237`。
- 关联需求：R1、R2，R6 的导入保护。
- 独立目标：把原型变成能安装和构建的项目；配置 endpoint 后，事件可独立发送到本地接收器，失败不破坏宿主。
- 交付：需求基线、包元数据及锁文件、相对导入、Vite 入口、本地接收器、最小 Vue 示例、超时和失败状态、脱敏与请求隔离。
- 验收：真实 HTTP 接收器收齐 10 个并发事件；配置非法、超时、网络失败、500 响应和过滤器异常有明确结果；无 DOM 环境可导入入口。
- 主要代码：package.json、index.js、utils/tracker.js、utils/privacy.js、example/collector.js、Vite 配置。
- 验证：`node --test tests/tracker.test.js`、`npm run build`。锁文件随本次工程初始化的功能代码一并提交，不单独计作功能。

### M2 修复错误采集与监听生命周期

- 起始及结束：`125dabec3c0a8f965d675f8024f24ecdf2ee74e7`。
- 关联需求：R3、R6。
- 独立目标：错误采集支持非标准错误值，并能安全停止和重新启动。
- 交付：全局 JS、Promise、Vue 和资源错误处理；多帧堆栈解析；交互路径快照；Vue 原处理器链式调用与所有权判断；匹配 capture 的监听清理。
- 验收：字符串、对象、null 拒绝原因不触发二次异常；多帧堆栈保留；重复启停不重复上报；停止后监听归零且宿主替换的 handler 不被覆盖。
- 主要代码：lib/useErrorMonitor.js、utils/error.js、utils/getLastEvent.js、utils/getSelector.js。
- 验证：`node --test tests/errors.test.js`。后续联调阶段补充了交互记录器的边界回归用例。

### M3 有限等待的性能采集与降级

- 起始及结束：`86e93000bfebd5b4dfa81478a9362f4dd29230f4`。
- 关联需求：R4、R6。
- 独立目标：即使没有首次交互或浏览器缺少某种指标，也在规定时间内得到部分性能结果。
- 交付：单次等待上限、缺失原因、LCP 和晚到 FID 更新、独立导航及资源指标、资源数量限制、显式 tracker 的接收器流量排除、隐藏与停止时统一清理。
- 验收：无输入也报告；unsupported 不崩溃；LCP 从 25 更新到 80；导航与资源的 duration 不混用；停止后 observer 和 timer 均释放。
- 主要代码：lib/usePerformance.js。
- 验证：`node --test tests/performance.test.js`。默认全局 tracker 的 endpoint 委托问题在 M5 的最终接入核对中补齐。

### M4 按成功导航结算停留时长

- 起始及结束：`71f1188102da10205b0ada5c5189cb25d927e27d`。
- 关联需求：R5、R6。
- 独立目标：停留事件对应用户实际停留的页面，取消导航、停止和恢复不会重复计时。
- 交付：afterEach 成功导航语义、首次路由处理、同 path 合并、pagehide 结算、BFCache 恢复、守卫注销及旧就绪回调隔离。
- 验收：A 停留 1000 ms 后进入 B，结果正好为 1000 ms；取消导航不重置；pagehide 后 stop 只结算一次；重启后不残留守卫。
- 主要代码：lib/usePageDuration.js。
- 验证：`node --test tests/duration.test.js`，使用可控时钟验证时长。

### M5 完成 Vue 实际接入与可复现交付

- 起始：`376184034f3f2af9bd7586be6b7c7e55f379fcb8`。
- 结束：标题为 `fix: exclude collector traffic with the default tracker` 的最终提交（完整 SHA 获取方法见开头）。
- 关联需求：R7，联调 R1 至 R6。
- 独立目标：新使用者能够从 README 运行示例，并实际验证三条采集链路、停止及重启。
- 交付：完整 Vue 演示页、真实浏览器测试、CI 配置、完整 API 和边界文档、SDK 专用覆盖率统计。联调修正了示例资源错误的 DOM 传播及默认 tracker 的接收器请求排除。
- 验收：四种错误均到达接收器且页面显示记录；无交互时收到性能数据；真实 Vue Router 的取消导航不误记；停止后不采集、重启后恢复且无重复事件。
- 主要代码：example、tests/browser、playwright.config.js、.github/workflows/ci.yml、README、默认 tracker 委托。
- 验证：重新安装锁定依赖后，`PLAYWRIGHT_CHANNEL=chrome npm run verify` 全部通过。

## 需求与代码覆盖关系

| 需求 | 业务模块 | 验证证据 |
| --- | --- | --- |
| R1 | 包入口、工程配置、Vue 示例、接收器 | 全量构建、真实浏览器采集与 UI 事件展示 |
| R2 | tracker、privacy、collector | tracker.test.js 的真实 HTTP 并发、失败、过滤、beacon 与配置用例 |
| R3 | useErrorMonitor、error、getLastEvent、getSelector | errors.test.js 及浏览器四种错误事件 |
| R4 | usePerformance | performance.test.js 及浏览器无交互、请求反馈排除场景 |
| R5 | usePageDuration | duration.test.js 及真实 Router 成功和取消导航 |
| R6 | 三个 hook 的 start/stop、环境保护 | 无 DOM 导入、重复启停、所有权恢复、守卫和观察器清理 |
| R7 | README、CI、测试与示例 | 干净安装后的完整验证及 SDK 覆盖率报告 |

## 验证结果

2026 年 10 月 7 日，在 macOS、Node.js v22.23.2、npm 10.9.8、Chrome 154.0.8037.98 上完成：

| 检查 | 结果 |
| --- | --- |
| 按 package-lock 重新安装 | npm ci --ignore-scripts --offline 成功；使用本次安装所得的官方包缓存 |
| 自有 JavaScript 解析 | 23 / 23 模块通过 |
| Node 单元及 HTTP 测试 | 23 / 23 通过 |
| 真实 Chrome 联调 | 3 / 3 通过 |
| SDK 构建 | 成功，dist/byte-vue-monitor.js |
| Vue 示例构建 | 成功，demo-dist/ |
| SDK 行覆盖率 | 99.40% |
| SDK 分支覆盖率 | 84.06% |
| SDK 函数覆盖率 | 88.31% |

覆盖范围只包含 lib 和 utils，排除了测试代码。未覆盖分支仍存在，尤其是浏览器 observer 失败和自定义异常路径；覆盖率不是没有缺陷的证明。远端 CI 的 Linux Chromium 执行结果需以 GitHub Actions 实际状态为准。

代码规模按该基线统计：SDK 为 11 个 JS 文件、507 个物理行、500 个非空行；包含示例、测试和配置的自有 JS 为 23 个文件、1084 个物理行、1067 个非空行。非空行仍包含注释；没有把锁文件、生成产物、图片、文档或第三方依赖计入这些数字。这不是平台的有效 LOC 计算结果。

## 下一步 TODO

以下内容均未实现，可作为平台“下一步 TODO”的五条内容：

1. 在 lib/usePerformance.js 增加 INP 和 CLS 采集与对应事件契约，覆盖交互分组、布局偏移会话窗口及浏览器不支持时的降级，用合成 performance entries 和真实浏览器用例验证。
2. 为 utils/tracker.js 设计有容量和过期限制的批量队列与失败重试，引入事件标识和退避策略，明确页面退出时的投递边界；验收断网恢复不无限重试、不超过队列上限。
3. 为 utils/error.js 增加可选 Source Map 还原适配接口，保留原始位置与还原位置，支持映射缺失和版本不匹配的回退；通过固定压缩脚本与映射样例验证。
4. 将性能采集的 BFCache 恢复行为从手动重启扩展为可配置自动恢复，区分首次加载与恢复会话，增加真实前进后退测试，保证恢复后不会重复发送上一会话的资源条目。
5. 提供 index.d.ts 和类型消费测试，约束三个 hook、tracker 配置、事件载荷与发送状态的类型；同时增加 Firefox 与 WebKit 联调矩阵，按测试结果更新 README 的支持范围。

## 验证边界

以上记录是源码、Git 差异及本地测试证据。平台的有效提交认定、代码规模和其他准入条件仍由平台独立核对。应选择本分支并核对冻结 HEAD；其他分支的历史及评分不能作为当前版本结论。
