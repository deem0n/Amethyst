<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed, ref } from "vue";

import { amethyst } from "@/amethyst.js";
import type { Track } from "@/logic/track";

import CoverArt from "./CoverArt.vue";
import NotApplicableText from "./NotApplicableText.vue";
import TitleSubtitle from "./v2/TitleSubtitle.vue";

type PlanTrack = Track | null;
export type CortinaSlot = {
  mode: "automatic" | "manual";
  track: Track | null;
};

const props = defineProps<{
  title: string;
  subtitle: string;
  tracks: PlanTrack[];
  cortinaSlots: CortinaSlot[];
  currentTrackPath?: string;
  cortinaLibrarySize: number;
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

const createAutomaticCortina = (): CortinaSlot => ({
  mode: "automatic",
  track: null,
});

const cortinaSlots = computed(() => tandas.value.slice(0, -1).map((_, index) =>
  props.cortinaSlots[index] ?? createAutomaticCortina(),
));

const hasTrackDragData = (event: DragEvent) =>
  event.dataTransfer?.types.includes("application/json")
  || event.dataTransfer?.types.includes("text/plain");

const getDroppedTrack = (event: DragEvent): Track | null => {
  const jsonData = event.dataTransfer?.getData("application/json");
  if (jsonData) {
    try {
      const trackData = JSON.parse(jsonData);
      if (trackData.type === "amethyst/track") {
        return amethyst.state.milongaCandidateTracks.find((t) =>
          t.absolutePath === trackData.absolutePath
          || t.path === trackData.path) ?? null;
      }
    }
    catch (error) {
      console.error("Error parsing JSON data:", error);
    }
  }

  const pathData = event.dataTransfer?.getData("text/plain");
  if (pathData) {
    return amethyst.state.milongaCandidateTracks.find((t) =>
      t.absolutePath === pathData
      || t.path === pathData) ?? null;
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
  }
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
    };
    emit("cortinaSlotsUpdated", newCortinaSlots);
  }
  finally {
    activeCortinaDropZone.value = null;
  }
};

const resetCortinaSlot = (cortinaIndex: number) => {
  const newCortinaSlots = [...cortinaSlots.value];
  newCortinaSlots[cortinaIndex] = createAutomaticCortina();
  emit("cortinaSlotsUpdated", newCortinaSlots);
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
      >
        <div class="tanda-heading">
          <div class="tanda-title">
            Tanda {{ tandaIndex + 1 }}
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
                  <Icon icon="ic:outline-music-note" class="w-5 h-5 text-text-subtitle" />
                </div>
                <div class="track-time">
                  {{ track.getDurationFormatted(true) || "--:--" }}
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
                  <NotApplicableText v-else />
                </div>
              </div>
            </div>
            <div
              v-else
              class="tanda-empty-slot"
            >
              <Icon icon="ic:outline-add" class="w-6 h-6" />
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
          <div class="cortina-line" />
          <div
            v-if="cortinaSlots[tandaIndex]?.mode === 'manual' && cortinaSlots[tandaIndex]?.track"
            class="cortina-track"
            :class="{ 'is-playing': isCurrentTrack(cortinaSlots[tandaIndex].track) }"
            draggable="true"
            @click="emit('playFromCortina', { cortinaIndex: tandaIndex })"
            @dragstart="handleDragStart($event, cortinaSlots[tandaIndex].track!)"
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
                <Icon icon="ic:outline-music-note" class="w-4 h-4 text-text-subtitle" />
              </div>
            </div>
            <div class="cortina-copy">
              <div class="cortina-title">
                {{ cortinaSlots[tandaIndex].track!.getTitle() || cortinaSlots[tandaIndex].track!.getFilename() || "Untitled" }}
              </div>
              <div class="cortina-meta">
                Manual cortina · {{ cortinaSlots[tandaIndex].track!.getDurationFormatted(true) || "--:--" }}
              </div>
            </div>
            <button
              class="cortina-reset"
              title="Use automatic cortina"
              @click.stop="resetCortinaSlot(tandaIndex)"
            >
              <Icon icon="ic:round-close" class="w-4 h-4" />
            </button>
          </div>
          <div
            v-else
            class="cortina-auto-slot"
          >
            <Icon icon="ic:twotone-music-note" class="w-4 h-4" />
            <div class="cortina-copy">
              <div class="cortina-title">
                Automatic cortina
              </div>
              <div class="cortina-meta">
                <template v-if="cortinaLibrarySize > 0">
                  Random from {{ cortinaLibrarySize }} library tracks
                </template>
                <template v-else>
                  Drop tracks into Cortina Library or assign manually
                </template>
              </div>
            </div>
          </div>
          <div class="cortina-line" />
        </div>
      </div>

      <button
        class="add-tanda-button"
        @click="addNewTanda"
      >
        <Icon icon="ic:outline-add" class="w-8 h-8 text-text-subtitle" />
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
  @apply flex flex-col gap-2;
}

.tanda-heading {
  @apply flex items-center justify-between text-sm px-1;
}

.tanda-title {
  @apply text-text-title font-semibold;
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
  @apply absolute top-1 right-1 rounded bg-black/65 px-1.5 py-0.5 text-white text-xs leading-none;
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
  @apply grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-1;
}

.cortina-separator.is-active-drop .cortina-auto-slot,
.cortina-separator.is-active-drop .cortina-track {
  @apply bg-surface-700/70 border-primary border-dashed;
}

.cortina-line {
  @apply h-px bg-surface-600;
}

.cortina-auto-slot,
.cortina-track {
  @apply min-w-56 max-w-96 rounded bg-surface-800 border border-transparent px-3 py-2 transition-colors;
}

.cortina-auto-slot {
  @apply flex items-center gap-2 text-text-subtitle;
}

.cortina-track {
  @apply grid grid-cols-[40px_minmax(0,1fr)_24px] items-center gap-2 cursor-pointer hover:bg-surface-700;
}

.cortina-cover {
  @apply w-10 h-10 flex-none;
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

.cortina-reset {
  @apply w-6 h-6 flex items-center justify-center rounded text-text-subtitle hover:bg-surface-600 hover:text-text-title;
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
