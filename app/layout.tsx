import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TikTok Downloader — simpan video tanpa watermark",
  description:
    "Tempel link TikTok, ambil videonya tanpa watermark, versi HD, audio, dan cover. Langsung dari browser.",
  openGraph: {
    title: "TikTok Downloader",
    description: "Simpan video TikTok tanpa watermark, plus audio dan cover.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
