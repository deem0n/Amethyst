<script setup lang="ts">
import { secondsToColinHuman } from "@shared/formating";
import { Icon } from "@iconify/vue";
import { computed, ref } from "vue";

import { amethyst } from "@/amethyst.js";
import SpectrumAnalyzerComposite from "@/components/visualizers/SpectrumAnalyzerComposite.vue";
import type { Track } from "@/logic/track";

import CoverArt from "./CoverArt.vue";
import NotApplicableText from "./NotApplicableText.vue";
import TitleSubtitle from "./v2/TitleSubtitle.vue";

type PlanTrack = Track | null;
export type CortinaSlot = {
  mode: "automatic" | "manual" | "empty";
  track: Track | null;
  durationSeconds?: number;
  fadeInSeconds?: number;
  fadeOutSeconds?: number;
};
export type CortinaEffectState = {
  cortinaIndex: number;
  phase: "in" | "out";
  kind: "fade" | "silence";
  durationSeconds: number;
  progress: number;
};

const props = defineProps<{
  title: string;
  subtitle: string;
  tracks: PlanTrack[];
  cortinaSlots: CortinaSlot[];
  candidateTracks: Track[];
  currentTrackPath?: string;
  cortinaLibrarySize: number;
  activeCortinaEffect?: CortinaEffectState;
  defaultCortinaDurationSeconds: number;
  defaultCortinaFadeInSeconds: number;
  defaultCortinaFadeOutSeconds: number;
}>();

const emit = defineEmits<{
  tracksUpdated: [tracks: PlanTrack[]];
  cortinaSlotsUpdated: [cortinaSlots: CortinaSlot[]];
  playFromTandaTrack: [payload: { tandaIndex: number; position: number }];
  playFromCortina: [payload: { cortinaIndex: number }];
}>();

const tandas = computed(() => {
  const groups: PlanTrack[][] = [];
  for (let i = 0; i < props.tracks.length; i += 4) {
    const tanda = props.tracks.slice(i, i + 4);
    while (tanda.length < 4) tanda.push(null);
    groups.push(tanda);
  }
  return groups.length ? groups : [[null, null, null, null]];
});

const activeDropZone = ref<{ tandaIndex: number; position: number } | null>(null);
const activeCortinaDropZone = ref<number | null>(null);
const draggedTandaIndex = ref<number | null>(null);
const activeTandaDropIndex = ref<number | null>(null);

const createAutomaticCortina = (): CortinaSlot => ({
  mode: "automatic",
  track: null,
});

const createEmptyCortina = (): CortinaSlot => ({
  mode: "empty",
  track: null,
});

const cortinaSlots = computed(() => tandas.value.slice(0, -1).map((_, index) =>
  props.cortinaSlots[index] ?? createAutomaticCortina(),
));

const getTandaDurationFormatted = (tanda: PlanTrack[]) => {
  const durationSeconds = tanda.reduce((total, track) => total + (track?.getDurationSeconds() ?? 0), 0);
  return secondsToColinHuman(durationSeconds);
};

const hasTrackDragData = (event: DragEvent) =>
  event.dataTransfer?.types.includes("application/json")
  || event.dataTransfer?.types.includes("text/plain");

const isSameTrackPath = (track: Track, path: string | undefined) =>
  !!path && (track.absolutePath === path || track.path === path);

const getDroppedTrack = (event: DragEvent): Track | null => {
  const jsonData = event.dataTransfer?.getData("application/json");
  if (jsonData) {
    try {
      const trackData = JSON.parse(jsonData);
      if (trackData.type === "amethyst/track") {
        return props.candidateTracks.find((t) =>
          isSameTrackPath(t, trackData.absolutePath)
          || isSameTrackPath(t, trackData.path)) ?? null;
      }
    }
    catch (error) {
      console.error("Error parsing JSON data:", error);
    }
  }

  const pathData = event.dataTransfer?.getData("text/plain");
  if (pathData) {
    return props.candidateTracks.find((t) =>
      isSameTrackPath(t, pathData)) ?? null;
  }

  return null;
};

