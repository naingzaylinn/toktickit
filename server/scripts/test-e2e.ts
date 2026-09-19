import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:net";

const root = path.resolve("..");
const clientDir = path.join(root, "client");
const source = process.env.DATABASE_URL ?? readFileSync(".env", "utf8").match(/^DATABASE_URL\s*=\s*["']?([^"'\r\n]+)/m)?.[1];
if (!source) throw new Error("Set DATABASE_URL or configure server/.env before E2E testing.");
const schema = `lab3_e2e_${randomUUID().replaceAll("-", "")}`;
const url = new URL(source);
url.searchParams.set("schema", schema);
const admin = new PrismaClient({ datasources: { db: { url: source } } });
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
const storage = await mkdtemp(path.join(tmpdir(), "toktickit-e2e-"));
const env = { ...process.env, DATABASE_URL: url.toString(), NODE_ENV: "test", ATTACHMENT_STORAGE_DIRECTORY: storage };
const children: ChildProcess[] = [];
let created = false;
function run(cwd: string, args: string[], extra = {}) {
  const result = spawnSync(process.execPath, args, { cwd, env: { ...env, ...extra }, stdio: "inherit" });
  if (result.error || result.status !== 0) throw new Error(`E2E command failed: ${args.join(" ")}`);
}
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("Port allocation failed"));
      server.close(() => resolve(address.port));
    });
  });
}
async function ready(address: string, child: ChildProcess) {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (child.exitCode !== null) throw new Error(`E2E service exited before ready: ${address}`);
    try { if ((await fetch(address)).status < 500) return; } catch { /* wait for startup */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`E2E service did not start: ${address}`);
}
try {
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  created = true;
  run(process.cwd(), ["node_modules/prisma/build/index.js", "migrate", "deploy"]);
  run(process.cwd(), ["node_modules/prisma/build/index.js", "migrate", "diff", "--from-schema-datasource", "prisma/schema.prisma", "--to-schema-datamodel", "prisma/schema.prisma", "--exit-code"]);
  run(process.cwd(), ["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"]);
  await db.user.updateMany({ where: { email: { not: "charlie@kmutt.ac.th" } }, data: { mustChangePassword: false } });
  const apiPort = await freePort();
  const clientPort = await freePort();
  const apiUrl = `http://127.0.0.1:${apiPort}`;
  const clientUrl = `http://127.0.0.1:${clientPort}`;
  const api = spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "src/index.ts"], { cwd: process.cwd(), env: { ...env, PORT: String(apiPort) }, stdio: "inherit" });
  children.push(api);
  await ready(`${apiUrl}/api/health`, api);
  const web = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(clientPort), "--strictPort"], { cwd: clientDir, env: { ...env, E2E_API_URL: apiUrl }, stdio: "inherit" });
  children.push(web);
  await ready(clientUrl, web);
  run(clientDir, ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)], { PLAYWRIGHT_BASE_URL: clientUrl });
} finally {
  for (const child of children.reverse()) child.kill();
  await db.$disconnect();
  if (!/^lab3_e2e_[a-f0-9]{32}$/.test(schema)) throw new Error("Invalid E2E schema name.");
  if (created) await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.$disconnect();
  if (!path.resolve(storage).startsWith(path.resolve(tmpdir()) + path.sep)) throw new Error("Invalid E2E storage location.");
  await rm(storage, { recursive: true, force: true });
}
