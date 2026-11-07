import { NextResponse } from "next/server";
import { resolveTiktok } from "@/lib/tiktok";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body permintaan harus berupa JSON." },
      { status: 400 }
    );
  }

  const url =
    typeof payload === "object" && payload !== null && "url" in payload
      ? String((payload as { url?: unknown }).url ?? "").trim()
      : "";

  if (!url) {
    return NextResponse.json({ ok: false, error: "Link TikTok belum diisi." }, { status: 400 });
  }

  if (url.length > 600) {
    return NextResponse.json({ ok: false, error: "Link terlalu panjang." }, { status: 400 });
  }

  try {
    const data = await resolveTiktok(url);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal mengambil data video dari link itu.";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
