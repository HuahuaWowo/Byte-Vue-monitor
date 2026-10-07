import { createApp, h, ref } from "vue";
import { createTracker } from "../index.js";
const tracker = createTracker({ endpoint: "/__monitor/events" });
createApp({ setup() {
  const result = ref("等待发送");
  return () => h("main", [h("h1", "Byte Vue Monitor"), h("p", "本地事件上报示例"),
    h("button", { onClick: async () => { const status = await tracker.send({ kind: "custom", message: "hello monitor" }); result.value = status.ok ? "上报成功" : status.reason; } }, "发送测试事件"),
    h("p", result.value)]);
} }).mount("#app");
