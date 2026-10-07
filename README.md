# Byte Vue Monitor

面向 Vue 3 单页面应用的浏览器监控 SDK：采集 JavaScript、Promise、Vue 和资源错误，观察页面与资源性能，记录成功路由跳转前的停留时长。提供可配置上报、停止与重启、默认参数脱敏，以及可运行的 Vue 示例和本地事件接收器。

当前版本为 0.2.0；保留原项目的三个 hook 名称，修复原型中的导入、上报并发、监听清理、性能等待及路由计时问题。项目没有发布到 npm，不能直接假定 `npm install byte-vue-monitor` 可用。

## 快速运行

需要 Node.js **22.12 或更新版本**和 npm。依赖由 `package-lock.json` 锁定；示例使用 Vue 3.5.43、Vue Router 4.6.4 和 Vite 8.3.3。

```sh
git clone --branch codex/monitor-functional-history https://github.com/HuahuaWowo/Byte-Vue-monitor.git
cd Byte-Vue-monitor
npm ci
npm run dev
```

打开 **http://127.0.0.1:4173**：

1. 页面默认启动三个监控模块，约 1 秒后出现性能记录。
2. 点击四个错误按钮，分别看到 `javascript`、`promise`、`vue` 和资源错误。
3. 点击“进入详情页”，看到上一页的 `page-duration`；“尝试被取消的导航”不会提前结算。
4. 展开事件查看接收器实际收到的 JSON。
5. 点击“停止监控”后再触发事件，采集停止；路由模块在停止时对最后一段停留结算一次。点击“启动监控”可重新开始。

示例中的 JS 和 Promise 错误是人为触发的，浏览器控制台出现对应异常是预期行为。SDK 不调用 `preventDefault` 隐藏它们。

接收器与示例同源，默认只监听本机。若端口被占用，先停止占用 4173 的开发服务；配置使用 strictPort，不会悄悄切到其他端口。

## 在 Vue 应用中接入

可复制本仓库的 `index.js`、`lib/`、`utils/` 到应用内同一目录，然后通过相对路径导入。也可以在应用里执行 `npm install /绝对路径/Byte-Vue-monitor`，并从 `byte-vue-monitor` 导入。默认导出入口是 ESM 源码，由宿主构建工具处理。

```js
import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import {
  createTracker, useErrorMonitor, usePerformance, usePageDuration,
} from './monitor/index.js';
import App from './App.vue';
import Home from './Home.vue';
import Details from './Details.vue';

const app = createApp(App);
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/details', component: Details },
  ],
});
const tracker = createTracker({
  endpoint: '/telemetry/events', // 替换为宿主服务实际存在的接收接口
  timeout: 5000,
  allowedQuery: ['campaign'],
  beforeSend(event) {
    // 同步过滤业务数据；返回 null 可丢弃整个事件
    return event;
  },
});
const errors = useErrorMonitor(app, { tracker });
errors.start();
app.use(router);
await router.isReady();
const performance = usePerformance({ tracker, maxWait: 5000 });
const duration = usePageDuration(router, { tracker });
app.mount('#app');

// 应用销毁时：先停采集，等待已发起请求结束，再释放上报器。
async function disposeMonitor() {
  errors.stop();
  performance.stop();
  duration.stop();
  await tracker.flush();
  tracker.destroy();
}
```

宿主负责调用清理函数，组件内使用时可注册到 `onUnmounted`。同一应用建议只建立一套全局监控实例。监控实例的重复 start、重复 stop 都安全。

## 上报器 API

`createTracker(options)` 创建独立上报器；`configureMonitor(options)` 配置三个 hook 共用的默认上报器，并返回同样的实例。重新配置默认上报器会销毁旧上报器；显式传入 `tracker` 的 hook 不受默认配置变化影响。使用默认方式时应先配置，再启动 hook。

| 配置 | 默认值 | 行为 |
| --- | --- | --- |
| endpoint | 必填 | HTTP(S) 地址，可相对于当前页面；空地址、其他协议和内嵌凭据会抛出初始化错误 |
| timeout | 5000 | 每个请求的超时毫秒数，必须为正数 |
| allowedQuery | [] | URL 查询参数和路由 query 的允许字段 |
| allowedParams | [] | 路由 params 的允许字段 |
| maxStringLength | 2000 | 单个字符串的最大字符数，必须为正整数 |
| beforeSend | 无 | 同步过滤器，接收已脱敏对象；返回 null 丢弃，返回对象继续上报 |
| debug | false | 开启后只记录发送状态，不打印事件载荷 |
| environment | globalThis | 用于测试或特殊运行环境的浏览器 API 容器 |