const handleDragOver = (event: DragEvent, tandaIndex: number, position: number) => {
  event.preventDefault();
  event.stopPropagation();

  if (event.dataTransfer) {
    const hasTrackData = hasTrackDragData(event);

    if (hasTrackData) {
      event.dataTransfer.dropEffect = "move";
      activeDropZone.value = { tandaIndex, position };
    }
    else {
      event.dataTransfer.dropEffect = "none";
    }
  }
};

const handleCortinaDragOver = (event: DragEvent, cortinaIndex: number) => {
  event.preventDefault();
  event.stopPropagation();

  if (!event.dataTransfer) return;

  if (hasTrackDragData(event)) {
    event.dataTransfer.dropEffect = "move";
    activeCortinaDropZone.value = cortinaIndex;
  }
  else {
    event.dataTransfer.dropEffect = "none";
  }
};

const handleDragLeave = (event: DragEvent) => {
  event.preventDefault();
  const relatedTarget = event.relatedTarget as Node;
  const currentTarget = event.currentTarget as HTMLElement;

  if (!currentTarget.contains(relatedTarget)) {
    activeDropZone.value = null;
    activeCortinaDropZone.value = null;
    activeTandaDropIndex.value = null;
  }
};

const handleTandaDragStart = (event: DragEvent, tandaIndex: number) => {
  draggedTandaIndex.value = tandaIndex;

  if (!event.dataTransfer) return;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("application/x-amethyst-tanda", String(tandaIndex));
};

const handleTandaDragOver = (event: DragEvent, tandaIndex: number) => {
  if (draggedTandaIndex.value === null) return;

  event.preventDefault();
  event.stopPropagation();
  activeTandaDropIndex.value = tandaIndex;
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
};

const handleTandaDrop = (event: DragEvent, targetTandaIndex: number) => {
  if (draggedTandaIndex.value === null) return;

  event.preventDefault();
  event.stopPropagation();

  const sourceTandaIndex = draggedTandaIndex.value;
  draggedTandaIndex.value = null;
  activeTandaDropIndex.value = null;
  if (sourceTandaIndex === targetTandaIndex) return;

  const nextTandas = tandas.value.map((tanda) => [...tanda]);
  const [movedTanda] = nextTandas.splice(sourceTandaIndex, 1);
  if (!movedTanda) return;

  nextTandas.splice(targetTandaIndex, 0, movedTanda);
  emit("tracksUpdated", nextTandas.flat());
};

const clearTandaDrag = () => {
  draggedTandaIndex.value = null;
  activeTandaDropIndex.value = null;
};

const handleDrop = async (event: DragEvent, tandaIndex: number, position: number) => {
  event.preventDefault();
  event.stopPropagation();

  try {
    const track = getDroppedTrack(event);
    if (track) {
      const newTracks = [...props.tracks];
      const flatIndex = tandaIndex * 4 + position;

      while (newTracks.length <= flatIndex) newTracks.push(null);
      newTracks[flatIndex] = track;
      emit("tracksUpdated", newTracks);
    }
    else {
      console.warn("Track not found in candidate tracks");
    }
  }
  catch (error) {
    console.error("Error handling drop:", error);
  }
  finally {
    activeDropZone.value = null;
  }
};

const handleCortinaDrop = (event: DragEvent, cortinaIndex: number) => {
  event.preventDefault();
  event.stopPropagation();

  try {
    const track = getDroppedTrack(event);
    if (!track) {
      console.warn("Cortina track not found in candidate tracks");
      return;
    }

    const newCortinaSlots = [...cortinaSlots.value];
    newCortinaSlots[cortinaIndex] = {
      mode: "manual",
      track,
      durationSeconds: props.defaultCortinaDurationSeconds,
      fadeInSeconds: props.defaultCortinaFadeInSeconds,
      fadeOutSeconds: props.defaultCortinaFadeOutSeconds,
    };
    emit("cortinaSlotsUpdated", newCortinaSlots);
  }
  finally {
    activeCortinaDropZone.value = null;
  }
};

const resetCortinaSlot = (cortinaIndex: number) => {
  const newCortinaSlots = [...cortinaSlots.value];
  newCortinaSlots[cortinaIndex] = createEmptyCortina();
  emit("cortinaSlotsUpdated", newCortinaSlots);
};

