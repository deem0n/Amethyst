import type { Track } from "@/logic/track";

import type { MediaSourceType } from "./MediaSource";

export type MilongaTrackRef = {
  path: string;
  sourceUuid?: string;
  sourceType: MediaSourceType;
};

export type CortinaLibraryEntry = {
  track: MilongaTrackRef;
  addedAt: number;
  title?: string;
  artist?: string;
  durationSeconds?: number;
};

export type CortinaLibrarySet = {
  id: string;
  name: string;
  entries: CortinaLibraryEntry[];
  createdAt: number;
  updatedAt: number;
};

export type MilongaCortinaSlotRef = {
  mode: "automatic" | "manual" | "empty";
  track: MilongaTrackRef | null;
  durationSeconds?: number;
  fadeInSeconds?: number;
  fadeOutSeconds?: number;
};

export type MilongaPlanDocument = {
  id: string;
  name: string;
  tracks: (MilongaTrackRef | null)[];
  cortinaSlots: MilongaCortinaSlotRef[];
  cortinaDurationSeconds: number;
  cortinaFadeInSeconds: number;
  cortinaFadeOutSeconds: number;
  createdAt: number;
  updatedAt: number;
};

export const createCortinaLibrarySet = (
  name: string,
  entries: CortinaLibraryEntry[] = [],
): CortinaLibrarySet => {
  const timestamp = Date.now();
  const normalizedName = name.trim() || "Cortinas";

  return {
    id: `cortina-set-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    name: normalizedName,
    entries,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const createMilongaPlanDocument = (
  name: string,
  cortinaDurationSeconds: number,
  cortinaFadeInSeconds: number,
  cortinaFadeOutSeconds: number,
): MilongaPlanDocument => {
  const timestamp = Date.now();
  const normalizedName = name.trim() || "Milonga";

  return {
    id: `milonga-plan-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    name: normalizedName,
    tracks: [],
    cortinaSlots: [],
    cortinaDurationSeconds,
    cortinaFadeInSeconds,
    cortinaFadeOutSeconds,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const trackToMilongaTrackRef = (track: Track): MilongaTrackRef => ({
  path: track.absolutePath || track.path,
  sourceUuid: track.sourceUuid,
  sourceType: track.sourceType,
});

export const isSameMilongaTrackRef = (left: MilongaTrackRef, right: MilongaTrackRef) =>
  left.path === right.path
  && left.sourceUuid === right.sourceUuid
  && left.sourceType === right.sourceType;

export const createCortinaLibraryEntry = (track: Track): CortinaLibraryEntry => ({
  track: trackToMilongaTrackRef(track),
  addedAt: Date.now(),
  title: track.getTitle() || track.getFilename(),
  artist: track.getArtistsFormatted(),
  durationSeconds: track.getDurationSeconds(),
});

export const resolveMilongaTrackRef = (trackRef: MilongaTrackRef, tracks: Track[]) =>
  tracks.find((track) =>
    (track.absolutePath === trackRef.path || track.path === trackRef.path)
    && track.sourceType === trackRef.sourceType
    && (!trackRef.sourceUuid || !track.sourceUuid || track.sourceUuid === trackRef.sourceUuid));
