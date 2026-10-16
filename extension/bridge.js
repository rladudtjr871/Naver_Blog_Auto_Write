// The page sends only an authenticated export response; no tokens enter this bridge.
window.addEventListener('message', async event => {
  const data = event.data;
  if (event.source !== window || event.origin !== location.origin || data?.source !== 'blog-auto-write-dashboard' || typeof data.requestId !== 'string' || data.requestId.length > 200) return;
  if (!['PING','EXPORT_POST'].includes(data.type)) return;
  try {
    const response = await chrome.runtime.sendMessage({type:data.type,requestId:data.requestId,...(data.type === 'EXPORT_POST' ? {payload:data.payload}:{})});
    window.postMessage({source:'blog-auto-write-extension',type:data.type === 'PING' ? 'PONG':'EXPORT_RESULT',requestId:data.requestId,...response}, location.origin);
  } catch {
    window.postMessage({source:'blog-auto-write-extension',type:data.type === 'PING' ? 'PONG':'EXPORT_RESULT',requestId:data.requestId,ok:false,error:'확장 프로그램 연결이 종료되었습니다. 페이지를 새로고침하세요.'},location.origin);
  }
});
