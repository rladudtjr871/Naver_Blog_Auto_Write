import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const code=(await readFile(new URL('./background.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
function worker(extra={}) {
  let listener,release,reads=0;
  const chrome={runtime:{getURL:path=>'chrome-extension://test/'+path,onMessage:{addListener:fn=>{listener=fn;}}},storage:{session:{get:async key=>{
    if(key==='pending') {reads++;return new Promise(resolve=>{release=()=>resolve({});});}
    return {};
  },set:async()=>{}},local:{get:async()=>({})}}};
  const context={chrome,URL,validatePayload:p=>p,...extra};
  vm.runInNewContext(code,context);
  return {inspect:context.editorOperation,send:(message,sender={url:'chrome-extension://test/popup.html'})=>new Promise(resolve=>listener(message,sender,resolve)),release:()=>release(),reads:()=>reads};
}
test('claims input lock before asynchronous pending read and rejects export during input',async()=>{
  const w=worker();
  const first=w.send({type:'TRANSFER',postId:'one',tabId:1});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(w.reads(),1);
  const duplicate=await w.send({type:'ATTACH_IMAGES',postId:'one',tabId:1});
  assert.equal(duplicate.ok,false);assert.match(duplicate.error,/진행/);assert.equal(w.reads(),1);
  const replaced=await w.send({type:'EXPORT_POST',payload:{}},{tab:{id:5},frameId:0,url:'http://localhost:3000/'});
  assert.equal(replaced.ok,false);assert.match(replaced.error,/입력 작업/);
  w.release();assert.equal((await first).ok,false);
  // A failed request must release the lock.
  const retry=w.send({type:'TRANSFER',postId:'one',tabId:1});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(w.reads(),2);
  w.release();await retry;
});
test('readback rejects bold leaking into an unformatted following segment',()=>{
  const visible={getClientRects:()=>[{}],isContentEditable:true,hasAttribute:()=>true};
  const title={...visible,innerText:'T',closest:()=>null,cloneNode:()=>({textContent:'T',querySelectorAll:()=>[]})};
  const paragraph={...visible,textContent:'ab',cloneNode:()=>({textContent:'ab',querySelectorAll:()=>[]})};
  const main={querySelectorAll:()=>[paragraph]};paragraph.closest=()=>main;
  const nodes=['a','b'].map(textContent=>({textContent,parentElement:{closest:()=>null}}));
  const w=worker({NodeFilter:{SHOW_TEXT:4},getComputedStyle:e=>({visibility:'visible',fontWeight:'700',textDecorationLine:'none',color:'rgb(0, 0, 0)'}),document:{
    querySelectorAll:selector=>selector==='title'?[title]:[paragraph],
    createTreeWalker:()=>{let index=-1;return {nextNode(){this.currentNode=nodes[++index];return !!this.currentNode;}};}
  }});
  const result=w.inspect({title:['title'],body:['body'],container:'main',paragraphs:'p'},'verify',{title:'T',text:'ab',blocks:[{type:'paragraph',segments:[{text:'a',bold:true},{text:'b'}]}]});
  assert.equal(result.textMatches,true);assert.equal(result.stylesMatch,false);
});
test('diagnostics omit document text and location query',()=>{
  const w=worker({location:{origin:'https://blog.naver.com'},document:{querySelectorAll:()=>[]}});
  const result=w.inspect({title:['title'],body:['body']},'diagnose',null);
  assert.equal(result.origin,'https://blog.naver.com');assert.equal(result.bodyFound,false);
  assert.equal('text' in result,false);assert.equal('url' in result,false);
});
test('empty-editor probe ignores placeholders in detached clones and still rejects real text or images',()=>{
  let text='',images=0,removals=0;
  const clone=()=>{
    const copy={textContent:text+'안내문',querySelectorAll:()=>[{remove:()=>{copy.textContent=text;removals++;}}]};return copy;
  };
  const visible={getClientRects:()=>[{}],isContentEditable:true,hasAttribute:()=>true,cloneNode:clone};
  const main={cloneNode:clone};
  const title={...visible},body={...visible,closest:()=>main};
  const w=worker({getComputedStyle:()=>({visibility:'visible'}),document:{querySelectorAll:selector=>selector==='title'?[title]:selector==='body'?[body]:Array(images).fill({})}});
  const config={title:['title'],body:['body'],container:'main',images:'images',placeholder:'.se-placeholder'};
  assert.equal(w.inspect(config,'probe').empty,true);
  assert.equal(w.inspect(config,'probe').titleEmpty,true);
  assert.ok(removals>0);
  text='실제 글';assert.equal(w.inspect(config,'probe').empty,false);
  assert.equal(w.inspect(config,'probe').titleEmpty,false);
  text='';images=1;assert.equal(w.inspect(config,'probe').empty,false);
});
test('rejects untrusted popup callers, unknown origins and iframe dashboard messages',async()=>{
  const w=worker();
  assert.equal((await w.send({type:'TRANSFER'},{url:'https://evil.example/'})).ok,false);
  assert.equal((await w.send({type:'PING'},{tab:{id:1},frameId:0,url:'https://evil.example/'})).ok,false);
  assert.equal((await w.send({type:'PING'},{tab:{id:1},frameId:3,url:'http://localhost:3000/'})).ok,false);
  assert.equal((await w.send({type:'PING'},{tab:{id:1},frameId:0,url:'http://localhost:3000/'})).ok,true);
});
