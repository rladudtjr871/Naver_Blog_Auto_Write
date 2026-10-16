import test from "node:test";
import assert from "node:assert/strict";
import { readImageMetadata, setImageDescription, prepareImageUrls, buildImageManifest, sortDocumentImages } from "../src/lib/image-metadata.ts";
import { buildBlogUserPrompt } from "../src/lib/blog-prompt.ts";
import { buildSubscriptionPrompt } from "../src/lib/subscription-workflow.ts";

const url = "data:image/jpeg;base64,AA==#name=" + encodeURIComponent("입구 & 간판+.png");
test("manual metadata preserves original filename, description and position", () => {
  assert.equal(readImageMetadata(url).filename, "입구 & 간판+.png");
  const [prepared] = prepareImageUrls([setImageDescription(url, "장소 입구 & 간판")]);
  assert.deepEqual(readImageMetadata(prepared), { filename: "입구 & 간판+.png", description: "장소 입구 & 간판", position: 1 });
  assert.equal(url.includes("__manual"), false);
});
test("manifest sorts saved positions and produces distinct MIME-correct names without mutating input", () => {
  const urls = prepareImageUrls([url, url]);
  const images = [{ id: "b", url: urls[1] }, { id: "a", url: urls[0] }];
  const manifest = buildImageManifest(images);
  assert.deepEqual(manifest.map(item => item.imageId), ["a", "b"]);
  assert.deepEqual(manifest.map(item => item.filename), ["01-입구 & 간판+.jpg", "02-입구 & 간판+.jpg"]);
  assert.equal(images[0].id, "b");
  assert.notEqual(sortDocumentImages(images), images);
});
test("unknown original names use neutral attachment names rather than IDs", () => {
  const [entry] = buildImageManifest([{ id: "uuid", url: "data:image/png;base64,AA==" }]);
  assert.equal(entry.originalFilename, null);
  assert.equal(entry.filename, "01-사진.png");
});
test("only subscription prompt contains the new attachment mapping", () => {
  const images = [{ id: "uuid", url: setImageDescription(url, "입구 설명") }];
  const input = { category: "카페", subject: "방문기", place: "서울", references: [], images };
  const manual = buildSubscriptionPrompt(input);
  assert.ok(manual.includes('"filename":"01-입구 & 간판+.jpg"'));
  assert.ok(manual.includes('"description":"입구 설명"'));
  const api = JSON.parse(buildBlogUserPrompt("방문기", "서울", [], images));
  assert.deepEqual(api.images, [{ imageId: "uuid", filename: "입구 & 간판+.png" }]);
  assert.ok(!manual.includes("data:image"));
});
