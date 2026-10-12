import type { ActionStatus } from "@prisma/client";

export class ActionError extends Error {
  constructor(public status: number, public code: string, message: string, public fields?: Record<string, string>) {
    super(message);
  }
}
export const invalidAction = (fields: Record<string, string>): never => {
  throw new ActionError(400, "VALIDATION_ERROR", "One or more fields are invalid.", fields);
};
export const invalidAssignee = (): never => {
  throw new ActionError(400, "INVALID_ACTION_ASSIGNEE", "Select an active IT Staff or Administrator assignee.", { assigneeId: "Select an active IT Staff or Administrator assignee." });
};
export const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const contentKeys = ["actionDescription", "actionResult", "followUpRequired", "followUpNote", "attachmentNotes"] as const;
const mutationKeys = [...contentKeys, "assigneeId", "status"];
export interface ActionContent {
  actionDescription: string;
  actionResult: string;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
}
export type ActionChange = Partial<ActionContent> & { assigneeId?: string; status?: ActionStatus };

export function validateContent(body: Record<string, unknown>): ActionContent {
  const fields: Record<string, string> = Object.create(null);
  for (const key of ["actionDescription", "actionResult"] as const) {
    if (typeof body[key] !== "string" || !body[key].trim() || body[key].trim().length > 2000) fields[key] = "Enter 1 to 2000 characters after trimming.";
  }
  if (typeof body.followUpRequired !== "boolean") fields.followUpRequired = "Enter a JSON boolean.";
  const notes: Record<string, string | null> = {};
  for (const key of ["followUpNote", "attachmentNotes"] as const) {
    const value = body[key];
    if (value !== undefined && value !== null && (typeof value !== "string" || value.trim().length > 2000)) fields[key] = "Enter text up to 2000 characters or null.";
    notes[key] = typeof value === "string" ? value.trim() || null : null;
  }
  if (body.followUpRequired === true && !notes.followUpNote) fields.followUpNote = "Enter a follow-up note when follow-up is required.";
  for (const key of ["actionDescription", "actionResult", "followUpNote", "attachmentNotes"] as const) {
    if (typeof body[key] === "string" && body[key].includes("\u0000")) fields[key] = "NUL characters are not permitted.";
  }
  if (Object.keys(fields).length) invalidAction(fields);
  return { actionDescription: (body.actionDescription as string).trim(), actionResult: (body.actionResult as string).trim(), followUpRequired: body.followUpRequired as boolean, followUpNote: notes.followUpNote, attachmentNotes: notes.attachmentNotes };
}

export function validateActionBody(value: unknown, create: boolean): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalidAction({ body: "Enter a JSON object." });
  const body = value as Record<string, unknown>;
  const allowed = create ? [...contentKeys, "assigneeId", "clientRequestId"] : [...mutationKeys, "expectedVersion"];
  const fields: Record<string, string> = Object.create(null);
  for (const key of Object.keys(body)) if (!allowed.includes(key)) fields[key] = "This field is not permitted.";
  if (create && !uuid(body.clientRequestId)) fields.clientRequestId = "Enter a UUID request ID.";
  if (!create) {
    if (!Number.isSafeInteger(body.expectedVersion) || (body.expectedVersion as number) < 1 || (body.expectedVersion as number) > 2147483647) fields.expectedVersion = "Enter an integer version greater than or equal to 1.";
    if (!mutationKeys.some(key => Object.hasOwn(body, key))) fields.body = "Include at least one action field.";
    if ("status" in body && !["PENDING", "COMPLETED", "CANCELLED"].includes(body.status as string)) fields.status = "Select a valid Action status.";
    // Validate supplied types before merging, while conditional rules use merged content.
    for (const key of contentKeys) {
      if (!(key in body)) continue;
      const val = body[key];
      if (key === "followUpRequired") {
        if (typeof val !== "boolean") fields[key] = "Enter a JSON boolean.";
      } else if (key === "followUpNote" || key === "attachmentNotes") {
        if (val !== null && (typeof val !== "string" || val.trim().length > 2000)) fields[key] = "Enter text up to 2000 characters or null.";
      } else if (typeof val !== "string" || !val.trim() || val.trim().length > 2000) fields[key] = "Enter 1 to 2000 characters after trimming.";
    }
  }
  for (const key of ["actionDescription", "actionResult", "followUpNote", "attachmentNotes"] as const) {
    if (typeof body[key] === "string" && body[key].includes("\u0000")) fields[key] = "NUL characters are not permitted.";
  }
  if (Object.keys(fields).length) invalidAction(fields);
  if ("assigneeId" in body && !uuid(body.assigneeId)) invalidAssignee();
  if (create) validateContent(body);
  return body;
}
