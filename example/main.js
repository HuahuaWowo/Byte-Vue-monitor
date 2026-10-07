import { createApp, h, onMounted, onUnmounted, ref } from "vue";
import { createRouter, createWebHistory, RouterView } from "vue-router";
import { createTracker, useErrorMonitor, usePerformance, usePageDuration } from "../index.js";
import "./style.css";

const tracker = createTracker({ endpoint: "/__monitor/events" });
const router = createRouter({ history: createWebHistory(), routes: [
  { path: "/", name: "overview", component: { render: () => h("p", { class: "route-copy" }, "概览页 · 跳转到详情页即可结算本页停留时长。") } },
  { path: "/details", name: "details", component: { render: () => h("p", { class: "route-copy" }, "详情页 · 返回概览页，可查看刚才的停留记录。") } },
  { path: "/blocked", component: { render: () => h("p", "This route is cancelled.") } },
] });
router.beforeEach(to => to.path === "/blocked" ? false : undefined);
let monitors = [];
const running = ref(false);
const events = ref([]);
const status = ref("等待事件");
let app;
function start() {
  if (running.value) return;
  const errors = useErrorMonitor(app, { tracker });
  errors.start();
  monitors = [errors, usePerformance({ tracker, maxWait: 1000 }), usePageDuration(router, { tracker })];
  running.value = true;
}
function stop() {
  for (const monitor of monitors) monitor.stop();
  monitors = [];
  running.value = false;
}
async function refresh() {
  try {
    const response = await fetch("/__monitor/events");
    if (!response.ok) throw Error("collector unavailable");
    events.value = (await response.json()).reverse();
    status.value = "本地接收器已连接";
  } catch { status.value = "接收器不可用，请使用 npm run dev 启动"; }
}
function button(text, onClick, className = "") {
  return h("button", { onClick, class: className }, text);
}
app = createApp({
  setup() {
    let refreshTimer;
    onMounted(() => {
      start();
      refresh();
      refreshTimer = setInterval(refresh, 500);
    });
    onUnmounted(() => { clearInterval(refreshTimer); stop(); tracker.destroy(); });
    return () => h("main", [
      h("header", [
        h("div", [h("p", { class: "eyebrow" }, "DEVELOPER LAB / 0.2"), h("h1", "Byte Vue Monitor"), h("p", { class: "subtitle" }, "触发真实事件，验证从浏览器到接收器的完整链路。")]),
        h("span", { class: "badge " + (running.value ? "online" : ""), "data-testid": "monitor-status" }, running.value ? "监控运行中" : "监控已停止"),
      ]),
      h("section", { class: "toolbar" }, [
        button("启动监控", start), button("停止监控", stop),
        button("清空本地记录", async () => { await fetch("/__monitor/events", { method: "DELETE" }); await refresh(); }, "quiet"),
        h("span", status.value),
      ]),
      h("section", { class: "cards" }, [
        h("article", [h("span", { class: "step" }, "01"), h("h2", "错误采集"), h("p", "覆盖运行时、Promise、Vue 组件和资源加载错误。"),
          button("触发 JS 错误", () => setTimeout(() => { throw Error("Demo JavaScript error"); }, 0)),
          button("触发 Promise 拒绝", () => { Promise.reject("Demo promise rejection"); }),
          button("触发 Vue 错误", () => { throw Error("Demo Vue component error"); }),
          button("触发资源错误", () => { const image = new Image(); image.hidden = true; image.addEventListener("error", () => image.remove(), { once: true }); document.body.append(image); image.src = "/missing-demo-image.png"; }),
        ]),
        h("article", [h("span", { class: "step" }, "02"), h("h2", "性能观察"), h("p", "启动后 1 秒内给出部分结果；晚到的指标单独更新。缺失值保留原因。"),
          button("立即采集性能", () => monitors[1]?.flush()),
          h("small", "资源与导航数据独立记录，自动排除接收器请求。"),
        ]),
        h("article", [h("span", { class: "step" }, "03"), h("h2", "页面停留"), h(RouterView),
          button("进入详情页", () => router.push("/details")),
          button("返回概览页", () => router.push("/")),
          button("尝试被取消的导航", () => router.push("/blocked")),
          h("small", "成功跳转才结算；取消导航不会提前结束计时。"),
        ]),
      ]),
      h("section", { class: "feed", "aria-label": "事件记录" }, [
        h("div", { class: "feed-heading" }, [h("h2", "已接收事件"), h("span", { "data-testid": "event-count" }, String(events.value.length))]),
        events.value.length ? h("div", { class: "events" }, events.value.map((event, index) =>
          h("details", { key: event.timestamp + ":" + index }, [
            h("summary", [h("span", { class: "event-kind" }, event.kind),
              h("span", event.type || event.reason || event.phase || event.initiatorType || ""),
              h("time", new Date(event.timestamp).toLocaleTimeString())]),
            h("pre", JSON.stringify(event, null, 2)),
          ]))) : h("p", { class: "empty" }, "还没有记录。点击上方按钮，或等待性能采集完成。"),
      ]),
      h("footer", "仅用于本地验证 · 最多保留 1000 条事件 · 重启清空 · 默认不采集查询参数"),
    ]);
  },
});
app.use(router);
await router.isReady();
app.mount("#app");
if (import.meta.hot) import.meta.hot.dispose(() => app.unmount());
