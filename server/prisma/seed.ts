import { getPrisma } from "../src/prisma.js";

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

export async function seed() {
  const prisma = getPrisma();

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

  console.log("Seeded database successfully.");
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });