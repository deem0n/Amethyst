<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { useLocalStorage } from "@vueuse/core";
import { computed, ref, watchEffect} from "vue";

import { amethyst } from "@/amethyst.js";
import { useContextMenu } from "@/components/ContextMenu";
import type { PossibleSortingMethods } from "@/logic/queue";
import {COMPARATORS_BY_METHOD} from "@/logic/queue";

import { type Track, trackContextMenuOptions } from "@/logic/track";
import type { IContextMenuOption } from "@/state";

import CoverArt from "./CoverArt.vue";
import { useInspector } from "./Inspector";
import NotApplicableText from "./NotApplicableText.vue";
import LoadingIcon from "./v2/LoadingIcon.vue";


// Добавляем отдельные переменные для сортировки TrackSelector
const trackSelectorSortMethod = useLocalStorage<PossibleSortingMethods>("trackSelectorSortMethod", "default");
const trackSelectorSortDirection = useLocalStorage<"ascending" | "descending">("trackSelectorSortDirection", "ascending");
const trackSelectorFilterText = useLocalStorage("trackSelectorFilterText", "");
const isLoading = ref(false); // Добавлен индикатор загрузки

// Определяем тип для ключей колонок
export type ColumnKey = keyof typeof amethyst.state.settings.trackSelector.columns;

// Добавляем props для внешних колонок
const props = defineProps<{
  externalColumns?: Record<ColumnKey, boolean>;
  onColumnUpdate?: (key: ColumnKey, value: boolean) => void;
}>();

// Используем внешние колонки если переданы, иначе стандартные
const columns = computed(() => {
  return props.externalColumns ?? amethyst.state.settings.trackSelector.columns;
});

// Используем watchEffect для реактивного обновления
const tracks = ref<Track[]>([]);
watchEffect(async () => {
  isLoading.value = true;
  try {
    tracks.value = getListSorted(
      trackSelectorSortMethod.value,
      trackSelectorFilterText.value
    );
  } finally {
    isLoading.value = false;
  }
});


// FIXME: Got it from logic/queue.ts but we have no similar file for track selector
function getListSorted(sortBy: PossibleSortingMethods, search?: string) {
    //const sorted = [...(search ? this.search(search) : amethyst.state.milongaCandidateTracks)];
    const sorted = [...(search ? amethyst.state.milongaCandidateTracks : amethyst.state.milongaCandidateTracks)];
    sorted.sort(COMPARATORS_BY_METHOD[sortBy]);
    if (trackSelectorSortDirection.value === "descending") {
      sorted.reverse();
    }
    sorted.map(e => console.log(e.getTitle()))
    return sorted;
}

const setCurrentSortedMethod = (sortBy: PossibleSortingMethods) => {
  if (trackSelectorSortMethod.value === sortBy) {
    // Переключение направления при повторном клике
    trackSelectorSortDirection.value = 
      trackSelectorSortDirection.value === "ascending" 
        ? "descending" 
        : "ascending";
  } else {
    // Новое поле сортировки - сбрасываем направление
    trackSelectorSortMethod.value = sortBy;
    trackSelectorSortDirection.value = "ascending";
  }
};


const isHoldingControl = amethyst.shortcuts.isControlPressed;

const ITEM_HEIGHT = amethyst.state.settings.appearance.compactList ? 32 : 40;

// Context Menu options for this component
const handleTrackContextMenu = ({ x, y }: MouseEvent, track: Track) => {
  useContextMenu().open({ x, y }, trackContextMenuOptions(track));
};


