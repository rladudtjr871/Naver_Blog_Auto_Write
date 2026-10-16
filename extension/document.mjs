const COLORS = new Set(['#E53935', '#1565C0', '#00875A', '#6A1B9A']);
export function validatePayload(value) {
  if (!value || typeof value.postId !== 'string' || value.postId.length > 200) throw new Error('글 식별자가 올바르지 않습니다.');
  const d = value.document;
  if (!d || d.version !== 1 || typeof d.title !== 'string' || !d.title.trim() || d.title.length > 300 || /[\r\n]/.test(d.title) || !Array.isArray(d.blocks) || !d.blocks.length || d.blocks.length > 1000) throw new Error('지원하지 않는 문서입니다.');
  if (!Array.isArray(value.images) || value.images.length > 100) throw new Error('이미지 목록이 올바르지 않습니다.');
  let total = 0, totalText=0;
  const seenImages=new Set(), seenRefs=new Set();
  const images = value.images.map(i => {
    if (!i || typeof i.id !== 'string' || !i.id || i.id.length > 200 || seenImages.has(i.id) || typeof i.url !== 'string' || !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(i.url.split('#')[0]) || i.url.length > 14000000) throw new Error('압축된 이미지 Data URL만 전송할 수 있습니다.');
    seenImages.add(i.id);
    total += i.url.length;
    return {id:i.id, url:i.url.split('#')[0], role:typeof i.role === 'string' ? i.role.slice(0,100) : ''};
  });
  const ids = new Set(images.map(i=>i.id));
  const blocks = d.blocks.map(b => {
    if (b?.type === 'image' && typeof b.imageId === 'string' && ids.has(b.imageId) && !seenRefs.has(b.imageId)) {seenRefs.add(b.imageId);return {type:'image',imageId:b.imageId};}
    if (b?.type !== 'paragraph' || !Array.isArray(b.segments) || b.segments.length > 500) throw new Error('문단 데이터가 올바르지 않습니다.');
    return {type:'paragraph',segments:b.segments.map(s => {
      if (!s || typeof s.text !== 'string' || /[\r\n]/.test(s.text) || (s.bold !== undefined && typeof s.bold !== 'boolean') || (s.underline !== undefined && typeof s.underline !== 'boolean') || (s.color !== undefined && !COLORS.has(s.color))) throw new Error('허용하지 않는 서식입니다.');
      totalText+=s.text.length;
      total += s.text.length;
      return {text:s.text,...(s.bold ? {bold:true}:{}),...(s.underline ? {underline:true}:{}),...(s.color ? {color:s.color}:{})};
    })};
  });
  if (total > 40000000 || totalText>100000) throw new Error('전송 문서가 너무 큽니다.');
  return {postId:value.postId,document:{version:1,title:d.title,blocks},images,naverBlogId:typeof value.naverBlogId === 'string' ? value.naverBlogId.slice(0,100) : ''};
}
export const escapeHtml = s => s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const imageLabel = id => `[이미지: ${id}]`;
export function imageFilename(image,index=0) {
  const mime=image.url.match(/^data:image\/(png|jpeg|webp|gif);base64,/);
  if(!mime) throw new Error('지원하지 않는 이미지입니다.');
  return `${index+1}-${image.id.replace(/[^a-zA-Z0-9_-]/g,'_')}.${mime[1]==='jpeg'?'jpg':mime[1]}`;
}
export function renderDocument(d) {
  const lines = d.blocks.map(b => b.type === 'image' ? imageLabel(b.imageId) : b.segments.map(s=>s.text).join(''));
  const html = d.blocks.map(b => {
    if (b.type === 'image') return `<p>${escapeHtml(imageLabel(b.imageId))}</p>`;
    const text = b.segments.map(s => `<span style="font-weight:400;text-decoration:none${s.color ? `;color:${s.color}`:''}">${s.bold?'<strong>':''}${s.underline?'<u>':''}${escapeHtml(s.text).replace(/\n/g,'<br>')}${s.underline?'</u>':''}${s.bold?'</strong>':''}</span>`).join('');
    return `<p style="white-space:pre-wrap;margin:0">${b.segments.some(s=>s.text.length) ? text : '<br>'}</p>`;
  }).join('');
  return {text:lines.join('\n'),html};
}
