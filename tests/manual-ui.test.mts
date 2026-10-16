import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as writingMode from "../src/lib/writing-mode.ts";
import { imageName } from "../src/lib/blog-document.ts";
import * as imageMetadata from "../src/lib/image-metadata.ts";

const nodeRequire = createRequire(import.meta.url);
function loadComponent(path: string, name: string) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports: Record<string, React.ComponentType<Record<string, unknown>>> = {};
  const modules: Record<string, unknown> = { "@/lib/writing-mode": writingMode, "@/lib/blog-document": { imageName }, "@/lib/image-metadata": imageMetadata };
  if (name === "ManualComposer") modules["./PreparedImageAttachments"] = { PreparedImageAttachments: loadComponent("../src/app/components/manual/PreparedImageAttachments.tsx", "PreparedImageAttachments") };
  if (name === "GenerationForm") {
    modules["./MoreOptionsDropdown"] = { MoreOptionsDropdown: loadComponent("../src/app/components/MoreOptionsDropdown.tsx", "MoreOptionsDropdown") };
    modules["./manual/ImageAttachmentEditor"] = { ImageAttachmentEditor: loadComponent("../src/app/components/manual/ImageAttachmentEditor.tsx", "ImageAttachmentEditor") };
  }
  vm.runInNewContext(code, { exports, require: (id: string) => id in modules ? modules[id] : nodeRequire(id) });
  return exports[name];
}

test("mode selector marks manual active and renders a natively disabled API button", () => {
  const ModeSelector = loadComponent("../src/app/components/manual/ModeSelector.tsx", "ModeSelector");
  const html = renderToStaticMarkup(React.createElement(ModeSelector, { mode: "manual", onModeChange: () => {} }));
  assert.equal(writingMode.API_MODE_ENABLED, false);
  assert.match(html, /<button[^>]*aria-pressed="true"[^>]*>구독 AI에서 작성<\/button>/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>API로 작성/);
});
test("image descriptions and numbered editor appear only in manual mode", () => {
  const Form = loadComponent("../src/app/components/GenerationForm.tsx", "GenerationForm");
  const props = {
    category: "카페", model: "OPENAI", subject: "방문기", place: "서울", references: [""],
    uploadedImages: ["data:image/jpeg;base64,AA==#name=" + encodeURIComponent("외관.jpg")],
    post: { id: null, status: "IDLE" }, savedKeysStatus: { openai: true, gemini: false },
    geminiModels: [], selectedGeminiModel: "", isManualBusy: false,
  };
  const manual = renderToStaticMarkup(React.createElement(Form, { ...props, mode: "manual" }));
  const api = renderToStaticMarkup(React.createElement(Form, { ...props, mode: "api" }));
  assert.ok(manual.includes("사진 설명 (선택)"));
  assert.ok(manual.includes("사진 1"));
  assert.ok(manual.includes("외관.jpg"));
  assert.ok(!api.includes("사진 설명 (선택)"));
  assert.ok(api.includes('alt="Upload thumb"'));
});
test("prepared image download matches prompt filename and actual image encoding", () => {
  const Component = loadComponent("../src/app/components/manual/PreparedImageAttachments.tsx", "PreparedImageAttachments");
  const html = renderToStaticMarkup(React.createElement(Component, { images: [{ id: "uuid", url: "data:image/jpeg;base64,AA==#name=" + encodeURIComponent("외관.png") }] }));
  assert.ok(html.includes('download="01-외관.jpg"'));
  assert.ok(html.includes("사진 1"));
  assert.ok(html.includes("외관.png"));
});
test("manual composer preserves prompt as escaped text and blocks stale result submission", () => {
  const ManualComposer = loadComponent("../src/app/components/manual/ManualComposer.tsx", "ManualComposer");
  const html = renderToStaticMarkup(React.createElement(ManualComposer, {
    prepared: { id: "draft", prompt: "<script>unsafe()</script>", images: [] },
    busy: false, isStale: true, imported: false, responseText: "{...}",
    copyPrompt: () => {}, importResult: () => {}, setResponseText: () => {}, readFile: () => {}, error: "", notice: "",
  }));
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.match(html, /<button[^>]*disabled=""[^>]*>결과 가져오기/);
  assert.ok(html.includes("사진을 첨부 파일명에 맞춰 직접 첨부"));
});