const setCortinaSlotMode = (cortinaIndex: number, mode: CortinaSlot["mode"]) => {
  const currentSlot = cortinaSlots.value[cortinaIndex] ?? createAutomaticCortina();

  const newCortinaSlots = [...cortinaSlots.value];
  newCortinaSlots[cortinaIndex] = {
    ...currentSlot,
    mode,
    durationSeconds: mode === "manual" ? currentSlot.durationSeconds ?? props.defaultCortinaDurationSeconds : currentSlot.durationSeconds,
    fadeInSeconds: mode === "manual" ? currentSlot.fadeInSeconds ?? props.defaultCortinaFadeInSeconds : currentSlot.fadeInSeconds,
    fadeOutSeconds: mode === "manual" ? currentSlot.fadeOutSeconds ?? props.defaultCortinaFadeOutSeconds : currentSlot.fadeOutSeconds,
  };
  emit("cortinaSlotsUpdated", newCortinaSlots);
};

const normalizeDurationSeconds = (value: number) => Math.max(5, Math.min(600, Math.round(value)));
const normalizeFadeSeconds = (value: number) => Math.max(0, Math.min(30, Math.round(value * 10) / 10));
const isCortinaTimingInputAnimated = (
  cortinaIndex: number,
  key: "fadeInSeconds" | "fadeOutSeconds",
) => {
  const activeEffect = props.activeCortinaEffect;
  if (!activeEffect || activeEffect.cortinaIndex !== cortinaIndex) return false;
  return (key === "fadeInSeconds" && activeEffect.phase === "in")
    || (key === "fadeOutSeconds" && activeEffect.phase === "out");
};
const isCortinaTimingInputSilence = (
  cortinaIndex: number,
  key: "fadeInSeconds" | "fadeOutSeconds",
) => props.activeCortinaEffect?.kind === "silence" && isCortinaTimingInputAnimated(cortinaIndex, key);
const getCortinaTimingInputStyle = (
  cortinaIndex: number,
  key: "fadeInSeconds" | "fadeOutSeconds",
) => {
  const activeEffect = props.activeCortinaEffect;
  if (!activeEffect || !isCortinaTimingInputAnimated(cortinaIndex, key)) return {};

  if (activeEffect.kind === "silence") return {};

  const fill = Math.max(0, Math.min(100, activeEffect.progress * 100));
  const direction = activeEffect.phase === "in" ? "to top" : "to bottom";

  return {
    backgroundImage: `linear-gradient(${direction}, rgba(var(--primary), 0.55) 0%, rgba(var(--primary), 0.55) ${fill}%, transparent ${fill}%, transparent 100%)`,
  };
};
const getCortinaTimingInputValue = (
  cortinaIndex: number,
  key: "fadeInSeconds" | "fadeOutSeconds",
  value: number,
) => {
  const activeEffect = props.activeCortinaEffect;
  if (!activeEffect || !isCortinaTimingInputSilence(cortinaIndex, key)) return value;

  return Math.max(0, Math.ceil(activeEffect.durationSeconds * (1 - activeEffect.progress)) - 1);
};

const setManualCortinaTiming = (
  cortinaIndex: number,
  key: "durationSeconds" | "fadeInSeconds" | "fadeOutSeconds",
  value: number,
) => {
  const currentSlot = cortinaSlots.value[cortinaIndex] ?? createAutomaticCortina();
  if (currentSlot.mode !== "manual") return;

  const newCortinaSlots = [...cortinaSlots.value];
  newCortinaSlots[cortinaIndex] = {
    ...currentSlot,
    [key]: key === "durationSeconds" ? normalizeDurationSeconds(value) : normalizeFadeSeconds(value),
  };
  emit("cortinaSlotsUpdated", newCortinaSlots);
};

const handleManualCortinaTimingChange = (
  event: Event,
  cortinaIndex: number,
  key: "durationSeconds" | "fadeInSeconds" | "fadeOutSeconds",
) => {
  const value = Number((event.target as HTMLInputElement).value);
  if (!Number.isFinite(value)) return;
  setManualCortinaTiming(cortinaIndex, key, value);
};

