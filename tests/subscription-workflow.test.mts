import test from "node:test";
import assert from "node:assert/strict";
import { buildSubscriptionPrompt, parseSubscriptionResponse } from "../src/lib/subscription-workflow.ts";

const images = [{ id: "photo-1", url: "data:image/jpeg;base64,PRIVATE_IMAGE_BYTES#name=%EC%99%B8%EA%B4%80.jpg" }];
const valid = { version: 1, title: "[맛집] 후기", blocks: [
  { type: "paragraph", segments: [{ text: "  첫 문장 🙂 ", bold: true, underline: true, color: "#E53935" }] },
  { type: "paragraph", segments: [] }, { type: "image", imageId: "photo-1" },
] };

test("subscription prompt includes source context and stable image mapping without image bytes", () => {
  const prompt = buildSubscriptionPrompt({ category: "맛집", subject: "입구부터 메뉴 순으로 소개", place: "성수 식당", references: ["예시 스타일", "  "], images });
  assert.ok(prompt.includes("최소 4,000자"));
  assert.ok(prompt.includes("약 3~4줄 단위"));
  assert.ok(prompt.includes("이미지 한 장에 대한 멘트는 최대 10줄로 제한"));
  assert.ok(prompt.includes("[사진별 감상과 평가]"));
  assert.ok(prompt.includes("맛의 인상과 먹는 즐거움"));
  assert.ok(prompt.includes("완성 본문에 그대로 복사하지 마세요"));
  assert.ok(prompt.includes('paragraph 3~4개 뒤에 {"type":"paragraph","segments":[]}'));
  assert.ok(prompt.includes("photo-1"));
  assert.ok(prompt.includes("외관.jpg"));
  assert.ok(prompt.includes("성수 식당"));
  assert.ok(prompt.includes("예시 스타일"));
  assert.ok(prompt.includes("직접 첨부"));
  assert.ok(prompt.includes("[장소 검색과 리뷰 활용]"));
  assert.ok(prompt.includes("사용자 요청 스타일의 새로운 문장으로 각색"));
  assert.ok(prompt.includes("웹 검색을 사용할 수 없거나"));
  assert.ok(prompt.includes("자연스러운 1인칭 방문 후기체"));
  assert.ok(prompt.includes('"공개 후기에서도", "실제 후기에서도"'));
  assert.ok(!prompt.includes("맛·서비스 평가는 리뷰에서 언급된 의견으로 표현"));
  assert.ok(!prompt.includes("PRIVATE_IMAGE_BYTES"));
});
test("image-free prompt explicitly requests no image blocks", () => {
  const prompt = buildSubscriptionPrompt({ category: "여행", subject: "산책", place: "", references: [], images: [] });
  assert.ok(prompt.includes("이미지 블록은 만들지"));
  assert.ok(!prompt.includes("[장소 검색과 리뷰 활용]"));
  assert.ok(!prompt.includes("[사진별 감상과 평가]"));
});
test("import preserves exact text, empty paragraph, marks and image IDs", () => {
  assert.deepEqual(parseSubscriptionResponse("\uFEFF```json\n" + JSON.stringify(valid) + "\n```", images), valid);
});
test("invalid, truncated, oversized or empty results fail without silently losing formatting", () => {
  for (const text of ["", "plain text", '{"version":1', "x".repeat(1_000_001)]) assert.throws(() => parseSubscriptionResponse(text, images));
  assert.throws(() => parseSubscriptionResponse(JSON.stringify({ ...valid, blocks: [{ type: "image", imageId: "photo-1" }] }), images));
});
test("foreign, missing and duplicate image refs cannot be saved", () => {
  assert.throws(() => parseSubscriptionResponse(JSON.stringify({ ...valid, blocks: [{ type: "paragraph", segments: [{ text: "글" }] }] }), images));
  assert.throws(() => parseSubscriptionResponse(JSON.stringify({ ...valid, blocks: [...valid.blocks, { type: "image", imageId: "other-post" }] }), images));
  assert.throws(() => parseSubscriptionResponse(JSON.stringify({ ...valid, blocks: [...valid.blocks, { type: "image", imageId: "photo-1" }] }), images));
});
test("HTML remains literal text and unsafe style attributes fail validation", () => {
  assert.throws(() => parseSubscriptionResponse(JSON.stringify({ ...valid, blocks: [{ type: "paragraph", segments: [{ text: "x", color: "red;position:fixed" }] }] }), []));
  const document = parseSubscriptionResponse(JSON.stringify({ ...valid, blocks: [{ type: "paragraph", segments: [{ text: "<script>alert(1)</script>" }] }] }), []);
  assert.equal(document.blocks[0].type === "paragraph" && document.blocks[0].segments[0].text, "<script>alert(1)</script>");
});
