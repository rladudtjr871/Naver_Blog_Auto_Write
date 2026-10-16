import {renderDocument,imageFilename} from './document.mjs';
const $ = id => document.getElementById(id);
let pending;
async function refresh() {
  const state = await chrome.storage.session.get(['pending','transferStatus']);
  pending = state.pending;
  $('title').textContent = pending?.document.title || '받은 글 없음';
  $('summary').textContent = pending ? `${pending.document.blocks.length}개 블록 · 이미지 ${pending.images.length}개` : '';
  $('transfer').disabled = !pending || state.transferStatus?.state === 'running';
  $('download').disabled = !pending?.images.length;
  $('attach').disabled = !pending?.images.length || state.transferStatus?.state === 'running';
  $('status').textContent = state.transferStatus?.message || '';
}
const saved = await chrome.storage.local.get('dashboardOrigin');
$('origin').value = saved.dashboardOrigin || '';
for (const tab of await chrome.tabs.query({url:'https://blog.naver.com/*'})) {
  const option = document.createElement('option'); option.value = String(tab.id); option.textContent = tab.title || tab.url; $('tabs').append(option);
}
$('connect').onclick = async () => {
  try {
    const url = new URL($('origin').value);
    if (url.protocol !== 'https:' || url.origin !== $('origin').value.replace(/\/$/,'')) throw new Error('경로 없는 정확한 HTTPS 주소를 입력하세요.');
    if (!await chrome.permissions.request({origins:[url.origin+'/*']})) throw new Error('웹 연결 권한이 허용되지 않았습니다.');
    const response = await chrome.runtime.sendMessage({type:'SET_ORIGIN',origin:url.origin});
    if (!response.ok) throw new Error(response.error);
    $('status').textContent='연결했습니다. 웹 페이지를 새로고침하세요.';
  } catch(e) { $('status').textContent=e.message; }
};
$('diagnose').onclick=async()=>{
  try {
    const tabId=Number($('tabs').value);
    if(!tabId) throw new Error('네이버 글쓰기 탭을 선택하세요.');
    const response=await chrome.runtime.sendMessage({type:'DIAGNOSE',tabId});
    if(!response.ok) throw new Error(response.error);
    $('diagnostics').value=JSON.stringify(response.diagnostics,null,2);
    $('diagnostics').hidden=false;$('copyDiagnostics').hidden=false;
    $('status').textContent='글 내용 없이 편집 영역 구조만 확인했습니다. 입력 실패 시 진단 결과를 복사해 전달해 주세요.';
  } catch(error) {$('status').textContent=error.message;}
};
$('copyDiagnostics').onclick=async()=>{
  try {await navigator.clipboard.writeText($('diagnostics').value);$('status').textContent='진단 결과를 복사했습니다.';}
  catch {$('status').textContent='클립보드 권한이 없습니다. 진단 내용을 직접 선택해 복사하세요.';}
};
$('transfer').onclick = async () => {
  if (!pending) return;
  $('transfer').disabled=true;
  try {
    const tabId=Number($('tabs').value);
    if (!tabId) throw new Error('네이버 글쓰기 탭을 먼저 열어 주세요.');
    const {html,text}=renderDocument(pending.document);
    // Clipboard API runs here, directly in the popup user gesture.
    await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([text],{type:'text/plain'})})]);
    const r=await chrome.runtime.sendMessage({type:'TRANSFER',tabId,postId:pending.postId});
    if (!r.ok) throw new Error(r.error);
    await refresh();
  } catch(e) { $('status').textContent=`입력 시작 실패: ${e.message}`; $('transfer').disabled=false; }
};
$('download').onclick=()=>{
  for(const [index,i] of pending.images.entries()) {
    const a=document.createElement('a'); a.href=i.url; a.download=imageFilename(i,index); a.click();
  }
};
$('attach').onclick=async()=>{
  $('attach').disabled=true;
  try {
    const tabId=Number($('tabs').value);
    if(!tabId) throw new Error('네이버 글쓰기 탭을 선택하세요.');
    const response=await chrome.runtime.sendMessage({type:'ATTACH_IMAGES',tabId,postId:pending.postId});
    if(!response.ok) throw new Error(response.error);
    await refresh();
  } catch(error) { $('status').textContent=error.message; $('attach').disabled=false; }
};
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='session') refresh();});
await refresh();
