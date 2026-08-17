/**
 * Joins class names, dropping falsy entries.
 *
 * NOTE: this does *not* resolve conflicting Tailwind utilities the way
 * `tailwind-merge` does. If a caller passes `hidden` via `className` to a
 * component whose base already sets `inline-flex`, both land in the class list
 * and the winner is decided by the order Tailwind emits them in the stylesheet
 * — not by argument order here.
 *
 * So: do not rely on `className` to override a base utility. Either expose a
 * prop on the component, or wrap it in an element that carries the override
 * (e.g. `<span className="hidden sm:contents">`).
 */
export function cn(...inputs: Array<string | false | null | undefined>) {
  return inputs.filter(Boolean).join(" ");
}