const removeTandaTrack = (tandaIndex: number, position: number) => {
  const nextTracks = [...props.tracks];
  const flatIndex = tandaIndex * 4 + position;
  if (flatIndex >= nextTracks.length) return;

  nextTracks[flatIndex] = null;
  emit("tracksUpdated", nextTracks);
};

const removeTanda = (tandaIndex: number) => {
  const nextTracks = [...props.tracks];
  nextTracks.splice(tandaIndex * 4, 4);

  const nextCortinaSlots = [...cortinaSlots.value];
  if (nextCortinaSlots.length > 0) {
    nextCortinaSlots.splice(Math.min(tandaIndex, nextCortinaSlots.length - 1), 1);
  }

  emit("tracksUpdated", nextTracks);
  emit("cortinaSlotsUpdated", nextCortinaSlots);
};

const isCurrentTrack = (track: Track | null | undefined) =>
  !!track && props.currentTrackPath === track.path;

const handleDragStart = (event: DragEvent, track: Track) => {
  if (!event.dataTransfer) return;

  const trackData = {
    type: "amethyst/track",
    absolutePath: track.absolutePath,
    path: track.path,
    filename: track.getFilename(),
    title: track.getTitle(),
    artist: track.getArtistsFormatted(),
  };

  event.dataTransfer.setData("application/json", JSON.stringify(trackData));
  event.dataTransfer.setData("text/plain", track.absolutePath);
  event.dataTransfer.effectAllowed = "move";
};

const addNewTanda = () => {
  const nextTracks = [...props.tracks, null, null, null, null];
  const nextTandaCount = Math.ceil(nextTracks.length / 4);
  const nextCortinaSlots = [...cortinaSlots.value];

  while (nextCortinaSlots.length < nextTandaCount - 1) {
    nextCortinaSlots.push(createAutomaticCortina());
  }

  emit("tracksUpdated", nextTracks);
  emit("cortinaSlotsUpdated", nextCortinaSlots);
};
</script>

