<script lang="ts" setup>
import { Icon } from "@iconify/vue";

import BaseKeyboardButton from "../input/BaseKeyboardButton.vue";
defineProps<{
  title: string;
  icon?: string;
  red?: boolean;
  shortcuts?: string[];
}>();
</script>

<template>
  <button
    :class="[
      title.includes('...') && 'cursor-pointer',
      red ? 'hover:bg-rose-600 hover:font-bold' : 'hover:bg-surface-600 hover:text-accent'
    ]"
    class="text-left min-h-32px text-11px py-2 px-3 w-full flex justify-between items-center gap-4"
  >
    <div class="flex gap-3 items-center min-w-0">
      <icon
        v-if="icon"
        :icon="icon"
        class="h-4 w-4 min-h-4 min-w-4 text-current"
      />
      <div
        v-else
        class="h-4 w-4 min-h-4 min-w-4"
      />
      <span class="truncate text-13px font-weight-user-defined">
        {{ title }}
      </span>
    </div>
    <div class="flex gap-1 flex-none">
      <base-keyboard-button
        v-for="(shortcut) of shortcuts"
        :key="shortcut"
        :button="shortcut"
      >
        {{ shortcut }}
      </base-keyboard-button>
    </div>
  </button>
</template>
