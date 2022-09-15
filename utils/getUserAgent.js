
export default function () {
  // 获取浏览器 userAgent
  var ua = navigator.userAgent;
  // 是否为 Opera
  var isOpera = ua.indexOf("Opera") > -1;
  // 返回结果
  if (isOpera) {
    return ua.slice(isOpera);
  }

  // 是否为 Edge
  var isEdge = ua.indexOf("Edge") > -1;
  // 返回结果
  if (isEdge) {
    return ua.slice(isEdge);
  }

  // 是否为 Firefox
  var isFirefox = ua.indexOf("Firefox") > -1;
  // 返回结果
  if (isFirefox) {
    return "Firefox";
  }

  // 是否为 Safari
  var isSafari = ua.indexOf("Chrome") == -1&&ua.search(/Safari\/\d+/)  ;
  // 返回结果
  if (isSafari) {
    return ua.slice(isSafari);
  }

  // 是否为 Chrome
  var isChrome =
  (
    ua.indexOf("Chrome") > -1 &&
    ua.indexOf("Safari") > -1 &&
    ua.indexOf("Edge") == -1
    );
  // 返回结果
  if (isChrome) {
    return ua.slice(ua.search(/Chrome\/\d+/),ua.search(/\s+Safari\/\d+/));
  }

  // 是否为 UC
  var isUC = ua.indexOf("UBrowser") > -1;
  // 返回结果
  if (isUC) {
    return ua.slice(isUC);
  }

  // 是否为 QQ
  var isQQ = ua.indexOf("QQBrowser") > -1;
  // 返回结果
  if (isQQ) {
    return ua.slice(isQQ);
  }

  // 都不是
  return "";
}
