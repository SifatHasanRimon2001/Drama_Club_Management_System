import { z } from "zod";

/**
 * Build a dynamic Zod schema from a registration window's formSchema.
 * PRD §5: "validates against formSchema via Zod built dynamically"
 *
 * Field shape: { name, type: "text"|"textarea"|"select"|"checkbox"|"number",
 *                required?, label?, options? }
 */
export function buildDynamicSchema(
  formSchema: Record<string, unknown>
): z.ZodObject<z.ZodRawShape> {
  const fields = (formSchema as {
    fields?: Array<{
      name: string;
      type: string;
      required?: boolean;
      label?: string;
      options?: string[];
    }>;
  }).fields || [];
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    if (!field.name || shape[field.name]) {
      throw new Error(
        `Invalid form schema: duplicate or missing field name '${field.name}'`
      );
    }

    let fieldSchema: z.ZodTypeAny;

    switch (field.type) {
      case "textarea":
      case "text":
        fieldSchema = z.string();
        break;
      case "select":
        // Validate against allowed options if provided
        if (field.options && field.options.length > 0) {
          fieldSchema = z.enum(field.options as [string, ...string[]]);
        } else {
          fieldSchema = z.string();
        }
        break;
      case "checkbox":
        fieldSchema = z.boolean();
        break;
      case "number":
        // Reject empty strings before coercion: z.coerce.number() would turn
        // "" into 0 and silently accept a blank required numeric field.
        fieldSchema = z.preprocess(
          (v) => (v === "" || v === null ? NaN : v),
          z.coerce.number().finite()
        );
        break;
      default:
        fieldSchema = z.string();
    }

    if (field.required) {
      if (fieldSchema instanceof z.ZodBoolean) {
        // A required checkbox must be checked: JSON can't distinguish a
        // missing boolean from `false`, so require the literal value true.
        fieldSchema = z.literal(true);
      } else if (fieldSchema instanceof z.ZodString) {
        // Only apply .min() for string schemas; number schemas use .min() with different semantics
        fieldSchema = fieldSchema.min(1, `${field.label || field.name} is required`);
      }
      // For ZodNumber with required, just ensure it's not optional (it's already required by default)
    } else {
      fieldSchema = fieldSchema.optional();
    }

    shape[field.name] = fieldSchema;
  }

  return z.object(shape);
}
