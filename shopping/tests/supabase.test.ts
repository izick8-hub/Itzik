import test from "node:test";
import assert from "node:assert/strict";

test("Configured publishable key enables the cloud client and reaches Auth unchanged", async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const previousFetch = globalThis.fetch;
  let requests = 0;
  const testKey = "sb_publishable_test_fixture_not_a_real_key";
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://cloud-fixture.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = testKey;
    globalThis.fetch = async (input, init) => {
      requests++;
      assert.match(String(input), /\/auth\/v1\/token\?grant_type=password$/);
      assert.equal(new Headers(init?.headers).get("apikey"), testKey);
      return new Response(
        JSON.stringify({
          error_code: "invalid_credentials",
          msg: "Test fixture",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    };
    const path = new URL(
      "../lib/supabase.ts?configured-fixture",
      import.meta.url,
    );
    const { supabase } = await import(path.href);
    assert.ok(
      supabase,
      "Cloud client must exist when both build variables are configured",
    );
    await supabase.auth.signInWithPassword({
      email: "fixture@example.invalid",
      password: "fixture-password",
    });
    assert.equal(requests, 1);
    supabase.auth.stopAutoRefresh();
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  }
});
