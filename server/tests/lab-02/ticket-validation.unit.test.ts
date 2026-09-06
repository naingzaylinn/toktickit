import { describe, it, expect } from "vitest";
import {
    normalizePriority,
    validateDescription,
    validateSummary,
} from "../../src/services/ticketValidation.js";

describe("Feature-D: Ticket validation unit tests", () => {
    // UT-001
    it("UT-001: Summary accepts trimmed values from 5 to 120 characters", () => {
        expect(validateSummary("12345")).toBeNull();
        expect(validateSummary("a".repeat(50))).toBeNull();
        expect(validateSummary("a".repeat(120))).toBeNull();

        expect(validateSummary("1234")).not.toBeNull();
        expect(validateSummary("a".repeat(121))).not.toBeNull();
    });

    // UT-002
    it("UT-002: Summary rejects whitespace-only input", () => {
        expect(validateSummary("     ")).toEqual({
            field: "summary",
            message: "Summary must be between 5 and 120 characters.",
        });
    });

    // UT-003
    it("UT-003: Description accepts trimmed values from 10 to 2000 characters", () => {
        expect(validateDescription("1234567890")).toBeNull();
        expect(validateDescription("a".repeat(500))).toBeNull();
        expect(validateDescription("a".repeat(2000))).toBeNull();

        expect(validateDescription("123456789")).not.toBeNull();
        expect(validateDescription("a".repeat(2001))).not.toBeNull();
    });

    // UT-004
    it("UT-004: Description rejects whitespace-only input", () => {
        expect(validateDescription("          ")).toEqual({
            field: "description",
            message: "Description must be between 10 and 2000 characters.",
        });
    });

    // UT-005
    it("UT-005: Priority accepts approved values and defaults to Medium", () => {
        expect(normalizePriority("Low")).toBe("Low");
        expect(normalizePriority("Medium")).toBe("Medium");
        expect(normalizePriority("High")).toBe("High");
        expect(normalizePriority("Urgent")).toBe("Urgent");

        expect(normalizePriority(undefined)).toBe("Medium");
        expect(normalizePriority(null)).toBe("Medium");
        expect(normalizePriority("")).toBe("Medium");

        expect(normalizePriority("Critical")).toBeNull();
    });
});