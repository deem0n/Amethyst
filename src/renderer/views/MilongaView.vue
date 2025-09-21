<script setup lang="ts">
import { useLocalStorage } from "@vueuse/core";
import { onMounted, computed, ref, watch  } from "vue";

import { amethyst } from "@/amethyst.js";
import BigButton from "@/components/BigButton.vue";
import MilongaPlan from "@/components/MilongaPlan.vue";
import RouteHeader from "@/components/v2/RouteHeader.vue";


// By Dima
import TrackSelector from "@/components/TrackSelector.vue";
import SearchInput from "@/components/v2/SearchInput.vue";
import type { Track } from "@/logic/track";

const isLoading = ref(false); // Добавлен индикатор загрузки
const mediaSources = computed(() => [
  { id: "All", name: "All Sources" },
  ...amethyst.mediaSourceManager.mediaSources.value.map(source => ({
    id: source.uuid,
    name: source.name
  }))
]);



const filterText = useLocalStorage("milongaTrackSelectorFilterText", "");
const selectedMediaSource = useLocalStorage("milongaTrackSelectorMediaSource", "All");

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


// Реакция на выбор источника
watch(selectedMediaSource, async (newSourceId) => {
  isLoading.value = true;
  try {
    await amethyst.loadMilongaCandidateTracks(newSourceId);
  } finally {
    isLoading.value = false;
  }
}, { immediate: false });

// Фильтрация треков по поиску
const filteredTracks = computed(() => {
  if (!filterText.value) return amethyst.state.milongaCandidateTracks;
  
  const searchTerm = filterText.value.toLowerCase();
  return amethyst.state.milongaCandidateTracks.filter(track => 
    track.getTitle()?.toLowerCase().includes(searchTerm) ||
    track.getArtistsFormatted()?.toLowerCase().includes(searchTerm) ||
    track.getAlbum()?.toLowerCase().includes(searchTerm) ||
    track.getFilename()?.toLowerCase().includes(searchTerm)
  );
});

// Get some random tracks for the Milonga plan
const milongaPlanTracks = computed(() => {
  // Get up to 12 random tracks for the Milonga plan (3 groups of 4)
  const shuffled = [...amethyst.state.milongaCandidateTracks].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 23);
});

onMounted(async () => {
  isLoading.value = true;
  await amethyst.loadMilongaCandidateTracks(selectedMediaSource.value);
  isLoading.value = false;
});

</script>

<template>
  <div class="w-full py-2 pl-4 pr-2 text-text-title ">
    <route-header :title="$t('route.milonga')" />
          <!-- Индикатор загрузки рядом с селектором -->
          <div v-if="isLoading" class="absolute right-0 top-0 mr-2 mt-2">
        <icon icon="svg-spinners:180-ring" class="w-5 h-5 text-primary" />
      </div>
    <div class="flex gap-2 mt-1 mr-2">
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

    <div class="flex flex-col overflow-y-auto gap-2 h-full pb-56">
      <milonga-plan
        :title="$t('milonga.plan.title')"
        :subtitle="$t('milonga.plan.description')"
        :tracks="milongaPlanTracks"
      />

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
        :external-columns="milongaColumns"
        :on-column-update="handleMilongaColumnUpdate"
      />
    </div>

  </div>
</template>
