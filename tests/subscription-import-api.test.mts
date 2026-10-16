import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { parseSubscriptionResponse } from "../src/lib/subscription-workflow.ts";
import { documentToText } from "../src/lib/blog-document.ts";

// Execute the real route with only the network/auth boundary replaced.
const source = readFileSync(new URL("../src/app/api/posts/[id]/import/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const id = "f1d074e9-b67e-41d8-824d-1ae6fb1977e4";
const valid = { version: 1, title: "[맛집] 제목", blocks: [{ type: "paragraph", segments: [{ text: "본문", bold: true }] }] };

function fixture(options: { owner?: string; status?: string; authenticated?: boolean; race?: boolean } = {}) {
  let writes = 0;
  let payload: unknown;
  const filters: [string, unknown][] = [];
  const supabaseAdmin = { from: () => {
    let updating = false;
    const chain = {
      select: () => chain,
      eq: (column: string, value: unknown) => { if (updating) filters.push([column, value]); return chain; },
      update: (value: unknown) => { updating = true; payload = value; return chain; },
      maybeSingle: async () => {
        if (updating) { if (!options.race) writes++; return { data: options.race ? null : { id }, error: null }; }
        return { data: { id, userId: options.owner || "user-1", status: options.status || "DRAFT", images: [] }, error: null };
      },
    };
    return chain;
  } };
  const exports: Record<string, (...args: unknown[]) => Promise<Response>> = {};
  const json = (value: unknown, init?: ResponseInit) => new Response(JSON.stringify(value), init);
  const modules: Record<string, unknown> = {
    "next/server": { NextResponse: { json } },
    "@/lib/auth": { getAuthUser: async () => { if (options.authenticated === false) throw new Error("Unauthorized"); return { id: "user-1" }; } },
    "@/lib/supabase-admin": { supabaseAdmin },
    "@/lib/api-error": { apiError: () => json({ error: "로그인 필요" }, { status: 401 }) },
    "@/lib/blog-document": { documentToText },
    "@/lib/subscription-workflow": { parseSubscriptionResponse },
  };
  vm.runInNewContext(compiled, { exports, require: (name: string) => { if (!(name in modules)) throw new Error("Unexpected external dependency: " + name); return modules[name]; }, Response });
  return {
    send: (responseText: string) => exports.POST(new Request("https://local.test/api/posts/" + id + "/import", { method: "POST", body: JSON.stringify({ responseText }) }), { params: Promise.resolve({ id }) }),
    writes: () => writes, payload: () => payload, filters,
  };
}

test("import saves validated document and compatibility text, scoped to owner and DRAFT", async () => {
  const f = fixture();
  const response = await f.send(JSON.stringify(valid));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { postId: id, status: "COMPLETED" });
  assert.equal(f.writes(), 1);
  const payload = f.payload() as { document: unknown; content: string; status: string };
  assert.deepEqual(payload.document, valid);
  assert.equal(payload.content, "본문");
  assert.equal(payload.status, "COMPLETED");
  assert.deepEqual(f.filters, [["id", id], ["userId", "user-1"], ["status", "DRAFT"]]);
});
test("unauthenticated, foreign-owner and completed posts cannot be imported", async () => {
  for (const [options, status] of [[{ authenticated: false }, 401], [{ owner: "other" }, 403], [{ status: "COMPLETED" }, 409]] as const) {
    const f = fixture(options);
    assert.equal((await f.send(JSON.stringify(valid))).status, status);
    assert.equal(f.writes(), 0);
  }
});
test("bad external JSON leaves the draft untouched", async () => {
  const f = fixture();
  const response = await f.send('{"version":1');
  assert.equal(response.status, 400);
  assert.equal(f.writes(), 0);
});
test("a concurrent import cannot overwrite a document already saved by another request", async () => {
  const f = fixture({ race: true });
  assert.equal((await f.send(JSON.stringify(valid))).status, 409);
  assert.equal(f.writes(), 0);
});