<template>
  <div class="flex gap-2 flex-col pr-2">
    <title-subtitle
      :title="title"
      :subtitle="subtitle"
    />
    <section class="milonga-plan-list">
      <div
        v-for="(tanda, tandaIndex) of tandas"
        :key="tandaIndex"
        class="tanda-row"
        :class="{ 'is-tanda-drop-target': activeTandaDropIndex === tandaIndex }"
        @dragover="handleTandaDragOver($event, tandaIndex)"
        @dragleave="handleDragLeave"
        @drop="handleTandaDrop($event, tandaIndex)"
      >
        <div class="tanda-heading">
          <div class="tanda-heading-main">
            <button
              class="tanda-drag-handle"
              title="Move tanda"
              draggable="true"
              @dragstart="handleTandaDragStart($event, tandaIndex)"
              @dragend="clearTandaDrag"
            >
              =
            </button>
            <div class="tanda-title">
              Tanda {{ tandaIndex + 1 }}
            </div>
          </div>
          <div class="tanda-heading-actions">
            <div class="tanda-duration">
              {{ getTandaDurationFormatted(tanda) }}
            </div>
            <button
              class="tanda-remove"
              title="Remove tanda"
              type="button"
              @click="removeTanda(tandaIndex)"
            >
              <icon icon="ic:twotone-delete" class="w-5 h-5" />
            </button>
          </div>
        </div>
        <div class="tanda-track-grid">
          <div
            v-for="(track, position) in tanda"
            :key="position"
            class="tanda-slot"
            :class="{
              'is-active-drop': activeDropZone?.tandaIndex === tandaIndex && activeDropZone?.position === position
            }"
            @dragover="handleDragOver($event, tandaIndex, position)"
            @dragleave="handleDragLeave"
            @drop="handleDrop($event, tandaIndex, position)"
          >
            <div
              v-if="track"
              class="tanda-track"
              :class="{ 'is-playing': isCurrentTrack(track) }"
              draggable="true"
              @click="emit('playFromTandaTrack', { tandaIndex, position })"
              @dragstart="handleDragStart($event, track)"
            >
              <div class="track-cover">
                <cover-art
                  v-if="track.isLoaded && track.getCover()"
                  class="w-full h-full rounded"
                  :url="track.getCover()"
                />
                <div
                  v-else
                  class="fallback-cover"
                >
                  <icon icon="ic:outline-music-note" class="w-5 h-5 text-text-subtitle" />
                </div>
                <div class="track-time">
                  {{ track.getDurationFormatted(true) || "--:--" }}
                </div>
                <button
                  class="track-remove"
                  title="Remove track from tanda"
                  type="button"
                  @click.stop="removeTandaTrack(tandaIndex, position)"
                >
                  <icon icon="ic:twotone-delete" class="w-4 h-4" />
                </button>
                <div
                  v-if="isCurrentTrack(track) && amethyst.player.source"
                  class="track-visualizer-overlay"
                >
                  <spectrum-analyzer-composite
                    :key="amethyst.player.nodeManager.getNodeConnectionsString()"
                    :node="amethyst.player.nodeManager.master.pre"
                    :type="amethyst.state.settings.metering.spectrum.type"
                  />
                </div>
              </div>
              <div class="track-copy">
                <div class="track-title">
                  {{ track.getTitle() || track.getFilename() || "Untitled" }}
                </div>
                <div class="track-artist">
                  <template v-if="track.getArtistsFormatted()">
                    {{ track.getArtistsFormatted() }}
                  </template>
                  <not-applicable-text v-else />
                </div>
              </div>
            </div>
            <div
              v-else
              class="tanda-empty-slot"
            >
              <icon icon="ic:outline-add" class="w-6 h-6" />
              <span>Drop track</span>
            </div>
          </div>
        </div>
        <div
          v-if="tandaIndex < tandas.length - 1"
          class="cortina-separator"
          :class="{ 'is-active-drop': activeCortinaDropZone === tandaIndex }"
          @dragover="handleCortinaDragOver($event, tandaIndex)"
          @dragleave="handleDragLeave"
          @drop="handleCortinaDrop($event, tandaIndex)"
        >
          <div
            v-if="cortinaSlots[tandaIndex]?.track"
            class="cortina-track"
            :class="{ 'is-playing': isCurrentTrack(cortinaSlots[tandaIndex].track) }"
            draggable="true"
            @click="emit('playFromCortina', { cortinaIndex: tandaIndex })"
            @dragstart="handleDragStart($event, cortinaSlots[tandaIndex].track!)"
            @dragover="handleCortinaDragOver($event, tandaIndex)"
            @drop="handleCortinaDrop($event, tandaIndex)"
          >
            <div class="cortina-cover">
              <cover-art
                v-if="cortinaSlots[tandaIndex].track!.isLoaded && cortinaSlots[tandaIndex].track!.getCover()"
                class="w-full h-full rounded"
                :url="cortinaSlots[tandaIndex].track!.getCover()"
              />
              <div
                v-else
                class="fallback-cover"
              >
                <icon icon="ic:outline-music-note" class="w-4 h-4 text-text-subtitle" />
              </div>
              <div
                v-if="isCurrentTrack(cortinaSlots[tandaIndex].track) && amethyst.player.source"
                class="track-visualizer-overlay"
              >
                <spectrum-analyzer-composite
                  :key="amethyst.player.nodeManager.getNodeConnectionsString()"
                  :node="amethyst.player.nodeManager.master.pre"
                  :type="amethyst.state.settings.metering.spectrum.type"
                />
              </div>
            </div>
            <div class="cortina-copy">
              <div class="cortina-title">
                {{ cortinaSlots[tandaIndex].track!.getTitle() || cortinaSlots[tandaIndex].track!.getFilename() || "Untitled" }}
              </div>
            </div>
            <div
              class="cortina-actions"
              @click.stop
            >
              <div class="cortina-mode-toggle">
                <button
                  class="cortina-mode-button"
                  :class="{ 'is-active': cortinaSlots[tandaIndex].mode === 'automatic' }"
                  title="Use automatic cortina assignment"
                  @click.stop="setCortinaSlotMode(tandaIndex, 'automatic')"
                >
                  A
                </button>
                <button
                  class="cortina-mode-button"
                  :class="{ 'is-active': cortinaSlots[tandaIndex].mode === 'manual' }"
                  title="Protect this cortina from automatic assignment"
                  @click.stop="setCortinaSlotMode(tandaIndex, 'manual')"
                >
                  M
                </button>
              </div>
              <div
                v-if="cortinaSlots[tandaIndex].mode === 'manual'"
                class="cortina-fade-controls"
              >
                <label>
                  <span>Dur</span>
                  <input
                    :value="cortinaSlots[tandaIndex].durationSeconds ?? defaultCortinaDurationSeconds"
                    class="is-duration"
                    :class="{ 'is-overridden': cortinaSlots[tandaIndex].durationSeconds !== undefined }"
                    type="number"
                    min="5"
                    max="600"
                    step="5"
                    @change="handleManualCortinaTimingChange($event, tandaIndex, 'durationSeconds')"
                  >
                </label>
                <label
                  :class="{
                    'is-fading': isCortinaTimingInputAnimated(tandaIndex, 'fadeInSeconds'),
                    'is-silence': isCortinaTimingInputSilence(tandaIndex, 'fadeInSeconds'),
                  }"
                  :style="getCortinaTimingInputStyle(tandaIndex, 'fadeInSeconds')"
                >
                  <span>In</span>
                  <input
                    :value="getCortinaTimingInputValue(tandaIndex, 'fadeInSeconds', cortinaSlots[tandaIndex].fadeInSeconds ?? defaultCortinaFadeInSeconds)"
                    :class="{
                      'is-overridden': cortinaSlots[tandaIndex].fadeInSeconds !== undefined,
                      'is-fade-in': isCortinaTimingInputAnimated(tandaIndex, 'fadeInSeconds'),
                      'is-silence': isCortinaTimingInputSilence(tandaIndex, 'fadeInSeconds'),
                    }"
                    :style="getCortinaTimingInputStyle(tandaIndex, 'fadeInSeconds')"
                    type="number"
                    min="0"
                    max="30"
                    step="0.5"
                    @change="handleManualCortinaTimingChange($event, tandaIndex, 'fadeInSeconds')"
                  >
                </label>
                <label
                  :class="{
                    'is-fading': isCortinaTimingInputAnimated(tandaIndex, 'fadeOutSeconds'),
                    'is-silence': isCortinaTimingInputSilence(tandaIndex, 'fadeOutSeconds'),
                  }"
                  :style="getCortinaTimingInputStyle(tandaIndex, 'fadeOutSeconds')"
                >
                  <span>Out</span>
                  <input
                    :value="getCortinaTimingInputValue(tandaIndex, 'fadeOutSeconds', cortinaSlots[tandaIndex].fadeOutSeconds ?? defaultCortinaFadeOutSeconds)"
                    :class="{
                      'is-overridden': cortinaSlots[tandaIndex].fadeOutSeconds !== undefined,
                      'is-fade-out': isCortinaTimingInputAnimated(tandaIndex, 'fadeOutSeconds'),
                      'is-silence': isCortinaTimingInputSilence(tandaIndex, 'fadeOutSeconds'),
                    }"
                    :style="getCortinaTimingInputStyle(tandaIndex, 'fadeOutSeconds')"
                    type="number"
                    min="0"
                    max="30"
                    step="0.5"
                    @change="handleManualCortinaTimingChange($event, tandaIndex, 'fadeOutSeconds')"
                  >
                </label>
              </div>
              <div class="cortina-track-duration">
                {{ cortinaSlots[tandaIndex].track!.getDurationFormatted(true) || "--:--" }}
              </div>
              <button
                class="cortina-reset"
                title="Set cortina empty"
                type="button"
                @click.stop="resetCortinaSlot(tandaIndex)"
              >
                <icon icon="ic:twotone-delete" class="w-5 h-5" />
              </button>
            </div>
          </div>
          <div
            v-else
            class="cortina-auto-slot"
            @dragover="handleCortinaDragOver($event, tandaIndex)"
            @drop="handleCortinaDrop($event, tandaIndex)"
          >
            <icon icon="ic:twotone-music-note" class="w-4 h-4" />
            <div class="cortina-copy">
              <div class="cortina-title">
                <template v-if="cortinaSlots[tandaIndex]?.mode === 'empty'">
                  Empty cortina
                </template>
                <template v-else>
                  Automatic cortina
                </template>
              </div>
              <div class="cortina-meta">
                <template v-if="cortinaSlots[tandaIndex]?.mode === 'manual'">
                  Drop a track here to assign it manually
                </template>
                <template v-else-if="cortinaSlots[tandaIndex]?.mode === 'empty'">
                  No cortina will play here
                </template>
                <template v-else-if="cortinaLibrarySize > 0">
                  Random from {{ cortinaLibrarySize }} library tracks
                </template>
                <template v-else>
                  Drop tracks into Cortina Library or assign manually
                </template>
              </div>
            </div>
            <div class="cortina-mode-toggle">
              <button
                class="cortina-mode-button"
                :class="{ 'is-active': (cortinaSlots[tandaIndex]?.mode ?? 'automatic') === 'automatic' }"
                title="Use automatic cortina assignment"
                @click.stop="setCortinaSlotMode(tandaIndex, 'automatic')"
              >
                A
              </button>
              <button
                class="cortina-mode-button"
                :class="{ 'is-active': cortinaSlots[tandaIndex]?.mode === 'manual' }"
                title="Protect this cortina from automatic assignment"
                @click.stop="setCortinaSlotMode(tandaIndex, 'manual')"
              >
                M
              </button>
            </div>
            <button
              class="cortina-reset"
              title="Set cortina empty"
              type="button"
              :disabled="cortinaSlots[tandaIndex]?.mode === 'empty'"
              @click.stop="resetCortinaSlot(tandaIndex)"
            >
              <icon icon="ic:twotone-delete" class="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <button
        class="add-tanda-button"
        @click="addNewTanda"
      >
        <icon icon="ic:outline-add" class="w-8 h-8 text-text-subtitle" />
        <span class="text-text-subtitle ml-2">Add tanda</span>
      </button>
    </section>
  </div>
