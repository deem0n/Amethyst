<script setup lang="ts">
import { Icon as IconifyIcon } from "@iconify/vue";
import { useLocalStorage } from "@vueuse/core";
import { onBeforeUnmount, onMounted, computed, ref, watch } from "vue";

import { amethyst } from "@/amethyst.js";
import CoverArt from "@/components/CoverArt.vue";
import MilongaPlan, { type CortinaEffectState, type CortinaSlot } from "@/components/MilongaPlan.vue";
import RouteHeader from "@/components/v2/RouteHeader.vue";
import {
  createCortinaLibraryEntry,
  type CortinaLibraryEntry,
  createCortinaLibrarySet,
  type CortinaLibrarySet,
  createMilongaPlanDocument,
  isSameMilongaTrackRef,
  type MilongaPlanDocument,
  type MilongaTrackRef,
  resolveMilongaTrackRef,
  trackToMilongaTrackRef,
} from "@/logic/milonga";

// By Dima
import TrackSelector from "@/components/TrackSelector.vue";
import SearchInput from "@/components/v2/SearchInput.vue";
import type { Track } from "@/logic/track";

type PlanTrack = Track | null;
type MilongaPlaybackEntry = {
  track: Track;
  kind: "tanda" | "cortina";
  cortinaIndex?: number;
  durationSeconds?: number;
  fadeInSeconds?: number;
  fadeOutSeconds?: number;
};

const isLoading = ref(false);
const mediaSources = computed(() => [
  { id: "All", name: "All Sources" },
  ...amethyst.mediaSourceManager.mediaSources.value.map((source) => ({
    id: source.uuid,
    name: source.name,
  })),
]);

const filterText = useLocalStorage("milongaTrackSelectorFilterText", "");
const selectedMediaSource = useLocalStorage("milongaTrackSelectorMediaSource", "All");
const planPaneSize = useLocalStorage("milongaWorkspacePlanPaneSize", 42);
const legacyCortinaLibrary = useLocalStorage<CortinaLibraryEntry[]>("milongaCortinaLibrary", []);
const cortinaSets = useLocalStorage<CortinaLibrarySet[]>("milongaCortinaSets", []);
const activeCortinaSetId = useLocalStorage("milongaActiveCortinaSetId", "");
const cortinaSetNameInput = ref("");
const showCortinaSetEditor = ref(false);
const draggedCortinaEntryIndex = ref<number | null>(null);
const milongaPlans = useLocalStorage<MilongaPlanDocument[]>("milongaPlans", []);
const activeMilongaPlanId = useLocalStorage("milongaActivePlanId", "");
const milongaPlanNameInput = ref("");
const showMilongaPlanEditor = ref(false);
const workspaceElement = ref<HTMLElement | null>(null);
const isResizingWorkspace = ref(false);
const currentTrackPath = ref<string>();
const activeCortinaEffect = ref<CortinaEffectState>();
const milongaPlaybackSequence = ref<MilongaPlaybackEntry[]>([]);
const milongaPlaybackIndex = ref(-1);
let cortinaAdvanceTimeout: ReturnType<typeof window.setTimeout> | undefined;
let cortinaFadeInTimeout: ReturnType<typeof window.setTimeout> | undefined;
let cortinaFadeOutTimeout: ReturnType<typeof window.setTimeout> | undefined;
let cortinaFadeOutSilenceTimeout: ReturnType<typeof window.setTimeout> | undefined;
let cortinaEffectProgressInterval: ReturnType<typeof window.setInterval> | undefined;
let cortinaPlayTimeout: ReturnType<typeof window.setTimeout> | undefined;

const milongaLibraryTracks = computed(() => {
  const queueTracks = amethyst.player.queue.getList();
  return queueTracks.length > 0 ? queueTracks : amethyst.state.milongaCandidateTracks;
});

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

// Заменяем computed на ref для управления состоянием
const milongaPlanTracks = ref<PlanTrack[]>([]);
const milongaCortinaSlots = ref<CortinaSlot[]>([]);

const createAutomaticCortina = (): CortinaSlot => ({
  mode: "automatic",
  track: null,
});

const activeMilongaPlan = computed(() =>
  milongaPlans.value.find((plan) => plan.id === activeMilongaPlanId.value) ?? milongaPlans.value[0],
);
const globalDefaultCortinaDurationSeconds = computed(() =>
  amethyst.state.settings.milonga?.defaultCortinaDurationSeconds ?? 30,
);
const globalDefaultCortinaFadeInSeconds = computed(() =>
  amethyst.state.settings.milonga?.defaultCortinaFadeInSeconds ?? 2,
);
const globalDefaultCortinaFadeOutSeconds = computed(() =>
  amethyst.state.settings.milonga?.defaultCortinaFadeOutSeconds ?? 2,
);
const selectedMilongaCortinaFadeInSeconds = computed(() =>
  activeMilongaPlan.value?.cortinaFadeInSeconds ?? globalDefaultCortinaFadeInSeconds.value,
);
const selectedMilongaCortinaFadeOutSeconds = computed(() =>
  activeMilongaPlan.value?.cortinaFadeOutSeconds ?? globalDefaultCortinaFadeOutSeconds.value,
);
const normalizedMilongaPlanNameInput = computed(() => milongaPlanNameInput.value.trim());
const normalizedMilongaPlanNameKey = computed(() => normalizedMilongaPlanNameInput.value.toLocaleLowerCase());
const activeMilongaPlanNameKey = computed(() => activeMilongaPlan.value?.name.trim().toLocaleLowerCase() ?? "");
const hasMilongaPlanNameInput = computed(() => normalizedMilongaPlanNameInput.value.length > 0);
const hasMilongaPlanWithInputName = computed(() =>
  milongaPlans.value.some((plan) => plan.name.trim().toLocaleLowerCase() === normalizedMilongaPlanNameKey.value),
);
const hasOtherMilongaPlanWithInputName = computed(() =>
  milongaPlans.value.some((plan) =>
    plan.id !== activeMilongaPlan.value?.id
    && plan.name.trim().toLocaleLowerCase() === normalizedMilongaPlanNameKey.value,
  ),
);
const canCreateMilongaPlan = computed(() =>
  hasMilongaPlanNameInput.value && !hasMilongaPlanWithInputName.value,
);
const canRenameMilongaPlan = computed(() =>
  !!activeMilongaPlan.value
  && hasMilongaPlanNameInput.value
  && normalizedMilongaPlanNameKey.value !== activeMilongaPlanNameKey.value
  && !hasOtherMilongaPlanWithInputName.value,
);
const milongaPlanNameValidationMessage = computed(() => {
  if (!hasMilongaPlanNameInput.value) return "Enter a Milonga name.";
  if (hasOtherMilongaPlanWithInputName.value) return "A Milonga with this name already exists.";
  return "";
});

