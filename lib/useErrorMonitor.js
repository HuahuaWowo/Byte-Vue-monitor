import tracker from "vuemonitor/utils/tracker";
import getSelector from "vuemonitor/utils/getSelector";
import getLastEvent from "vuemonitor/utils/getLastEvent";

export default function (app) {
  function start(app){
    app.config.errorHandler = (err, vm, info) => {
      let obj = {
        type: err.name,
        stack: extractErrorStack(err),
        msg: err.message,
        selector: "",
        category: "error",
        extra: {
          componentName: formatComponentName(vm),
          lifecycleHook: info,
        },
      };
  
      tracker.send(obj);
    };
  
    window.addEventListener(
      "error",
     jsErrorCapture,
     true
    );
  
    window.addEventListener("unhandledrejection",unhandledrejection ,true);
  

  }
  function end(){
    window.removeEventListener('error',jsErrorCapture)
    window.removeEventListener("unhandledrejection",unhandledrejection)
  }
  return [start,end]
}
const jsErrorCapture = (e) => {
  e.preventDefault();
  const temp = e.message.search(/:\s/);
  tracker.send({
    kind:'JSerror',
    url: e.target.location.href,
    filename: e.filename,
    lineno: e.lineno,
    colno: e.colno,
    message: e.message.slice(temp + 2),
    type: e.message.slice(0, temp).split(" ")[1],
  });
};
const unhandledrejection = (e) => {
  e.preventDefault();
  const lastEvent = getLastEvent();
  // let reason = e.reason;
  // if (typeof e.reason === "string") {
  //   message = reason;
  // } else if (typeof e.reason === "object") {
  //   let matchResult = reason.stack.match(/at\s+(.+):(\d+):(\d+)\n/);
  //   filename = matchResult[1];
  //   line = matchResult[2];
  //   column = matchResult[3];
  //   message = reason.stack.message;
  //   stack = getLines(reason.stack);
  // }
  tracker.send({
    kind: "JSerror", //监控指标的大类
    type: e.type, //小类型
    url: e.target.location.href,
    selector: lastEvent ? getSelector(lastEvent.path) : "",
  });
};
function formatComponentName(vm) {
  var name = vm.$options.name || vm.$options._componentTag;
  return (
    (name ? "component <" + name + ">" : "anonymous component") +
    (vm.$options.__file ? " at " + vm.$options.__file : "")
  );
}

// 解析错误栈

/**
 * 解析 error 的 stack, 并返回 args, column, line, func, url
 * @param ex
 */
function extractErrorStack(ex) {
  const chrome =
      /^\s*at (.*?) ?\(((?:file|https?|blob|chrome-extension|native|eval|webpack|<anonymous>|[a-z]:|\/).*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i,
    chromeEval = /\((\S*)(?::(\d+))(?::(\d+))\)/;

  const lines = ex.stack.split("\n"),
    stack = [];

  let submatch, parts, element;

  for (let i = 0, j = lines.length; i < j; ++i) {
    if ((parts = chrome.exec(lines[i]))) {
      const isNative = parts[2] && parts[2].indexOf("native") === 0; // start of linec
      const isEval = parts[2] && parts[2].indexOf("eval") === 0; // start of line

      if (isEval && (submatch = chromeEval.exec(parts[2]))) {
        // throw out eval line/column and use top-most line/column number
        parts[2] = submatch[1]; // url
        parts[3] = submatch[2]; // line
        parts[4] = submatch[3]; // column
      }

      element = {
        url: !isNative ? parts[2] : null,
        func: parts[1] || "",
        args: isNative ? [parts[2]] : [],
        line: parts[3] ? +parts[3] : null,
        column: parts[4] ? +parts[4] : null,
      };
    }
  }

  if (!element.func && element.line) {
    element.func = "";
  }
  stack.push(element);
  return stack;
}

