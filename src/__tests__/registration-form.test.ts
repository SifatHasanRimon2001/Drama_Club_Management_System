import { describe, it, expect } from "vitest";
import { buildDynamicSchema } from "@/lib/registration-form";
import {
  ALLOWED_STATUS_TRANSITIONS,
  allowedTransitionsFor,
  isAllowedTransition,
} from "@/lib/registration-window-transitions";

describe("buildDynamicSchema (extracted registration form schema builder)", () => {
  it("makes required text fields mandatory with the label in the message", () => {
    const schema = buildDynamicSchema({
      fields: [{ name: "why", type: "text", required: true, label: "Your reason" }],
    });
    expect(schema.safeParse({}).success).toBe(false); // missing -> fails
    expect(schema.safeParse({ why: "x" }).success).toBe(true);

    const empty = schema.safeParse({ why: "" });
    expect(empty.success).toBe(false);
    if (!empty.success) {
      expect(empty.error.issues[0].message).toBe("Your reason is required");
    }
  });

  it("treats optional text fields as optional", () => {
    const schema = buildDynamicSchema({
      fields: [{ name: "note", type: "textarea", required: false }],
    });
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ note: "hi" }).success).toBe(true);
  });

  it("validates select fields against their options", () => {
    const schema = buildDynamicSchema({
      fields: [{ name: "dept", type: "select", options: ["acting", "tech"] }],
    });
    expect(schema.safeParse({ dept: "acting" }).success).toBe(true);
    expect(schema.safeParse({ dept: "other" }).success).toBe(false);
    expect(schema.safeParse({ dept: "acting", extra: 1 }).success).toBe(true);
  });

  it("treats a select without options as a free string", () => {
    const schema = buildDynamicSchema({ fields: [{ name: "dept", type: "select" }] });
    expect(schema.safeParse({ dept: "anything" }).success).toBe(true);
  });

  it("requires checkboxes to be booleans; a required checkbox must be true", () => {
    const schema = buildDynamicSchema({
      fields: [{ name: "agree", type: "checkbox", required: true }],
    });
    expect(schema.safeParse({ agree: true }).success).toBe(true);
    expect(schema.safeParse({ agree: false }).success).toBe(false); // explicit false cannot pass for a required checkbox
    expect(schema.safeParse({ agree: "yes" }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
  });

  it("allows false for an optional checkbox", () => {
    const schema = buildDynamicSchema({
      fields: [{ name: "updates", type: "checkbox", required: false }],
    });
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ updates: false }).success).toBe(true);
    expect(schema.safeParse({ updates: true }).success).toBe(true);
  });

  it("rejects an empty string for a number field (no silent 0)", () => {
    const schema = buildDynamicSchema({
      fields: [{ name: "years", type: "number", required: true }],
    });
    expect(schema.safeParse({ years: "" }).success).toBe(false);
    expect(schema.safeParse({ years: null }).success).toBe(false);
    expect(schema.safeParse({ years: 3 }).success).toBe(true);
    expect(schema.safeParse({ years: "3" }).success).toBe(true); // coerced
  });

  it("falls back to a string for unknown field types", () => {
    const schema = buildDynamicSchema({
      fields: [{ name: "mystery", type: "color-picker" }],
    });
    expect(schema.safeParse({ mystery: "anything" }).success).toBe(true);
  });

  it("throws on duplicate or missing field names", () => {
    expect(() =>
      buildDynamicSchema({
        fields: [
          { name: "dup", type: "text" },
          { name: "dup", type: "text" },
        ],
      })
    ).toThrow(/duplicate or missing field name 'dup'/);

    expect(() =>
      buildDynamicSchema({ fields: [{ name: "", type: "text" }] })
    ).toThrow(/duplicate or missing field name ''/);
  });

  it("handles an empty or missing fields array", () => {
    expect(buildDynamicSchema({}).safeParse({ anything: 1 }).success).toBe(true);
    expect(buildDynamicSchema({ fields: [] }).safeParse({}).success).toBe(true);
  });

  it("strips unknown top-level fields but keeps known ones", () => {
    const schema = buildDynamicSchema({ fields: [{ name: "a", type: "text" }] });
    const parsed = schema.safeParse({ a: "x", unknown: true });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({ a: "x" });
    }
  });
});

describe("Registration window transition helpers", () => {
  it("defines the PRD §4 state machine exactly", () => {
    expect(ALLOWED_STATUS_TRANSITIONS).toEqual({
      DRAFT: ["SCHEDULED", "LIVE"],
      SCHEDULED: ["LIVE"],
      LIVE: ["CLOSED"],
      CLOSED: ["LIVE"],
    });
  });

  it("returns the allowed targets for a known status", () => {
    expect(allowedTransitionsFor("DRAFT")).toEqual(["SCHEDULED", "LIVE"]);
    expect(allowedTransitionsFor("LIVE")).toEqual(["CLOSED"]);
  });

  it("returns an empty list for an unknown status (defensive fallback)", () => {
    expect(allowedTransitionsFor("BOGUS")).toEqual([]);
  });

  it("isAllowedTransition answers for the machine edges", () => {
    expect(isAllowedTransition("DRAFT", "LIVE")).toBe(true);
    expect(isAllowedTransition("CLOSED", "LIVE")).toBe(true);
    expect(isAllowedTransition("LIVE", "DRAFT")).toBe(false);
    expect(isAllowedTransition("DRAFT", "CLOSED")).toBe(false);
    expect(isAllowedTransition("BOGUS", "LIVE")).toBe(false);
  });
});