const handleColumnContextMenu = ({ x, y }: MouseEvent) => {
  const contextMenu = useContextMenu();

  const columnOptions: { key: keyof typeof amethyst.state.settings.trackSelector.columns; title: string }[] = [
    { key: "cover", title: "queue.column.cover" },
    { key: "diskNumber", title: "track.metadata.disk_number" },
    { key: "trackNumber", title: "track.metadata.track_number" },
    { key: "filename", title: "track.file.name" },
    { key: "title", title: "track.metadata.title" },
    { key: "artist", title: "track.metadata.artist" },
    { key: "location", title: "queue.column.location" },
    { key: "album", title: "track.metadata.album" },
    { key: "genre", title: "track.metadata.genre" },
    { key: "barcode", title: "track.metadata.barcode" },
    { key: "year", title: "track.metadata.year" },
    { key: "label", title: "track.metadata.label" },
    { key: "isrc", title: "track.metadata.isrc" },
    { key: "copyright", title: "track.metadata.copyright" },
    { key: "bpm", title: "track.metadata.bpm" },
    { key: "duration", title: "track.metadata.duration" },
    { key: "container", title: "track.audio_properties.container" },
    { key: "favorite", title: "queue.column.favorite" },
    { key: "sampleRate", title: "track.audio_properties.sample_rate" },
    { key: "bitsPerSample", title: "track.audio_properties.bits_per_sample" },
    { key: "bitrate", title: "track.audio_properties.bitrate" },
    { key: "size", title: "track.file.size" },
  ];

  const menuItems: IContextMenuOption[] = columnOptions.map(({ key, title }) => ({
    title,
    icon: columns.value[key] ? "ic:twotone-radio-button-checked" : "ic:twotone-radio-button-unchecked",
    action: () => {
      const newValue = !columns.value[key];
      if (props.onColumnUpdate) {
        props.onColumnUpdate(key, newValue);
      } else {
        amethyst.state.settings.trackSelector.columns[key] = newValue;
      }
    },
  }));

  contextMenu.open({ x, y }, menuItems);
};

</script>

