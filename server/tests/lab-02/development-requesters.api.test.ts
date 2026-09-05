import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import { app } from "../../src/app.js";
import { requireDevelopmentRequester } from "../../src/middleware/requesterContext.js";

// Isolated test app for validating the reusable requireDevelopmentRequester middleware
const protectedTestApp = express();
protectedTestApp.use(express.json());
protectedTestApp.post("/api/v1/tickets", requireDevelopmentRequester, (req, res) => {
  res.status(200).json({
    status: "ok",
    requester: {
      id: req.requester?.id,
      name: req.requester?.name,
      email: req.requester?.email,
    },
  });
});

describe("Feature-A: Development Requester Context API Tests", () => {
  // Active requesters seeded
  const ALICE_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
  // Inactive requester seeded
  const EVAN_INACTIVE_ID = "e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b";
  // Nonexistent UUID
  const NONEXISTENT_ID = "00000000-0000-0000-0000-000000000000";

  // API-001: Retrieve active development requesters via GET /api/v1/development-requesters
  it("API-001: retrieves active development requesters ordered by name ASC and excludes inactive requesters", async () => {
    const res = await request(app)
      .get("/api/v1/development-requesters")
      .set("Accept", "application/json");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(Array.isArray(res.body.data)).toBe(true);

    const requesters = res.body.data;
    expect(requesters.length).toBeGreaterThanOrEqual(4);

    // Ensure all returned requesters are active (Evan must NOT be present)
    const names = requesters.map((r: { name: string }) => r.name);
    expect(names).toContain("Alice Developer");
    expect(names).toContain("Bob Developer");
    expect(names).toContain("Charlie Developer");
    expect(names).toContain("Diana Developer");
    expect(names).not.toContain("Evan Developer");

    // Check properties on each item
    for (const r of requesters) {
      expect(r).toHaveProperty("id");
      expect(r).toHaveProperty("name");
      expect(r).toHaveProperty("email");
      // DTO encapsulation: internal fields should not be exposed
      expect(r).not.toHaveProperty("isActive");
    }

    // Verify ordering: name ASC
    for (let i = 0; i < requesters.length - 1; i++) {
      expect(requesters[i].name.localeCompare(requesters[i + 1].name)).toBeLessThanOrEqual(0);
    }
  });

  // API-002: Inactive requester header
  it("API-002: returns 400 Bad Request with code INACTIVE_REQUESTER when using inactive requester header", async () => {
    const res = await request(protectedTestApp)
      .post("/api/v1/tickets")
      .set("X-Development-Requester-Id", EVAN_INACTIVE_ID)
      .send({ summary: "Test ticket" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error.code).toBe("INACTIVE_REQUESTER");
    expect(res.body.error).toHaveProperty("message");
    expect(res.body.error).toHaveProperty("correlationId");
  });

  // API-003: Nonexistent requester UUID header
  it("API-003: returns 400 Bad Request with code REQUESTER_NOT_FOUND when requester UUID does not exist", async () => {
    const res = await request(protectedTestApp)
      .post("/api/v1/tickets")
      .set("X-Development-Requester-Id", NONEXISTENT_ID)
      .send({ summary: "Test ticket" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error.code).toBe("REQUESTER_NOT_FOUND");
    expect(res.body.error).toHaveProperty("message");
    expect(res.body.error).toHaveProperty("correlationId");
  });

  // API-004: Malformed non-UUID requester header
  it("API-004: returns 400 Bad Request with code INVALID_REQUESTER_ID when header is not a valid UUID", async () => {
    const res = await request(protectedTestApp)
      .post("/api/v1/tickets")
      .set("X-Development-Requester-Id", "not-a-valid-uuid-1234")
      .send({ summary: "Test ticket" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error.code).toBe("INVALID_REQUESTER_ID");
    expect(res.body.error).toHaveProperty("message");
    expect(res.body.error).toHaveProperty("correlationId");
  });

  // API-004B: Missing requester header entirely
  it("API-004B: returns 400 Bad Request with code MISSING_REQUESTER_HEADER when header is completely absent", async () => {
    const res = await request(protectedTestApp)
      .post("/api/v1/tickets")
      .send({ summary: "Test ticket" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error.code).toBe("MISSING_REQUESTER_HEADER");
    expect(res.body.error).toHaveProperty("message");
    expect(res.body.error).toHaveProperty("correlationId");
  });

  // Positive validation: Valid active requester header succeeds
  it("allows access to protected route when X-Development-Requester-Id is valid and active", async () => {
    const res = await request(protectedTestApp)
      .post("/api/v1/tickets")
      .set("X-Development-Requester-Id", ALICE_ID)
      .send({ summary: "Valid ticket test" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.requester.id).toBe(ALICE_ID);
  });
});
