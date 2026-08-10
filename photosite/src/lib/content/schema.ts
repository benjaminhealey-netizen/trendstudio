import { z } from "zod";

/**
 * The content schema is versioned and ships with the template rather than
 * living in database columns. Adding a field to a site is a change here plus a
 * change in the renderer — no migration, no form rewrite (the editor builds
 * itself from this schema's shape).
 */
export const CONTENT_SCHEMA_VERSION = 1;

const httpUrl = z
  .string()
  .trim()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), "must be an http(s) URL");

/** Colours, type and spacing. Variation between clients lives here, not in CSS. */
export const designTokensSchema = z.object({
  ink: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#141414"),
  paper: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#fbfaf8"),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#8a6a4b"),
  headingFont: z
    .enum(["serif-display", "sans-grotesk", "serif-editorial"])
    .default("serif-display"),
  bodyFont: z.enum(["sans-humanist", "sans-grotesk", "serif-text"]).default("sans-humanist"),
  /** Controls gallery crop personality: tall portraits vs wide landscapes. */
  imageRatio: z.enum(["portrait", "landscape", "square", "natural"]).default("natural"),
  cornerStyle: z.enum(["sharp", "soft"]).default("sharp"),
});
export type DesignTokens = z.infer<typeof designTokensSchema>;

export const imageSchema = z.object({
  url: httpUrl,
  /** Required — alt text is an accessibility and SEO requirement, not a nicety. */
  alt: z.string().trim().min(1, "every image needs alt text").max(300),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
export type SiteImage = z.infer<typeof imageSchema>;

const sectionBase = { id: z.string().min(1) };

export const heroSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("hero"),
  title: z.string().trim().min(1).max(120),
  tagline: z.string().trim().max(200).default(""),
  image: imageSchema,
  /** Full-bleed image with overlaid text, or image below the words. */
  layout: z.enum(["overlay", "stacked"]).default("overlay"),
});

export const aboutSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("about"),
  heading: z.string().trim().max(120).default("About"),
  body: z.string().trim().max(4000),
  portrait: imageSchema.optional(),
});

export const gallerySectionSchema = z.object({
  ...sectionBase,
  type: z.literal("gallery"),
  heading: z.string().trim().max(120).default("Selected work"),
  images: z.array(imageSchema).max(60).default([]),
  columns: z.union([z.literal(2), z.literal(3)]).default(3),
});

export const servicesSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("services"),
  heading: z.string().trim().max(120).default("Services"),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        description: z.string().trim().max(600).default(""),
        priceNote: z.string().trim().max(80).default(""),
      })
    )
    .max(12)
    .default([]),
});

export const testimonialSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("testimonial"),
  quote: z.string().trim().min(1).max(600),
  attribution: z.string().trim().max(120).default(""),
});

export const contactSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("contact"),
  heading: z.string().trim().max(120).default("Get in touch"),
  blurb: z.string().trim().max(600).default(""),
  email: z.string().trim().email(),
  phone: z.string().trim().max(40).default(""),
  location: z.string().trim().max(120).default(""),
  /**
   * Optional POST endpoint for the enquiry form. Empty means the template
   * renders a mailto link instead — a photographer site without a way to
   * enquire is not a photographer site.
   */
  formEndpoint: z.union([httpUrl, z.literal("")]).default(""),
});

export const sectionSchema = z.discriminatedUnion("type", [
  heroSectionSchema,
  aboutSectionSchema,
  gallerySectionSchema,
  servicesSectionSchema,
  testimonialSectionSchema,
  contactSectionSchema,
]);
export type Section = z.infer<typeof sectionSchema>;
export type SectionType = Section["type"];

export const socialLinkSchema = z.object({
  label: z.string().trim().min(1).max(40),
  url: httpUrl,
});

export const seoSchema = z.object({
  title: z.string().trim().min(1).max(70),
  description: z.string().trim().min(1).max(200),
  /** Canonical origin, e.g. https://janedoe.com. Set once the domain is live. */
  canonicalOrigin: z.union([httpUrl, z.literal("")]).default(""),
  ogImage: imageSchema.optional(),
});

export const siteContentSchema = z.object({
  schemaVersion: z.literal(CONTENT_SCHEMA_VERSION).default(CONTENT_SCHEMA_VERSION),
  siteName: z.string().trim().min(1).max(120),
  tokens: designTokensSchema.default(designTokensSchema.parse({})),
  sections: z.array(sectionSchema).min(1, "a site needs at least one section"),
  socialLinks: z.array(socialLinkSchema).max(10).default([]),
  seo: seoSchema,
  favicon: z.union([httpUrl, z.literal("")]).default(""),
});
export type SiteContent = z.infer<typeof siteContentSchema>;

/** Starting point for a new site so the operator never faces a blank editor. */
export function starterContent(businessName: string, email: string): SiteContent {
  return siteContentSchema.parse({
    siteName: businessName,
    sections: [
      {
        id: "hero",
        type: "hero",
        title: businessName,
        tagline: "Photography",
        layout: "overlay",
        image: {
          url: "https://images.unsplash.com/photo-1519741497674-611481863552?w=2000",
          alt: `Photograph by ${businessName}`,
        },
      },
      {
        id: "work",
        type: "gallery",
        heading: "Selected work",
        columns: 3,
        images: [],
      },
      {
        id: "about",
        type: "about",
        heading: "About",
        body: `${businessName} is a photographer. Replace this with a short, specific bio — where you work, what you shoot, and why someone should book you.`,
      },
      {
        id: "services",
        type: "services",
        heading: "Services",
        items: [
          { name: "Weddings", description: "Full-day coverage.", priceNote: "From $2,500" },
          { name: "Portraits", description: "Studio or on location.", priceNote: "From $400" },
        ],
      },
      {
        id: "contact",
        type: "contact",
        heading: "Get in touch",
        blurb: "Tell me about your date, location and what you have in mind.",
        email,
      },
    ],
    seo: {
      title: `${businessName} — Photographer`,
      description: `Portfolio and booking enquiries for ${businessName}.`,
    },
  });
}
