import { NextResponse } from "next/server";
import { renderPreview } from "@/lib/services/publish";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const html = await renderPreview(id);
    return new NextResponse(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        // The preview is rendered from operator-entered content and shown in an
        // iframe on the dashboard; keep it from being framed anywhere else.
        "x-frame-options": "SAMEORIGIN",
        "x-robots-tag": "noindex, nofollow",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "preview failed" },
      { status: 404 }
    );
  }
}
