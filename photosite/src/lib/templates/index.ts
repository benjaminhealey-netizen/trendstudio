import { aperture } from "./aperture";
import type { Template } from "./types";

/**
 * Template registry. Adding a second template is a new folder exporting a
 * Template and one line here — nothing else in the app knows template names.
 */
const TEMPLATES: Template[] = [aperture];

export const DEFAULT_TEMPLATE_ID = aperture.id;

export function listTemplates(): Template[] {
  return TEMPLATES;
}

export function getTemplate(id: string): Template {
  const found = TEMPLATES.find((t) => t.id === id);
  if (!found) throw new Error(`unknown template: ${id}`);
  return found;
}

export type { Template, SiteFile, RenderContext } from "./types";
