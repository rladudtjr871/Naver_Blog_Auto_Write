import {validatePayload,renderDocument,imageFilename} from './document.mjs';
import {uploadAtMarker} from './image-upload.js';
let running = false;
const recover = chrome.storage.session.get('transferStatus').then(async state=>{
  if(state.transferStatus?.state==='running') await chrome.storage.session.set({transferStatus:{state:'partial',message:'이전 입력 연결이 종료되었습니다. 일부 내용이 남았을 수 있으므로 네이버 화면을 확인하세요. 저장·재열기는 미검증입니다.'}});
});
const ownPopup = sender => sender.url === chrome.runtime.getURL('popup.html');
async function dashboardAllowed(sender) {
  if (!sender.tab || sender.frameId !== 0 || !sender.url) return false;
  const {dashboardOrigin} = await chrome.storage.local.get('dashboardOrigin');
  return [dashboardOrigin,'http://localhost:3000'].includes(new URL(sender.url).origin);
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  (async()=>{
    await recover;
    if (['PING','EXPORT_POST'].includes(message?.type)) {
      if (!await dashboardAllowed(sender)) throw new Error('허용되지 않은 웹 주소입니다.');
      if (message.type==='EXPORT_POST') {
        if(running) throw new Error('입력 작업 중에는 다른 글을 받을 수 없습니다.');
        running=true;
        try { await chrome.storage.session.set({pending:validatePayload(message.payload),transferStatus:{state:'received',message:'글을 받았습니다. 빈 네이버 에디터를 열고 입력 버튼을 누르세요.'}}); }
        finally { running=false; }
      }
      return {ok:true};
    }
    if (!ownPopup(sender)) throw new Error('허용되지 않은 요청입니다.');
    if(message.type==='DIAGNOSE') {
      const tab=await chrome.tabs.get(message.tabId);
      if(!tab.url?.startsWith('https://blog.naver.com/')) throw new Error('네이버 블로그 글쓰기 탭을 선택하세요.');
      const config=await(await fetch(chrome.runtime.getURL('config.json'))).json();
      const results=await chrome.scripting.executeScript({target:{tabId:message.tabId,allFrames:true},func:editorOperation,args:[config,'diagnose',null]});
      return {ok:true,diagnostics:results.map(result=>({frameId:result.frameId,...result.result}))};
    }
    if (message.type==='SET_ORIGIN') {
      const origin=new URL(message.origin).origin;
      if(origin!==message.origin || !origin.startsWith('https://') || !await chrome.permissions.contains({origins:[origin+'/*']})) throw new Error('웹 주소 권한을 먼저 허용하세요.');
      await chrome.scripting.unregisterContentScripts({ids:['dashboard-bridge']}).catch(()=>{});
      await chrome.scripting.registerContentScripts([{id:'dashboard-bridge',matches:[origin+'/*'],js:['bridge.js'],runAt:'document_start',persistAcrossSessions:true}]);
      await chrome.storage.local.set({dashboardOrigin:origin});
      return {ok:true};
    }
    if(message.type==='TRANSFER' || message.type==='ATTACH_IMAGES') {
      if(running) throw new Error('이미 입력 작업이 진행 중입니다.');
      running=true;
      try {
      const {pending}=await chrome.storage.session.get('pending');
      if(!pending || pending.postId!==message.postId) throw new Error('글을 다시 전송해 주세요.');
      const tab=await chrome.tabs.get(message.tabId);
      if(!tab.url?.startsWith('https://blog.naver.com/')) throw new Error('네이버 블로그 탭만 지원합니다.');
      await chrome.tabs.update(message.tabId,{active:true});
      await chrome.storage.session.set({transferStatus:{state:'running',message:'에디터 확인 및 입력 중입니다. 이 탭을 조작하지 마세요.'}});
      // Keep the channel open until the operation ends, even if the popup closes.
      if(message.type==='ATTACH_IMAGES') await attachImages(message.tabId,pending);
      else await transfer(message.tabId,pending);
      return {ok:true};
      } finally { running=false; }
    }
    throw new Error('지원하지 않는 요청입니다.');
  })().then(reply).catch(error=>reply({ok:false,error:error.message}));
  return true;
});

