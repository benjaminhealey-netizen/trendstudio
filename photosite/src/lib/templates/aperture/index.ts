import type { Section, SiteContent, SiteImage } from "../../content/schema";
import { attr, esc, escUrl, paragraphs } from "../html";
import type { RenderContext, SiteFile, Template } from "../types";
import { stylesheet } from "./styles";

/**
 * "Aperture" — the first photographer template. Entirely data-driven: no
 * client name, copy, colour or image is hard-coded here. Everything comes from
 * SiteContent, which is what lets one template serve every client.
 */
export const aperture: Template = {
  id: "aperture",
  name: "Aperture",
  description: "Editorial single-page portfolio: full-bleed hero, masonry-ish gallery, services, contact.",
  render(content, ctx) {
    const files: SiteFile[] = [
      { path: "index.html", content: renderPage(content, ctx), contentType: "text/html; charset=utf-8" },
      { path: "robots.txt", content: renderRobots(content, ctx), contentType: "text/plain; charset=utf-8" },
    ];
    if (!ctx.preview && ctx.origin) {
      files.push({
        path: "sitemap.xml",
        content: renderSitemap(ctx.origin),
        contentType: "application/xml; charset=utf-8",
      });
    }
    return files;
  },
};

function renderPage(c: SiteContent, ctx: RenderContext): string {
  const canonical = ctx.preview ? "" : ctx.origin || c.seo.canonicalOrigin;
  const ogImage = c.seo.ogImage?.url ?? firstImage(c)?.url ?? "";
  const nav = c.sections
    .filter((s) => s.type !== "hero")
    .map((s) => ({ id: s.id, label: sectionLabel(s) }))
    .filter((s) => s.label);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.seo.title)}</title>
<meta name="description" content="${esc(c.seo.description)}">
${ctx.preview ? '<meta name="robots" content="noindex, nofollow">' : '<meta name="robots" content="index, follow">'}
${canonical ? `<link rel="canonical" href="${escUrl(canonical + "/")}">` : ""}
${c.favicon ? `<link rel="icon" href="${escUrl(c.favicon)}">` : ""}
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(c.seo.title)}">
<meta property="og:description" content="${esc(c.seo.description)}">
${canonical ? `<meta property="og:url" content="${escUrl(canonical + "/")}">` : ""}
${ogImage ? `<meta property="og:image" content="${escUrl(ogImage)}">` : ""}
<meta name="twitter:card" content="${ogImage ? "summary_large_image" : "summary"}">
<style>${stylesheet(c.tokens)}</style>
${renderJsonLd(c, canonical)}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <a class="wordmark" href="#top">${esc(c.siteName)}</a>
  ${nav.length ? `<nav aria-label="Sections"><ul>${nav
    .map((n) => `<li><a href="#${esc(n.id)}">${esc(n.label)}</a></li>`)
    .join("")}</ul></nav>` : ""}
</header>
<main id="main">
${c.sections.map((s) => renderSection(s, c)).join("\n")}
</main>
<footer class="site-footer">
  <p class="footer-name">${esc(c.siteName)}</p>
  ${c.socialLinks.length
    ? `<ul class="socials">${c.socialLinks
        .map(
          (l) =>
            `<li><a href="${escUrl(l.url)}" rel="me noopener" target="_blank">${esc(l.label)}</a></li>`
        )
        .join("")}</ul>`
    : ""}
  <p class="copyright">&copy; ${new Date().getFullYear()} ${esc(c.siteName)}</p>
</footer>
</body>
</html>
`;
}

function sectionLabel(s: Section): string {
  switch (s.type) {
    case "gallery":
    case "about":
    case "services":
    case "contact":
      return s.heading;
    default:
      return "";
  }
}

function firstImage(c: SiteContent): SiteImage | null {
  for (const s of c.sections) {
    if (s.type === "hero") return s.image;
    if (s.type === "gallery" && s.images.length) return s.images[0];
  }
  return null;
}

function img(image: SiteImage, opts: { eager?: boolean; sizes?: string } = {}): string {
  return `<img src="${escUrl(image.url)}" alt="${esc(image.alt)}"${attr("width", image.width)}${attr(
    "height",
    image.height
  )} loading="${opts.eager ? "eager" : "lazy"}" decoding="${opts.eager ? "sync" : "async"}"${
    opts.eager ? ' fetchpriority="high"' : ""
  }>`;
}

function renderSection(s: Section, c: SiteContent): string {
  switch (s.type) {
    case "hero":
      return s.layout === "overlay"
        ? `<section id="${esc(s.id)}" class="hero hero-overlay">
  <div class="hero-media">${img(s.image, { eager: true })}</div>
  <div class="hero-copy">
    <h1>${esc(s.title)}</h1>
    ${s.tagline ? `<p class="tagline">${esc(s.tagline)}</p>` : ""}
  </div>
</section>`
        : `<section id="${esc(s.id)}" class="hero hero-stacked">
  <div class="hero-copy">
    <h1>${esc(s.title)}</h1>
    ${s.tagline ? `<p class="tagline">${esc(s.tagline)}</p>` : ""}
  </div>
  <div class="hero-media">${img(s.image, { eager: true })}</div>
