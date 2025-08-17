<script setup lang="ts">
import { useLocalStorage } from "@vueuse/core";
import { onMounted, computed, ref, watch  } from "vue";

import { amethyst } from "@/amethyst.js";
import BigButton from "@/components/BigButton.vue";
import DiscoveryFeed from "@/components/DiscoveryFeed.vue";
import RouteHeader from "@/components/v2/RouteHeader.vue";


// By Dima
import TrackSelector from "@/components/TrackSelector.vue";
import SearchInput from "@/components/v2/SearchInput.vue";
import type { Track } from "@/logic/track";
const filterText = useLocalStorage("trackSelectorFilterText", "");

const selectedMediaSource = ref<string>("All");
const isLoading = ref(false); // Добавлен индикатор загрузки
const mediaSources = computed(() => [
  { id: "All", name: "All Sources" },
  ...amethyst.mediaSourceManager.mediaSources.value.map(source => ({
    id: source.uuid,
    name: source.name
  }))
]);

// Реакция на выбор источника
watch(selectedMediaSource, async (newSourceId) => {
  isLoading.value = true;
  try {
    await amethyst.loadMilongaCandidateTracks(newSourceId);
  } finally {
    isLoading.value = false;
  }
}, { immediate: true });

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

onMounted(() => {
  amethyst.analytics.getDiscoveryTracks();
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
      <discovery-feed
        :title="$t('discovery.random.title')"
        :subtitle="$t('discovery.random.description')"
        :tracks="amethyst.analytics.tracksBasedOnRandom.value"
      />

      <route-header :title="$t('route.milonga')">

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
      <track-selector />
    </div>

  </div>
</template>