const ensureMilongaPlans = () => {
  if (milongaPlans.value.length > 0) {
    if (!milongaPlans.value.some((plan) => plan.id === activeMilongaPlanId.value)) {
      activeMilongaPlanId.value = milongaPlans.value[0]?.id ?? "";
    }
    return;
  }

  const defaultPlan = createMilongaPlanDocument(
    "Default Milonga",
    globalDefaultCortinaDurationSeconds.value,
    globalDefaultCortinaFadeInSeconds.value,
    globalDefaultCortinaFadeOutSeconds.value,
  );
  milongaPlans.value = [defaultPlan];
  activeMilongaPlanId.value = defaultPlan.id;
};

const updateActiveMilongaPlan = (changes: Partial<MilongaPlanDocument>) => {
  const activePlan = activeMilongaPlan.value;
  if (!activePlan) return;

  milongaPlans.value = milongaPlans.value.map((plan) =>
    plan.id === activePlan.id
      ? { ...plan, ...changes, updatedAt: Date.now() }
      : plan,
  );
};

const resolvePlanTrackRef = (trackRef: MilongaTrackRef | null) =>
  trackRef ? resolveMilongaTrackRef(trackRef, milongaLibraryTracks.value) ?? null : null;

const hydrateActiveMilongaPlan = () => {
  const activePlan = activeMilongaPlan.value;
  if (!activePlan) return;

  milongaPlanTracks.value = activePlan.tracks.map(resolvePlanTrackRef);
  milongaCortinaSlots.value = activePlan.cortinaSlots.map((slot) => ({
    mode: slot.mode,
    track: resolvePlanTrackRef(slot.track),
    durationSeconds: slot.durationSeconds,
    fadeInSeconds: slot.fadeInSeconds,
    fadeOutSeconds: slot.fadeOutSeconds,
  }));
};

const serializeTracks = (tracks: PlanTrack[]) =>
  tracks.map((track) => track ? trackToMilongaTrackRef(track) : null);

const serializeCortinaSlots = (slots: CortinaSlot[]) =>
  slots.map((slot) => ({
    mode: slot.mode,
    track: slot.track ? trackToMilongaTrackRef(slot.track) : null,
    durationSeconds: slot.durationSeconds,
    fadeInSeconds: slot.fadeInSeconds,
    fadeOutSeconds: slot.fadeOutSeconds,
  }));

watch(milongaPlans, ensureMilongaPlans, { deep: false });
watch(activeMilongaPlan, (plan) => {
  milongaPlanNameInput.value = plan?.name ?? "";
  hydrateActiveMilongaPlan();
}, { immediate: true });

const toggleMilongaPlanEditor = () => {
  showMilongaPlanEditor.value = !showMilongaPlanEditor.value;
  if (showMilongaPlanEditor.value) milongaPlanNameInput.value = activeMilongaPlan.value?.name ?? "";
};

const addMilongaPlan = () => {
  if (!canCreateMilongaPlan.value) return;

  const plan = createMilongaPlanDocument(
    normalizedMilongaPlanNameInput.value || "New Milonga",
    globalDefaultCortinaDurationSeconds.value,
    globalDefaultCortinaFadeInSeconds.value,
    globalDefaultCortinaFadeOutSeconds.value,
  );
  milongaPlans.value = [...milongaPlans.value, plan];
  activeMilongaPlanId.value = plan.id;
};

const renameActiveMilongaPlan = () => {
  if (!canRenameMilongaPlan.value) return;
  updateActiveMilongaPlan({ name: normalizedMilongaPlanNameInput.value });
};

const deleteActiveMilongaPlan = () => {
  const activePlan = activeMilongaPlan.value;
  if (milongaPlans.value.length <= 1 || !activePlan) return;

  const shouldDelete = window.confirm(`Delete Milonga "${activePlan.name}"?`);
  if (!shouldDelete) return;

  const remainingPlans = milongaPlans.value.filter((plan) => plan.id !== activePlan.id);
  milongaPlans.value = remainingPlans;
  activeMilongaPlanId.value = remainingPlans[0]?.id ?? "";
};

const updateActiveMilongaCortinaDuration = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value);
  if (!Number.isFinite(value)) return;
  updateActiveMilongaPlan({ cortinaDurationSeconds: Math.max(5, Math.min(600, Math.round(value))) });
};

const normalizeFadeSeconds = (value: number) => Math.max(0, Math.min(30, Math.round(value * 10) / 10));
const getCortinaRampSeconds = (addedSeconds: number) => addedSeconds > 0 ? Math.max(2, addedSeconds / 2) : 0;
const getNormalPlaybackGain = () => Math.pow(10, amethyst.player.volume / 20);

const clearCortinaEffectProgress = () => {
  if (cortinaEffectProgressInterval) window.clearInterval(cortinaEffectProgressInterval);
  cortinaEffectProgressInterval = undefined;
  activeCortinaEffect.value = undefined;
};