</section>`;

    case "about":
      return `<section id="${esc(s.id)}" class="about wrap" aria-labelledby="${esc(s.id)}-h">
  <h2 id="${esc(s.id)}-h">${esc(s.heading)}</h2>
  <div class="about-grid${s.portrait ? " has-portrait" : ""}">
    <div class="prose">${paragraphs(s.body)}</div>
    ${s.portrait ? `<figure class="portrait">${img(s.portrait)}</figure>` : ""}
  </div>
</section>`;

    case "gallery":
      if (!s.images.length) {
        return `<section id="${esc(s.id)}" class="gallery wrap" aria-labelledby="${esc(s.id)}-h">
  <h2 id="${esc(s.id)}-h">${esc(s.heading)}</h2>
  <p class="empty-note">No images yet.</p>
</section>`;
      }
      return `<section id="${esc(s.id)}" class="gallery wrap" aria-labelledby="${esc(s.id)}-h">
  <h2 id="${esc(s.id)}-h">${esc(s.heading)}</h2>
  <ul class="grid cols-${s.columns}">
    ${s.images.map((image) => `<li class="shot">${img(image)}</li>`).join("\n    ")}
  </ul>
</section>`;

    case "services":
      return `<section id="${esc(s.id)}" class="services wrap" aria-labelledby="${esc(s.id)}-h">
  <h2 id="${esc(s.id)}-h">${esc(s.heading)}</h2>
  <ul class="service-list">
    ${s.items
      .map(
        (it) => `<li>
      <h3>${esc(it.name)}</h3>
      ${it.description ? `<p>${esc(it.description)}</p>` : ""}
      ${it.priceNote ? `<p class="price">${esc(it.priceNote)}</p>` : ""}
    </li>`
      )
      .join("\n    ")}
  </ul>
</section>`;

    case "testimonial":
      return `<section id="${esc(s.id)}" class="testimonial">
  <blockquote>
    <p>${esc(s.quote)}</p>
    ${s.attribution ? `<cite>${esc(s.attribution)}</cite>` : ""}
  </blockquote>
</section>`;

    case "contact":
      return `<section id="${esc(s.id)}" class="contact wrap" aria-labelledby="${esc(s.id)}-h">
  <h2 id="${esc(s.id)}-h">${esc(s.heading)}</h2>
  ${s.blurb ? `<p class="blurb">${esc(s.blurb)}</p>` : ""}
  <dl class="contact-details">
    <dt>Email</dt><dd><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></dd>
    ${s.phone ? `<dt>Phone</dt><dd><a href="tel:${esc(s.phone.replace(/[^\d+]/g, ""))}">${esc(s.phone)}</a></dd>` : ""}
    ${s.location ? `<dt>Based in</dt><dd>${esc(s.location)}</dd>` : ""}
  </dl>
  ${
    s.formEndpoint
      ? `<form class="enquiry" method="post" action="${escUrl(s.formEndpoint)}">
    <label>Your name <input type="text" name="name" required autocomplete="name"></label>
    <label>Email <input type="email" name="email" required autocomplete="email"></label>
    <label>Date or timeframe <input type="text" name="date"></label>
    <label>Tell me about your shoot <textarea name="message" rows="5" required></textarea></label>
    <input type="text" name="company" tabindex="-1" autocomplete="off" aria-hidden="true" class="hp">
    <button type="submit">Send enquiry</button>
  </form>`
      : `<p class="cta"><a class="button" href="mailto:${esc(s.email)}?subject=${encodeURIComponent(
          `Enquiry via ${c.siteName}`
        )}">Email ${esc(c.siteName)}</a></p>`
  }
</section>`;
  }
}

function renderJsonLd(c: SiteContent, canonical: string): string {
  const contact = c.sections.find((s) => s.type === "contact");
  const hero = c.sections.find((s) => s.type === "hero");
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: c.siteName,
    description: c.seo.description,
    ...(canonical ? { url: canonical } : {}),
    ...(hero && hero.type === "hero" ? { image: hero.image.url } : {}),
    ...(contact && contact.type === "contact"
      ? {
          email: contact.email,
          ...(contact.phone ? { telephone: contact.phone } : {}),
          ...(contact.location ? { areaServed: contact.location } : {}),
        }
      : {}),
    ...(c.socialLinks.length ? { sameAs: c.socialLinks.map((l) => l.url) } : {}),
  };
  // JSON-LD sits in a script block, so "<" must not be able to close it.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

function renderRobots(c: SiteContent, ctx: RenderContext): string {
  if (ctx.preview || !ctx.origin) {
    return "User-agent: *\nDisallow: /\n";
  }
  return `User-agent: *\nAllow: /\n\nSitemap: ${ctx.origin.replace(/\/$/, "")}/sitemap.xml\n`;
}

function renderSitemap(origin: string): string {
  const url = `${origin.replace(/\/$/, "")}/`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${esc(url)}</loc>
    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>
    <changefreq>monthly</changefreq>
  </url>
</urlset>
`;
}