</template>

<style scoped lang="postcss">
.milonga-plan-list {
  @apply flex flex-col gap-3 pr-2;
}

.tanda-row {
  @apply flex flex-col gap-2 rounded border border-transparent;
}

.tanda-row.is-tanda-drop-target {
  @apply border-primary bg-primary/10;
}

.tanda-heading {
  @apply flex items-center justify-between text-sm px-1;
}

.tanda-heading-main {
  @apply flex items-center gap-2;
}

.tanda-heading-actions {
  @apply flex items-center gap-2;
}

.tanda-drag-handle {
  @apply w-6 h-6 flex items-center justify-center rounded text-text-subtitle cursor-grab hover:bg-surface-700 hover:text-text-title;
}

.tanda-remove {
  @apply w-8 h-8 flex items-center justify-center rounded bg-surface-700 text-text-subtitle hover:text-text-title;
}

.tanda-title {
  @apply text-text-title font-semibold;
}

.tanda-duration {
  @apply rounded bg-surface-700 px-2 py-1 text-xs text-text-subtitle;
}

.tanda-meta {
  @apply text-text-subtitle text-xs;
}

.tanda-track-grid {
  @apply grid grid-cols-4 gap-2;
}

.tanda-slot {
  @apply min-h-28 rounded bg-surface-800 border border-transparent transition-colors;
}

