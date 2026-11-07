import type { DownloadItem, ResolvedVideo } from "./types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const API = "https://www.tikwm.com/api/";

/** Host yang boleh jadi halaman TikTok yang ditempel pengguna. */
const LINK_HOST_RE = /(^|\.)tiktok\.com$/i;

/** Host CDN yang boleh dilewatkan oleh endpoint proxy. */
const ASSET_HOST_RE =
  /(^|\.)(tiktok\.com|tiktokv\.com|tiktokv\.us|tiktokcdn\.com|tiktokcdn-us\.com|tiktokcdn-eu\.com|tiktokcdn\.net|muscdn\.com|ibyteimg\.com|byteimg\.com|byteoversea\.com|ttwstatic\.com|tiktokcdn\.ru)$/i;

type TikwmData = {
  id?: string;
  title?: string;
  cover?: string;
  duration?: number;
  play?: string;
  hdplay?: string;
  wmplay?: string;
  music?: string;
  size?: number;
  hd_size?: number;
  wm_size?: number;
  images?: string[];
  play_count?: number;
  digg_count?: number;
  comment_count?: number;
  share_count?: number;
  create_time?: number;
  author?: { unique_id?: string; nickname?: string; avatar?: string } | null;
  music_info?: { title?: string; author?: string } | null;
};

type TikwmResponse = { code?: number; msg?: string; data?: TikwmData };

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function slug(value: string): string {
  const clean = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return clean || "tiktok";
}

/** Ambil link TikTok dari teks bebas (misal caption atau pesan campur teks). */
export function extractTiktokUrl(input: string): string | null {
  const text = (input ?? "").trim();
  if (!text) return null;

  const match = text.match(/https?:\/\/[^\s"'<>]+/i);
  const raw = match ? match[0].replace(/[)\].,;]+$/, "") : null;

  if (!raw) {
    // dukung input berupa ID video saja
    const id = text.match(/^\d{15,25}$/);
    if (id) return `https://www.tiktok.com/@i/video/${id[0]}`;
    return null;
  }

  try {
    const url = new URL(raw);
    if (!LINK_HOST_RE.test(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Link pendek (vm./vt.tiktok.com) diikuti redirect supaya jadi URL kanonis. */
export async function expandShortLink(url: string): Promise<string> {
  let hostname = "";
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return url;
  }

  if (!/^(vm|vt)\.tiktok\.com$/.test(hostname)) return url;

  try {
    const res = await fetch(url, {
      redirect: "follow",
      cache: "no-store",
      headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" },
    });
    const finalUrl = res.url || url;
    const video = finalUrl.match(/\/video\/(\d+)/);
    if (video) {
      const user = finalUrl.match(/@([\w.\-]+)/);
      return `https://www.tiktok.com/@${user ? user[1] : "i"}/video/${video[1]}`;
    }
    return finalUrl;
  } catch {
    return url;
  }
}

/** Hanya CDN milik TikTok/ByteDance yang boleh dilewatkan proxy unduhan. */
export function isAllowedAssetUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    return ASSET_HOST_RE.test(url.hostname);
  } catch {
    return false;
  }
}

/** Ambil detail video + daftar file yang bisa diunduh dari sebuah link TikTok. */
export async function resolveTiktok(raw: string): Promise<ResolvedVideo> {
  const input = extractTiktokUrl(raw);
  if (!input) {
    throw new Error(
      "Itu bukan link TikTok yang valid. Contoh: https://www.tiktok.com/@username/video/7123456789012345678"
    );
  }

  const url = await expandShortLink(input);

  const res = await fetch(`${API}?url=${encodeURIComponent(url)}&hd=1`, {
    cache: "no-store",
    headers: { "user-agent": UA, accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Server pengambil data menolak permintaan (HTTP ${res.status}). Coba lagi sebentar.`);
  }

  const json = (await res.json()) as TikwmResponse;
  const data = json?.data;

  if (!data || json.code !== 0) {
    throw new Error(
      json?.msg
        ? `Gagal mengambil video: ${json.msg}`
        : "Video tidak ditemukan. Pastikan linknya publik, bukan privat atau sudah dihapus."
    );
  }

  const uniqueId = slug(data.author?.unique_id ?? "tiktok");
  const base = `${uniqueId}-${data.id ?? Date.now()}`;

  const downloads: DownloadItem[] = [];
  const add = (item: DownloadItem) => {
    if (!item.url) return;
    if (downloads.some((existing) => existing.url === item.url)) return;
    downloads.push(item);
  };

  if (data.play) {
    add({
      id: "no-watermark",
      label: "Tanpa watermark",
      hint: "MP4 · paling pas buat repost",
      url: data.play,
      filename: `${base}-nowm.mp4`,
      kind: "video",
      size: toNumber(data.size),
    });
  }

  if (data.hdplay && data.hdplay !== data.play) {
    add({
      id: "hd",
      label: "Kualitas HD",
      hint: "MP4 · resolusi lebih tinggi",
      url: data.hdplay,
      filename: `${base}-hd.mp4`,
      kind: "video",
      size: toNumber(data.hd_size),
    });
  }

  if (data.wmplay && data.wmplay !== data.play && data.wmplay !== data.hdplay) {
    add({
      id: "watermark",
      label: "Versi asli",
      hint: "MP4 · masih ada watermark",
      url: data.wmplay,
      filename: `${base}-wm.mp4`,
      kind: "video",
      size: toNumber(data.wm_size),
    });
  }

  if (data.music) {
    add({
      id: "audio",
      label: "Audio saja",
      hint: "M4A · buat backsound",
      url: data.music,
      filename: `${base}-audio.m4a`,
      kind: "audio",
    });
  }

  if (Array.isArray(data.images)) {
    data.images.forEach((src, index) => {
      add({
        id: `slide-${index + 1}`,
        label: `Gambar ${index + 1}`,
        hint: "JPG · slide foto",
        url: src,
        filename: `${base}-${index + 1}.jpg`,
        kind: "image",
      });
    });
  }

  if (data.cover) {
    add({
      id: "cover",
      label: "Cover",
      hint: "JPG · thumbnail",
      url: data.cover,
      filename: `${base}-cover.jpg`,
      kind: "image",
    });
  }

  if (downloads.length === 0) {
    throw new Error("Video ini tidak menyediakan file yang bisa diunduh.");
  }

  return {
    id: data.id ?? "",
    description: data.title ?? "",
    author: {
      uniqueId: data.author?.unique_id ?? "tiktok",
      name: data.author?.nickname ?? data.author?.unique_id ?? "Tanpa nama",
      avatar: data.author?.avatar ?? "",
    },
    music: data.music_info?.title ?? "",
    cover: data.cover ?? "",
    durationSeconds: toNumber(data.duration),
    stats: {
      play: toNumber(data.play_count),
      like: toNumber(data.digg_count),
      comment: toNumber(data.comment_count),
      share: toNumber(data.share_count),
    },
    createdAt: toNumber(data.create_time),
    originUrl: url,
    downloads,
  };
}
