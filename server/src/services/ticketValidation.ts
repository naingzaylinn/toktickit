export const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;

export type RequestedPriorityValue = (typeof PRIORITIES)[number];

export interface ValidationDetail {
    field: string;
    message: string;
}

const UUID_V4_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateSummary(value: unknown): ValidationDetail | null {
    if (typeof value !== "string") {
        return {
            field: "summary",
            message: "Summary must be between 5 and 120 characters.",
        };
    }

    const trimmed = value.trim();

    if (trimmed.length < 5 || trimmed.length > 120) {
        return {
            field: "summary",
            message: "Summary must be between 5 and 120 characters.",
        };
    }

    return null;
}

export function validateDescription(value: unknown): ValidationDetail | null {
    if (typeof value !== "string") {
        return {
            field: "description",
            message: "Description must be between 10 and 2000 characters.",
        };
    }

    const trimmed = value.trim();

    if (trimmed.length < 10 || trimmed.length > 2000) {
        return {
            field: "description",
            message: "Description must be between 10 and 2000 characters.",
        };
    }

    return null;
}

export function normalizePriority(
    value: unknown
): RequestedPriorityValue | null {
    if (value === undefined || value === null || value === "") {
        return "Medium";
    }

    if (
        typeof value === "string" &&
        PRIORITIES.includes(value as RequestedPriorityValue)
    ) {
        return value as RequestedPriorityValue;
    }

    return null;
}

export function validateClientRequestId(
    value: unknown
): ValidationDetail | null {
    if (typeof value !== "string" || !UUID_V4_REGEX.test(value)) {
        return {
            field: "clientRequestId",
            message: "clientRequestId must be a valid UUID v4.",
        };
    }

    return null;
}

export function validateCategoryId(
    value: unknown
): ValidationDetail | null {
    if (
        typeof value !== "number" ||
        !Number.isInteger(value) ||
        value <= 0
    ) {
        return {
            field: "categoryId",
            message: "Category is invalid.",
        };
    }

    return null;
}

export function validateRelatedSystemId(
    value: unknown
): ValidationDetail | null {
    if (typeof value !== "string" || !UUID_REGEX.test(value)) {
        return {
            field: "relatedSystemId",
            message: "Related System is invalid.",
        };
    }

    return null;
}