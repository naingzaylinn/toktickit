import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { getPrisma } from "../../src/prisma.js";

export async function applyMigration(prisma: PrismaClient, name: string) {
  const sql = await readFile(`prisma/migrations/${name}/migration.sql`, "utf8");
  // The repository migrations contain ordinary DDL/DML, without procedural
  // bodies or semicolons inside literals. Remove line comments before splitting.
  const statements = sql.replace(/^\s*--.*$/gm, "").split(";").filter(item => item.trim());
  await prisma.$transaction(async tx => {
    for (const statement of statements) await tx.$executeRawUnsafe(statement);
  });
}

export async function migrationNames() {
  return (await readdir("prisma/migrations")).filter(name => /^\d/.test(name)).sort();
}

export async function withDatabaseFixture(run: (prisma: PrismaClient) => Promise<void>) {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("Use npm run test:isolated for migration/seed tests.");
  const schema = `auth_fixture_${randomUUID().replaceAll("-", "")}`;
  const url = new URL(base);
  url.searchParams.set("schema", schema);
  const admin = getPrisma();
  const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  try {
    await run(prisma);
  } finally {
    await prisma.$disconnect();
    if (!/^auth_fixture_[a-f0-9]{32}$/.test(schema)) throw new Error("Invalid fixture schema.");
    await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  }
}
