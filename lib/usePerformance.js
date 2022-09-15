import tracker from "vuemonitor/utils/tracker";
export default function obser() {
  observeLCP();
  observePaint();
  observeEvent('resource');
  observeFID()
  checkDataChange();
}

// LCP 获取
// lcp是否完成
let LCP;
let lcpDone = false;
// LCP 需要最大内容渲染
function observeLCP() {
  const entryHandler = (list) => {
    lcpDone = true;
    if (observer) {
      observer.disconnect();
    }
    for (const entry of list.getEntries()) {
      LCP = entry.startTime.toFixed(2);
    }
  };

  const observer = new PerformanceObserver(entryHandler);
  observer.observe({
    type: "largest-contentful-paint",
    buffered: true,
  });
}

let FP;
let FCP;
let fpdone = false;

function observePaint() {
  const entryHandler = (list) => {
    fpdone = true;
    for (const entry of list.getEntries()) {
      if (entry.name === "first-paint") {
        FP = entry.startTime.toFixed(2);
        observer.disconnect();
      }
      if (entry.name === "first-contentful-paint") {
        FCP = entry.startTime.toFixed(2);
        observer.disconnect();
      }
    }
  };

  const observer = new PerformanceObserver(entryHandler);
  observer.observe({ type: "paint", buffered: true });
}

let ob;
let obdone = false;
 function observeEvent(entryType) {
  function entryHandler() {
    obdone = true;
    const {
      connectEnd,
      connectStart,
      initiatorType,
      domContentLoadedEventEnd,
      domContentLoadedEventStart,
      encodedBodySize,
      decodedBodySize,
      domainLookupEnd,
      domainLookupStart,
      duration,
      fetchStart,
      loadEventEnd,
      name,
      type,
      nextHopProtocol,
      requestStart,
      responseEnd,
      responseStart,
      secureConnectionStart,
      startTime,
      transferSize,
      redirectEnd,
      redirectStart
  }=performance.getEntriesByType('navigation')[0]
      ob = {
        resourceName: name, // 资源名称
        sourceType: initiatorType, // 资源类型
        duration: duration.toFixed(2), // 总耗时
        request:(responseEnd-requestStart).toFixed(2),
        action:type,
        DNS: (domainLookupEnd - domainLookupStart).toFixed(2), // DNS 耗时
        TCP: (connectEnd - connectStart).toFixed(2),
        SSL:(connectEnd-secureConnectionStart).toFixed(2),// 建立 tcp 连接耗时
        redirect: (redirectEnd - redirectStart).toFixed(2), // 重定向耗时
        protocol: nextHopProtocol, // 请求协议
        responseBodySize: encodedBodySize, // 响应内容大小
        resourceSize: decodedBodySize, // 资源解压后的大小
        isCache:transferSize === 0 ||(transferSize !== 0 && encodedBodySize === 0), // 是否命中缓存
        startTime,
        DCL:(domContentLoadedEventEnd-domContentLoadedEventStart).toFixed(2),
        TTFB: responseStart.toFixed(2), // 首字节时间
        onLoad:(loadEventEnd-fetchStart).toFixed(2)
      };
    
  }
  const observer = new PerformanceObserver(entryHandler);
  observer.observe({ type: entryType, buffered: true });
}

let FID;
let FIDdone=false;
function observeFID(){
  new PerformanceObserver((entryList) => {
    FIDdone=true
    for (const entry of entryList.getEntries()) {
      const delay = entry.processingStart - entry.startTime;
      FID=delay
    }
  }).observe({type: 'first-input', buffered: true});
}
let timer;
function checkDataChange() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (lcpDone && fpdone && obdone&&FIDdone) {
      let obj = {
        url:window.location.href,
        kind:"performance",
        FP,
        FCP,
        LCP,
        FID,
        ...ob,
      };
      tracker.send(obj);
    } else {
      checkDataChange();
    }
  }, 1000);
}
