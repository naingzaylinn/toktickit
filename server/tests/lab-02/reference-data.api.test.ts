import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { RELATED_SYSTEMS, seed } from "../../prisma/seed.js";

describe("Feature-C: Ticket Reference Data", () => {
    const prisma = getPrisma();

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // API-005
    it("API-005: GET /api/v1/categories returns only active categories ordered by name", async () => {
        const software = await prisma.category.findUniqueOrThrow({
            where: {
                name: "Software",
            },
        });

        await prisma.category.update({
            where: {
                id: software.id,
            },
            data: {
                isActive: false,
            },
        });

        try {
            const res = await request(app).get("/api/v1/categories");

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("data");
            expect(Array.isArray(res.body.data)).toBe(true);

            const names = res.body.data.map(
                (c: { id: number; name: string }) => c.name
            );

            expect(names).toEqual([
                "Account and Access",
                "Hardware",
                "Network",
            ]);

            expect(names).not.toContain("Software");

            for (const category of res.body.data) {
                expect(category).toHaveProperty("id");
                expect(category).toHaveProperty("name");
                expect(category).not.toHaveProperty("isActive");
            }
        } finally {
            await prisma.category.update({
                where: {
                    id: software.id,
                },
                data: {
                    isActive: true,
                },
            });
        }
    });

    // API-006
    it("API-006: GET /api/v1/related-systems returns only active systems ordered by name", async () => {
        const inactive = await prisma.relatedSystem.create({
            data: {
                name: "Inactive Test System",
                isActive: false,
            },
        });

        try {
            const res = await request(app).get("/api/v1/related-systems");

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("data");
            expect(Array.isArray(res.body.data)).toBe(true);

            const names = res.body.data.map(
                (s: { id: string; name: string }) => s.name
            );

            expect(names).toEqual([
                "Campus Wi-Fi",
                "Email",
                "LEB2",
                "Printing Service",
                "Student Information System",
                "University Computer/Laptop",
                "VPN",
            ]);

            expect(names).not.toContain("Inactive Test System");

            for (const system of res.body.data) {
                expect(system).toHaveProperty("id");
                expect(system).toHaveProperty("name");
                expect(system).not.toHaveProperty("isActive");
            }
        } finally {
            await prisma.relatedSystem.delete({
                where: { id: inactive.id },
            });
        }
    });

    // API-007
    it("API-007: required active Related Systems are seeded", async () => {
        const systems = await prisma.relatedSystem.findMany({
            where: {
                isActive: true,
            },
            orderBy: {
                name: "asc",
            },
        });

        expect(systems.map((s) => s.name)).toEqual([
            "Campus Wi-Fi",
            "Email",
            "LEB2",
            "Printing Service",
            "Student Information System",
            "University Computer/Laptop",
            "VPN",
        ]);
    });

    // API-008
    it("API-008: seed execution is idempotent", async () => {
        const beforeCategories = await prisma.category.count();
        const beforeSystems = await prisma.relatedSystem.count();
        const beforeRequesters = await prisma.developmentRequester.count();

        await seed();

        const afterFirstCategories = await prisma.category.count();
        const afterFirstSystems = await prisma.relatedSystem.count();
        const afterFirstRequesters = await prisma.developmentRequester.count();

        await seed();

        const afterSecondCategories = await prisma.category.count();
        const afterSecondSystems = await prisma.relatedSystem.count();
        const afterSecondRequesters = await prisma.developmentRequester.count();

        expect(afterFirstCategories).toBe(beforeCategories);
        expect(afterFirstSystems).toBe(beforeSystems);
        expect(afterFirstRequesters).toBe(beforeRequesters);

        expect(afterSecondCategories).toBe(afterFirstCategories);
        expect(afterSecondSystems).toBe(afterFirstSystems);
        expect(afterSecondRequesters).toBe(afterFirstRequesters);
    });

    // API-013
    it("API-013: reference-data endpoints return empty arrays when no active records exist", async () => {
        const categorySpy = vi
            .spyOn(prisma.category, "findMany")
            .mockResolvedValueOnce([]);

        const systemSpy = vi
            .spyOn(prisma.relatedSystem, "findMany")
            .mockResolvedValueOnce([]);

        const categoryRes = await request(app).get("/api/v1/categories");
        const systemRes = await request(app).get("/api/v1/related-systems");

        expect(categoryRes.status).toBe(200);
        expect(categoryRes.body).toEqual({ data: [] });

        expect(systemRes.status).toBe(200);
        expect(systemRes.body).toEqual({ data: [] });

        categorySpy.mockRestore();
        systemSpy.mockRestore();
    });

    // API-014
    it("API-014: reference-data endpoints return safe 500 errors on database failure", async () => {
        const categorySpy = vi
            .spyOn(prisma.category, "findMany")
            .mockRejectedValueOnce(
                new Error("Prisma SQL connection details should never leak")
            );

        const categoryRes = await request(app).get("/api/v1/categories");

        expect(categoryRes.status).toBe(500);
        expect(categoryRes.body.error.code).toBe("INTERNAL_SERVER_ERROR");
        expect(categoryRes.body.error.message).toBe(
            "Failed to fetch categories."
        );
        expect(categoryRes.body.error).toHaveProperty("correlationId");

        expect(JSON.stringify(categoryRes.body)).not.toContain("Prisma");
        expect(JSON.stringify(categoryRes.body)).not.toContain("SQL");

        categorySpy.mockRestore();

        const systemSpy = vi
            .spyOn(prisma.relatedSystem, "findMany")
            .mockRejectedValueOnce(
                new Error("Database connection string must remain private")
            );

        const systemRes = await request(app).get("/api/v1/related-systems");

        expect(systemRes.status).toBe(500);
        expect(systemRes.body.error.code).toBe("INTERNAL_SERVER_ERROR");
        expect(systemRes.body.error.message).toBe(
            "Failed to fetch related systems."
        );
        expect(systemRes.body.error).toHaveProperty("correlationId");

        expect(JSON.stringify(systemRes.body)).not.toContain("Database connection");

        systemSpy.mockRestore();
    });
});