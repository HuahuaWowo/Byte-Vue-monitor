# Byte Vue Monitor

Vue 3 SPA 监控 SDK。当前分支按阶段完善错误、性能与路由停留采集。

## 本地运行

需要 Node.js 22.12 或更高版本。

```sh
npm ci
npm run dev
```

打开 http://127.0.0.1:4173，点击“发送测试事件”。本地接收器位于 `/__monitor/events`，只用于演示，重启后记录清空。

```sh
npm test
npm run check
npm run build
```

## 独立上报

```js
import { createTracker } from './index.js';
const tracker = createTracker({ endpoint: 'https://your-collector.example/events' });
const result = await tracker.send({ kind: 'custom', message: 'hello monitor' });
await tracker.flush();
tracker.destroy();
```

上报失败返回状态，不自动重试。默认去除 URL 查询与片段、用户名密码及路由参数；允许采集字段使用 `allowedQuery`、`allowedParams` 白名单。任意错误文本仍应通过同步 `beforeSend` 过滤业务敏感信息。

[需求及里程碑](docs/REQUIREMENTS.md)

## 原型能力

## 错误监控

### useErrorMonitor
* 全局同步监控(可选)
* JsError
* PromiseError

![](https://github.com/HuahuaWowo/Byte-Vue-monitor/raw/main/example/globalJsErrorCapture1.png)

![](https://github.com/HuahuaWowo/Byte-Vue-monitor/raw/main/example/componentMonitor.png)

## 性能监控

### usePerformance
* FP
* FCP
* LCP
* FID
* DNS连接时长
* TTFB
* DCL
* .....

![](https://github.com/HuahuaWowo/Byte-Vue-monitor/raw/main/example/performanceMonitor1.png)

## 页面停留时长

### usePageDuration
![](https://github.com/HuahuaWowo/Byte-Vue-monitor/raw/main/example/globalPageStay1.png)
