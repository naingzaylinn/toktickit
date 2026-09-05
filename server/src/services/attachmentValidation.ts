import path from "node:path";

export const MAX_ATTACHMENT_SIZE =
    5 * 1024 * 1024;

export const MAX_ACTIVE_ATTACHMENTS = 5;

const ALLOWED_EXTENSIONS = [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".pdf",
];

const ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
];

export interface AttachmentValidationResult {
    valid: boolean;
    detectedMimeType?: string;
    reason?: string;
}

function getExtension(
    filename: string
): string {
    return path
        .extname(filename)
        .toLowerCase();
}

function detectMimeTypeFromSignature(
    buffer: Buffer
): string | null {
    if (buffer.length < 4) {
        return null;
    }

    // JPEG: FF D8 FF
    if (
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
    ) {
        return "image/jpeg";
    }

    // PNG:
    // 89 50 4E 47 0D 0A 1A 0A
    if (
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
    ) {
        return "image/png";
    }

    // PDF: %PDF
    if (
        buffer[0] === 0x25 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x44 &&
        buffer[3] === 0x46
    ) {
        return "application/pdf";
    }

    // WEBP:
    // RIFF....WEBP
    if (
        buffer.length >= 12 &&
        buffer.toString("ascii", 0, 4) ===
        "RIFF" &&
        buffer.toString("ascii", 8, 12) ===
        "WEBP"
    ) {
        return "image/webp";
    }

    return null;
}

function mimeMatchesExtension(
    extension: string,
    mimeType: string
): boolean {
    if (
        extension === ".jpg" ||
        extension === ".jpeg"
    ) {
        return mimeType === "image/jpeg";
    }

    if (extension === ".png") {
        return mimeType === "image/png";
    }

    if (extension === ".webp") {
        return mimeType === "image/webp";
    }

    if (extension === ".pdf") {
        return mimeType === "application/pdf";
    }

    return false;
}

export interface UploadedAttachmentFile {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
}

export function validateAttachmentFile(
    file: UploadedAttachmentFile
): AttachmentValidationResult {
    const extension =
        getExtension(file.originalname);

    if (
        !ALLOWED_EXTENSIONS.includes(extension)
    ) {
        return {
            valid: false,
            reason:
                "Unsupported file format. Allowed formats: JPG, PNG, WEBP, PDF.",
        };
    }

    if (
        !ALLOWED_MIME_TYPES.includes(
            file.mimetype
        )
    ) {
        return {
            valid: false,
            reason:
                "Unsupported file format. Allowed formats: JPG, PNG, WEBP, PDF.",
        };
    }

    if (file.size > MAX_ATTACHMENT_SIZE) {
        return {
            valid: false,
            reason:
                "File size exceeds the 5 MB maximum limit.",
        };
    }

    const detectedMimeType =
        detectMimeTypeFromSignature(
            file.buffer
        );

    if (!detectedMimeType) {
        return {
            valid: false,
            reason:
                "File content does not match a supported attachment type.",
        };
    }

    if (
        detectedMimeType !== file.mimetype ||
        !mimeMatchesExtension(
            extension,
            detectedMimeType
        )
    ) {
        return {
            valid: false,
            reason:
                "File content does not match its declared file type.",
        };
    }

    return {
        valid: true,
        detectedMimeType,
    };
}