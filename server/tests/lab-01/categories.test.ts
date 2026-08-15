import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

describe("GET /api/categories", () => {
  it("returns the four seeded categories in id order", async () => {
    const res = await request(app).get("/api/categories");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(4);
    expect(res.body.map((c: { id: number; name: string }) => c.name)).toEqual([
      "Account and Access",
      "Hardware",
      "Software",
      "Network",
    ]);
    for (let i = 0; i < res.body.length; i++) {
      expect(res.body[i]).toHaveProperty("id");
      expect(typeof res.body[i].id).toBe("number");
      expect(res.body[i]).toHaveProperty("name");
    }
    for (let i = 0; i < res.body.length - 1; i++) {
      expect(res.body[i].id).toBeLessThan(res.body[i + 1].id);
    }
  });
});

