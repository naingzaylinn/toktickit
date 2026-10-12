import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { ActionError, validateActionBody, validateContent } from "../../src/services/actionValidation.js";

const base = { clientRequestId: randomUUID(), actionDescription: "Work", actionResult: "Observation", followUpRequired: false };
describe("Action validation boundaries", () => {
  it.each(["actionDescription", "actionResult", "followUpNote", "attachmentNotes"])("rejects NUL in %s on create and PATCH", key => {
    for (const validate of [() => validateContent({ ...base, [key]: "a\u0000b" }), () => validateActionBody({ ...base, [key]: "a\u0000b" }, true), () => validateActionBody({ expectedVersion: 1, [key]: "a\u0000b" }, false)]) {
      try { validate(); throw new Error("Expected validation rejection"); }
      catch (error) { expect(error).toBeInstanceOf(ActionError); expect(error).toMatchObject({ status: 400, code: "VALIDATION_ERROR", fields: { [key]: "NUL characters are not permitted." } }); }
    }
  });
  it.each([1, 2000])("accepts trimmed text at %i characters", length => {
    const text = "x".repeat(length);
    expect(validateContent({ ...base, actionDescription: ` ${text} `, actionResult: text })).toMatchObject({ actionDescription: text, actionResult: text });
  });
  it.each([undefined, null, "", " ", 1, true, [], {}, "x".repeat(2001)])("rejects required text %j", value => {
    for (const key of ["actionDescription", "actionResult"]) {
      expect(() => validateContent({ ...base, [key]: value })).toThrow(ActionError);
    }
  });
  it.each([undefined, null, 0, 1, "true", "false", [], {}])("rejects nonboolean follow-up %j", value => {
    expect(() => validateContent({ ...base, followUpRequired: value })).toThrow(ActionError);
  });
  it.each([undefined, null, "", " \n "]) ("normalizes optional blank notes %j and rejects them when follow-up is true", value => {
    expect(validateContent({ ...base, followUpNote: value, attachmentNotes: value })).toMatchObject({ followUpNote: null, attachmentNotes: null });
    expect(() => validateContent({ ...base, followUpRequired: true, followUpNote: value })).toThrow(ActionError);
  });
  it("preserves literal shared markup/file text and accepts 2000-character optional notes", () => {
    expect(validateContent({ ...base, attachmentNotes: " <script>literal</script> file.txt " }).attachmentNotes).toBe("<script>literal</script> file.txt");
    expect(validateContent({ ...base, followUpRequired: true, followUpNote: "x".repeat(2000), attachmentNotes: "x".repeat(2000) }).followUpNote).toHaveLength(2000);
  });
  it.each([false, 1, [], {}, "x".repeat(2001)])("rejects optional note wrong type/length %j", value => {
    for (const key of ["followUpNote", "attachmentNotes"]) expect(() => validateContent({ ...base, [key]: value })).toThrow(ActionError);
  });
  it.each([null, [], "text", 1, true])("requires object body %j", value => {
    expect(() => validateActionBody(value, true)).toThrow(ActionError);
    expect(() => validateActionBody(value, false)).toThrow(ActionError);
  });
  it.each([undefined, null, 0, -1, 1.5, "1", true, 2147483648, Number.MAX_SAFE_INTEGER + 1])("rejects invalid version %j", expectedVersion => {
    expect(() => validateActionBody({ expectedVersion, actionResult: "Result" }, false)).toThrow(ActionError);
  });
  it.each(["userId", "performedById", "ownerId", "actionDateTime", "createdAt", "updatedAt", "editorId", "completedBy", "cancelledBy", "ticketId", "version", "revisions"]) ("rejects server-managed field %s", key => {
    expect(() => validateActionBody({ ...base, [key]: randomUUID() }, true)).toThrow(ActionError);
    expect(() => validateActionBody({ expectedVersion: 1, actionResult: "Work", [key]: randomUUID() }, false)).toThrow(ActionError);
  });
  it("rejects unknown prototype-named JSON fields", () => {
    const injection = JSON.parse('{"__proto__":"forged"}');
    expect(() => validateActionBody({ ...base, ...injection }, true)).toThrow(ActionError);
  });
});