<template>
  <div
    class="text-13px text-text-title min-h-0 flex flex-col text-left relative select-none "
  >
      <!-- Индикатор загрузки -->
      <div v-if="isLoading" class="absolute inset-0 bg-surface-900 bg-opacity-75 z-50 flex items-center justify-center">
      <div class="animate-spin">
        <icon icon="svg-spinners:180-ring" class="w-8 h-8 text-primary" />
      </div>
    </div>
    <div
      class="flex text-left font-weight-user-defined sticky top-0 bg-surface-900 py-2 px-2 columnHeader min-h-36px"
      :class="[trackSelectorSortDirection]" 
      @contextmenu="handleColumnContextMenu($event)"
    >
      <div class="flex-none w-8" />
      <div
        v-if="columns.cover"
        class="flex-none w-[32px] "
      />
      <div
        v-if="columns.trackNumber"
        class="flex-none w-32px transform-gpu -translate-x-1.75"
        :class="[trackSelectorSortMethod == 'trackNumber' && 'activeSort']"
        @click="setCurrentSortedMethod('trackNumber')"
      >
        <icon
          icon="material-symbols:tag-rounded"
        />
        <icon
          v-if="trackSelectorSortMethod == 'trackNumber'"
          icon="ic:round-chevron-left"
          class="chevron"
        />
      </div>
      <div
        v-if="columns.diskNumber"
        class="flex-none w-32px transform-gpu -translate-x-1.75"
        :class="[trackSelectorSortMethod == 'diskNumber' && 'activeSort']"
        @click="setCurrentSortedMethod('diskNumber')"
      >
        <icon
          icon="mdi:disc"
        />
        <icon
          v-if="trackSelectorSortMethod == 'diskNumber'"
          icon="ic:round-chevron-left"
          class="chevron"
        />
      </div>
      <div
        v-if="columns.filename"
        class="flex-grow w-[200px] min-w-30px"
        :class="[trackSelectorSortMethod == 'filename' && 'activeSort']"
        @click="setCurrentSortedMethod('filename')"
      >
        {{ $t('track.file.name') }}
        <icon
          v-if="trackSelectorSortMethod == 'filename'"
          icon="ic:round-chevron-left"
          class="chevron"
        />
      </div>
      <div
        v-if="columns.title"
        class="flex-grow w-[200px] min-w-30px"
        :class="[trackSelectorSortMethod == 'title' && 'activeSort']"
        @click="setCurrentSortedMethod('title')"
      >
        {{ $t('track.metadata.title') }}
        <icon
          v-if="trackSelectorSortMethod == 'title'"
          icon="ic:round-chevron-left"
          class="chevron"
        />
      </div>
      <div
        v-if="columns.artist"
        class="flex-grow w-[200px] min-w-30px"
        :class="[trackSelectorSortMethod == 'artist' && 'activeSort']"
        @click="setCurrentSortedMethod('artist')"
      >
        {{ $t('track.metadata.artist') }}
        <icon
          v-if="trackSelectorSortMethod == 'artist'"
          icon="ic:round-chevron-left"
          class="chevron"
        />
      </div>
      <div
        v-if="columns.location"
        class="flex-none w-[70px] min-w-30px "
      >
        {{ $t('queue.column.location') }}
      </div>
      <div
        v-if="columns.album"
        class="flex-grow w-[200px] min-w-30px"
        :class="[trackSelectorSortMethod == 'album' && 'activeSort']"
        @click="setCurrentSortedMethod('album')"
      >
        {{ $t('track.metadata.album') }}
        <icon
          v-if="trackSelectorSortMethod == 'album'"
          icon="ic:round-chevron-left"
          class="chevron"
        />
      </div>
      <div
        v-if="columns.year"
        class="flex-none w-[50px]"
        :class="[trackSelectorSortMethod == 'year' && 'activeSort']"
        @click="setCurrentSortedMethod('year')"
      >
        {{ $t('track.metadata.year') }}
        <icon
          v-if="trackSelectorSortMethod == 'year'"
          icon="ic:round-chevron-left"
          class="chevron"
        />
      </div>

      <div
        v-if="columns.genre"
        class="flex-grow w-[120px]"
        :class="[trackSelectorSortMethod == 'genre' && 'activeSort']"
        @click="setCurrentSortedMethod('genre')"
      >
        {{ $t('track.metadata.genre') }}
        <icon
          v-if="trackSelectorSortMethod == 'genre'"
          icon="ic:round-chevron-left"
          class="chevron"
        />
      </div>

      <div
        v-if="columns.barcode"
        class="flex-grow w-[120px]"
        :class="[trackSelectorSortMethod == 'barcode' && 'activeSort']"
        @click="setCurrentSortedMethod('barcode')"
      >
        {{ $t('track.metadata.barcode') }}
        <icon
          v-if="trackSelectorSortMethod == 'barcode'"
          icon="ic:round-chevron-left"
          class="chevron"
        />
      </div>

      <div
        v-if="columns.label"
        class="flex-grow w-[100px]"
        :class="[trackSelectorSortMethod == 'label' && 'activeSort']"
        @click="setCurrentSortedMethod('label')"
      >
        {{ $t('track.metadata.label') }}
        <icon
          v-if="trackSelectorSortMethod == 'label'"
          icon="ic:round-chevron-left"
          class="chevron"
        />
      </div>

      <div
        v-if="columns.isrc"
        class="flex-grow w-[110px]"
        :class="[trackSelectorSortMethod == 'isrc' && 'activeSort']"
        @click="setCurrentSortedMethod('isrc')"
      >
        {{ $t('track.metadata.isrc') }}
        <icon
          v-if="trackSelectorSortMethod == 'isrc'"
          icon="ic:round-chevron-left"
          class="chevron"
        />
      </div>

      <div
        v-if="columns.copyright"
        class="flex-grow w-[100px]"
        :class="[trackSelectorSortMethod == 'copyright' && 'activeSort']"
        @click="setCurrentSortedMethod('copyright')"
      >
        {{ $t('track.metadata.copyright') }}
        <icon
          v-if="trackSelectorSortMethod == 'copyright'"
          icon="ic:round-chevron-left"
          class="chevron"
        />
      </div>

      <div
        v-if="columns.bpm"
        class="flex-none w-[60px]"
        :class="[trackSelectorSortMethod == 'bpm' && 'activeSort']"
        @click="setCurrentSortedMethod('bpm')"
      >
        {{ $t('track.metadata.bpm') }}
        <icon
          v-if="trackSelectorSortMethod == 'bpm'"
          icon="ic:round-chevron-left"
          class="chevron"
        />
      </div>

      <div
        v-if="columns.duration"
        class="flex-none w-[80px]"
        :class="[trackSelectorSortMethod == 'duration' && 'activeSort']"
        @click="setCurrentSortedMethod('duration')"
      >
        {{ $t('track.metadata.duration') }}
        <icon
          v-if="trackSelectorSortMethod == 'duration'"
          icon="ic:round-chevron-left"
          class="chevron"
        />
      </div>
      <div
        v-if="columns.container"
        class="flex-none w-[80px]"
        :class="[trackSelectorSortMethod == 'container' && 'activeSort']"
        @click="setCurrentSortedMethod('container')"
      >
        {{ $t('track.audio_properties.container') }}
        <icon
          v-if="trackSelectorSortMethod == 'container'"
          icon="ic:round-chevron-left"
          class="chevron"
        />
      </div>
      <div
        v-if="columns.favorite"
        class="flex-none w-[70px]"
        :class="[trackSelectorSortMethod == 'favorite' && 'activeSort']"
        @click="setCurrentSortedMethod('favorite')"
      >
        {{ $t('queue.column.favorite') }}
        <icon
          v-if="trackSelectorSortMethod == 'favorite'"
          icon="ic:round-chevron-left"
          class="chevron"
        />
      </div>
      <div
        v-if="columns.sampleRate"
        class="flex-none w-[100px]"
        :class="[trackSelectorSortMethod == 'sampleRate' && 'activeSort']"
        @click="setCurrentSortedMethod('sampleRate')"
      >
        {{ $t('track.audio_properties.sample_rate') }}
        <icon
          v-if="trackSelectorSortMethod == 'sampleRate'"
          icon="ic:round-chevron-left"
          class="chevron"
        />
      </div>
      <div
        v-if="columns.bitsPerSample"
        class="flex-none w-[70px]"
        :class="[trackSelectorSortMethod == 'bitsPerSample' && 'activeSort']"
        @click="setCurrentSortedMethod('bitsPerSample')"
      >
        {{ $t('track.audio_properties.bits_per_sample') }}
        <icon
          v-if="trackSelectorSortMethod == 'bitsPerSample'"
          icon="ic:round-chevron-left"
          class="chevron"
        />
      </div>
      <div
        v-if="columns.bitrate"
        class="flex-none w-[70px]"
        :class="[trackSelectorSortMethod == 'bitrate' && 'activeSort']"
        @click="setCurrentSortedMethod('bitrate')"
      >
        {{ $t('track.audio_properties.bitrate') }}
        <icon
          v-if="trackSelectorSortMethod == 'bitrate'"
          icon="ic:round-chevron-left"
          class="chevron"
        />
      </div>
      <div
        v-if="columns.size"
        class="flex-none w-[70px]"
        :class="[trackSelectorSortMethod == 'size' && 'activeSort']"
        @click="setCurrentSortedMethod('size')"
      >
        {{ $t('track.file.size') }}
        <icon
          v-if="trackSelectorSortMethod == 'size'"
          icon="ic:round-chevron-left"
          class="chevron"
        />
      </div>
    </div>

    <RecycleScroller
      class="h-full w-full pb-16 pr-1.5 leading-tight"
      :items="tracks"
      :item-size="ITEM_HEIGHT"
      key-field="path"
      :buffer="24"
      :class="[amethyst.getCurrentPlatform() !== 'mobile' && 'pb-32']"
    >
      <template #default="{ item } : { item: Track}">
        <div
          class="row flex items-center px-2 rounded-4px font-weight-user-defined"
          :class="[
            `max-h-[${ITEM_HEIGHT}px] h-[${ITEM_HEIGHT}px]`,
            isHoldingControl && 'control cursor-external-pointer',
            item.hasErrored && 'opacity-50 not-allowed',
            item.deleted && 'opacity-50 !text-rose-400 not-allowed',
            amethyst.player.getCurrentTrack()?.path == item.path && 'currentlyPlaying',
            amethyst.state.settings.appearance.compactList ? 'py-1' : 'py-2',
            useInspector().state.isVisible && (useInspector().state.currentItem == item as any) && 'currentlyInspecting',
          ]"
          draggable="true"
          @contextmenu="handleTrackContextMenu($event, item)"
          @dragstart.prevent="amethyst.handleTrackDragStart($event, item)"
          @keypress.prevent
          @click="isHoldingControl ? amethyst.showItem(item.path) : amethyst.player.play(item)"
        >
          <div
            class="flex-none w-8"
          >
            <icon
              v-if="amethyst.player.getCurrentTrack()?.path == item.path && amethyst.player.isPlaying.value"
              icon="line-md:play-filled"
              class="w-5 h-5 min-w-5 min-h-5"
            />
            <icon
              v-else-if="amethyst.player.getCurrentTrack()?.path == item.path && !amethyst.player.isPlaying.value"
              icon="line-md:pause"
              class="w-5 h-5 min-w-5 min-h-5"
            />
            <icon
              v-else-if="useInspector().state.currentItem?.path == item.path"
              icon="mdi:flask"
              class="w-5 h-5 min-w-5 min-h-5"
            />
            <icon
              v-else
              icon="ic:baseline-drag-handle"
              class="w-5 h-5 min-w-5 min-h-5"
            />
          </div>

          <div
            v-if="columns.cover"
            class="flex-none w-[32px] h-[24px]"
          >
            <loading-icon
              v-if="item.isLoading"
            />
            <icon
              v-else-if="item.hasErrored"
              icon="ic:twotone-error"
              class="cover"
            />
            <icon
              v-else-if="item.deleted"
              icon="ic:twotone-link-off"
              class="cover"
            />
            <cover-art
              v-else
              class="cover rounded-2px"
              :url="item.isLoaded && item.getCover() ? item.getCover() : ''"
            />
          </div>

          <div
            v-if="columns.trackNumber"
            class="flex-none w-32px"
          >
            <span v-if="item.getTrackNumber()">{{ item.getTrackNumber() }}</span>
            <not-applicable-text v-else />
          </div>

          <div
            v-if="columns.diskNumber"
            class="flex-none w-32px"
          >
            <span v-if="item.getDiskNumber()">{{ item.getDiskNumber() }}</span>
            <not-applicable-text v-else />
          </div>

          <div
            v-if="columns.filename"
            class="flex-grow w-[200px] min-w-30px"
          >
            <span>{{ item.getFilename() }}</span>
          </div>

          <div
            v-if="columns.title"
            class="flex-grow w-[200px] min-w-30px"
          >
            <span v-if="item.getTitle()">{{ item.getTitle() }}</span>
            <not-applicable-text v-else />
          </div>

          <div
            v-if="columns.artist"
            class="flex-grow w-[200px] min-w-30px"
          >
            <span v-if="item.getArtistsFormatted()">{{ item.getArtistsFormatted() }}</span>
            <not-applicable-text v-else />
          </div>

          <div
            v-if="columns.location"
            class="flex-none w-[70px] pl-4"
          >
            <icon
              icon="ic:baseline-folder-open"
              class="h-4 w-4 cursor-pointer hover:text-text-title"
              @click.stop.prevent="amethyst.showItem(item.path)"
            />
          </div>

          <div
            v-if="columns.album"
            class="flex-grow w-[200px] min-w-30px "
          >
            <span v-if="item.getAlbum()">{{ item.getAlbum() }}</span>
            <not-applicable-text v-else />
          </div>

          <div
            v-if="columns.year"
            class="flex-none w-[50px]"
          >
            <span v-if="item.getYear()">{{ item.getYear() }}</span>
            <not-applicable-text v-else />
          </div>

          <div
            v-if="columns.genre"
            class="flex-grow w-[120px]"
          >
            <span v-if="item.getGenre()">{{ item.getGenreFormatted() }}</span>
            <not-applicable-text v-else />
          </div>

          <div
            v-if="columns.barcode"
            class="flex-grow w-[120px]"
          >
            <span v-if="item.getBarcode()">{{ item.getBarcode() }}</span>
            <not-applicable-text v-else />
          </div>

          <div
            v-if="columns.label"
            class="flex-grow w-[100px]"
          >
            <span v-if="item.getLabel()?.[0]">{{ item.getLabel()![0] }}</span>
            <not-applicable-text v-else />
          </div>

          <div
            v-if="columns.isrc"
            class="flex-grow w-[110px]"
          >
            <span v-if="item.getISRC()?.[0]">{{ item.getISRC()![0] }}</span>
            <not-applicable-text v-else />
          </div>

          <div
            v-if="columns.copyright"
            class="flex-grow w-[100px]"
          >
            <span v-if="item.getCopyright()">{{ item.getCopyright() }}</span>
            <not-applicable-text v-else />
          </div>

          <div
            v-if="columns.bpm"
            class="flex-none w-[60px]"
          >
            <span v-if="item.getBPM()">{{ item.getBPM() }}</span>
            <not-applicable-text v-else />
          </div>

          <div
            v-if="columns.duration"
            class="flex-none w-[80px]"
          >
            <span v-if="item.getDurationFormatted(true)">{{ item.getDurationFormatted(true) }}</span>
            <not-applicable-text v-else />
          </div>

          <div
            v-if="columns.container"
            class="flex-none w-[80px]"
          >
            <span v-if="item.getContainer()">{{ item.getContainer() }}</span>
            <not-applicable-text v-else />
          </div>

          <div
            v-if="columns.favorite"
            class="flex-none w-[70px] pl-4"
          >
            <icon
              icon="ic:baseline-favorite-border"
              class="h-4 w-4 cursor-pointer "
              :class="[item.isFavorited ? 'text-alert-color' :'hover:text-text-title']"
              @click.stop.prevent="item.toggleFavorite()"
            />
          </div>
          <div
            v-if="columns.sampleRate"
            class="flex-none w-[100px]"
          >
            <span v-if="item.getSampleRateFormatted()">{{ item.getSampleRateFormatted() }}</span>
            <not-applicable-text v-else />
          </div>

          <div
            v-if="columns.bitsPerSample"
            class="flex-none w-[70px]"
          >
            <span v-if="item.getBitsPerSampleFormatted()">{{ item.getBitsPerSampleFormatted() }}</span>
            <not-applicable-text v-else />
          </div>

          <div
            v-if="columns.bitrate"
            class="flex-none w-[70px]"
          >
            <span v-if="item.getBitrateFormatted()">{{ item.getBitrateFormatted() }}</span>
            <not-applicable-text v-else />
          </div>

          <div
            v-if="columns.size"
            class="flex-none w-[70px]"
          >
            <span v-if="item.getFilesizeFormatted()">{{ item.getFilesizeFormatted() }}</span>
            <not-applicable-text v-else />
          </div>
        </div>
      </template>
    </RecycleScroller>
  </div>
