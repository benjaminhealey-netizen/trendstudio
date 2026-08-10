import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { PUBLISHED_DIR } from "@/lib/hosts/local";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

/**
 * Serves sites published by LocalHost, so the whole publish loop is verifiable
 * without a Cloudflare account. In production this route is irrelevant —
 * Cloudflare Pages serves the real thing.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  if (!segments?.length) return new NextResponse("Not found", { status: 404 });

  const relative = segments.length === 1 ? path.join(segments[0], "index.html") : path.join(...segments);
  const target = path.resolve(PUBLISHED_DIR, relative);

  // Never serve anything outside the published directory, whatever the URL says.
  if (target !== PUBLISHED_DIR && !target.startsWith(PUBLISHED_DIR + path.sep)) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (path.basename(target).startsWith(".")) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const stat = await fs.stat(target);
    const file = stat.isDirectory() ? path.join(target, "index.html") : target;
    const body = await fs.readFile(file, "utf8");
    return new NextResponse(body, {
      headers: {
        "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
        "cache-control": "no-store",
        "x-robots-tag": "noindex, nofollow",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
