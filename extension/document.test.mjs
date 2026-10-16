import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePayload,renderDocument,imageFilename} from './document.mjs';
const payload=()=>({postId:'one',document:{version:1,title:'제목',blocks:[{type:'paragraph',segments:[{text:'  한글 😀 <script>',bold:true,underline:true,color:'#E53935'}]},{type:'paragraph',segments:[{text:''}]},{type:'paragraph',segments:[{text:'끝  '}]}]},images:[]});
test('preserves whitespace and blank paragraphs while escaping text',()=>{
  const p=validatePayload(payload());const r=renderDocument(p.document);
  assert.equal(r.text,'  한글 😀 <script>\n\n끝  ');
  assert.ok(r.html.includes('&lt;script&gt;'));assert.ok(r.html.includes('<strong><u>'));assert.ok(r.html.includes('<br>'));
});
test('rejects executable colors, unknown versions and missing image refs',()=>{
  let p=payload();p.document.blocks[0].segments[0].color='red; background:url(x)';assert.throws(()=>validatePayload(p));
  p=payload();p.document.version=2;assert.throws(()=>validatePayload(p));
  p=payload();p.document.blocks.push({type:'image',imageId:'missing'});assert.throws(()=>validatePayload(p));
});
test('removes extra keys including tokens and never trusts HTML',()=>{
  const p=payload();p.token='secret';p.document.html='<script>x</script>';
  assert.equal(validatePayload(p).token,undefined);assert.equal(validatePayload(p).document.html,undefined);
});
test('accepts legacy image name fragments without passing them to upload',()=>{
  const p=payload();p.images=[{id:'a',url:'data:image/png;base64,YQ==#name=test.png'}];p.document.blocks.push({type:'image',imageId:'a'});
  const validated=validatePayload(p);assert.equal(validated.images[0].url,'data:image/png;base64,YQ==');
  assert.equal(imageFilename(validated.images[0]),'1-a.png');
  p.document.blocks.push({type:'image',imageId:'a'});assert.throws(()=>validatePayload(p));
});
test('rejects embedded line breaks and oversized title',()=>{
  const p=payload();p.document.blocks[0].segments[0].text='a\nb';assert.throws(()=>validatePayload(p));
  p.document.blocks[0].segments[0].text='ok';p.document.title='a'.repeat(301);assert.throws(()=>validatePayload(p));
});
