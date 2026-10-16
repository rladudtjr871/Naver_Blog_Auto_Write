import test from "node:test";
import assert from "node:assert/strict";
import { describeGenerationError, withGeminiRetry } from "../src/lib/generation-error.ts";

test("classifies provider failures without exposing raw keys, prompts or SDK messages", () => {
  const cases = [[401, "authentication"], [403, "permission"], [404, "model"], [429, "quota"], [400, "request"], [503, "unavailable"]] as const;
  for (const [status, kind] of cases) {
    const failure = describeGenerationError({ status, message: "SECRET_API_KEY private prompt https://example.com?key=SECRET", headers: { authorization: "SECRET" } }, "provider", "gemini-2.5-flash");
    assert.equal(failure.kind, kind);
    assert.ok(!JSON.stringify(failure).includes("SECRET"));
    assert.ok(!JSON.stringify(failure).includes("private prompt"));
  }
});

test("server error messages include safe HTTP status and distinguish overload from deadline", () => {
  assert.match(describeGenerationError({ status: 500 }, "provider", "GEMINI").message, /500/);
  assert.match(describeGenerationError({ status: 503 }, "provider", "GEMINI").message, /혼잡.*503/);
  assert.match(describeGenerationError({ status: 504 }, "provider", "GEMINI").message, /제한 시간.*504/);
});

test("retries transient Gemini errors twice with backoff and decreasing shared timeout", async () => {
  let elapsed = 0;
  const waits: number[] = [], timeouts: number[] = [];
  const result = await withGeminiRetry(async timeout => {
    timeouts.push(timeout);
    if (timeouts.length < 3) throw { status: 503 };
    return "ok";
  }, { now: () => elapsed, random: () => 0, sleep: async ms => { waits.push(ms); elapsed += ms; } });
  assert.equal(result, "ok");
  assert.deepEqual(waits, [1000, 2000]);
  assert.deepEqual(timeouts, [210000, 209000, 207000]);
});

test("does not retry quota, auth, validation or ambiguous timeouts", async () => {
  for (const error of [{ status: 400 }, { status: 401 }, { status: 403 }, { status: 404 }, { status: 429 }, new SyntaxError("JSON"), { name: "AbortError" }]) {
    let calls = 0;
    await assert.rejects(withGeminiRetry(async () => { calls++; throw error; }));
    assert.equal(calls, 1);
  }
});

test("stops retrying after three attempts or when insufficient total time remains", async () => {
  let calls = 0;
  await assert.rejects(withGeminiRetry(async () => { calls++; throw { status: 500 }; }, { sleep: async () => {}, random: () => 0 }));
  assert.equal(calls, 3);
  let elapsed = 0;
  calls = 0;
  await assert.rejects(withGeminiRetry(async () => { calls++; elapsed += 209000; throw { status: 503 }; }, { now: () => elapsed, random: () => 0, sleep: async () => { assert.fail("Must not sleep past deadline"); } }));
  assert.equal(calls, 1);
});
test("distinguishes billing from rate limits at the same HTTP status", () => {
  assert.equal(describeGenerationError({ status: 429, code: "insufficient_quota" }, "provider", "OPENAI").kind, "billing");
  assert.equal(describeGenerationError({ status: 429 }, "provider", "OPENAI").kind, "quota");
});
test("malformed AI documents and missing image refs are not misreported as key failures", () => {
  assert.equal(describeGenerationError(new SyntaxError("invalid JSON with private response"), "document", "OPENAI").kind, "document");
  assert.equal(describeGenerationError(new Error("private image data"), "document", "GEMINI").kind, "document");
});
test("distinguishes local stages and timeout from provider authorization", () => {
  for (const stage of ["loading", "credentials", "storage"] as const) assert.equal(describeGenerationError(new Error("SECRET"), stage, "GEMINI").kind, stage);
  assert.equal(describeGenerationError({ name: "APIConnectionTimeoutError" }, "provider", "OPENAI").kind, "timeout");
  assert.equal(describeGenerationError({ name: "APIConnectionError" }, "provider", "OPENAI").kind, "connection");
});
