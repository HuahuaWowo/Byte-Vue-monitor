# Byte Vue Monitor 里程碑与验收记录

代码验收基线为 `6525dcb3bb818a3ea82ee73d3175d2f846c3542b`，位于 `codex/monitor-requirements-milestones`。本页将历史功能和本次开发按真实提交顺序分组，供平台填写标题、说明和起止 Commit。所有区间均包含起止提交，互不重叠。

本页是交付材料；其文档提交在上述代码基线之后，不增加功能代码，也不作为“有效功能提交”计数。原有历史未重写，未创建空提交或回填日期。

## 历史分组

### H1 建立 Vue SPA 监控原型

- 起始及结束：`b8dfa7865e9b434f3404b3d1e59c72d2e6ad3c68`。
- 独立目标：提供错误、性能、路由停留三个 hook，以及公共上报与浏览器工具，形成监控原型。
- 代码范围：index.js、lib 和 utils。
- 历史证据：根提交一次性加入原型代码。该阶段仍缺少完整包配置、可运行示例和可靠清理，不能表述为当前全部能力已经完成。

### H2 兼容可选 Vue 应用并补充原型说明

- 起始：`19eff1c5eadcdfee4e48a0a5e18391e569ec2155`。
- 结束：`6dcada206d47f66f37beb5ced6a07bc20714402b`。
- 独立目标：根据是否传入 app 决定组件错误处理器注册，同时保留全局错误监听，补充 README 和示例图片。
- 代码范围：lib/useErrorMonitor.js、README 和 example 图片。
- 历史证据：首个提交包含可选 app 的实际行为修改，后两个提交只调整图片文件名及文档，不单独认定为新增功能。

## 本次开发里程碑

### M1 建立可运行工程与独立事件上报

- 起始：`48f2a216e4ea22aa80bec0368a15a5defb6c980c`。
- 结束：`227328d0ac96a7ea223ad15f1366b87fee1ef055`。
- 关联需求：R1、R2，R6 的导入保护。
- 独立目标：把原型变成能安装和构建的项目；配置 endpoint 后，事件可独立发送到本地接收器，失败不破坏宿主。
- 交付：需求基线、包元数据及锁文件、相对导入、Vite 入口、本地接收器、最小 Vue 示例、超时和失败状态、脱敏与请求隔离。
- 验收：真实 HTTP 接收器收齐 10 个并发事件；配置非法、超时、网络失败、500 响应和过滤器异常有明确结果；无 DOM 环境可导入入口。
- 主要代码：package.json、index.js、utils/tracker.js、utils/privacy.js、example/collector.js、Vite 配置。
- 验证：`node --test tests/tracker.test.js`、`npm run build`。锁文件提交是工程可复现性工作，不冒充新增业务功能。

### M2 修复错误采集与监听生命周期

- 起始及结束：`876a7b4706be7a1acd4cc13b4f4cd982974cbc7f`。
- 关联需求：R3、R6。
- 独立目标：错误采集支持非标准错误值，并能安全停止和重新启动。
- 交付：全局 JS、Promise、Vue 和资源错误处理；多帧堆栈解析；交互路径快照；Vue 原处理器链式调用与所有权判断；匹配 capture 的监听清理。
- 验收：字符串、对象、null 拒绝原因不触发二次异常；多帧堆栈保留；重复启停不重复上报；停止后监听归零且宿主替换的 handler 不被覆盖。
- 主要代码：lib/useErrorMonitor.js、utils/error.js、utils/getLastEvent.js、utils/getSelector.js。
- 验证：`node --test tests/errors.test.js`。后续联调阶段补充了交互记录器的边界回归用例。

### M3 有限等待的性能采集与降级

- 起始及结束：`0db6b882f950cfb880d552d96c62ce2b3adf35dd`。
- 关联需求：R4、R6。
- 独立目标：即使没有首次交互或浏览器缺少某种指标，也在规定时间内得到部分性能结果。
- 交付：单次等待上限、缺失原因、LCP 和晚到 FID 更新、独立导航及资源指标、资源数量限制、显式 tracker 的接收器流量排除、隐藏与停止时统一清理。
- 验收：无输入也报告；unsupported 不崩溃；LCP 从 25 更新到 80；导航与资源的 duration 不混用；停止后 observer 和 timer 均释放。
- 主要代码：lib/usePerformance.js。
- 验证：`node --test tests/performance.test.js`。默认全局 tracker 的 endpoint 委托问题在 M5 的最终接入核对中补齐。

### M4 按成功导航结算停留时长

- 起始及结束：`cdec8a7bf8333b8e5030c374c2db2dfa159ce795`。
- 关联需求：R5、R6。
- 独立目标：停留事件对应用户实际停留的页面，取消导航、停止和恢复不会重复计时。
- 交付：afterEach 成功导航语义、首次路由处理、同 path 合并、pagehide 结算、BFCache 恢复、守卫注销及旧就绪回调隔离。
- 验收：A 停留 1000 ms 后进入 B，结果正好为 1000 ms；取消导航不重置；pagehide 后 stop 只结算一次；重启后不残留守卫。
- 主要代码：lib/usePageDuration.js。
- 验证：`node --test tests/duration.test.js`，使用可控时钟验证时长。

### M5 完成 Vue 实际接入与可复现交付

- 起始：`be57066e6ab2aca6204cdfa0a47d3a366d6d8f50`。
- 结束：`6525dcb3bb818a3ea82ee73d3175d2f846c3542b`。
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

## 提交平台时仍需完成

当前交付完成仓库代码与材料，并未执行平台准入或质量评分。平台 URL 为 https://www.talents-ai.com/expert/items/209/activity/218849。

- 截图要求私有仓库，当前目标仍为公开仓库；需要确定私有提交仓库或调整可见性。
- 选择包含上述代码基线的分支或版本。main 仍保留原代码；不要误将 main 当成本次交付版本。
- 平台只检查上传时冻结的版本；旧检查已耗尽尝试次数，是否可重开需以平台界面为准。
- 准入通过后运行 Repo 检查，按上述实际区间填写 Milestone，再运行 Milestone 检查并填写五条 TODO。
- 提交数、有效 LOC、里程碑个数的具体门槛未提供，因此不能保证平台通过，也没有伪造“已通过”结论。
