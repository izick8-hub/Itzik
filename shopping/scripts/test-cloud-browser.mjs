// No live keys or services: these are explicitly isolated browser fixtures.
import { spawnSync } from "node:child_process";
const env = {
  ...process.env,
  NEXT_PUBLIC_BASE_PATH: "",
  NEXT_PUBLIC_SUPABASE_URL: "https://cloud-fixture.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_test_fixture_not_a_real_key",
};
for (const args of [
  ["run", "build"],
  [
    "exec",
    "playwright",
    "test",
    "--",
    "--config",
    "playwright.cloud.config.ts",
  ],
]) {
  const result = spawnSync("npm", args, { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
