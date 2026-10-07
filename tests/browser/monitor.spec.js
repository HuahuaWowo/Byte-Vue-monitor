import { test, expect } from "@playwright/test";

const readEvents = async request => (await request.get("/__monitor/events")).json();
test.beforeEach(async ({ request }) => {
  await request.delete("/__monitor/events");
});
test("real Vue errors, promise, JS and resource errors reach the collector", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByTestId("monitor-status")).toHaveText("监控运行中");
  for (const label of ["触发 JS 错误", "触发 Promise 拒绝", "触发 Vue 错误", "触发资源错误"]) {
    await page.getByRole("button", { name: label, exact: true }).click();
  }
  await expect.poll(async () => (await readEvents(request)).filter(e => e.kind === "error").map(e => e.type).sort())
    .toEqual(["javascript", "promise", "resource", "vue"]);
  const events = await readEvents(request);
  expect(events.find(e => e.type === "promise").message).toBe("Demo promise rejection");
  expect(events.find(e => e.type === "vue").stack.length).toBeGreaterThan(0);
  await expect.poll(async () => Number(await page.getByTestId("event-count").textContent())).toBeGreaterThanOrEqual(4);
  await page.screenshot({ path: test.info().outputPath("demo.png"), fullPage: true });
});
test("no interaction still reports partial performance; collector does not cause a feedback loop", async ({ page, request }) => {
  await page.goto("/");
  await expect.poll(async () => (await readEvents(request)).filter(e => e.kind === "performance").length).toBeGreaterThan(0);
  const events = await readEvents(request);
  expect(events.find(e => e.kind === "performance").FID).toBeNull();
  expect(events.filter(e => e.kind === "resource").some(e => e.resourceName.includes("/__monitor/events"))).toBe(false);
});
test("real router ignores cancellation, settles navigation and stops collecting", async ({ page, request }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "尝试被取消的导航" }).click();
  expect((await readEvents(request)).filter(e => e.kind === "page-duration")).toHaveLength(0);
  await page.getByRole("button", { name: "进入详情页" }).click();
  await expect(page).toHaveURL(/\/details$/);
  await expect.poll(async () => (await readEvents(request)).filter(e => e.kind === "page-duration").length).toBe(1);
  const stay = (await readEvents(request)).find(e => e.kind === "page-duration");
  expect(stay.path).toBe("/");
  expect(stay.duration).toBeGreaterThan(0);
  await page.getByRole("button", { name: "停止监控" }).click();
  await expect(page.getByTestId("monitor-status")).toHaveText("监控已停止");
  const errorSeen = page.waitForEvent("pageerror");
  await page.getByRole("button", { name: "触发 JS 错误" }).click();
  await errorSeen;
  await page.getByRole("button", { name: "返回概览页" }).click();
  // A GET after the UI actions verifies no listener enqueued an error report.
  expect((await readEvents(request)).filter(e => e.kind === "error")).toHaveLength(0);
  await page.getByRole("button", { name: "启动监控" }).click();
  await page.getByRole("button", { name: "触发 JS 错误" }).click();
  await expect.poll(async () => (await readEvents(request)).filter(e => e.kind === "error").length).toBe(1);
});
