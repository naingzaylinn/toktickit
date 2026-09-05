import { getPrisma } from "../src/prisma.js";

// Lab 1 categories
const CATEGORIES = [
  "Account and Access",
  "Hardware",
  "Software",
  "Network",
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

  for (const name of CATEGORIES) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  for (const req of DEVELOPMENT_REQUESTERS) {
    await prisma.developmentRequester.upsert({
      where: { email: req.email },
      update: {
        id: req.id,
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