// Executed in the editor frame. No page-owned HTML or application model is changed.
function editorOperation(config,action,expected) {
  const visible = e => !!(e && e.getClientRects().length && getComputedStyle(e).visibility!=='hidden');
  const cleanText=element=>{
    const clone=element.cloneNode(true);
    if(config.placeholder) for(const node of clone.querySelectorAll(config.placeholder)) node.remove();
    return (clone.textContent||'').replace(/\u200b/g,'');
  };
  const locate = selectors => {
    for(const selector of selectors) for(const candidate of document.querySelectorAll(selector)) {
      if(!visible(candidate)) continue;
      let editable=candidate;
      while(editable && (!editable.hasAttribute('contenteditable') || !editable.isContentEditable)) editable=editable.parentElement;
      if(editable?.isContentEditable && visible(editable)) return {candidate,editable};
    }
    return null;
  };
  const title=locate(config.title), body=locate(config.body);
  if(action==='diagnose') {
    const describe=selectors=>selectors.map(selector=>{
      const elements=[...document.querySelectorAll(selector)];
      return {selector,count:elements.length,visible:elements.filter(visible).length,editable:elements.filter(e=>e.isContentEditable).length,editableRoots:[...new Set(elements.map(e=>{
        let root=e;
        while(root && (!root.hasAttribute('contenteditable')||!root.isContentEditable)) root=root.parentElement;
        return root ? {tag:root.tagName,mode:root.getAttribute('contenteditable'),classes:[...root.classList].filter(c=>/^[a-zA-Z_-]+$/.test(c)).slice(0,12).join(' ')} : null;
      }).filter(Boolean).map(JSON.stringify))].map(item=>JSON.parse(item))};
    });
    const main=body?.candidate.closest(config.container)||body?.editable;
    return {origin:location.origin,titleFound:!!title,bodyFound:!!body,sharedEditableRoot:!!(title&&body&&title.editable===body.editable),empty:main ? !cleanText(main).replace(/[\s\ufeff]/g,'')&&!document.querySelectorAll(config.images).length:null,titleEmpty:title?!cleanText(title.editable).trim():null,title:describe(config.title),body:describe(config.body)};
  }
  if(!body || !title || title.editable===body.editable) return {found:false};
  const main=body.candidate.closest(config.container) || body.editable;
  if(action==='probe') return {found:true,empty:!cleanText(main).replace(/[\s\ufeff]/g,'')&&!document.querySelectorAll(config.images).length,titleEmpty:!cleanText(title.editable).trim()};
  if(action==='title' || action==='body') {
    const target=action==='title'?title:body;
    target.editable.focus();
    const range=document.createRange(); range.selectNodeContents(target.candidate); range.collapse(false);
    const selection=window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    return {found:true,focused:document.activeElement===target.editable || target.editable.contains(document.activeElement),selection:selection.rangeCount===1};
  }
  if(action==='verify') {
    const paragraphs=[...main.querySelectorAll(config.paragraphs)];
    const actual=paragraphs.length?paragraphs.map(cleanText).join('\n'):cleanText(main);
    const normalize=s=>s.replace(/\r\n/g,'\n').replace(/\u00a0/g,' ');
    const textMatches=normalize(actual)===normalize(expected.text);
    const titleMatches=normalize(cleanText(title.editable)).replace(/\n$/,'')===normalize(expected.title);
    // Check individual styled text nodes by their document position; do not
    // mistake another occurrence of a repeated phrase for preserved formatting.
    const textNodes=[];
    const source=paragraphs.length?paragraphs:[main];
    source.forEach((p,index)=>{
      const walker=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);
      while(walker.nextNode()) {
        const node=walker.currentNode, style=getComputedStyle(node.parentElement);
        if(config.placeholder && node.parentElement.closest(config.placeholder)) continue;
        for(const char of normalize(node.textContent.replace(/\u200b/g,''))) textNodes.push({char,bold:Number(style.fontWeight)>=600||style.fontWeight==='bold',underline:!!node.parentElement.closest('u')||style.textDecorationLine.includes('underline'),color:style.color});
      }
      if(index<source.length-1) textNodes.push({char:'\n'});
    });
    let offset=0, stylesMatch=true;
    for(const block of expected.blocks) {
      if(block.type==='image') offset += [...`[이미지: ${block.imageId}]`].length;
      else for(const segment of block.segments) {
        for(const char of normalize(segment.text)) {
          const node=textNodes[offset++];
          if(!node || node.char!==char || !!segment.bold!==!!node.bold || !!segment.underline!==!!node.underline) stylesMatch=false;
          if(segment.color) {
            const hex=segment.color.slice(1);const rgb=`rgb(${parseInt(hex.slice(0,2),16)}, ${parseInt(hex.slice(2,4),16)}, ${parseInt(hex.slice(4,6),16)})`;
            if(node?.color!==rgb) stylesMatch=false;
          }
        }
      }
      offset++;
    }
    return {found:true,textMatches,titleMatches,stylesMatch};
  }
}
async function transfer(tabId,pending) {
  const target={tabId}; let attached=false,changed=false;
  try {
    const config=await (await fetch(chrome.runtime.getURL('config.json'))).json();
    const probe=await chrome.scripting.executeScript({target:{tabId,allFrames:true},func:editorOperation,args:[config,'probe',null]});
    const frames=probe.filter(f=>f.result?.found);
    if(frames.length!==1) throw new Error('편집 영역을 하나로 확인하지 못했습니다. 글쓰기 화면이 완전히 열린 뒤 다시 시도하세요.');
    if(!frames[0].result.empty || !frames[0].result.titleEmpty) throw new Error('제목 또는 본문에 기존 내용이 있습니다. 덮어쓰기와 중복 삽입 방지를 위해 빈 글에서만 입력합니다.');
    const frameId=frames[0].frameId;
    const focus=async action=>{
      const [result]=await chrome.scripting.executeScript({target:{tabId,frameIds:[frameId]},func:editorOperation,args:[config,action,null]});
      if(!result.result?.focused||!result.result?.selection) throw new Error('에디터의 포커스와 커서를 확인하지 못했습니다.');
    };
    await chrome.debugger.attach(target,'1.3'); attached=true;
    await focus('title');
    changed=true;
    await chrome.debugger.sendCommand(target,'Input.insertText',{text:pending.document.title});
    await focus('body');
    // CDP dispatches browser input rather than synthetic DOM KeyboardEvents.
    const modifiers=navigator.platform?.toLowerCase().includes('mac')?4:2;
    await chrome.debugger.sendCommand(target,'Input.dispatchKeyEvent',{type:'keyDown',key:'v',code:'KeyV',windowsVirtualKeyCode:86,modifiers});
    await chrome.debugger.sendCommand(target,'Input.dispatchKeyEvent',{type:'keyUp',key:'v',code:'KeyV',windowsVirtualKeyCode:86,modifiers});
    const {text}=renderDocument(pending.document);
    let result;
    for(let attempt=0;attempt<12;attempt++) {
      await new Promise(resolve=>setTimeout(resolve,350));
      const [r]=await chrome.scripting.executeScript({target:{tabId,frameIds:[frameId]},func:editorOperation,args:[config,'verify',{title:pending.document.title,text,blocks:pending.document.blocks}]});
      result=r.result;
      if(result?.textMatches&&result?.titleMatches&&result?.stylesMatch) break;
    }
    const verified=result?.textMatches&&result?.titleMatches&&result?.stylesMatch;
    const images=pending.images.length;
    await chrome.storage.session.set({transferStatus:{state:verified&&!images?'input_verified':'partial',message:verified ? `제목·본문·서식 DOM 비교를 통과했습니다.${images ? ` 이미지 ${images}개는 아직 첨부되지 않았습니다. 다운로드 후 위치 표시를 직접 교체하세요.`:''} 임시저장·재열기 검증은 아직 하지 않았습니다.` : '입력은 시도했지만 제목·본문·빈 줄·서식을 원본과 일치한다고 확인하지 못했습니다. 네이버 내용을 확인하세요. 재시도하면 중복될 수 있습니다. 임시저장·재열기는 미검증입니다.'}});
  } catch(error) {
    await chrome.storage.session.set({transferStatus:{state:changed?'partial':'failed',message:`${error.message}${changed?' 일부 내용이 입력됐을 수 있으므로 재시도 전 네이버 화면을 확인하세요.':''} 저장·재열기는 미검증입니다.`}});
    throw error;
  } finally {
    if(attached) await chrome.debugger.detach(target).catch(()=>{});
  }
}

