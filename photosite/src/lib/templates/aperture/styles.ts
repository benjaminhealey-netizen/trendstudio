import type { DesignTokens } from "../../content/schema";

const HEADING_STACKS: Record<DesignTokens["headingFont"], string> = {
  "serif-display": `"Didot","Bodoni MT","Playfair Display",Georgia,"Times New Roman",serif`,
  "sans-grotesk": `"Helvetica Neue",Helvetica,Arial,ui-sans-serif,system-ui,sans-serif`,
  "serif-editorial": `"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif`,
};

const BODY_STACKS: Record<DesignTokens["bodyFont"], string> = {
  "sans-humanist": `ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif`,
  "sans-grotesk": `"Helvetica Neue",Helvetica,Arial,ui-sans-serif,system-ui,sans-serif`,
  "serif-text": `Georgia,"Times New Roman",serif`,
};

const RATIOS: Record<DesignTokens["imageRatio"], string> = {
  portrait: "4 / 5",
  landscape: "3 / 2",
  square: "1 / 1",
  natural: "auto",
};

/**
 * Fonts are system stacks on purpose: no webfont request means no third-party
 * dependency, no layout shift and a faster first paint — which is most of what
 * "excellent performance" means on an image-heavy site.
 */
export function stylesheet(t: DesignTokens): string {
  const radius = t.cornerStyle === "soft" ? "6px" : "0";
  const ratio = RATIOS[t.imageRatio];
  return minify(`
:root{
  --ink:${t.ink};
  --paper:${t.paper};
  --accent:${t.accent};
  --muted:color-mix(in srgb, var(--ink) 55%, var(--paper));
  --hairline:color-mix(in srgb, var(--ink) 15%, var(--paper));
  --heading:${HEADING_STACKS[t.headingFont]};
  --body:${BODY_STACKS[t.bodyFont]};
  --radius:${radius};
  --wrap:1180px;
}
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{animation:none!important;transition:none!important}}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--body);font-size:17px;line-height:1.65;-webkit-font-smoothing:antialiased}
img{max-width:100%;height:auto;display:block}
a{color:inherit}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.skip{position:absolute;left:-9999px}
.skip:focus{left:1rem;top:1rem;z-index:99;background:var(--paper);padding:.6rem 1rem;border:1px solid var(--ink)}
.wrap{max-width:var(--wrap);margin:0 auto;padding:clamp(3.5rem,9vw,7rem) clamp(1.25rem,5vw,2.5rem)}

h1,h2,h3{font-family:var(--heading);font-weight:400;letter-spacing:.01em;margin:0}
h2{font-size:clamp(1.6rem,3.2vw,2.3rem);margin-bottom:1.75rem}
h3{font-size:1.12rem;letter-spacing:.02em}

.site-header{display:flex;align-items:center;justify-content:space-between;gap:1.5rem;flex-wrap:wrap;
  padding:1.1rem clamp(1.25rem,5vw,2.5rem);border-bottom:1px solid var(--hairline);
  position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--paper) 88%,transparent);backdrop-filter:blur(10px)}
.wordmark{font-family:var(--heading);font-size:1.2rem;letter-spacing:.16em;text-transform:uppercase;text-decoration:none}
.site-header nav ul{display:flex;gap:1.4rem;list-style:none;margin:0;padding:0;flex-wrap:wrap}
.site-header nav a{font-size:.76rem;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;color:var(--muted)}
.site-header nav a:hover{color:var(--accent)}

.hero{position:relative}
.hero-overlay .hero-media{aspect-ratio:16/9;min-height:62vh;max-height:88vh;overflow:hidden}
.hero-overlay .hero-media img{width:100%;height:100%;object-fit:cover}
.hero-overlay .hero-copy{position:absolute;inset:auto 0 0 0;padding:clamp(1.5rem,5vw,3.5rem);
  background:linear-gradient(to top,color-mix(in srgb,#000 62%,transparent),transparent);color:#fff}
.hero-overlay h1{font-size:clamp(2.2rem,6.5vw,4.6rem);line-height:1.05;text-shadow:0 1px 24px rgba(0,0,0,.35)}
.hero-overlay .tagline{margin:.5rem 0 0;letter-spacing:.2em;text-transform:uppercase;font-size:.8rem;opacity:.92}
.hero-stacked{max-width:var(--wrap);margin:0 auto;padding:clamp(2.5rem,7vw,5rem) clamp(1.25rem,5vw,2.5rem) 0}
.hero-stacked h1{font-size:clamp(2.2rem,6vw,4rem);line-height:1.06}
.hero-stacked .tagline{color:var(--muted);letter-spacing:.2em;text-transform:uppercase;font-size:.78rem;margin:.6rem 0 2rem}
.hero-stacked .hero-media img{width:100%;border-radius:var(--radius)}

.grid{list-style:none;margin:0;padding:0;display:grid;gap:clamp(.6rem,1.4vw,1.1rem)}
.cols-2{grid-template-columns:repeat(2,1fr)}
.cols-3{grid-template-columns:repeat(3,1fr)}
@media (max-width:900px){.cols-3{grid-template-columns:repeat(2,1fr)}}
@media (max-width:560px){.cols-2,.cols-3{grid-template-columns:1fr}}
.shot img{width:100%;border-radius:var(--radius);${ratio === "auto" ? "" : `aspect-ratio:${ratio};object-fit:cover;`}}
.empty-note{color:var(--muted);font-style:italic}

.about-grid{display:grid;gap:clamp(1.5rem,4vw,3rem)}
.about-grid.has-portrait{grid-template-columns:1.6fr 1fr;align-items:start}
@media (max-width:760px){.about-grid.has-portrait{grid-template-columns:1fr}}
.prose{max-width:62ch}
.prose p{margin:0 0 1.1rem}
.portrait{margin:0}
.portrait img{width:100%;border-radius:var(--radius);${ratio === "auto" ? "" : `aspect-ratio:${ratio};object-fit:cover;`}}

.service-list{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:clamp(1.2rem,3vw,2.2rem)}
.service-list li{border-top:1px solid var(--hairline);padding-top:1rem}
.service-list p{margin:.5rem 0 0;color:var(--muted)}
.service-list .price{color:var(--accent);letter-spacing:.06em;font-size:.9rem;margin-top:.7rem}

.testimonial{background:color-mix(in srgb,var(--ink) 5%,var(--paper));padding:clamp(3rem,7vw,5.5rem) clamp(1.25rem,5vw,2.5rem)}
.testimonial blockquote{max-width:44ch;margin:0 auto;text-align:center}
.testimonial p{font-family:var(--heading);font-size:clamp(1.25rem,2.6vw,1.8rem);line-height:1.4;margin:0}
.testimonial cite{display:block;margin-top:1.2rem;font-style:normal;font-size:.78rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}

.contact .blurb{max-width:56ch;color:var(--muted);margin:0 0 2rem}
.contact-details{display:grid;grid-template-columns:auto 1fr;gap:.5rem 1.5rem;margin:0 0 2.5rem;max-width:36rem}
.contact-details dt{font-size:.74rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);align-self:center}
.contact-details dd{margin:0}
.contact-details a{color:var(--accent)}
.button{display:inline-block;background:var(--ink);color:var(--paper);text-decoration:none;padding:.85rem 1.8rem;border-radius:var(--radius);letter-spacing:.1em;text-transform:uppercase;font-size:.78rem}
.button:hover{background:var(--accent)}
.enquiry{display:grid;gap:1rem;max-width:34rem}
.enquiry label{display:grid;gap:.4rem;font-size:.74rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.enquiry input,.enquiry textarea{font:inherit;font-size:1rem;color:var(--ink);background:var(--paper);
  border:1px solid var(--hairline);border-radius:var(--radius);padding:.7rem .8rem;width:100%}
.enquiry textarea{resize:vertical}
.enquiry button{justify-self:start;font:inherit;cursor:pointer;border:0;background:var(--ink);color:var(--paper);
  padding:.85rem 1.8rem;border-radius:var(--radius);letter-spacing:.1em;text-transform:uppercase;font-size:.78rem}
.enquiry button:hover{background:var(--accent)}
.hp{position:absolute!important;left:-9999px!important;width:1px!important;height:1px!important}

.site-footer{border-top:1px solid var(--hairline);padding:2.5rem clamp(1.25rem,5vw,2.5rem);text-align:center}
.footer-name{font-family:var(--heading);letter-spacing:.16em;text-transform:uppercase;margin:0 0 1rem}
.socials{list-style:none;display:flex;justify-content:center;gap:1.4rem;flex-wrap:wrap;margin:0 0 1.2rem;padding:0}
.socials a{font-size:.76rem;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;color:var(--muted)}
.socials a:hover{color:var(--accent)}
.copyright{font-size:.76rem;color:var(--muted);margin:0}
`);
}

function minify(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s*\n\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
