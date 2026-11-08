import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
const name = `shopping-sql-test-${process.pid}`;
const env = { ...process.env };
for (const key of [
  "DOCKER_HOST",
  "DOCKER_CONTEXT",
  "DOCKER_TLS",
  "DOCKER_TLS_VERIFY",
  "DOCKER_CERT_PATH",
])
  delete env[key];
const docker = (args, options = {}) =>
  execFileSync("docker", ["--host=unix:///var/run/docker.sock", ...args], {
    env,
    encoding: "utf8",
    ...options,
  });
const sql = (file) =>
  docker(
    [
      "exec",
      "-i",
      name,
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-X",
      "-q",
    ],
    { input: readFileSync(file), stdio: ["pipe", "pipe", "inherit"] },
  );
let created = false;
try {
  docker([
    "run",
    "-d",
    "--name",
    name,
    "--network",
    "none",
    "--tmpfs",
    "/var/lib/postgresql/data",
    "-e",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    "postgres:17-alpine",
    "-c",
    "wal_level=logical",
  ]);
  created = true;
  let ready = false;
  for (let i = 0; i < 40; i++) {
    const r = spawnSync(
      "docker",
      [
        "--host=unix:///var/run/docker.sock",
        "exec",
        name,
        "pg_isready",
        "-U",
        "postgres",
      ],
      { env, stdio: "ignore" },
    );
    if (r.status === 0) {
      ready = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!ready) throw Error("PostgreSQL startup failed");
  sql("tests/postgres/bootstrap.sql");
  sql("supabase/migrations/202611050001_shopping.sql");
  sql("supabase/migrations/202611080001_cloud_sync.sql");
  sql("supabase/migrations/202611080001_cloud_sync.sql");
  sql("tests/postgres/cloud-sync.sql");
  console.log(
    "Real PostgreSQL integration passed: both migrations, repeatability, two household members, third-user isolation, writes, readback, stale edits, idempotent import, rollback and deletion trigger. This is not a live Supabase Auth/Realtime service test.",
  );
} finally {
  if (created) docker(["rm", "-f", name], { stdio: "ignore" });
}
