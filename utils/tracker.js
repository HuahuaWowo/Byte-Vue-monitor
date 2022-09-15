import myUseAgent from 'vuemonitor/utils/getUserAgent'
function getExtrData() {
  return {
    url: location.href,
    timestamp: Date.now(),
    userAgent: myUseAgent(),
  };
}
class sendTracker {
  constructor() {
    (this.url = ""), (this.xhr = new XMLHttpRequest());
  }
  send(data = {}) {
    let extrData = getExtrData();
    this.xhr.open("POST", this.url, true);
    let log = { ...data, ...extrData };
    console.log(log);
    let body = JSON.stringify(log);
    this.xhr.setRequestHeader("Content-Type", "application/json");
    this.xhr.send(body);
  }
}
export default new sendTracker();
