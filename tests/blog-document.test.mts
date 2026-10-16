import test from "node:test";
import assert from "node:assert/strict";
import { documentToHtml, documentToText, legacyDocument, parseGeneratedDocument, validateBlogDocument } from "../src/lib/blog-document.ts";

test("legacy conversion preserves spaces, leading/trailing and consecutive blank lines", () => {
  const content = "\n  한글 🙂  \n\n\n끝 \n";
  assert.equal(documentToText(legacyDocument("제목", content)), content);
});
test("legacy image tags resolve only exact known image names without deleting unknown text", () => {
  const images = [{ id: "photo-1", url: "data:image/jpeg;base64,YQ==#name=%EC%82%AC%EC%A7%84.jpg" }];
  const content = "[사진.jpg]\n\n[알수없음.jpg]";
  const document = legacyDocument("제목", content, images);
  assert.deepEqual(document.blocks[0], { type: "image", imageId: "photo-1" });
  assert.equal(documentToText(document, images), content);
});
test("mixed formatting escapes HTML instead of executing AI supplied text", () => {
  const document = validateBlogDocument({ version: 1, title: "제목", blocks: [
    { type: "paragraph", segments: [{ text: '<img src=x onerror="attack()">', bold: true, color: "#E53935", underline: true }] },
    { type: "paragraph", segments: [] },
  ] });
  const html = documentToHtml(document);
  assert.ok(html.includes("&lt;img"));
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("<strong>"));
  assert.ok(html.includes("<u>"));
  assert.ok(html.includes("color:#E53935"));
  assert.ok(html.endsWith('<p style="white-space:pre-wrap"><br></p>'));
});
test("unsupported schema version or AI properties fail explicitly", () => {
  const document = { version: 1, title: "제목", blocks: [{ type: "paragraph", segments: [{ text: "글" }] }] };
  assert.throws(() => validateBlogDocument({ ...document, version: 2 }));
  assert.throws(() => validateBlogDocument({ ...document, html: "<script>" }));
  assert.throws(() => validateBlogDocument({ ...document, title: "제목\n둘째" }));
});
test("unsafe color and invalid mark types cannot reach HTML styles", () => {
  for (const mark of [{ color: "red;position:fixed" }, { bold: "true" }, { underline: 1 }, { text: "a\nb" }]) {
    assert.throws(() => validateBlogDocument({ version: 1, title: "제목", blocks: [{ type: "paragraph", segments: [{ text: "글", ...mark }] }] }));
  }
});
test("missing/duplicate image references are rejected", () => {
  assert.throws(() => validateBlogDocument({ version: 1, title: "제목", blocks: [{ type: "image", imageId: "other" }] }, ["mine"]));
  assert.throws(() => validateBlogDocument({ version: 1, title: "제목", blocks: [{ type: "image", imageId: "mine" }, { type: "image", imageId: "mine" }] }, ["mine"]));
});
test("JSON output permits a code fence but never falls back silently on malformed JSON", () => {
  const document = { version: 1, title: "제목", blocks: [{ type: "paragraph", segments: [{ text: "글" }] }] };
  assert.deepEqual(parseGeneratedDocument("```json\n" + JSON.stringify(document) + "\n```", []), document);
  assert.throws(() => parseGeneratedDocument("[TITLE] plain", []));
});
test("extremely large generated text fails validation", () => {
  assert.throws(() => validateBlogDocument({ version: 1, title: "제목", blocks: [{ type: "paragraph", segments: [{ text: "a".repeat(100001) }] }] }));
});
