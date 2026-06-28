<script setup lang="ts">
import { useLocalStorage } from "@vueuse/core";
import { onBeforeUnmount, onMounted, computed, ref, watch  } from "vue";

import { amethyst } from "@/amethyst.js";
import BigButton from "@/components/BigButton.vue";
import CoverArt from "@/components/CoverArt.vue";
import MilongaPlan, { type CortinaSlot } from "@/components/MilongaPlan.vue";
import RouteHeader from "@/components/v2/RouteHeader.vue";
import {
  createCortinaLibraryEntry,
  type CortinaLibraryEntry,
  isSameMilongaTrackRef,
  resolveMilongaTrackRef,
  trackToMilongaTrackRef
} from "@/logic/milonga";

// By Dima
import TrackSelector from "@/components/TrackSelector.vue";
import SearchInput from "@/components/v2/SearchInput.vue";
import type { Track } from "@/logic/track";

type PlanTrack = Track | null;

const isLoading = ref(false);
const mediaSources = computed(() => [
  { id: "All", name: "All Sources" },
  ...amethyst.mediaSourceManager.mediaSources.value.map(source => ({
    id: source.uuid,
    name: source.name
  }))
]);

const filterText = useLocalStorage("milongaTrackSelectorFilterText", "");
const selectedMediaSource = useLocalStorage("milongaTrackSelectorMediaSource", "All");
const planPaneSize = useLocalStorage("milongaWorkspacePlanPaneSize", 42);
const cortinaLibrary = useLocalStorage<CortinaLibraryEntry[]>("milongaCortinaLibrary", []);
const workspaceElement = ref<HTMLElement | null>(null);
const isResizingWorkspace = ref(false);
const currentTrackPath = ref<string>();
const milongaPlaybackSequence = ref<Track[]>([]);
const milongaPlaybackIndex = ref(-1);

const workspaceStyle = computed(() => ({
  "--milonga-plan-size": `${planPaneSize.value}%`,
}));

const clampPlanPaneSize = (size: number) => Math.min(70, Math.max(25, size));

const isStackedWorkspace = () => {
  if (!workspaceElement.value) return window.innerWidth <= 1180;
  return workspaceElement.value.clientWidth <= 1180;
};

const handleWorkspaceResize = (event: MouseEvent) => {
  if (!isResizingWorkspace.value || !workspaceElement.value) return;

  event.preventDefault();
  const rect = workspaceElement.value.getBoundingClientRect();
  const pointerOffset = isStackedWorkspace()
    ? event.clientY - rect.top
    : event.clientX - rect.left;
  const totalSize = isStackedWorkspace() ? rect.height : rect.width;

  if (totalSize <= 0) return;
  planPaneSize.value = clampPlanPaneSize((pointerOffset / totalSize) * 100);
};

const stopWorkspaceResize = () => {
  if (!isResizingWorkspace.value) return;
  isResizingWorkspace.value = false;
  document.body.classList.remove("milonga-is-resizing");
};

const startWorkspaceResize = (event: MouseEvent) => {
  event.preventDefault();
  isResizingWorkspace.value = true;
  document.body.classList.add("milonga-is-resizing");
  handleWorkspaceResize(event);
};

const resetWorkspaceResize = () => {
  planPaneSize.value = 42;
};

// Определяем тип для колонок Milonga
type MilongaColumnKey = keyof typeof amethyst.state.settings.trackSelector.columns;
const milongaColumns = useLocalStorage<Record<MilongaColumnKey, boolean>>("milongaTrackSelectorColumns", {
  cover: true,
  diskNumber: false,
  trackNumber: true,
  filename: true,
  title: true,
  artist: true,
  location: false,
  album: true,
  genre: false,
  barcode: false,
  year: false,
  label: false,
  isrc: false,
  copyright: false,
  bpm: false,
  duration: true,
  container: false,
  favorite: true,
  sampleRate: false,
  bitsPerSample: false,
  bitrate: false,
  size: false,
});

// Функция для обновления колонок Milonga
const handleMilongaColumnUpdate = (key: MilongaColumnKey, value: boolean) => {
  milongaColumns.value[key] = value;
};

