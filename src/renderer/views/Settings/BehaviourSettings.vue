<script setup lang="ts">
import { amethyst } from "@/amethyst.js";
import SettingsSetting from "@/components/settings/SettingsSetting.vue";
import ToggleSwitch from "@/components/v2/ToggleSwitch.vue";
const { behavior } = amethyst.state.settings;

</script>

<template>
  <settings-setting
    icon="mdi:flask"
    :description="$t('settings.fetch_metadata_on_startup.description')"
    :title="$t('settings.fetch_metadata_on_startup.title')"
  >
    <toggle-switch
      v-model="behavior.fetchMetadataOnStartup"
    />
  </settings-setting>
  <settings-setting
    icon="mdi:play"
    :description="$t('settings.autoplay_on_startup.description')"
    :title="$t('settings.autoplay_on_startup.title')"
  >
    <toggle-switch
      v-model="behavior.autoPlayOnStartup"
    />
  </settings-setting>

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

<style scoped lang="postcss">

</style>