.tanda-slot.is-active-drop {
  @apply bg-surface-700/50 border-primary border-dashed;
}

.tanda-track {
  @apply h-full flex flex-col gap-2 p-2 rounded cursor-pointer transition-colors hover:bg-surface-700;
}

.tanda-track.is-playing,
.cortina-track.is-playing {
  @apply bg-primary/20 border border-primary shadow;
}

.track-cover {
  @apply relative w-full aspect-square max-h-28 flex-none;
}

.fallback-cover {
  @apply w-full h-full bg-surface-600 rounded flex items-center justify-center;
}

.track-copy {
  @apply min-w-0 flex flex-col flex-1;
}

.track-title {
  @apply text-text-title text-sm font-medium leading-tight truncate;
}

.track-time {
  @apply absolute bottom-1 right-1 rounded bg-black/65 px-1.5 py-0.5 text-white text-xs leading-none;
  z-index: 2;
}

.track-remove {
  @apply absolute top-1 right-1 w-7 h-7 flex items-center justify-center rounded bg-black/65 text-white/80 hover:text-white;
  z-index: 3;
}

.track-visualizer-overlay {
  @apply absolute inset-0 rounded bg-black/45 overflow-hidden pointer-events-none;
  z-index: 1;
}

.track-artist {
  @apply text-text-subtitle text-xs truncate;
}

