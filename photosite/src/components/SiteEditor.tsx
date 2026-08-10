"use client";

import { useState, useTransition } from "react";
import { saveDraftAction } from "@/app/actions";
import type { Section, SectionType, SiteContent, SiteImage } from "@/lib/content/schema";

const SECTION_LABELS: Record<SectionType, string> = {
  hero: "Hero",
  about: "About",
  gallery: "Gallery",
  services: "Services",
  testimonial: "Testimonial",
  contact: "Contact",
};

function blankSection(type: SectionType, id: string): Section {
  switch (type) {
    case "hero":
      return { id, type, title: "New heading", tagline: "", layout: "overlay", image: { url: "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=2000", alt: "Photograph" } };
    case "about":
      return { id, type, heading: "About", body: "Tell their story here." };
    case "gallery":
      return { id, type, heading: "Selected work", images: [], columns: 3 };
    case "services":
      return { id, type, heading: "Services", items: [] };
    case "testimonial":
      return { id, type, quote: "They were wonderful to work with.", attribution: "" };
    case "contact":
      return { id, type, heading: "Get in touch", blurb: "", email: "hello@example.com", phone: "", location: "", formEndpoint: "" };
  }
}

export function SiteEditor({
  siteId,
  initialContent,
}: {
  siteId: string;
  initialContent: SiteContent;
}) {
  const [content, setContent] = useState<SiteContent>(initialContent);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [pending, startTransition] = useTransition();

  const patch = (updates: Partial<SiteContent>) => {
    setContent((c) => ({ ...c, ...updates }));
    setSaved(false);
  };

  const patchSection = (index: number, updates: Record<string, unknown>) => {
    setContent((c) => {
      const sections = [...c.sections];
      sections[index] = { ...sections[index], ...updates } as Section;
      return { ...c, sections };
    });
    setSaved(false);
  };

  const moveSection = (index: number, delta: number) => {
    setContent((c) => {
      const target = index + delta;
      if (target < 0 || target >= c.sections.length) return c;
      const sections = [...c.sections];
      [sections[index], sections[target]] = [sections[target], sections[index]];
      return { ...c, sections };
    });
    setSaved(false);
  };

  const removeSection = (index: number) => {
    setContent((c) => ({ ...c, sections: c.sections.filter((_, i) => i !== index) }));
    setSaved(false);
  };

  const addSection = (type: SectionType) => {
    setContent((c) => ({
      ...c,
      sections: [...c.sections, blankSection(type, `${type}-${Date.now().toString(36)}`)],
    }));
    setSaved(false);
  };

  const save = () => {
    startTransition(async () => {
      const result = await saveDraftAction(siteId, content);
      setErrors(result.errors);
      setSaved(result.ok);
      if (result.ok) setPreviewKey((k) => k + 1);
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-5">
        <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-3 bg-[var(--color-ink)] px-1 py-3">
          <button type="button" onClick={save} disabled={pending} className="btn-primary disabled:opacity-60">
            {pending ? "Saving…" : "Save draft"}
          </button>
          {saved ? <span className="text-xs text-[#7ee2a0]">Saved. Preview updated.</span> : null}
          {errors.length ? (
            <span className="text-xs text-[#f19393]">{errors.length} problem(s) below</span>
          ) : null}
        </div>

        {errors.length ? (
          <ul className="rounded-md border border-[#5c2626] bg-[#2a1414] px-4 py-3 text-xs text-[#f19393]">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}

        <Panel title="Site">
          <Text label="Site name" value={content.siteName} onChange={(v) => patch({ siteName: v })} />
          <Text label="Favicon URL" value={content.favicon} onChange={(v) => patch({ favicon: v })} />
        </Panel>

        <Panel title="SEO">
          <Text
            label="Page title"
            value={content.seo.title}
            hint={`${content.seo.title.length}/70`}
            onChange={(v) => patch({ seo: { ...content.seo, title: v } })}
          />
          <Area
            label="Meta description"
            value={content.seo.description}
            hint={`${content.seo.description.length}/200`}
            onChange={(v) => patch({ seo: { ...content.seo, description: v } })}
          />
          <Text
            label="Canonical origin"
            placeholder="https://janedoe.com"
            value={content.seo.canonicalOrigin}
            hint="Leave blank until the domain is live — a live domain overrides this anyway."
            onChange={(v) => patch({ seo: { ...content.seo, canonicalOrigin: v } })}
          />
        </Panel>

        <Panel title="Design">
          <div className="grid grid-cols-3 gap-3">
            <Colour label="Ink" value={content.tokens.ink} onChange={(v) => patch({ tokens: { ...content.tokens, ink: v } })} />
            <Colour label="Paper" value={content.tokens.paper} onChange={(v) => patch({ tokens: { ...content.tokens, paper: v } })} />
            <Colour label="Accent" value={content.tokens.accent} onChange={(v) => patch({ tokens: { ...content.tokens, accent: v } })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Heading font"
              value={content.tokens.headingFont}
              options={["serif-display", "sans-grotesk", "serif-editorial"]}
              onChange={(v) => patch({ tokens: { ...content.tokens, headingFont: v as never } })}
            />
            <Select
              label="Body font"
              value={content.tokens.bodyFont}
              options={["sans-humanist", "sans-grotesk", "serif-text"]}
              onChange={(v) => patch({ tokens: { ...content.tokens, bodyFont: v as never } })}
            />
            <Select
              label="Image crop"
              value={content.tokens.imageRatio}
              options={["natural", "portrait", "landscape", "square"]}
              onChange={(v) => patch({ tokens: { ...content.tokens, imageRatio: v as never } })}
            />
            <Select
              label="Corners"
              value={content.tokens.cornerStyle}
              options={["sharp", "soft"]}
              onChange={(v) => patch({ tokens: { ...content.tokens, cornerStyle: v as never } })}
            />
          </div>
        </Panel>

        <Panel title="Social links">
          {content.socialLinks.map((link, i) => (
            <div key={i} className="grid grid-cols-[1fr_2fr_auto] items-end gap-2">
              <Text
                label="Label"
                value={link.label}
                onChange={(v) => {
                  const socialLinks = [...content.socialLinks];
                  socialLinks[i] = { ...link, label: v };
                  patch({ socialLinks });
                }}
              />
              <Text
                label="URL"
                value={link.url}
                onChange={(v) => {
                  const socialLinks = [...content.socialLinks];
                  socialLinks[i] = { ...link, url: v };
                  patch({ socialLinks });
                }}
              />
              <button
                type="button"
                className="btn-danger mb-0.5 px-3 py-1.5 text-xs"
                onClick={() => patch({ socialLinks: content.socialLinks.filter((_, j) => j !== i) })}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn-ghost text-xs"
            onClick={() => patch({ socialLinks: [...content.socialLinks, { label: "Instagram", url: "https://instagram.com/" }] })}
          >
            Add link
          </button>
        </Panel>

        {content.sections.map((section, index) => (
          <Panel
            key={section.id}
            title={`${SECTION_LABELS[section.type]}`}
            actions={
              <div className="flex gap-1">
                <IconBtn label="Move up" onClick={() => moveSection(index, -1)} disabled={index === 0} />
                <IconBtn label="Move down" onClick={() => moveSection(index, 1)} disabled={index === content.sections.length - 1} />
                <button type="button" onClick={() => removeSection(index)} className="btn-danger px-2 py-1 text-[11px]">
                  Remove
                </button>
              </div>
            }
          >
            <SectionFields section={section} onChange={(u) => patchSection(index, u)} />
          </Panel>
        ))}

        <div className="card">
          <p className="label">Add a section</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(SECTION_LABELS) as SectionType[]).map((type) => (
              <button key={type} type="button" className="btn-ghost text-xs" onClick={() => addSection(type)}>
                + {SECTION_LABELS[type]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="xl:sticky xl:top-4 xl:h-[calc(100vh-4rem)]">
        <div className="mb-2 flex items-center justify-between">
          <p className="label mb-0">Preview</p>
          <button type="button" className="btn-ghost px-3 py-1 text-xs" onClick={() => setPreviewKey((k) => k + 1)}>
            Refresh
          </button>
        </div>
        <iframe
          key={previewKey}
          src={`/api/sites/${siteId}/preview?v=${previewKey}`}
          title="Site preview"
          className="h-[70vh] w-full rounded-lg border border-[var(--color-edge)] bg-white xl:h-[calc(100%-2rem)]"
        />
        <p className="mt-2 text-xs text-[var(--color-mist)]">
          Preview renders the saved draft through the same template code that publishing uses.
        </p>
      </div>
    </div>
  );
}

function SectionFields({
  section,
  onChange,
}: {
  section: Section;
  onChange: (updates: Record<string, unknown>) => void;
}) {
  switch (section.type) {
    case "hero":
      return (
        <>
          <Text label="Title" value={section.title} onChange={(v) => onChange({ title: v })} />
          <Text label="Tagline" value={section.tagline} onChange={(v) => onChange({ tagline: v })} />
          <Select
            label="Layout"
            value={section.layout}
            options={["overlay", "stacked"]}
            onChange={(v) => onChange({ layout: v })}
          />
          <ImageFields image={section.image} onChange={(image) => onChange({ image })} />
        </>
      );
    case "about":
      return (
        <>
          <Text label="Heading" value={section.heading} onChange={(v) => onChange({ heading: v })} />
          <Area label="Body" rows={6} value={section.body} onChange={(v) => onChange({ body: v })} hint="Blank line starts a new paragraph." />
          <ImageFields
            label="Portrait (optional)"
            image={section.portrait ?? { url: "", alt: "" }}
            allowEmpty
            onChange={(image) => onChange({ portrait: image.url ? image : undefined })}
          />
        </>
      );
    case "gallery":
      return (
        <>
          <Text label="Heading" value={section.heading} onChange={(v) => onChange({ heading: v })} />
          <Select
            label="Columns"
            value={String(section.columns)}
            options={["2", "3"]}
            onChange={(v) => onChange({ columns: Number(v) })}
          />
          <div className="space-y-3">
            {section.images.map((image, i) => (
              <div key={i} className="rounded-md border border-[var(--color-edge)] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-mist)]">
                    Image {i + 1}
                  </span>
                  <button
                    type="button"
                    className="btn-danger px-2 py-1 text-[11px]"
                    onClick={() => onChange({ images: section.images.filter((_, j) => j !== i) })}
                  >
                    Remove
                  </button>
                </div>
                <ImageFields
                  image={image}
                  onChange={(next) => {
                    const images = [...section.images];
                    images[i] = next;
                    onChange({ images });
                  }}
                />
              </div>
            ))}
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={() => onChange({ images: [...section.images, { url: "", alt: "" }] })}
            >
              Add image
            </button>
          </div>
        </>
      );
    case "services":
      return (
        <>
          <Text label="Heading" value={section.heading} onChange={(v) => onChange({ heading: v })} />
          <div className="space-y-3">
            {section.items.map((item, i) => (
              <div key={i} className="rounded-md border border-[var(--color-edge)] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-mist)]">
                    Service {i + 1}
                  </span>
                  <button
                    type="button"
                    className="btn-danger px-2 py-1 text-[11px]"
                    onClick={() => onChange({ items: section.items.filter((_, j) => j !== i) })}
                  >
                    Remove
                  </button>
                </div>
                <Text
                  label="Name"
                  value={item.name}
                  onChange={(v) => {
                    const items = [...section.items];
                    items[i] = { ...item, name: v };
                    onChange({ items });
                  }}
                />
                <Area
                  label="Description"
                  value={item.description}
                  onChange={(v) => {
                    const items = [...section.items];
                    items[i] = { ...item, description: v };
                    onChange({ items });
                  }}
                />
                <Text
                  label="Price note"
                  value={item.priceNote}
                  onChange={(v) => {
                    const items = [...section.items];
                    items[i] = { ...item, priceNote: v };
                    onChange({ items });
                  }}
                />
              </div>
            ))}
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={() => onChange({ items: [...section.items, { name: "New service", description: "", priceNote: "" }] })}
            >
              Add service
            </button>
          </div>
        </>
      );
    case "testimonial":
      return (
        <>
          <Area label="Quote" value={section.quote} onChange={(v) => onChange({ quote: v })} />
          <Text label="Attribution" value={section.attribution} onChange={(v) => onChange({ attribution: v })} />
        </>
      );
    case "contact":
      return (
        <>
          <Text label="Heading" value={section.heading} onChange={(v) => onChange({ heading: v })} />
          <Area label="Blurb" value={section.blurb} onChange={(v) => onChange({ blurb: v })} />
          <Text label="Email" value={section.email} onChange={(v) => onChange({ email: v })} />
          <Text label="Phone" value={section.phone} onChange={(v) => onChange({ phone: v })} />
          <Text label="Location" value={section.location} onChange={(v) => onChange({ location: v })} />
          <Text
            label="Form endpoint"
            value={section.formEndpoint}
            hint="Blank renders a mailto button instead of a form."
            onChange={(v) => onChange({ formEndpoint: v })}
          />
        </>
      );
  }
}

function ImageFields({
  image,
  onChange,
  label,
  allowEmpty,
}: {
  image: SiteImage | { url: string; alt: string };
  onChange: (image: SiteImage) => void;
  label?: string;
  allowEmpty?: boolean;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Text
        label={label ? `${label} — URL` : "Image URL"}
        value={image.url}
        onChange={(v) => onChange({ ...image, url: v } as SiteImage)}
      />
      <Text
        label="Alt text"
        value={image.alt}
        hint={allowEmpty ? undefined : "Required — describes the photo for screen readers and search."}
        onChange={(v) => onChange({ ...image, alt: v } as SiteImage)}
      />
    </div>
  );
}

// --- small form primitives -------------------------------------------------

function Panel({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">{title}</h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

function Text({
  label,
  value,
  onChange,
  hint,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="field" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {hint ? <p className="mt-1 text-[11px] text-[var(--color-mist)]">{hint}</p> : null}
    </div>
  );
}

function Area({
  label,
  value,
  onChange,
  rows = 3,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  hint?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <textarea className="field" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint ? <p className="mt-1 text-[11px] text-[var(--color-mist)]">{hint}</p> : null}
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function Colour({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded border border-[var(--color-edge)] bg-transparent"
        />
        <input className="field font-mono text-xs" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

function IconBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="btn-ghost px-2 py-1 text-[11px] disabled:opacity-40"
    >
      {label === "Move up" ? "↑" : "↓"}
    </button>
  );
}