async function attachImages(tabId,pending) {
  const target={tabId};let attached=false;
  try {
    await chrome.debugger.attach(target,'1.3');attached=true;
    const config=await(await fetch(chrome.runtime.getURL('config.json'))).json();
    const frames=(await chrome.scripting.executeScript({target:{tabId,allFrames:true},func:editorOperation,args:[config,'probe',null]})).filter(f=>f.result?.found);
    if(frames.length!==1) throw new Error('편집 영역을 하나로 확인하지 못했습니다.');
    const key=`imageAttempts:${tabId}:${pending.postId}`;
    const stored=await chrome.storage.session.get(key), attempts=stored[key]||{};
    const refs=pending.document.blocks.filter(b=>b.type==='image');
    if(!refs.length) throw new Error('본문에 이미지 위치 표시가 없습니다.');
    let verified=0;
    for(const block of refs) {
      if(attempts[block.imageId]) throw new Error('이미 시도한 이미지가 있습니다. 중복 첨부를 막기 위해 자동 재시도하지 않습니다. 화면 확인 후 다운로드로 첨부하세요.');
      const image=pending.images.find(i=>i.id===block.imageId);
      if(!image) throw new Error('이미지 원본을 찾지 못했습니다.');
      attempts[block.imageId]='attempted';
      await chrome.storage.session.set({[key]:attempts});
      const [result]=await chrome.scripting.executeScript({target:{tabId,frameIds:[frames[0].frameId]},func:uploadAtMarker,args:[config,image,imageFilename(image,verified)]});
      if(!result.result?.ok) throw new Error(result.result?.error||'이미지 입력 결과를 확인하지 못했습니다.');
      attempts[block.imageId]='verified';verified++;
      await chrome.storage.session.set({[key]:attempts,transferStatus:{state:'running',message:`이미지 ${verified}/${refs.length}개 DOM 업로드·위치 확인 중`}});
    }
    await chrome.storage.session.set({transferStatus:{state:'partial',message:`이미지 ${verified}개의 새 원격 이미지 로딩과 위치를 확인했습니다. 위치 표시 문구는 직접 지워주세요. 임시저장·재열기는 미검증입니다.`}});
  } catch(error) {
    await chrome.storage.session.set({transferStatus:{state:'partial',message:`이미지 첨부 부분 실패: ${error.message} 일부 또는 지연 업로드가 남을 수 있습니다. 텍스트를 다시 입력하지 말고 이미지를 직접 확인·첨부하세요. 저장·재열기 미검증.`}});
    throw error;
  } finally {if(attached) await chrome.debugger.detach(target).catch(()=>{});}
}
