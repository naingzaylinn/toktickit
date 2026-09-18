import { getPrisma } from "../src/prisma.js";
import { pathToFileURL } from "node:url";
import { hashPassword } from "../src/services/passwords.js";
import { generateTicketNumber } from "../src/services/ticketNumber.js";
import type { Role, RequestedPriority } from "@prisma/client";

// LOCAL DEVELOPMENT / TEST ONLY. All newly seeded accounts must replace this
// initial password. Re-running the seed never resets an existing User password.
export const LOCAL_INITIAL_PASSWORD = "Initial123";
export const STAFF_USERS: { name: string; email: string; role: Role; isActive: boolean }[] = [
  { name: "IT Staff One", email: "staff1@example.com", role: "IT_STAFF", isActive: true },
  { name: "IT Staff Two", email: "staff2@example.com", role: "IT_STAFF", isActive: true },
  { name: "IT Staff Three", email: "staff3@example.com", role: "IT_STAFF", isActive: true },
  { name: "Inactive IT Staff", email: "staff-inactive@example.com", role: "IT_STAFF", isActive: false },
  { name: "Lab Administrator", email: "admin@example.com", role: "ADMINISTRATOR", isActive: true },
];

// Lab 1 categories, extended for Lab 2 active/inactive reference support
const CATEGORIES = [
  "Account and Access",
  "Hardware",
  "Software",
  "Network",
];

// Lab 2 Feature-C approved Related Systems
export const RELATED_SYSTEMS = [
  {
    id: "3f4a5b6c-7d8e-9f0a-1b2c-3d4e5f6a7b8c",
    name: "Campus Wi-Fi",
    isActive: true,
  },
  {
    id: "4a5b6c7d-8e9f-0a1b-2c3d-4e5f6a7b8c9d",
    name: "Email",
    isActive: true,
  },
  {
    id: "5b6c7d8e-9f0a-1b2c-3d4e-5f6a7b8c9d0e",
    name: "LEB2",
    isActive: true,
  },
  {
    id: "6c7d8e9f-0a1b-2c3d-4e5f-6a7b8c9d0e1f",
    name: "Printing Service",
    isActive: true,
  },
  {
    id: "7d8e9f0a-1b2c-3d4e-5f6a-7b8c9d0e1f2a",
    name: "Student Information System",
    isActive: true,
  },
  {
    id: "8e9f0a1b-2c3d-4e5f-6a7b-8c9d0e1f2a3b",
    name: "University Computer/Laptop",
    isActive: true,
  },
  {
    id: "9f0a1b2c-3d4e-5f6a-7b8c-9d0e1f2a3b4c",
    name: "VPN",
    isActive: true,
  },
];

// Lab 2 Feature-A approved Development Requesters
export const DEVELOPMENT_REQUESTERS = [
  {
    id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
    name: "Alice Developer",
    email: "alice@kmutt.ac.th",
    isActive: true,
  },
  {
    id: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
    name: "Bob Developer",
    email: "bob@kmutt.ac.th",
    isActive: true,
  },
  {
    id: "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f",
    name: "Charlie Developer",
    email: "charlie@kmutt.ac.th",
    isActive: true,
  },
  {
    id: "d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a",
    name: "Diana Developer",
    email: "diana@kmutt.ac.th",
    isActive: true,
  },
  {
    id: "e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b",
    name: "Evan Developer",
    email: "evan@kmutt.ac.th",
    isActive: false,
  },
];

export async function seed(prisma = getPrisma()) {

  // Seed Categories
  for (const name of CATEGORIES) {
    await prisma.category.upsert({
      where: { name },
      update: {
        isActive: true,
      },
      create: {
        name,
        isActive: true,
      },
    });
  }

  // Seed Related Systems
  for (const system of RELATED_SYSTEMS) {
    await prisma.relatedSystem.upsert({
      where: { name: system.name },
      update: {
        isActive: system.isActive,
      },
      create: {
        id: system.id,
        name: system.name,
        isActive: system.isActive,
      },
    });
  }

  // Seed Development Requesters
  for (const req of DEVELOPMENT_REQUESTERS) {
    await prisma.developmentRequester.upsert({
      where: { email: req.email },
      update: {
        name: req.name,
        isActive: req.isActive,
      },
      create: {
        id: req.id,
        name: req.name,
        email: req.email,
        isActive: req.isActive,
      },
    });
  }

  const passwordHash = await hashPassword(LOCAL_INITIAL_PASSWORD);
  // Include existing Lab 2 identities, using their actual persisted IDs. Do not
  // replace an ID just because an older database used a different seed UUID.
  const requesters = await prisma.developmentRequester.findMany();
  for (const requester of requesters) {
    await prisma.user.upsert({
      where: { id: requester.id },
      update: {},
      create: {
        id: requester.id, name: requester.name, email: requester.email.trim().toLowerCase(),
        role: "REQUESTER", isActive: requester.isActive, passwordHash,
        mustChangePassword: true, createdAt: requester.createdAt,
      },
    });
  }
  for (const user of STAFF_USERS) {
    await prisma.user.upsert({
      where: { email: user.email }, update: {},
      create: { ...user, passwordHash, mustChangePassword: true },
    });
  }

  // Preserve every existing ticket. Add repeatable examples for the four active
  // lab identities using the current Lab 2 schema. Staff ownership/status,
  // Comments and Notes will be seeded with their later feature migrations.
  const examples: { summary: string; description: string; priority: RequestedPriority; system: string }[] = [
    { summary: "Wi-Fi disconnects during lectures", description: "The campus wireless connection drops every few minutes in the lecture room.", priority: "High", system: "Campus Wi-Fi" },
    { summary: "Printer produces faded pages", description: "Pages from the shared printer are too faint to read even after replacing paper.", priority: "Medium", system: "Printing Service" },
    { summary: "Cannot submit coursework in LEB2", description: "The submission page reports an error before tonight's coursework deadline.", priority: "Urgent", system: "LEB2" },
    { summary: "Email signature needs updating", description: "Please help update the contact information shown in my university email signature.", priority: "Low", system: "Email" },
  ];
  for (const [index, example] of examples.entries()) {
    const requester = requesters.find(item => item.email === DEVELOPMENT_REQUESTERS[index].email)!;
    const category = await prisma.category.findUniqueOrThrow({ where: { name: index === 0 ? "Network" : index === 1 ? "Hardware" : "Software" } });
    const system = await prisma.relatedSystem.findUniqueOrThrow({ where: { name: example.system } });
    const clientRequestId = `lab3-seed-${requester.id}`;
    await prisma.$transaction(async (tx) => {
      if (await tx.ticket.findUnique({ where: { requesterId_clientRequestId: { requesterId: requester.id, clientRequestId } } })) return;
      await tx.ticket.create({ data: {
        ticketNumber: await generateTicketNumber(tx, new Date().getFullYear()),
        requesterId: requester.id, clientRequestId, categoryId: category.id, relatedSystemId: system.id,
        summary: example.summary, description: example.description, requestedPriority: example.priority,
      } });
    });
  }

  console.log("Seeded database successfully.");
}

// Importing the seed in tests must not mutate the default database.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) seed()
  .catch((e) => {
    console.error("Database seed failed.");
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
