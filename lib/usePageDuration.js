import tracker from "vuemonitor/utils/tracker";
export default function (router) {
  let startTime = Date.now();
  router.beforeEach((to, from) => {
    if (to.path !== from.path) {
      tracker.send({
        name: from.name || "",
        path: from.path,
        params: from.params || "",
        query: from.query|| "",
        duration: Date.now() - startTime,
      });
      startTime = Date.now();
    }
  });
}
