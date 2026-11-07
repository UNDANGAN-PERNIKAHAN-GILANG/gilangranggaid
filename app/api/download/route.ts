import { NextResponse } from "next/server";
import { isAllowedAssetUrl } from "@/lib/tiktok";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function safeName(value: string): string {
  const cleaned = value
    .replace(/[\r\n"\\/]+/g, "_")
    // buang karakter non-ASCII supaya header tetap sah
    .replace(/[^\x20-\x7e]+/g, "_")
    .trim();
  return (cleaned || "tiktok-download").slice(0, 120);
}

const EXT_BY_TYPE: Record<string, string> = {
  "video/mp4": "mp4",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("url");
  const requested = searchParams.get("name") ?? "tiktok-download";

  if (!target) {
    return NextResponse.json({ ok: false, error: "Parameter url wajib diisi." }, { status: 400 });
  }

  if (!isAllowedAssetUrl(target)) {
    return NextResponse.json(
      { ok: false, error: "Hanya file dari CDN TikTok yang bisa diunduh lewat proxy ini." },
      { status: 400 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      cache: "no-store",
      redirect: "follow",
      headers: {
        "user-agent": UA,
        referer: "https://www.tiktok.com/",
        accept: "*/*",
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Gagal menghubungi server file. Coba unduh ulang sebentar lagi." },
      { status: 502 }
    );
  }

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { ok: false, error: `Server file menolak permintaan (HTTP ${upstream.status}).` },
      { status: 502 }
    );
  }

  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
  let filename = safeName(requested);

  if (!/\.[a-z0-9]{2,4}$/i.test(filename)) {
    const guessed = EXT_BY_TYPE[contentType.split(";")[0].trim().toLowerCase()];
    filename = guessed ? `${filename}.${guessed}` : filename;
  }

  const headers = new Headers();
  headers.set("content-type", contentType);
  headers.set("content-disposition", `attachment; filename="${filename}"`);
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");

  const length = upstream.headers.get("content-length");
  if (length) headers.set("content-length", length);

  return new Response(upstream.body, { status: 200, headers });
}