</template>

<style lang="postcss">

th {
  @apply sticky top-0 z-10 bg-surface-900 py-4;
}

td {
  @apply py-2;
}

tr {
  @apply truncate;
}

.cover {
  @apply w-6 h-6 min-w-6 min-h-6;
}

.columnHeader > div {
  @apply flex items-center relative min-w-0;

  &:hover:not(.activeSort) {@apply  hover:text-accent; }
}

.columnHeader svg {
  @apply min-h-5 min-w-5;
}

.columnHeader.ascending svg.chevron {
  @apply transform-gpu rotate-90;
}

.columnHeader.descending svg.chevron {
  @apply transform-gpu -rotate-90;
}

.activeSort {
  @apply text-primary;
}

.row {
  @apply truncate text-text-subtitle ;

  & > div {
    @apply truncate text-ellipsis;
  }

  &:hover {
    @apply text-accent bg-surface-400/20;
  }

  &.control:hover {
    @apply underline;
  }

  &.currentlyPlaying {
    @apply text-primary bg-primary/10;
    &:hover {
      @apply bg-primary/15;
    }
  }

  &.currentlyInspecting {
    @apply text-inspector-color bg-inspector-color/10;
    &:hover {
      @apply bg-inspector-color/15;
    }
  }
}

</style>
