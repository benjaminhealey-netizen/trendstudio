/**
 * Templates render to HTML strings rather than being React/Next apps. That is
 * deliberate: publishing then needs no build step and no build machine, so it
 * runs inside a serverless function in milliseconds, and preview and publish
 * go through exactly the same code path.
 */

const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escape text destined for element content or a quoted attribute. */
export function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ENTITIES[c]);
}

/**
 * Escape a URL for use in href/src. Anything that is not http(s), mailto or
 * tel becomes "#", which kills javascript: and data: injection through
 * operator- or client-supplied links.
 */
export function escUrl(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "#";
  if (/^(https?:|mailto:|tel:)/i.test(raw) || raw.startsWith("/") || raw.startsWith("#")) {
    return esc(raw);
  }
  return "#";
}

/** Multi-paragraph plain text to escaped <p> blocks. */
export function paragraphs(text: string): string {
  return String(text ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

export function attr(name: string, value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === "") return "";
  return ` ${name}="${esc(value)}"`;
}
