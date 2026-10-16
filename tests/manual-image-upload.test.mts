import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

type UploadHook = (input: { compress: (file: File) => Promise<string>; append: (images: string[]) => void; onError: () => void }) => {
  upload: (files: File[]) => Promise<void>; cancel: () => void; isPending: () => boolean; isUploading: boolean;
};
function deferred() {
  let resolve!: (value: string) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function harness(compress: (file: File) => Promise<string>) {
  const slots: unknown[] = [];
  let cursor = 0;
  const appended: string[][] = [];
  let errors = 0;
  let cleanup: (() => void) | undefined;
  const react = {
    useEffect(effect: () => (() => void)) { cleanup ??= effect(); },
    useRef(value: unknown) { const index = cursor++; return slots[index] ??= { current: value }; },
    useState(value: unknown) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = value;
      return [slots[index], (next: unknown) => { slots[index] = next; }];
    },
  };
  const source = readFileSync(new URL("../src/app/hooks/useManualImageUpload.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports: { useManualImageUpload?: UploadHook } = {};
  vm.runInNewContext(code, { exports, require: (name: string) => { assert.equal(name, "react"); return react; } });
  const input = { compress, append: (images: string[]) => appended.push(Array.from(images)), onError: () => { errors++; } };
  return { render: () => { cursor = 0; return exports.useManualImageUpload!(input); }, unmount: () => cleanup?.(), appended, errors: () => errors };
}
const photo = (name: string) => ({ name } as File);

test("manual compression exposes synchronous pending guard and preserves selected file order", async () => {
  const first = deferred(); const second = deferred();
  const view = harness(file => file.name === "외관.jpg" ? first.promise : second.promise);
  const hook = view.render();
  const operation = hook.upload([photo("외관.jpg"), photo("메뉴.jpg")]);
  assert.equal(hook.isPending(), true);
  assert.equal(view.render().isUploading, true);
  second.resolve("data:second");
  await Promise.resolve();
  assert.equal(view.appended.length, 0);
  first.resolve("data:first");
  await operation;
  assert.deepEqual(view.appended, [["data:first#name=" + encodeURIComponent("외관.jpg"), "data:second#name=" + encodeURIComponent("메뉴.jpg")]]);
  assert.equal(hook.isPending(), false);
  assert.equal(view.render().isUploading, false);
});

test("duplicate upload while compression is pending does not start another batch", async () => {
  const wait = deferred(); let calls = 0;
  const view = harness(() => { calls++; return wait.promise; });
  const hook = view.render(); const first = hook.upload([photo("first.jpg")]);
  await hook.upload([photo("second.jpg")]);
  assert.equal(calls, 1);
  wait.resolve("data:first"); await first;
  assert.equal(view.appended.length, 1);
});

test("cancelled old compression cannot append or clear a newer upload's busy state", async () => {
  const old = deferred(); const current = deferred();
  const view = harness(file => file.name === "old.jpg" ? old.promise : current.promise);
  const hook = view.render(); const oldOperation = hook.upload([photo("old.jpg")]);
  hook.cancel();
  assert.equal(hook.isPending(), false);
  const newOperation = view.render().upload([photo("new.jpg")]);
  old.resolve("data:old"); await oldOperation;
  assert.equal(view.appended.length, 0);
  assert.equal(hook.isPending(), true);
  assert.equal(view.render().isUploading, true);
  current.resolve("data:new"); await newOperation;
  assert.deepEqual(view.appended, [["data:new#name=new.jpg"]]);
  assert.equal(hook.isPending(), false);
});

test("failed compression reports once and releases lock; cancelled failures stay silent", async () => {
  const failed = deferred(); const cancelled = deferred();
  let call = 0;
  const view = harness(() => ++call === 1 ? failed.promise : cancelled.promise);
  const hook = view.render(); const operation = hook.upload([photo("failed.jpg")]);
  failed.reject(new Error("invalid image")); await operation;
  assert.equal(view.errors(), 1);
  assert.equal(hook.isPending(), false);
  assert.equal(view.render().isUploading, false);
  const next = hook.upload([photo("cancelled.jpg")]);
  hook.cancel(); cancelled.reject(new Error("old failure")); await next;
  assert.equal(view.errors(), 1);
  assert.equal(view.appended.length, 0);
});

test("unmount invalidates pending compression without appending", async () => {
  const wait = deferred();
  const view = harness(() => wait.promise);
  const hook = view.render(); const operation = hook.upload([photo("old.jpg")]);
  view.unmount(); wait.resolve("data:old"); await operation;
  assert.equal(view.appended.length, 0);
  assert.equal(hook.isPending(), false);
  assert.equal(view.errors(), 0);
});
