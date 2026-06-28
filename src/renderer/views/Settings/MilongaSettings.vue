<script setup lang="ts">
import { amethyst } from "@/amethyst.js";
import SettingsSetting from "@/components/settings/SettingsSetting.vue";
import SliderInput from "@/components/v2/SliderInput.vue";
import ToggleSwitch from "@/components/v2/ToggleSwitch.vue";

const { behavior, milonga } = amethyst.state.settings;
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
  <settings-setting
    icon="ic:twotone-timer"
    :description="$t('settings.milonga.default_cortina_duration.description')"
    :title="$t('settings.milonga.default_cortina_duration.title')"
  >
    <slider-input
      v-model="milonga.defaultCortinaDurationSeconds"
      :min="5"
      :max="120"
      :step="5"
      suffix="s"
    />
  </settings-setting>
  <settings-setting
    icon="ic:twotone-gradient"
    :description="$t('settings.milonga.default_cortina_fade_in.description')"
    :title="$t('settings.milonga.default_cortina_fade_in.title')"
  >
    <slider-input
      v-model="milonga.defaultCortinaFadeInSeconds"
      :min="0"
      :max="10"
      :step="0.5"
      suffix="s"
    />
  </settings-setting>
  <settings-setting
    icon="ic:twotone-gradient"
    :description="$t('settings.milonga.default_cortina_fade_out.description')"
    :title="$t('settings.milonga.default_cortina_fade_out.title')"
  >
    <slider-input
      v-model="milonga.defaultCortinaFadeOutSeconds"
      :min="0"
      :max="10"
      :step="0.5"
      suffix="s"
    />
  </settings-setting>
</template>