const startCortinaEffectProgress = (
  cortinaIndex: number,
  phase: CortinaEffectState["phase"],
  kind: CortinaEffectState["kind"],
  durationSeconds: number,
) => {
  clearCortinaEffectProgress();

  const startTime = performance.now();
  const durationMs = Math.max(1, durationSeconds * 1000);

  const updateProgress = () => {
    const progress = Math.min(1, (performance.now() - startTime) / durationMs);
    if (kind === "silence" && progress >= 1) {
      clearCortinaEffectProgress();
      return;
    }

    activeCortinaEffect.value = {
      cortinaIndex,
      phase,
      kind,
      durationSeconds,
      progress,
    };

    if (progress >= 1) clearCortinaEffectProgress();
  };

  updateProgress();
  cortinaEffectProgressInterval = window.setInterval(updateProgress, kind === "silence" ? 1000 : 50);
};

const clearCortinaPlaybackEnvelope = () => {
  if (cortinaAdvanceTimeout) window.clearTimeout(cortinaAdvanceTimeout);
  if (cortinaFadeInTimeout) window.clearTimeout(cortinaFadeInTimeout);
  if (cortinaFadeOutTimeout) window.clearTimeout(cortinaFadeOutTimeout);
  if (cortinaFadeOutSilenceTimeout) window.clearTimeout(cortinaFadeOutSilenceTimeout);
  if (cortinaPlayTimeout) window.clearTimeout(cortinaPlayTimeout);
  cortinaAdvanceTimeout = undefined;
  cortinaFadeInTimeout = undefined;
  cortinaFadeOutTimeout = undefined;
  cortinaFadeOutSilenceTimeout = undefined;
  cortinaPlayTimeout = undefined;
  clearCortinaEffectProgress();

  const gain = amethyst.player.nodeManager.master.post.gain;
  gain.cancelScheduledValues(amethyst.player.context.currentTime);
  gain.setValueAtTime(getNormalPlaybackGain(), amethyst.player.context.currentTime);
};

const applyCortinaPlaybackEnvelope = (entry: MilongaPlaybackEntry) => {
  clearCortinaPlaybackEnvelope();
  if (entry.kind !== "cortina") return;

  const gain = amethyst.player.nodeManager.master.post.gain;
  const contextTime = amethyst.player.context.currentTime;
  const normalGain = getNormalPlaybackGain();
  const fadeInAddedSeconds = normalizeFadeSeconds(entry.fadeInSeconds ?? selectedMilongaCortinaFadeInSeconds.value);
  const fadeOutAddedSeconds = normalizeFadeSeconds(entry.fadeOutSeconds ?? selectedMilongaCortinaFadeOutSeconds.value);
  const fadeInRampSeconds = getCortinaRampSeconds(fadeInAddedSeconds);
  const fadeOutRampSeconds = getCortinaRampSeconds(fadeOutAddedSeconds);
  const durationSeconds = Math.max(0, entry.durationSeconds ?? activeMilongaPlan.value?.cortinaDurationSeconds ?? globalDefaultCortinaDurationSeconds.value);
  const totalPlaybackSeconds = fadeInAddedSeconds + durationSeconds + fadeOutAddedSeconds;

  gain.cancelScheduledValues(contextTime);

  if (entry.cortinaIndex !== undefined && fadeInAddedSeconds > 0) {
    startCortinaEffectProgress(entry.cortinaIndex, "in", "silence", fadeInAddedSeconds);
  }

  if (fadeInRampSeconds > 0) {
    gain.setValueAtTime(0, contextTime);
    gain.setValueAtTime(0, contextTime + fadeInAddedSeconds);
    gain.linearRampToValueAtTime(normalGain, contextTime + fadeInAddedSeconds + fadeInRampSeconds);

    if (entry.cortinaIndex !== undefined) {
      const startFadeInProgress = () => {
        if (entry.cortinaIndex !== undefined) startCortinaEffectProgress(entry.cortinaIndex, "in", "fade", fadeInRampSeconds);
      };

      if (fadeInAddedSeconds > 0) {
        cortinaFadeInTimeout = window.setTimeout(startFadeInProgress, fadeInAddedSeconds * 1000);
      }
      else {
        startFadeInProgress();
      }
    }
  }
  else {
    gain.setValueAtTime(normalGain, contextTime);
  }

  const startCortinaPlayback = () => {
    cortinaPlayTimeout = undefined;
    amethyst.player.play(entry.track);
  };

  if (fadeInAddedSeconds > 0) {
    cortinaPlayTimeout = window.setTimeout(startCortinaPlayback, fadeInAddedSeconds * 1000);
  }
  else {
    startCortinaPlayback();
  }

  if (totalPlaybackSeconds <= 0) return;

  if (fadeOutRampSeconds > 0) {
    const fadeOutDelayMs = Math.max(0, fadeInAddedSeconds + durationSeconds - fadeOutRampSeconds) * 1000;
    cortinaFadeOutTimeout = window.setTimeout(() => {
      if (entry.cortinaIndex !== undefined) {
        startCortinaEffectProgress(entry.cortinaIndex, "out", "fade", fadeOutRampSeconds);
      }
      const fadeOutStartTime = amethyst.player.context.currentTime;
      gain.cancelScheduledValues(fadeOutStartTime);
      gain.setValueAtTime(gain.value, fadeOutStartTime);
      gain.linearRampToValueAtTime(0, fadeOutStartTime + fadeOutRampSeconds);
    }, fadeOutDelayMs);
  }

  cortinaAdvanceTimeout = window.setTimeout(() => {
    playNextMilongaSequenceTrack();
  }, totalPlaybackSeconds * 1000);

  if (entry.cortinaIndex !== undefined && fadeOutAddedSeconds > 0) {
    cortinaFadeOutSilenceTimeout = window.setTimeout(() => {
      if (entry.cortinaIndex !== undefined) startCortinaEffectProgress(entry.cortinaIndex, "out", "silence", fadeOutAddedSeconds);
    }, (fadeInAddedSeconds + durationSeconds) * 1000);
  }
};

const updateActiveMilongaCortinaFadeIn = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value);
  if (!Number.isFinite(value)) return;
  updateActiveMilongaPlan({ cortinaFadeInSeconds: normalizeFadeSeconds(value) });
};

