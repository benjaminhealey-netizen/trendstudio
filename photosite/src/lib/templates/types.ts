import type { SiteContent } from "../content/schema";

export interface RenderContext {
  /** Canonical origin the site will be served from, e.g. https://janedoe.com. */
  origin: string;
  /** Preview renders skip canonical/sitemap URLs and add noindex. */
  preview: boolean;
}

export interface SiteFile {
  path: string;
  content: string;
  contentType: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  render(content: SiteContent, ctx: RenderContext): SiteFile[];
}
