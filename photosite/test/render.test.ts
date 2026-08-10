import assert from "node:assert/strict";
import test from "node:test";
import { siteContentSchema, starterContent } from "../src/lib/content/schema";
import { esc, escUrl } from "../src/lib/templates/html";
import { getTemplate } from "../src/lib/templates";

const template = getTemplate("aperture");
const content = starterContent("Jane Doe Photography", "jane@example.com");

test("starter content is valid against its own schema", () => {
  assert.equal(siteContentSchema.safeParse(content).success, true);
});

test("images without alt text are rejected", () => {
  const bad = structuredClone(content);
  const hero = bad.sections[0];
  if (hero.type !== "hero") throw new Error("expected hero first");
  hero.image.alt = "";
  assert.equal(siteContentSchema.safeParse(bad).success, false);
});

test("escUrl neutralises javascript: and data: URLs", () => {
  assert.equal(escUrl("javascript:alert(1)"), "#");
  assert.equal(escUrl("data:text/html,<script>"), "#");
  assert.equal(escUrl("https://example.com/a?b=1&c=2"), "https://example.com/a?b=1&amp;c=2");
  assert.equal(escUrl("mailto:jane@example.com"), "mailto:jane@example.com");
});

test("content is escaped, so operator-entered text cannot inject markup", () => {
  const evil = structuredClone(content);
  evil.siteName = `</title><script>alert(1)</script>`;
  const html = template.render(evil, { origin: "https://x.test", preview: false })[0].content;
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(html.includes(esc(evil.siteName)));
});

test("published render emits canonical, sitemap and indexable robots", () => {
  const files = template.render(content, { origin: "https://janedoe.com", preview: false });
  const index = files.find((f) => f.path === "index.html")!.content;
  const robots = files.find((f) => f.path === "robots.txt")!.content;

  assert.ok(index.includes('<link rel="canonical" href="https://janedoe.com/">'));
  assert.ok(index.includes('content="index, follow"'));
  assert.ok(index.includes('property="og:image"'));
  assert.ok(index.includes('application/ld+json'));
  assert.ok(robots.includes("Sitemap: https://janedoe.com/sitemap.xml"));
  assert.ok(files.some((f) => f.path === "sitemap.xml"));
});

test("preview render is noindex and ships no sitemap", () => {
  const files = template.render(content, { origin: "", preview: true });
  const index = files.find((f) => f.path === "index.html")!.content;
  const robots = files.find((f) => f.path === "robots.txt")!.content;

  assert.ok(index.includes('content="noindex, nofollow"'));
  assert.ok(!index.includes("rel=\"canonical\""));
  assert.ok(robots.includes("Disallow: /"));
  assert.equal(files.some((f) => f.path === "sitemap.xml"), false);
});

test("JSON-LD cannot break out of its script tag", () => {
  const evil = structuredClone(content);
  evil.seo.description = `</script><script>alert(1)</script>`;
  const html = template.render(evil, { origin: "https://x.test", preview: false })[0].content;
  const ld = html.slice(html.indexOf("application/ld+json"));
  assert.ok(!ld.slice(0, ld.indexOf("</script>")).includes("<script>"));
});

test("every section type renders without throwing", () => {
  const all = structuredClone(content);
  all.sections.push(
    { id: "t", type: "testimonial", quote: "Wonderful.", attribution: "A client" },
    {
      id: "g2",
      type: "gallery",
      heading: "More",
      columns: 2,
      images: [{ url: "https://example.com/a.jpg", alt: "A photo" }],
    }
  );
  const parsed = siteContentSchema.parse(all);
  const html = template.render(parsed, { origin: "https://x.test", preview: false })[0].content;
  assert.ok(html.includes("Wonderful."));
  assert.ok(html.includes("https://example.com/a.jpg"));
});