const updateActiveMilongaCortinaFadeOut = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value);
  if (!Number.isFinite(value)) return;
  updateActiveMilongaPlan({ cortinaFadeOutSeconds: normalizeFadeSeconds(value) });
};

const ensureCortinaSets = () => {
  if (cortinaSets.value.length > 0) {
    if (!cortinaSets.value.some((set) => set.id === activeCortinaSetId.value)) {
      activeCortinaSetId.value = cortinaSets.value[0]?.id ?? "";
    }
    return;
  }

  const defaultSet = createCortinaLibrarySet("Default", legacyCortinaLibrary.value);
  cortinaSets.value = [defaultSet];
  activeCortinaSetId.value = defaultSet.id;
};

const activeCortinaSet = computed(() =>
  cortinaSets.value.find((set) => set.id === activeCortinaSetId.value) ?? cortinaSets.value[0],
);

const activeCortinaEntries = computed(() => activeCortinaSet.value?.entries ?? []);
const normalizedCortinaSetNameInput = computed(() => cortinaSetNameInput.value.trim());
const normalizedCortinaSetNameKey = computed(() => normalizedCortinaSetNameInput.value.toLocaleLowerCase());
const activeCortinaSetNameKey = computed(() => activeCortinaSet.value?.name.trim().toLocaleLowerCase() ?? "");
const hasCortinaSetNameInput = computed(() => normalizedCortinaSetNameInput.value.length > 0);
const hasCortinaSetWithInputName = computed(() =>
  cortinaSets.value.some((set) => set.name.trim().toLocaleLowerCase() === normalizedCortinaSetNameKey.value),
);
const hasOtherCortinaSetWithInputName = computed(() =>
  cortinaSets.value.some((set) =>
    set.id !== activeCortinaSet.value?.id
    && set.name.trim().toLocaleLowerCase() === normalizedCortinaSetNameKey.value,
  ),
);
const canCreateCortinaSet = computed(() =>
  hasCortinaSetNameInput.value && !hasCortinaSetWithInputName.value,
);
const canRenameCortinaSet = computed(() =>
  !!activeCortinaSet.value
  && hasCortinaSetNameInput.value
  && normalizedCortinaSetNameKey.value !== activeCortinaSetNameKey.value
  && !hasOtherCortinaSetWithInputName.value,
);
const cortinaSetNameValidationMessage = computed(() => {
  if (!hasCortinaSetNameInput.value) return "Enter a cortina set name.";
  if (hasOtherCortinaSetWithInputName.value) return "A cortina set with this name already exists.";
  return "";
});

watch(cortinaSets, ensureCortinaSets, { deep: false });
watch(activeCortinaSet, (set) => {
  cortinaSetNameInput.value = set?.name ?? "";
}, { immediate: true });

const toggleCortinaSetEditor = () => {
  showCortinaSetEditor.value = !showCortinaSetEditor.value;
  if (showCortinaSetEditor.value) cortinaSetNameInput.value = activeCortinaSet.value?.name ?? "";
};

const updateActiveCortinaSetEntries = (entries: CortinaLibraryEntry[]) => {
  const activeSet = activeCortinaSet.value;
  if (!activeSet) return;

  cortinaSets.value = cortinaSets.value.map((set) =>
    set.id === activeSet.id
      ? { ...set, entries, updatedAt: Date.now() }
      : set,
  );
};

const addCortinaSet = () => {
  if (!canCreateCortinaSet.value) return;

  const cortinaSet = createCortinaLibrarySet(normalizedCortinaSetNameInput.value || "New Cortina Set");
  cortinaSets.value = [...cortinaSets.value, cortinaSet];
  activeCortinaSetId.value = cortinaSet.id;
};

const updateActiveCortinaSetName = (name: string) => {
  const activeSet = activeCortinaSet.value;
  if (!activeSet) return;

  const normalizedName = name.trim() || "Cortinas";
  cortinaSets.value = cortinaSets.value.map((set) =>
    set.id === activeSet.id
      ? { ...set, name: normalizedName, updatedAt: Date.now() }
      : set,
  );
  cortinaSetNameInput.value = normalizedName;
};

const renameActiveCortinaSet = () => {
  if (!canRenameCortinaSet.value) return;

  updateActiveCortinaSetName(cortinaSetNameInput.value);
};

const deleteActiveCortinaSet = () => {
  const activeSet = activeCortinaSet.value;
  if (cortinaSets.value.length <= 1 || !activeSet) return;

  const trackText = activeSet.entries.length === 1 ? "1 track" : `${activeSet.entries.length} tracks`;
  const shouldDelete = window.confirm(`Delete cortina set "${activeSet.name}" with ${trackText}?`);
  if (!shouldDelete) return;

  const remainingSets = cortinaSets.value.filter((set) => set.id !== activeSet.id);
  cortinaSets.value = remainingSets;
  activeCortinaSetId.value = remainingSets[0]?.id ?? "";
};

