// Serialized into the editor frame. A change event is only a request;
// success requires a new, loaded remote image at the requested marker.
export async function uploadAtMarker(config,image,filename) {
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const main=document.querySelector(config.container);
  if(!main) return {ok:false,error:'본문 영역을 찾지 못했습니다.'};
  const markers=[...main.querySelectorAll(config.paragraphs)].filter(p=>p.textContent===`[이미지: ${image.id}]`);
  if(markers.length!==1) return {ok:false,error:'이미지 위치 표시가 없거나 여러 개입니다. 화면을 확인하세요.'};
  const marker=markers[0];let editable=marker;
  while(editable && (!editable.hasAttribute('contenteditable') || !editable.isContentEditable)) editable=editable.parentElement;
  if(!editable) return {ok:false,error:'이미지 위치에 커서를 놓을 수 없습니다.'};
  const before=new Set(main.querySelectorAll('img'));
  const previousSources=new Set([...before].map(img=>img.currentSrc||img.src));
  const markerComponent=marker.closest(config.component)||marker;
  const following=[...main.querySelectorAll(config.paragraphs)].find(p=>p!==marker && (marker.compareDocumentPosition(p)&Node.DOCUMENT_POSITION_FOLLOWING));
  editable.focus();
  const range=document.createRange();range.selectNodeContents(marker);range.collapse(false);
  const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
  let input=document.querySelector(config.fileInput);
  if(!input) {
    const button=config.imageButton.flatMap(selector=>[...document.querySelectorAll(selector)]).find(e=>e.getClientRects().length);
    if(!button) return {ok:false,error:'사진 도구 버튼을 찾지 못했습니다. 셀렉터 확인이 필요합니다.'};
    button.click();
    for(let n=0;n<20&&!input;n++){await wait(150);input=document.querySelector(config.fileInput);}
  }
  if(!input||input.disabled) return {ok:false,error:'이미지 파일 입력창이 준비되지 않았습니다.'};
  const match=image.url.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/);
  if(!match) return {ok:false,error:'지원하지 않는 이미지입니다.'};
  const bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));
  const files=new DataTransfer();files.items.add(new File([bytes],filename,{type:match[1]}));
  try {input.files=files.files;input.dispatchEvent(new Event('change',{bubbles:true}));}
  catch {return {ok:false,error:'네이버가 파일 입력 요청을 허용하지 않았습니다.'};}
  for(let n=0;n<40;n++) {
    await wait(350);
    const fresh=[...main.querySelectorAll('img')].filter(img=>!before.has(img));
    const loaded=fresh.find(img=>{
      const src=img.currentSrc||img.src;
      if(!marker.isConnected || (following&&!following.isConnected) || previousSources.has(src) || !/^https:\/\//.test(src)||!img.complete||!img.naturalWidth) return false;
      const component=img.closest(config.component)||img;
      const after=component===markerComponent || !!(markerComponent.compareDocumentPosition(component)&Node.DOCUMENT_POSITION_FOLLOWING);
      const beforeNext=!following || component.contains(following) || !!(component.compareDocumentPosition(following)&Node.DOCUMENT_POSITION_FOLLOWING);
      return after&&beforeNext;
    });
    if(loaded) return {ok:true};
  }
  return {ok:false,error:'새 이미지 업로드 완료와 위치를 확인하지 못했습니다. 뒤늦게 첨부될 수 있으므로 재시도 전에 확인하세요.'};
}