const getTrackFromDragEvent = (event: DragEvent): Track | null => {
  const jsonData = event.dataTransfer?.getData("application/json");
  if (jsonData) {
    try {
      const trackData = JSON.parse(jsonData);
      if (trackData.type === "amethyst/track") {
        return amethyst.state.milongaCandidateTracks.find((track) =>
          track.absolutePath === trackData.absolutePath
          || track.path === trackData.path) ?? null;
      }
    }
    catch (error) {
      console.error("Error parsing cortina library drop data:", error);
    }
  }

  const pathData = event.dataTransfer?.getData("text/plain");
  if (pathData) {
    return amethyst.state.milongaCandidateTracks.find((track) =>
      track.absolutePath === pathData
      || track.path === pathData) ?? null;
  }

  return null;
};

const resolvedCortinaLibrary = computed(() => cortinaLibrary.value.map((entry) => ({
  entry,
  track: resolveMilongaTrackRef(entry.track, amethyst.state.milongaCandidateTracks),
})));

const addCortinaLibraryTrack = (track: Track) => {
  const trackRef = trackToMilongaTrackRef(track);
  const alreadyExists = cortinaLibrary.value.some((entry) =>
    isSameMilongaTrackRef(entry.track, trackRef)
  );

  if (!alreadyExists) {
    cortinaLibrary.value = [...cortinaLibrary.value, createCortinaLibraryEntry(track)];
  }
};

const removeCortinaLibraryEntry = (entryToRemove: CortinaLibraryEntry) => {
  cortinaLibrary.value = cortinaLibrary.value.filter((entry) =>
    !isSameMilongaTrackRef(entry.track, entryToRemove.track)
  );
};

const handleCortinaLibraryDragOver = (event: DragEvent) => {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
};

const handleCortinaLibraryDrop = (event: DragEvent) => {
  event.preventDefault();
  const track = getTrackFromDragEvent(event);
  if (track) addCortinaLibraryTrack(track);
};

// Реакция на выбор источника
watch(selectedMediaSource, async (newSourceId) => {
  isLoading.value = true;
  try {
    await amethyst.loadMilongaCandidateTracks(newSourceId);
    // После загрузки новых треков можно обновить MilongaPlan если нужно
    // Например, очистить или добавить несколько случайных треков
    if (milongaPlanTracks.value.length === 0) {
      // Если план пустой, добавим несколько случайных треков
      const randomTracks = getRandomTracks(8); // 2 тандЫ
      milongaPlanTracks.value = randomTracks;
    }
  } finally {
    isLoading.value = false;
  }
}, { immediate: false });

// Заменяем computed на ref для управления состоянием
const milongaPlanTracks = ref<PlanTrack[]>([]);
const milongaCortinaSlots = ref<CortinaSlot[]>([]);

const createAutomaticCortina = (): CortinaSlot => ({
  mode: "automatic",
  track: null,
});

const ensureCortinaSlotsForTracks = (tracks: PlanTrack[]) => {
  const cortinaCount = Math.max(0, Math.ceil(tracks.length / 4) - 1);
  const nextSlots = milongaCortinaSlots.value.slice(0, cortinaCount);

  while (nextSlots.length < cortinaCount) {
    nextSlots.push(createAutomaticCortina());
  }

  milongaCortinaSlots.value = nextSlots;
};