const getTrackFromDragEvent = (event: DragEvent): Track | null => {
  const jsonData = event.dataTransfer?.getData("application/json");
  if (jsonData) {
    try {
      const trackData = JSON.parse(jsonData);
      if (trackData.type === "amethyst/track") {
        return milongaLibraryTracks.value.find((track) =>
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
    return milongaLibraryTracks.value.find((track) =>
      track.absolutePath === pathData
      || track.path === pathData) ?? null;
  }

  return null;
};

const resolvedActiveCortinaEntries = computed(() => activeCortinaEntries.value.map((entry) => ({
  entry,
  track: resolveMilongaTrackRef(entry.track, milongaLibraryTracks.value),
})));

const resolvedActiveCortinaTracks = computed(() =>
  resolvedActiveCortinaEntries.value
    .map(({ track }) => track)
    .filter((track): track is Track => !!track),
);
const loadedActiveCortinaTrackCount = computed(() => resolvedActiveCortinaTracks.value.length);
const cortinaPoolStatusText = computed(() => {
  const totalCount = activeCortinaEntries.value.length;
  if (totalCount === 0) return "0 tracks";
  if (loadedActiveCortinaTrackCount.value === totalCount) {
    return totalCount === 1 ? "1 track" : `${totalCount} tracks`;
  }

  return `${loadedActiveCortinaTrackCount.value} loaded / ${totalCount} tracks`;
});
const cortinaPoolTrackCountText = computed(() => String(activeCortinaEntries.value.length));

const addCortinaLibraryTrack = (track: Track) => {
  const trackRef = trackToMilongaTrackRef(track);
  const alreadyExists = activeCortinaEntries.value.some((entry) =>
    isSameMilongaTrackRef(entry.track, trackRef),
  );

  if (!alreadyExists) {
    updateActiveCortinaSetEntries([...activeCortinaEntries.value, createCortinaLibraryEntry(track)]);
  }
};

const removeCortinaLibraryEntry = (entryToRemove: CortinaLibraryEntry) => {
  updateActiveCortinaSetEntries(activeCortinaEntries.value.filter((entry) =>
    !isSameMilongaTrackRef(entry.track, entryToRemove.track),
  ));
};

const handleCortinaEntryDragStart = (event: DragEvent, index: number, track: Track | null) => {
  draggedCortinaEntryIndex.value = index;
  if (!event.dataTransfer) return;

  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", String(index));
  event.dataTransfer.setData("application/x-amethyst-cortina-entry", String(index));

  if (!track) return;

  const trackData = {
    type: "amethyst/track",
    absolutePath: track.absolutePath,
    path: track.path,
    filename: track.getFilename(),
    title: track.getTitle(),
    artist: track.getArtistsFormatted(),
  };

  event.dataTransfer.setData("application/json", JSON.stringify(trackData));
  event.dataTransfer.setData("text/plain", track.absolutePath || track.path);
};

const handleCortinaEntryDragOver = (event: DragEvent) => {
  if (draggedCortinaEntryIndex.value === null) return;

  event.preventDefault();
  event.stopPropagation();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
};

const handleCortinaEntryDrop = (event: DragEvent, targetIndex: number) => {
  if (draggedCortinaEntryIndex.value === null) return;

  event.preventDefault();
  event.stopPropagation();

  const sourceIndex = draggedCortinaEntryIndex.value;
  draggedCortinaEntryIndex.value = null;
  if (sourceIndex === targetIndex) return;

  const nextEntries = [...activeCortinaEntries.value];
  const [movedEntry] = nextEntries.splice(sourceIndex, 1);
  if (!movedEntry) return;

  nextEntries.splice(targetIndex, 0, movedEntry);
  updateActiveCortinaSetEntries(nextEntries);
};

const clearCortinaEntryDrag = () => {
  draggedCortinaEntryIndex.value = null;
};

const handleCortinaLibraryDragOver = (event: DragEvent) => {
  if (draggedCortinaEntryIndex.value !== null) return;

  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
};

const handleCortinaLibraryDrop = (event: DragEvent) => {
  if (draggedCortinaEntryIndex.value !== null) return;

  event.preventDefault();
  const track = getTrackFromDragEvent(event);
  if (track) addCortinaLibraryTrack(track);
};

// Реакция на выбор источника
watch(selectedMediaSource, async (newSourceId) => {
  isLoading.value = true;
  try {
    await amethyst.loadMilongaCandidateTracks(newSourceId);
    hydrateActiveMilongaPlan();
  }
  finally {
    isLoading.value = false;
  }
}, { immediate: false });

const ensureCortinaSlotsForTracks = (tracks: PlanTrack[]) => {
  const cortinaCount = Math.max(0, Math.ceil(tracks.length / 4) - 1);
  const nextSlots = milongaCortinaSlots.value.slice(0, cortinaCount);

  while (nextSlots.length < cortinaCount) {
    nextSlots.push(createAutomaticCortina());
  }

  milongaCortinaSlots.value = nextSlots;
};

const cortinaSlotCount = computed(() => Math.max(0, Math.ceil(milongaPlanTracks.value.length / 4) - 1));
const automaticCortinaSlotCount = computed(() =>
  Array.from({ length: cortinaSlotCount.value }, (_, index) =>
    milongaCortinaSlots.value[index] ?? createAutomaticCortina(),
  ).filter((slot) => slot.mode === "automatic").length,
);
const canFillCortinasFromSet = computed(() =>
  automaticCortinaSlotCount.value > 0 && resolvedActiveCortinaTracks.value.length > 0,
);
const cortinaFillStatusText = computed(() => {
  if (activeCortinaEntries.value.length === 0) return "Add tracks to this pool before assigning cortinas.";
  if (loadedActiveCortinaTrackCount.value === 0) return "No pool tracks are loaded from the current source.";
  if (automaticCortinaSlotCount.value === 0) return "No automatic cortinas to reassign.";
  return "Manual and empty cortinas will stay unchanged.";
});

const createAssignedAutomaticCortina = (track: Track): CortinaSlot => ({
  mode: "automatic",
  track,
});

const fillCortinaSlotsFromTracks = (tracks: Track[]) => {
  if (tracks.length === 0) return;

  let trackIndex = 0;
  const nextSlots = [...milongaCortinaSlots.value];

  while (nextSlots.length < cortinaSlotCount.value) {
    nextSlots.push(createAutomaticCortina());
  }

  const updatedSlots = nextSlots.slice(0, cortinaSlotCount.value).map((slot) => {
    if (slot.mode !== "automatic") return slot;

    const track = tracks[trackIndex % tracks.length]!;
    trackIndex += 1;
    return createAssignedAutomaticCortina(track);
  });
  milongaCortinaSlots.value = updatedSlots;
  updateActiveMilongaPlan({ cortinaSlots: serializeCortinaSlots(updatedSlots) });
};

const fillCortinasInSetOrder = () => {
  if (!canFillCortinasFromSet.value) return;

  fillCortinaSlotsFromTracks(resolvedActiveCortinaTracks.value);
};

const fillCortinasInRandomOrder = () => {
  if (!canFillCortinasFromSet.value) return;

  const tracks = resolvedActiveCortinaTracks.value;
  const shuffledTracks = [...tracks].sort(() => 0.5 - Math.random());
  fillCortinaSlotsFromTracks(shuffledTracks);
};

// Функция для обработки обновления треков из MilongaPlan
const handleTracksUpdated = (updatedTracks: PlanTrack[]) => {
  milongaPlanTracks.value = updatedTracks;
  ensureCortinaSlotsForTracks(updatedTracks);
  updateActiveMilongaPlan({
    tracks: serializeTracks(updatedTracks),
    cortinaSlots: serializeCortinaSlots(milongaCortinaSlots.value),
  });
};

const handleCortinaSlotsUpdated = (updatedCortinaSlots: CortinaSlot[]) => {
  milongaCortinaSlots.value = updatedCortinaSlots;
  updateActiveMilongaPlan({ cortinaSlots: serializeCortinaSlots(updatedCortinaSlots) });
};

const getManualCortinaTrack = (cortinaIndex: number) => {
  const slot = milongaCortinaSlots.value[cortinaIndex];
  return slot?.mode === "manual" ? slot.track : null;
};

const getAutomaticCortinaTrack = (cortinaIndex: number) => {
  const slot = milongaCortinaSlots.value[cortinaIndex];
  if (slot?.mode !== "automatic") return null;

  const assignedTrack = slot.track;
  if (assignedTrack) return assignedTrack;

  const tracks = resolvedActiveCortinaTracks.value;

  if (tracks.length === 0) return null;
  return tracks[Math.floor(Math.random() * tracks.length)];
};

const getCortinaPlaybackTrack = (cortinaIndex: number) => {
  const manualTrack = getManualCortinaTrack(cortinaIndex);
  return manualTrack ?? getAutomaticCortinaTrack(cortinaIndex);
};

const getCortinaPlaybackEntry = (cortinaIndex: number): MilongaPlaybackEntry | null => {
  const slot = milongaCortinaSlots.value[cortinaIndex];
  const track = getCortinaPlaybackTrack(cortinaIndex);
  if (!track) return null;

  return {
    track,
    kind: "cortina",
    cortinaIndex,
    durationSeconds: slot?.mode === "manual" ? slot.durationSeconds ?? activeMilongaPlan.value?.cortinaDurationSeconds ?? globalDefaultCortinaDurationSeconds.value : activeMilongaPlan.value?.cortinaDurationSeconds ?? globalDefaultCortinaDurationSeconds.value,
    fadeInSeconds: slot?.mode === "manual" ? slot.fadeInSeconds ?? selectedMilongaCortinaFadeInSeconds.value : selectedMilongaCortinaFadeInSeconds.value,
    fadeOutSeconds: slot?.mode === "manual" ? slot.fadeOutSeconds ?? selectedMilongaCortinaFadeOutSeconds.value : selectedMilongaCortinaFadeOutSeconds.value,
  };
};

const buildMilongaSequenceFromTandaTrack = (startTandaIndex: number, startPosition: number) => {
  const sequence: MilongaPlaybackEntry[] = [];
  const tandaCount = Math.ceil(milongaPlanTracks.value.length / 4);

  for (let tandaIndex = startTandaIndex; tandaIndex < tandaCount; tandaIndex++) {
    const firstPosition = tandaIndex === startTandaIndex ? startPosition : 0;

    for (let position = firstPosition; position < 4; position++) {
      const track = milongaPlanTracks.value[tandaIndex * 4 + position];
      if (track) sequence.push({ track, kind: "tanda" });
    }

    const cortinaEntry = getCortinaPlaybackEntry(tandaIndex);
    if (cortinaEntry) sequence.push(cortinaEntry);
  }

  return sequence;
};

const buildMilongaSequenceFromCortina = (cortinaIndex: number) => {
  const sequence: MilongaPlaybackEntry[] = [];
  const cortinaEntry = getCortinaPlaybackEntry(cortinaIndex);
  if (cortinaEntry) sequence.push(cortinaEntry);

  const nextTandaSequence = buildMilongaSequenceFromTandaTrack(cortinaIndex + 1, 0);
  sequence.push(...nextTandaSequence);
  return sequence;
};

const playMilongaEntry = (entry: MilongaPlaybackEntry) => {
  currentTrackPath.value = entry.track.path;

  if (entry.kind === "cortina") {
    applyCortinaPlaybackEnvelope(entry);
    return;
  }

  clearCortinaPlaybackEnvelope();
  amethyst.player.play(entry.track);
};

const playMilongaSequence = (sequence: MilongaPlaybackEntry[]) => {
  milongaPlaybackSequence.value = sequence;
  milongaPlaybackIndex.value = 0;

  const firstEntry = sequence[0];
  if (firstEntry) {
    playMilongaEntry(firstEntry);
  }
};

const playNextMilongaSequenceTrack = () => {
  if (milongaPlaybackIndex.value < 0) return false;

  const nextIndex = milongaPlaybackIndex.value + 1;
  const nextTrack = milongaPlaybackSequence.value[nextIndex];

  if (!nextTrack) {
    clearCortinaPlaybackEnvelope();
    milongaPlaybackSequence.value = [];
    milongaPlaybackIndex.value = -1;
    currentTrackPath.value = undefined;
    amethyst.player.pause();
    return true;
  }

  milongaPlaybackIndex.value = nextIndex;
  playMilongaEntry(nextTrack);
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
  if (activeMilongaTrack && activeMilongaTrack.track.path !== track.path) {
    clearCortinaPlaybackEnvelope();
    milongaPlaybackSequence.value = [];
    milongaPlaybackIndex.value = -1;
  }
};

const handlePlayerStop = () => {
  clearCortinaPlaybackEnvelope();
  currentTrackPath.value = undefined;
  milongaPlaybackSequence.value = [];
  milongaPlaybackIndex.value = -1;
};

const handlePlayerPause = () => {
  clearCortinaPlaybackEnvelope();
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
  ensureCortinaSets();
  ensureMilongaPlans();

  isLoading.value = true;
  await amethyst.loadMilongaCandidateTracks(selectedMediaSource.value);
  hydrateActiveMilongaPlan();

  isLoading.value = false;
});

onBeforeUnmount(() => {
  clearCortinaPlaybackEnvelope();
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
    <div class="milonga-menu">
      <route-header title="Planner">
        <div class="milonga-menu-controls">
          <select
            v-model="activeMilongaPlanId"
            class="milonga-menu-select"
          >
            <option
              v-for="plan in milongaPlans"
              :key="plan.id"
              :value="plan.id"
            >
              {{ plan.name }}
            </option>
          </select>

          <label class="milonga-cortina-duration">
            <span>Cortina</span>
            <input
              :value="activeMilongaPlan?.cortinaDurationSeconds ?? globalDefaultCortinaDurationSeconds"
              type="number"
              min="5"
              max="600"
              step="5"
              @change="updateActiveMilongaCortinaDuration"
            >
            <span>s</span>
          </label>

          <label class="milonga-cortina-duration">
            <span>In</span>
            <input
              :value="selectedMilongaCortinaFadeInSeconds"
              type="number"
              min="0"
              max="30"
              step="0.5"
              @change="updateActiveMilongaCortinaFadeIn"
            >
            <span>s</span>
          </label>

          <label class="milonga-cortina-duration">
            <span>Out</span>
            <input
              :value="selectedMilongaCortinaFadeOutSeconds"
              type="number"
              min="0"
              max="30"
              step="0.5"
              @change="updateActiveMilongaCortinaFadeOut"
            >
            <span>s</span>
          </label>

          <button
            class="milonga-menu-toggle-editor"
            :title="showMilongaPlanEditor ? 'Hide Milonga editor' : 'Show Milonga editor'"
            type="button"
            @click="toggleMilongaPlanEditor"
          >
            {{ showMilongaPlanEditor ? "⬆" : "⬇" }}
          </button>

          <button
            class="milonga-menu-delete"
            title="Delete Milonga"
            type="button"
            :disabled="milongaPlans.length <= 1"
            @click="deleteActiveMilongaPlan"
          >
            <iconify-icon icon="ic:twotone-delete" class="w-5 h-5" />
          </button>
        </div>
      </route-header>

      <div v-if="showMilongaPlanEditor">
        <div class="milonga-menu-editor">
          <input
            v-model="milongaPlanNameInput"
            class="milonga-menu-name-input"
            placeholder="Milonga name"
          >
          <button
            class="milonga-menu-button"
            type="button"
            :disabled="!canCreateMilongaPlan"
            @click="addMilongaPlan"
          >
            New Milonga
          </button>
          <button
            class="milonga-menu-button"
            type="button"
            :disabled="!canRenameMilongaPlan"
            @click="renameActiveMilongaPlan"
          >
            Rename
          </button>
        </div>
        <div
          v-if="milongaPlanNameValidationMessage"
          class="milonga-menu-validation"
        >
          {{ milongaPlanNameValidationMessage }}
        </div>
      </div>
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
          :candidate-tracks="milongaLibraryTracks"
          :current-track-path="currentTrackPath"
          :cortina-library-size="activeCortinaEntries.length"
          :active-cortina-effect="activeCortinaEffect"
          :default-cortina-duration-seconds="activeMilongaPlan?.cortinaDurationSeconds ?? globalDefaultCortinaDurationSeconds"
          :default-cortina-fade-in-seconds="selectedMilongaCortinaFadeInSeconds"
          :default-cortina-fade-out-seconds="selectedMilongaCortinaFadeOutSeconds"
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
          <route-header title="Cortina Pool">
            <div class="cortina-library-controls">
              <div
                class="cortina-library-count-badge"
                :title="cortinaPoolStatusText"
              >
                {{ cortinaPoolTrackCountText }}
              </div>
              <select
                v-model="activeCortinaSetId"
                class="cortina-library-select"
              >
                <option
                  v-for="set in cortinaSets"
                  :key="set.id"
                  :value="set.id"
                >
                  {{ set.name }}
                </option>
              </select>

              <button
                class="cortina-library-toggle-editor"
                :title="showCortinaSetEditor ? 'Hide set editor' : 'Show set editor'"
                type="button"
                @click="toggleCortinaSetEditor"
              >
                {{ showCortinaSetEditor ? "⬆" : "⬇" }}
              </button>

              <button
                class="cortina-library-delete"
                title="Delete cortina set"
                :disabled="cortinaSets.length <= 1"
                @click="deleteActiveCortinaSet"
              >
                <iconify-icon icon="ic:twotone-delete" class="w-5 h-5" />
              </button>
            </div>
          </route-header>

          <div v-if="showCortinaSetEditor">
            <div class="cortina-library-set-editor">
              <input
                v-model="cortinaSetNameInput"
                class="cortina-library-name-input"
                placeholder="Cortina set name"
              >
              <button
                class="cortina-library-set-button"
                type="button"
                :disabled="!canCreateCortinaSet"
                @click="addCortinaSet"
              >
                New set
              </button>
              <button
                class="cortina-library-set-button"
                type="button"
                :disabled="!canRenameCortinaSet"
                @click="renameActiveCortinaSet"
              >
                Rename
              </button>
            </div>
            <div
              v-if="cortinaSetNameValidationMessage"
              class="cortina-library-validation"
            >
              {{ cortinaSetNameValidationMessage }}
            </div>
          </div>

          <div
            v-if="activeCortinaEntries.length === 0"
            class="cortina-library-empty"
          >
            Drag tracks into "{{ activeCortinaSet?.name || 'Default' }}" to use them for automatic cortinas.
          </div>

          <div
            v-else
            class="cortina-library-list"
          >
            <div
              v-for="({ entry, track }, index) in resolvedActiveCortinaEntries"
              :key="`${entry.track.sourceUuid || 'source'}:${entry.track.path}`"
              class="cortina-library-item"
              :class="{
                'is-missing': !track,
                'is-dragging': draggedCortinaEntryIndex === index,
              }"
              draggable="true"
              @dragstart="handleCortinaEntryDragStart($event, index, track)"
              @dragover="handleCortinaEntryDragOver"
              @drop="handleCortinaEntryDrop($event, index)"
              @dragend="clearCortinaEntryDrag"
            >
              <div class="cortina-library-drag-handle">
                =
              </div>
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
                title="Remove track from set"
                type="button"
                @click="removeCortinaLibraryEntry(entry)"
              >
                <iconify-icon icon="ic:twotone-delete" class="w-5 h-5" />
              </button>
            </div>
          </div>

          <div class="cortina-library-fill-actions">
            <button
              class="cortina-library-fill-button"
              type="button"
              :disabled="!canFillCortinasFromSet"
              @click="fillCortinasInRandomOrder"
            >
              Reassign auto random
            </button>
            <button
              class="cortina-library-fill-button"
              type="button"
              :disabled="!canFillCortinasFromSet"
              @click="fillCortinasInSetOrder"
            >
              Reassign auto in order
            </button>
          </div>
          <div
            v-if="cortinaFillStatusText"
            class="cortina-library-fill-status"
          >
            {{ cortinaFillStatusText }}
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

          <search-input v-model="filterText" :disabled="isLoading" />
        </route-header>
        <track-selector
          class="milonga-track-selector"
          :external-columns="milongaColumns"
          :on-column-update="handleMilongaColumnUpdate"
          :search-text="filterText"
          :source-tracks="milongaLibraryTracks"
        />
      </section>
    </div>
  </div>
</template>

<style scoped lang="postcss">
.milonga-view {
  @apply relative h-full w-full py-2 pl-4 pr-2 text-text-title flex flex-col overflow-hidden;
}

.milonga-menu {
  @apply flex-none rounded bg-surface-800/80 border border-surface-700 p-3 mt-2 mr-2;
}

.milonga-menu-controls {
  @apply flex flex-1 min-w-0 items-center justify-end gap-2;
}

.milonga-menu-select {
  @apply min-w-0 rounded bg-surface-700 px-3 py-2 text-text-title focus:outline-none;
  flex: 1 1 26rem;
  max-width: 36rem;
}

.milonga-cortina-duration {
  @apply flex flex-none items-center gap-1 rounded bg-surface-700 px-2 py-2 text-xs text-text-subtitle;
}

.milonga-cortina-duration input {
  @apply w-14 bg-surface-900 rounded px-1 text-center text-text-title focus:outline-none;
}

.milonga-menu-delete,
.milonga-menu-toggle-editor {
  @apply w-10 h-10 flex items-center justify-center rounded bg-surface-700 px-2 py-2 text-text-subtitle hover:text-text-title disabled:opacity-40 disabled:hover:text-text-subtitle;
}

.milonga-menu-editor {
  @apply mt-2 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2;
}

.milonga-menu-name-input {
  @apply min-w-0 flex-1 rounded bg-surface-900 px-2 py-1 text-xs text-text-title placeholder:text-text-subtitle focus:outline-none;
}

.milonga-menu-button {
  @apply rounded bg-surface-700 px-3 py-1 text-xs text-text-subtitle hover:text-text-title disabled:opacity-40 disabled:hover:text-text-subtitle;
}

.milonga-menu-validation {
  @apply mt-1 text-xs text-text-subtitle;
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

.cortina-library-controls {
  @apply flex flex-1 min-w-0 items-center justify-end gap-2;
}

.cortina-library-count-badge {
  @apply flex-none rounded-full bg-surface-700 px-2 py-0.5 text-xs text-text-subtitle;
}

.cortina-library-select {
  @apply min-w-0 rounded bg-surface-700 px-3 py-2 text-text-title focus:outline-none;
  flex: 1 1 28rem;
  max-width: 34rem;
}

.cortina-library-delete {
  @apply w-10 flex items-center justify-center rounded bg-surface-700 px-2 py-2 text-text-subtitle hover:text-text-title disabled:opacity-40 disabled:hover:text-text-subtitle;
}

.cortina-library-toggle-editor {
  @apply w-10 rounded bg-surface-700 px-2 py-2 text-text-subtitle hover:text-text-title;
}

.cortina-library-set-editor {
  @apply mt-2 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2;
}

.cortina-library-name-input {
  @apply min-w-0 flex-1 rounded bg-surface-900 px-2 py-1 text-xs text-text-title placeholder:text-text-subtitle focus:outline-none;
}

.cortina-library-set-button {
  @apply rounded bg-surface-700 px-3 py-1 text-xs text-text-subtitle hover:text-text-title disabled:opacity-40 disabled:hover:text-text-subtitle;
}

.cortina-library-validation {
  @apply mt-1 text-xs text-text-subtitle;
}

.cortina-library-empty {
  @apply mt-3 rounded border border-dashed border-surface-600 px-3 py-4 text-center text-text-subtitle text-xs;
}

.cortina-library-list {
  @apply mt-3 grid grid-cols-1 2xl:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1;
}

.cortina-library-item {
  @apply grid grid-cols-[16px_36px_minmax(0,1fr)_40px] items-center gap-2 rounded bg-surface-900/60 p-2 border border-transparent;
}

.cortina-library-item.is-dragging {
  @apply opacity-60;
}

.cortina-library-item.is-missing {
  @apply border-yellow-500/40;
}

.cortina-library-drag-handle {
  @apply cursor-grab text-center text-text-subtitle text-xs;
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
  @apply w-10 h-10 flex items-center justify-center rounded bg-surface-700 text-text-subtitle hover:text-text-title;
}

.cortina-library-fill-actions {
  @apply mt-2 grid grid-cols-2 gap-2;
}

.cortina-library-fill-button {
  @apply rounded bg-surface-700 px-3 py-1 text-xs text-text-subtitle hover:text-text-title disabled:opacity-40 disabled:hover:text-text-subtitle;
}

.cortina-library-fill-status {
  @apply mt-1 text-xs text-text-subtitle;
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