`send(event, { beacon: false })` 返回 Promise，失败不会向宿主抛出未处理拒绝。正常发送使用独立 fetch 和 AbortController，默认 `credentials: 'omit'`。传入 `beacon: true` 时优先尝试 sendBeacon，队列拒绝或不支持时回退到 keepalive fetch。跨域接收服务需要自行配置 CORS。

结果可能为：

- `{ ok: true, status: 202 }`：HTTP 接收成功。
- `{ ok: true, queued: true }`：浏览器接受 beacon 排队，不表示服务器已收到。
- `{ ok: false, reason }`：reason 包括 http、network、timeout、aborted、unsupported、filtered、serialization、payload-too-large、destroyed；默认上报器未配置时为 not-configured。

`flush()` 等待调用时已发起的请求结束；`destroy()` 禁止后续发送并中止在途请求；`getStats()` 返回 sent、failed、dropped、pending 计数。没有自动重试、离线缓存或服务端确认重放。

## 三个监控 hook

三个返回值都可使用 `[start, stop]` 解构，也提供 `.start()` 和 `.stop()`。start 返回是否成功启动；无浏览器环境返回 false。仅导入模块不会注册监听或发送数据。

| hook | 参数 | 启动及停止 |
| --- | --- | --- |
| useErrorMonitor | 可选 app；第二参数为 { tracker, autoStart, environment } | 默认手动 start；autoStart=true 自动启动；stop 移除全部监听并在仍持有处理器时恢复 Vue 原 handler |
| usePerformance | { tracker, maxWait, maxResources, autoStart, environment } | 默认自动启动；maxWait 默认 5000；maxResources 默认每次启动最多 100 条；还有 flush() 手动采集 |
| usePageDuration | Vue Router 4 实例；第二参数为 { tracker, autoStart, environment } | 默认自动启动；stop 结算当前停留并注销 afterEach、pagehide 和 pageshow |

错误事件支持非 Error 类型的 Promise 拒绝、空堆栈、Chrome/Firefox 形态的多帧堆栈、无组件实例和资源加载失败。交互定位只保留最近交互的标签路径，不采集输入值、按键内容、DOM id 或 class；该路径可能无法唯一定位元素。

性能采集在等待上限到达时发送已有指标，缺失值为 null，`missing` 记录 not-observed、unsupported 或 unavailable。LCP 候选值与晚到的 FID 可触发更新事件；事件按 `phase` 区分 timeout、update、manual、hidden 或 pagehide。页面隐藏或离开时发送最终可用快照并停止，恢复后需显式重新启动性能模块；stop 自身只清理资源，不额外发送性能快照。

路由统计使用成功导航后的 afterEach，忽略取消和失败。首次导航不报告虚假的来源页。同一 path 的参数变化不拆分会话；实际 path 改变则结算。时长基于单调时钟，包含后台时间；pagehide 与 stop 不重复结算。BFCache 的 pageshow 恢复会开启新一段路由停留。

## 事件字段与指标

公共字段为 `schemaVersion: 1`、`sdkVersion`、`timestamp`（Unix 毫秒）、`url`、`userAgent` 和 `kind`。URL 默认移除用户名密码、查询参数和 hash。

| kind | 主要业务字段 |
| --- | --- |
| error | type、name、message、stack；视来源增加 filename、line、column、component、lifecycleHook、resourceName 或 selector |
| performance | phase、FP、FCP、LCP、FID、navigation、missing、unit |
| resource | resourceName、initiatorType 和独立的资源 timing 数据 |
| page-duration | path、name、query、params、duration、reason、unit |
| custom | 使用 send 自定义的业务字段 |

示例载荷：

```json
{
  "kind": "page-duration",
  "path": "/details",
  "name": "details",
  "query": {},
  "params": {},
  "duration": 1200,
  "unit": "ms",
  "reason": "navigation",
  "schemaVersion": 1,
  "sdkVersion": "0.2.0",
  "timestamp": 1791345600000,
  "url": "https://example.test/",
  "userAgent": "Chrome/140.0"
}
```

