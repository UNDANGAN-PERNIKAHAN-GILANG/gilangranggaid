"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DownloadItem, ResolvedVideo } from "@/lib/types";

const STORAGE_KEY = "ttdl:history:v1";

const ICONS: Record<DownloadItem["kind"], string> = {
  video: "🎬",
  audio: "🎵",
  image: "🖼️",
};

function compact(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  return new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function sizeLabel(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let index = 0;
  let size = bytes;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  const rounded = size >= 10 || index === 0 ? Math.round(size) : size.toFixed(1);
  return `${rounded} ${units[index]}`;
}

function proxyUrl(item: DownloadItem): string {
  const params = new URLSearchParams({
    url: item.url,
    name: item.filename,
    label: item.label,
  });
  return `/api/download?${params.toString()}`;
}

function durationLabel(seconds: number): string {
  if (!seconds || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}d` : `${s}d`;
}

export default function HomePage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ResolvedVideo | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const remember = useCallback((link: string) => {
    if (!link) return;
    setHistory((prev) => {
      const next = [link, ...prev.filter((item) => item !== link)].slice(0, 6);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* localStorage bisa diblokir, riwayat cukup di memori */
      }
      return next;
    });
  }, []);

  const run = useCallback(
    async (value: string) => {
      const link = value.trim();
      if (!link) {
        setError("Tempel dulu link TikTok-nya.");
        inputRef.current?.focus();
        return;
      }

      setLoading(true);
      setError(null);
      setData(null);

      try {
        const response = await fetch("/api/resolve", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: link }),
        });
        const json = (await response.json()) as {
          ok?: boolean;
          data?: ResolvedVideo;
          error?: string;
        };

        if (!response.ok || !json.ok || !json.data) {
          throw new Error(json.error || "Gagal mengambil data video ini.");
        }

        setData(json.data);
        remember(json.data.originUrl || link);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Terjadi kesalahan yang tidak terduga.");
      } finally {
        setLoading(false);
      }
    },
    [remember]
  );

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setHistory(parsed.filter((x) => typeof x === "string"));
      }
    } catch {
      /* riwayat opsional saja */
    }

    const fromQuery = new URLSearchParams(window.location.search).get("url");
    if (fromQuery) {
      setInput(fromQuery);
      void run(fromQuery);
    }
  }, [run]);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setError("Clipboard kosong. Salin link TikTok dulu.");
        return;
      }
      setInput(text.trim());
      void run(text);
    } catch {
      setError(
        "Browser tidak memberi izin baca clipboard. Tempel manual pakai Ctrl+V (atau tekan lama di HP)."
      );
    }
  }, [run]);

  const useHistoryItem = useCallback(
    (link: string) => {
      setInput(link);
      void run(link);
    },
    [run]
  );

  const previewItem = data?.downloads.find((item) => item.kind === "video") ?? null;

  return (
    <main className="wrap">
      <nav className="nav">
        <div className="brand">
          <span className="logo">♪</span>
          <span>gilangranggaid · TikTok Downloader</span>
        </div>
        <span className="nav-badge">tanpa watermark · HD · audio</span>
      </nav>

      <h1>
        Simpan video TikTok, <span className="grad">langsung jadi file</span>
      </h1>
      <p className="lead">
        Tempel link video TikTok, tekan Ambil, lalu pilih file yang mau disimpan. Tombolnya benar-benar
        mengunduh MP4 ke galeri atau folder Downloads kamu, bukan cuma membuka video lagi.
      </p>

      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault();
          void run(input);
        }}
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://www.tiktok.com/@username/video/..."
          value={input}
          onChange={(event) => setInput(event.target.value)}
          aria-label="Link video TikTok"
        />
        <button type="button" className="btn btn-ghost" onClick={() => void pasteFromClipboard()}>
          Tempel
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Mengambil…" : "Ambil video"}
        </button>
      </form>

      <div className="row-help">
        <span className="chip">Link panjang</span>
        <span className="chip">Link pendek vm.tiktok.com</span>
        <span className="chip">ID video</span>
        <span className="chip">Slide foto / carousel</span>
      </div>

      {error ? <div className="alert">{error}</div> : null}

      {loading ? (
        <div className="skeleton" aria-hidden="true">
          <div className="sk sk-poster" />
          <div>
            <div className="sk sk-line" style={{ width: "70%" }} />
            <div className="sk sk-line" style={{ width: "40%" }} />
            <div className="sk sk-line" style={{ width: "100%" }} />
            <div className="sk sk-line" style={{ width: "55%" }} />
          </div>
        </div>
      ) : null}

      {data ? (
        <section className="result">
          <div className="thumb">
            {previewItem ? (
              <video
                src={proxyUrl(previewItem)}
                poster={data.cover || undefined}
                controls
                playsInline
                preload="metadata"
              />
            ) : data.cover ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={data.cover} alt="Cover video" />
            ) : null}
            {data.durationSeconds > 0 ? <span>{durationLabel(data.durationSeconds)}</span> : null}
          </div>

          <div className="meta">
            <div className="author">
              {data.author.avatar ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={data.author.avatar} alt={data.author.name} />
              ) : null}
              <div>
                <b>{data.author.name}</b>
                <small>@{data.author.uniqueId}</small>
              </div>
            </div>

            {data.description ? <h2>{data.description}</h2> : null}
            {data.music ? <p className="desc">🎵 {data.music}</p> : null}

            <ul className="stats">
              <li>▶ {compact(data.stats.play)} tontonan</li>
              <li>❤ {compact(data.stats.like)} suka</li>
              <li>💬 {compact(data.stats.comment)} komentar</li>
              <li>↗ {compact(data.stats.share)} bagikan</li>
            </ul>

            <div className="downloads">
              {data.downloads.map((item) => {
                const size = sizeLabel(item.size);
                return (
                  <a
                    key={item.id}
                    className="dl"
                    href={proxyUrl(item)}
                    download={item.filename}
                    rel="noopener"
                  >
                    <span>
                      <b>{item.label}</b>
                      <small>
                        {item.hint}
                        {size ? ` · ${size}` : ""}
                      </small>
                    </span>
                    <span className="ico" aria-hidden="true">
                      {ICONS[item.kind]}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {history.length > 0 ? (
        <section className="history">
          <h3>Terakhir dipakai</h3>
          <ul>
            {history.map((link) => (
              <li key={link}>
                <button type="button" onClick={() => void useHistoryItem(link)} title={link}>
                  {link}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="steps">
        <div className="step">
          <span className="n">Langkah 1</span>
          <b>Salin link videonya</b>
          <p>Di aplikasi TikTok tekan Bagikan → Salin link. Bisa juga link pendek vm.tiktok.com.</p>
        </div>
        <div className="step">
          <span className="n">Langkah 2</span>
          <b>Tempel di kolom atas</b>
          <p>Tekan Tempel kalau browser mengizinkan, atau tempel manual dengan Ctrl+V.</p>
        </div>
        <div className="step">
          <span className="n">Langkah 3</span>
          <b>Pilih file dan simpan</b>
          <p>
            Tersedia versi tanpa watermark, HD, versi asli, audio, serta cover dan slide foto kalau ada.
          </p>
        </div>
      </section>

      <footer>
        <p>
          Pakai untuk video milikmu sendiri atau yang kamu punya izin menyimpannya. Menghapus watermark
          tidak memindahkan hak cipta ke pembuat konten — jangan repost tanpa izin atau tanpa kredit.
        </p>
        <p>
          Web ini mengambil file lewat API publik pihak ketiga; kalau video bersifat privat atau API-nya
          sedang sibuk, pengambilan bisa gagal. Coba lagi beberapa detik kemudian.
        </p>
      </footer>
    </main>
  );
}
