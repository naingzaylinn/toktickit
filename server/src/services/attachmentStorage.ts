import {
    mkdir,
    readFile,
    unlink,
    writeFile,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const STORAGE_DIRECTORY =
    path.resolve(process.cwd(), "storage", "attachments");

async function ensureStorageDirectory() {
    await mkdir(STORAGE_DIRECTORY, {
        recursive: true,
    });
}

function extensionForMimeType(
    mimeType: string
): string {
    switch (mimeType) {
        case "image/jpeg":
            return ".jpg";

        case "image/png":
            return ".png";

        case "image/webp":
            return ".webp";

        case "application/pdf":
            return ".pdf";

        default:
            return "";
    }
}

export async function saveAttachmentBinary(
    buffer: Buffer,
    mimeType: string
): Promise<string> {
    await ensureStorageDirectory();

    const extension =
        extensionForMimeType(mimeType);

    if (!extension) {
        throw new Error(
            "Unsupported attachment MIME type."
        );
    }

    const storageKey =
        `${randomUUID()}${extension}`;

    const filePath = path.join(
        STORAGE_DIRECTORY,
        storageKey
    );

    await writeFile(filePath, buffer);

    return storageKey;
}

export async function readAttachmentBinary(
    storageKey: string
): Promise<Buffer> {
    const filePath = path.join(
        STORAGE_DIRECTORY,
        storageKey
    );

    return readFile(filePath);
}

export async function deleteAttachmentBinary(
    storageKey: string
): Promise<void> {
    const filePath = path.join(
        STORAGE_DIRECTORY,
        storageKey
    );

    try {
        await unlink(filePath);
    } catch (error: unknown) {
        if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "ENOENT"
        ) {
            return;
        }

        throw error;
    }
}

export function getAttachmentStorageDirectory() {
    return STORAGE_DIRECTORY;
}