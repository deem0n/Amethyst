<script setup lang="ts">
import { amethyst } from "@/amethyst.js";
import SettingsSetting from "@/components/settings/SettingsSetting.vue";
import ToggleSwitch from "@/components/v2/ToggleSwitch.vue";

const { behavior } = amethyst.state.settings;
</script>

<template>
  <settings-setting
    icon="mdi:dance-ballroom"
    :description="$t('settings.milonga.description')"
    :title="$t('settings.milonga.title')"
  >
    <toggle-switch
      v-model="behavior.milonga"
    />
  </settings-setting>
</template>
