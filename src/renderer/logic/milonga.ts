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
    && (!trackRef.sourceUuid || track.sourceUuid === trackRef.sourceUuid)
    && track.sourceType === trackRef.sourceType);
