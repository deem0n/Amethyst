<script setup lang="ts">
import { useLocalStorage } from "@vueuse/core";
import { onMounted } from "vue";

import { amethyst } from "@/amethyst.js";
import BigButton from "@/components/BigButton.vue";
import DiscoveryFeed from "@/components/DiscoveryFeed.vue";
import RouteHeader from "@/components/v2/RouteHeader.vue";


// By Dima
import TrackSelector from "@/components/TrackSelector.vue";
import SearchInput from "@/components/v2/SearchInput.vue";
//import type { Track } from "@/logic/track";
const filterText = useLocalStorage("trackSelectorFilterText", "");


onMounted(() => {
  amethyst.analytics.getDiscoveryTracks();
});

</script>

<template>
  <div class="w-full py-2 pl-4 pr-2 text-text-title ">
    <route-header :title="$t('route.milonga')" />
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
        <search-input v-model="filterText" />
      </route-header>
      <track-selector />
    </div>

    <div
      class="py-2 pl-4 pr-2 flex flex-col overflow-y-auto gap-2 h-full pb-56"
      :class="[amethyst.getCurrentPlatform() == 'mobile' ? 'px-2' : 'px-4']"
    >
      <route-header :title="$t('route.milonga')">
        <search-input v-model="filterText" />
      </route-header>
      <track-selector />
    </div>
  </div>
</template>
