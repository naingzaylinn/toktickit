import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Existing Lab 2 tests delete fixtures. Always give them a fresh schema instead
// of running them against the developer's working tickets and attachments.
const envFile = process.env.DATABASE_URL ? "" : readFileSync(".env", "utf8");
const databaseUrl = process.env.DATABASE_URL ?? envFile.match(/^DATABASE_URL\s*=\s*["']?([^"'\r\n]+)/m)?.[1];
if (!databaseUrl) throw new Error("Set DATABASE_URL or configure server/.env before testing.");
const schema = `issue2_test_${randomUUID().replaceAll("-", "")}`;
const url = new URL(databaseUrl);
url.searchParams.set("schema", schema);
const admin = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const env = { ...process.env, DATABASE_URL: url.toString(), NODE_ENV: "test" };
function run(args: string[]) {
  const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
  if (result.error || result.status !== 0) throw new Error(`Verification command failed: ${args.join(" ")}`);
}
let schemaCreated = false;
try {
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  schemaCreated = true;
  run(["node_modules/prisma/build/index.js", "migrate", "deploy"]);
  run(["node_modules/prisma/build/index.js", "migrate", "diff", "--from-schema-datasource", "prisma/schema.prisma", "--to-schema-datamodel", "prisma/schema.prisma", "--exit-code"]);
  run(["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"]);
  run(["node_modules/vitest/vitest.mjs", "run", ...process.argv.slice(2)]);
} finally {
  // Only this invocation's newly created, strictly generated schema is removed.
  if (!/^issue2_test_[a-f0-9]{32}$/.test(schema)) throw new Error("Invalid test schema.");
  if (schemaCreated) await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.$disconnect();
}