示例中数值用于说明字段，不代表实测结果。上报时公共 url 是发生结算时的页面地址；page-duration 的 path 标明被结算的上一页。

所有耗时单位为毫秒且为 number：

| 指标 | 定义 |
| --- | --- |
| FP / FCP | paint 条目的 startTime |
| LCP | 已观察到的最新最大候选 startTime，持续到页面隐藏或离开 |
| FID | 首个 first-input 的 processingStart − startTime；无输入时为 null |
| DNS | domainLookupEnd − domainLookupStart |
| TCP | connectEnd − connectStart |
| TLS | connectEnd − secureConnectionStart；没有 TLS 时间时为 null |
| TTFB | responseStart − startTime，包含请求前阶段 |
| request | responseEnd − requestStart |
| redirect | redirectEnd − redirectStart |
| DCL | domContentLoadedEventEnd − domContentLoadedEventStart |
| onLoad | loadEventEnd − startTime；尚未完成时为 null |

导航和资源条目分别读取；资源数据不借用页面导航数据。不把 transferSize=0 直接断言为缓存命中，因为跨域时间限制也可能导致字段为零。此版本保留原型的 FID 指标，未实现完整 Web Vitals 指标集。

## 隐私与边界

默认去除 query、params、URL 凭据和片段。白名单也不能重新允许 token、password、cookie、secret 等敏感字段名；自定义过滤后再次应用此边界。字符串默认最多 2000 字符，递归深度最多 6 层，单层对象或数组最多 50 项，序列化载荷超过 60000 字节则丢弃。

错误文本和路径本身仍可能包含业务敏感信息，接入方应通过 beforeSend 实施业务脱敏；SDK 不承诺识别任意自然语言中的秘密。默认不使用 cookies、localStorage 或用户身份标识。

已验证当前机器的 Chrome；其他浏览器根据 API 能力降级，不宣称已完整测试。SDK 运行依赖现代 fetch、AbortController、URL 等基础 API。SSR 仅保证导入安全及启动返回 false。不会跨来源自动合并 Vue 错误和全局错误。

## 本地接收器

`example/collector.js` 只接收示例数据，挂载在 Vite 开发服务器：

- `POST /__monitor/events`：application/json，kind 为字符串，成功返回 202。
- `GET /__monitor/events`：查看最多 1000 条内存事件。
- `DELETE /__monitor/events`：清空示例记录。
- 请求最多 64 KiB，非法 JSON、方法或媒体类型返回明确的错误码。

不提供认证、数据库和生产部署。页面按钮“清空本地记录”只清空这个接收器。构建后的静态示例仍需配套接收服务；直接双击 HTML 不能替代 npm run dev。

## 开发与验证

```sh
npm run check          # 解析所有自有 JS 模块
npm test               # Node 单元测试和真实 HTTP 并发上报测试
npm run test:coverage  # 仅统计 lib 与 utils，不把测试代码算入覆盖率
npm run build          # dist/ SDK 与 demo-dist/ 示例
npx playwright install chromium
npm run test:e2e       # 自动启动本机示例，执行真实浏览器联调
npm run verify        # 检查、测试、构建和浏览器验证
```

若希望使用机器上已有的 Chrome：

```sh
PLAYWRIGHT_CHANNEL=chrome npm run verify
```

CI 在 Node 22、Linux 和 Playwright Chromium 上执行相同验证，结果以 GitHub Actions 实际运行状态为准。测试刻意触发的错误会保留在日志中，不应直接将这些预期日志判定为测试失败。

## 目录

```text
index.js                   对外入口
lib/                       错误、性能、路由停留 hook
utils/                     上报、脱敏、错误解析、交互与生命周期工具
example/                   Vue 示例、本地接收器及原型截图
tests/                     回归测试及 browser 联调用例
scripts/check.mjs          全部 JS 语法检查
docs/REQUIREMENTS.md        需求及基线问题
docs/MILESTONES.md          提交区间、验收与后续 TODO
.github/workflows/ci.yml    持续集成
```

实现参考：[Vue Router 导航守卫](https://router.vuejs.org/guide/advanced/navigation-guards.html)、[PerformanceObserver](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver/observe)、[sendBeacon](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon)。

详细交付结果、已完成里程碑和下一步工作见 [Milestones](docs/MILESTONES.md)。平台准入检查有独立门槛，不能用本地测试结果替代平台结论。