// Функция для получения случайных треков
const getRandomTracks = (count: number): Track[] => {
  if (amethyst.state.milongaCandidateTracks.length === 0) return [];
  const shuffled = [...amethyst.state.milongaCandidateTracks].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

// Функция для обработки обновления треков из MilongaPlan
const handleTracksUpdated = (updatedTracks: PlanTrack[]) => {
  console.log('Tracks updated in MilongaView:', updatedTracks.length);
  milongaPlanTracks.value = updatedTracks;
  ensureCortinaSlotsForTracks(updatedTracks);
};

const handleCortinaSlotsUpdated = (updatedCortinaSlots: CortinaSlot[]) => {
  milongaCortinaSlots.value = updatedCortinaSlots;
};

const getManualCortinaTrack = (cortinaIndex: number) => {
  const slot = milongaCortinaSlots.value[cortinaIndex];
  return slot?.mode === "manual" ? slot.track : null;
};

const getAutomaticCortinaTrack = () => {
  const tracks = resolvedCortinaLibrary.value
    .map(({ track }) => track)
    .filter((track): track is Track => !!track);

  if (tracks.length === 0) return null;
  return tracks[Math.floor(Math.random() * tracks.length)];
};

const getCortinaPlaybackTrack = (cortinaIndex: number) => {
  const manualTrack = getManualCortinaTrack(cortinaIndex);
  return manualTrack ?? getAutomaticCortinaTrack();
};

const buildMilongaSequenceFromTandaTrack = (startTandaIndex: number, startPosition: number) => {
  const sequence: Track[] = [];
  const tandaCount = Math.ceil(milongaPlanTracks.value.length / 4);

  for (let tandaIndex = startTandaIndex; tandaIndex < tandaCount; tandaIndex++) {
    const firstPosition = tandaIndex === startTandaIndex ? startPosition : 0;

    for (let position = firstPosition; position < 4; position++) {
      const track = milongaPlanTracks.value[tandaIndex * 4 + position];
      if (track) sequence.push(track);
    }

    const cortinaTrack = getCortinaPlaybackTrack(tandaIndex);
    if (cortinaTrack) sequence.push(cortinaTrack);
  }

  return sequence;
};

const buildMilongaSequenceFromCortina = (cortinaIndex: number) => {
  const sequence: Track[] = [];
  const cortinaTrack = getCortinaPlaybackTrack(cortinaIndex);
  if (cortinaTrack) sequence.push(cortinaTrack);

  const nextTandaSequence = buildMilongaSequenceFromTandaTrack(cortinaIndex + 1, 0);
  sequence.push(...nextTandaSequence);
  return sequence;
};

const playMilongaSequence = (sequence: Track[]) => {
  milongaPlaybackSequence.value = sequence;
  milongaPlaybackIndex.value = 0;

  const firstTrack = sequence[0];
  if (firstTrack) {
    currentTrackPath.value = firstTrack.path;
    amethyst.player.play(firstTrack);
  }
};

const playNextMilongaSequenceTrack = () => {
  if (milongaPlaybackIndex.value < 0) return false;

  const nextIndex = milongaPlaybackIndex.value + 1;
  const nextTrack = milongaPlaybackSequence.value[nextIndex];

  if (!nextTrack) {
    milongaPlaybackSequence.value = [];
    milongaPlaybackIndex.value = -1;
    currentTrackPath.value = undefined;
    amethyst.player.pause();
    return true;
  }

  milongaPlaybackIndex.value = nextIndex;
  currentTrackPath.value = nextTrack.path;
  amethyst.player.play(nextTrack);
  return true;
};

const handleMilongaTandaTrackPlay = ({ tandaIndex, position }: { tandaIndex: number; position: number }) => {
  playMilongaSequence(buildMilongaSequenceFromTandaTrack(tandaIndex, position));
};

const handleMilongaCortinaPlay = ({ cortinaIndex }: { cortinaIndex: number }) => {
  playMilongaSequence(buildMilongaSequenceFromCortina(cortinaIndex));
};

const handlePlayerTrackChange = (track: Track) => {
  currentTrackPath.value = track.path;

  const activeMilongaTrack = milongaPlaybackSequence.value[milongaPlaybackIndex.value];
  if (activeMilongaTrack && activeMilongaTrack.path !== track.path) {
    milongaPlaybackSequence.value = [];
    milongaPlaybackIndex.value = -1;
  }
};

const handlePlayerStop = () => {
  currentTrackPath.value = undefined;
  milongaPlaybackSequence.value = [];
  milongaPlaybackIndex.value = -1;
};

const handlePlayerPause = () => {
  currentTrackPath.value = undefined;
};

const handlePlayerResume = (track: Track) => {
  currentTrackPath.value = track.path;
};

onMounted(async () => {
  window.addEventListener("mousemove", handleWorkspaceResize);
  window.addEventListener("mouseup", stopWorkspaceResize);
  amethyst.player.on("player:trackChange", handlePlayerTrackChange);
  amethyst.player.on("player:stop", handlePlayerStop);
  amethyst.player.on("player:pause", handlePlayerPause);
  amethyst.player.on("player:resume", handlePlayerResume);
  amethyst.player.setTrackFinishedInterceptor(playNextMilongaSequenceTrack);

  isLoading.value = true;
  await amethyst.loadMilongaCandidateTracks(selectedMediaSource.value);
  
  // Инициализируем MilongaPlan несколькими случайными треками
  const initialTracks = getRandomTracks(12); // 3 тандЫ
  milongaPlanTracks.value = initialTracks;
  ensureCortinaSlotsForTracks(initialTracks);
  
  isLoading.value = false;
});

onBeforeUnmount(() => {
  window.removeEventListener("mousemove", handleWorkspaceResize);
  window.removeEventListener("mouseup", stopWorkspaceResize);
  amethyst.player.off("player:trackChange", handlePlayerTrackChange);
  amethyst.player.off("player:stop", handlePlayerStop);
  amethyst.player.off("player:pause", handlePlayerPause);
  amethyst.player.off("player:resume", handlePlayerResume);
  amethyst.player.setTrackFinishedInterceptor(undefined);
  document.body.classList.remove("milonga-is-resizing");
});
</script>

<template>
  <div class="milonga-view">
    <route-header :title="$t('route.milonga')" />
    <!-- Индикатор загрузки рядом с селектором -->
    <div v-if="isLoading" class="absolute right-0 top-0 mr-2 mt-2">
      <icon icon="svg-spinners:180-ring" class="w-5 h-5 text-primary" />
    </div>
    <div class="milonga-actions">
      <big-button
        class="flex gap-2"
        icon="mdi:dice-5"
        @click="amethyst.analytics.getDiscoveryTracks()"
      />
      <big-button
        class="flex gap-2 w-full"
        icon="ic:round-shuffle"
        title="Just send it"
        description="I can't decide, play something random"
        @click="amethyst.player.playRandomTrack()"
      />
      <big-button
        class="flex gap-2 w-full"
        icon="ic:twotone-favorite"
        :title="$t('route.favorites')"
        description="View your favorite saved songs"
        @click="$router.push({ name: 'favorites' })"
      />
      <big-button
        class="flex gap-2 w-1/2"
        icon="ic:twotone-menu-book"
        :title="$t('menu.about.user_manual')"
        description="Open the user manual"
        @click="amethyst.openLink('https://amethyst.geoxor.moe/user-manual')"
      />

      <big-button
        class="flex gap-2"
        icon="ic:twotone-settings"
        title="Settings"
        description="View your settings"
        @click="$router.push({ name: 'settings' })"
      />
    </div>

    <div
      ref="workspaceElement"
      class="milonga-workspace"
      :class="{ 'is-resizing': isResizingWorkspace }"
      :style="workspaceStyle"
    >
      <section class="milonga-plan-pane">
        <milonga-plan
          :title="$t('milonga.plan.title')"
          :subtitle="$t('milonga.plan.description')"
          :tracks="milongaPlanTracks"
          :cortina-slots="milongaCortinaSlots"
          :current-track-path="currentTrackPath"
          :cortina-library-size="cortinaLibrary.length"
          @tracks-updated="handleTracksUpdated"
          @cortina-slots-updated="handleCortinaSlotsUpdated"
          @play-from-tanda-track="handleMilongaTandaTrackPlay"
          @play-from-cortina="handleMilongaCortinaPlay"
        />
      </section>

      <button
        class="milonga-workspace-resizer"
        title="Resize panels"
        @mousedown="startWorkspaceResize"
        @dblclick="resetWorkspaceResize"
      >
        <span />
      </button>

      <section class="milonga-library-pane">
        <section
          class="cortina-library"
          @dragover="handleCortinaLibraryDragOver"
          @drop="handleCortinaLibraryDrop"
        >
          <div class="cortina-library-header">
            <div>
              <div class="cortina-library-title">
                Cortina Library
              </div>
              <div class="cortina-library-subtitle">
                {{ cortinaLibrary.length }} tracks for automatic cortinas
              </div>
            </div>
            <div class="cortina-library-drop-hint">
              Drop tracks here
            </div>
          </div>

          <div
            v-if="cortinaLibrary.length === 0"
            class="cortina-library-empty"
          >
            Drag cortina tracks from the track selector into this area.
          </div>

          <div
            v-else
            class="cortina-library-list"
          >
            <div
              v-for="{ entry, track } in resolvedCortinaLibrary"
              :key="`${entry.track.sourceUuid || 'source'}:${entry.track.path}`"
              class="cortina-library-item"
              :class="{ 'is-missing': !track }"
            >
              <div class="cortina-library-cover">
                <cover-art
                  v-if="track?.isLoaded && track.getCover()"
                  class="w-full h-full rounded"
                  :url="track.getCover()"
                />
                <icon
                  v-else
                  icon="ic:outline-music-note"
                  class="w-5 h-5 text-text-subtitle"
                />
              </div>
              <div class="cortina-library-copy">
                <div class="cortina-library-track-title">
                  {{ track?.getTitle() || entry.title || entry.track.path }}
                </div>
                <div class="cortina-library-track-meta">
                  <template v-if="track">
                    {{ track.getArtistsFormatted() || "n/a" }} · {{ track.getDurationFormatted(true) || "--:--" }}
                  </template>
                  <template v-else>
                    Not loaded from current source
                  </template>
                </div>
              </div>
              <button
                class="cortina-library-remove"
                title="Remove from cortina library"
                @click="removeCortinaLibraryEntry(entry)"
              >
                <icon icon="ic:round-close" class="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        <route-header :title="$t('milonga.trackSelector.title')">
          <div class="relative">
            <select
              v-model="selectedMediaSource"
              class="appearance-none bg-surface-700 text-text-title rounded-l-lg pl-3 pr-8 py-2 focus:outline-none cursor-pointer"
              :disabled="isLoading"
            >
              <option
                v-for="source in mediaSources"
                :key="source.id"
                :value="source.id"
              >
                {{ source.name }}
              </option>
            </select>
          </div>

          <search-input v-model="filterText" :disabled="isLoading"/>
        </route-header>
        <track-selector
          class="milonga-track-selector"
          :external-columns="milongaColumns"
          :on-column-update="handleMilongaColumnUpdate"
          :search-text="filterText"
        />
      </section>
    </div>
  </div>
</template>

<style scoped lang="postcss">
.milonga-view {
  @apply relative h-full w-full py-2 pl-4 pr-2 text-text-title flex flex-col overflow-hidden;
}

.milonga-actions {
  @apply flex gap-2 mt-1 mr-2 flex-none;
}

.milonga-workspace {
  @apply min-h-0 flex-1 grid gap-2 mt-3 pb-36 pr-2 overflow-hidden;
  grid-template-columns: minmax(360px, var(--milonga-plan-size)) 10px minmax(420px, 1fr);
}

.milonga-plan-pane,
.milonga-library-pane {
  @apply min-h-0 rounded bg-surface-900/30;
}

.milonga-plan-pane {
  @apply overflow-y-auto pr-1;
}

.milonga-library-pane {
  @apply min-w-0 flex flex-col overflow-hidden;
}

.milonga-track-selector {
  @apply flex-1 min-h-0 overflow-hidden;
}

.cortina-library {
  @apply flex-none rounded bg-surface-800/80 border border-surface-700 p-3 mb-2;
}

.cortina-library-header {
  @apply flex items-start justify-between gap-3;
}

.cortina-library-title {
  @apply text-text-title text-sm font-semibold;
}

.cortina-library-subtitle {
  @apply text-text-subtitle text-xs;
}

.cortina-library-drop-hint {
  @apply rounded bg-surface-700 px-2 py-1 text-xs text-text-subtitle whitespace-nowrap;
}

.cortina-library-empty {
  @apply mt-3 rounded border border-dashed border-surface-600 px-3 py-4 text-center text-text-subtitle text-xs;
}

.cortina-library-list {
  @apply mt-3 grid grid-cols-1 2xl:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1;
}

.cortina-library-item {
  @apply grid grid-cols-[36px_minmax(0,1fr)_24px] items-center gap-2 rounded bg-surface-900/60 p-2 border border-transparent;
}

.cortina-library-item.is-missing {
  @apply border-yellow-500/40;
}

.cortina-library-cover {
  @apply w-9 h-9 rounded bg-surface-600 flex items-center justify-center;
}

.cortina-library-copy {
  @apply min-w-0;
}

.cortina-library-track-title {
  @apply text-text-title text-xs font-medium truncate;
}

.cortina-library-track-meta {
  @apply text-text-subtitle text-xs truncate;
}

.cortina-library-remove {
  @apply w-6 h-6 flex items-center justify-center rounded text-text-subtitle hover:bg-surface-600 hover:text-text-title;
}

.milonga-workspace-resizer {
  @apply h-full w-10px flex items-center justify-center rounded cursor-ew-resize hover:bg-surface-700/70 transition-colors;
}

.milonga-workspace-resizer span {
  @apply h-16 w-px bg-surface-500 pointer-events-none;
}

.milonga-workspace.is-resizing .milonga-workspace-resizer,
.milonga-workspace-resizer:hover {
  @apply bg-surface-700/70;
}

@media (max-width: 1180px) {
  .milonga-workspace {
    @apply grid-cols-1;
    grid-template-rows: minmax(220px, var(--milonga-plan-size)) 10px minmax(280px, 1fr);
    grid-template-columns: 1fr;
  }

  .milonga-workspace-resizer {
    @apply h-10px w-full cursor-ns-resize;
  }

  .milonga-workspace-resizer span {
    @apply h-px w-16;
  }
}
</style>

<style lang="postcss">
.milonga-is-resizing {
  @apply select-none;
}
</style>