.tanda-empty-slot {
  @apply h-full min-h-28 flex flex-col items-center justify-center gap-1 text-text-subtitle/60 border border-dashed border-surface-600 rounded;
}

.tanda-empty-slot:hover {
  @apply bg-surface-700/30;
}

.cortina-separator {
  @apply grid grid-cols-1 items-center py-1;
}

.cortina-separator.is-active-drop .cortina-auto-slot,
.cortina-separator.is-active-drop .cortina-track {
  @apply bg-surface-700/70 border-primary border-dashed;
}

.cortina-auto-slot,
.cortina-track {
  @apply w-full min-w-0 rounded bg-surface-800 border border-transparent pl-3 pr-1 py-2 transition-colors;
}

.cortina-auto-slot {
  @apply grid grid-cols-[16px_minmax(0,1fr)_auto_40px] items-center gap-2 text-text-subtitle;
}

.cortina-track {
  @apply grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-2 cursor-pointer hover:bg-surface-700;
}

.cortina-cover {
  @apply relative w-10 h-10 flex-none rounded overflow-hidden;
}

.cortina-copy {
  @apply min-w-0;
}

.cortina-title {
  @apply text-text-title text-sm font-medium truncate;
}

.cortina-meta {
  @apply text-text-subtitle text-xs truncate;
}

.cortina-track-duration {
  @apply rounded bg-surface-700 px-2 py-1 text-xs text-text-subtitle;
}

.cortina-actions {
  @apply flex items-center gap-2;
}

.cortina-mode-toggle {
  @apply flex gap-1;
}

.cortina-fade-controls {
  @apply flex gap-1;
}

.cortina-fade-controls label {
  @apply flex items-center gap-1 rounded bg-surface-700 px-1.5 py-1 text-xs text-text-subtitle;
}

.cortina-fade-controls label.is-fading {
  @apply text-text-title ring-1 ring-primary/60;
  background-repeat: no-repeat;
  background-size: 100% 100%;
}

.cortina-fade-controls label.is-silence {
  animation: cortina-silence-flash 1s steps(2, jump-none) infinite;
}

.cortina-fade-controls input {
  @apply w-12 rounded bg-surface-900 px-1 text-center text-text-subtitle focus:outline-none;
}

.cortina-fade-controls input.is-duration {
  @apply w-16;
}

.cortina-fade-controls input.is-overridden {
  @apply text-text-title;
}

.cortina-fade-controls input.is-fade-in,
.cortina-fade-controls input.is-fade-out {
  background-repeat: no-repeat;
  background-size: 100% 100%;
  box-shadow: inset 0 0 0 1px rgba(var(--primary), 0.5);
}

.cortina-fade-controls input.is-silence {
  animation: cortina-silence-flash 1s steps(2, jump-none) infinite;
}

@keyframes cortina-silence-flash {
  0%,
  45% {
    background-color: rgba(var(--primary), 0.28);
  }

  55%,
  100% {
    background-color: rgb(var(--surface-900));
  }
}

.cortina-mode-button {
  @apply rounded bg-surface-700 px-2 py-1 text-xs text-text-subtitle hover:text-text-title disabled:opacity-40 disabled:hover:text-text-subtitle;
}

.cortina-mode-button.is-active {
  @apply bg-primary/30 text-text-title;
}

.cortina-reset {
  @apply w-8 h-8 flex items-center justify-center rounded bg-surface-700 text-text-subtitle hover:text-text-title disabled:opacity-40 disabled:hover:text-text-subtitle;
}

.add-tanda-button {
  @apply h-16 flex items-center justify-center bg-surface-800 rounded cursor-pointer hover:bg-surface-700 transition-colors;
}

@media (max-width: 1200px) {
  .tanda-track-grid {
    @apply grid-cols-2;
  }
}

@media (max-width: 720px) {
  .tanda-track-grid {
    @apply grid-cols-1;
  }
}
</style>
