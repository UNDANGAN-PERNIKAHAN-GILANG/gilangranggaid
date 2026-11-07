export type DownloadKind = "video" | "audio" | "image";

export type DownloadItem = {
  id: string;
  label: string;
  hint: string;
  url: string;
  filename: string;
  kind: DownloadKind;
  size?: number;
};

export type ResolvedVideo = {
  id: string;
  description: string;
  author: {
    uniqueId: string;
    name: string;
    avatar: string;
  };
  music: string;
  cover: string;
  durationSeconds: number;
  stats: {
    play: number;
    like: number;
    comment: number;
    share: number;
  };
  createdAt: number;
  originUrl: string;
  downloads: DownloadItem[];
};
