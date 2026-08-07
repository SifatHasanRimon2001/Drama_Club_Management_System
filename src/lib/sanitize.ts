import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "p",
  "h1",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "a",
  "strong",
  "em",
  "u",
  "s",
  "code",
  "pre",
  "blockquote",
  "hr",
  "br",
  "img",
  "span",
];

const STYLE_TAGS = ["p", "h1", "h2", "h3", "span", "li"];

/**
 * Server-side sanitizer for Tiptap-produced rich text (club updates).
 * Prevents stored XSS: scripts, event handlers, javascript: URLs and
 * arbitrary inline styles are stripped before the HTML is persisted
 * (and later rendered via dangerouslySetInnerHTML on public pages).
 */
export function sanitizeRichText(html: string): string {
  const options = {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "target", "rel", "class"],
      img: ["src", "alt", "title", "class"],
      code: ["class"],
      pre: ["class"],
      ...Object.fromEntries(STYLE_TAGS.map((t) => [t, ["class", "style"]])),
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
    disallowedTagsMode: "discard" as const,
    transformTags: {
      a: (_tagName, attribs) => {
        const safe: Record<string, string> = {
          ...attribs,
          rel: "noopener noreferrer",
        };
        if (attribs.target === "_blank") safe.target = "_blank";
        return { tagName: "a", attribs: safe };
      },
    },
    // Tiptap TextAlign writes inline styles like text-align — allow only
    // those layout-safe declarations, drop everything else.
    allowedStyles: {
      "*": {
        "text-align": [/^left$/, /^right$/, /^center$/, /^justify$/],
        "text-align-last": [/^left$/, /^right$/, /^center$/, /^justify$/],
      },
    },
  } as sanitizeHtml.IOptions;

  return sanitizeHtml(html, options);
}
