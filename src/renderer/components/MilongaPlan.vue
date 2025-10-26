<script setup lang="ts">
import { computed, ref } from "vue";
import type { Track } from "@/logic/track";
import { amethyst } from "@/amethyst.js";
import TitleSubtitle from "./v2/TitleSubtitle.vue";
import CoverArt from "./CoverArt.vue";
import NotApplicableText from "./NotApplicableText.vue";
import { Icon } from "@iconify/vue"; // Добавляем импорт Icon

const props = defineProps<{ 
  title: string; 
  subtitle: string; 
  tracks: Track[];
}>();

const emit = defineEmits(['tracksUpdated']);

// Группируем треки в блоки по 4 (танды)
const tandas = computed(() => {
  const groups = [];
  for (let i = 0; i < props.tracks.length; i += 4) {
    groups.push(props.tracks.slice(i, i + 4));
  }
  return groups;
});

// Состояние для отслеживания активной зоны перетаскивания
const activeDropZone = ref<{tandaIndex: number, position: number} | null>(null);

// Обработчики событий перетаскивания
const handleDragOver = (event: DragEvent, tandaIndex: number, position: number) => {
  event.preventDefault();
  event.stopPropagation();
  
  if (event.dataTransfer) {
    // Проверяем, есть ли подходящие данные для перетаскивания
    const hasTrackData = event.dataTransfer.types.includes('application/json') || 
                         event.dataTransfer.types.includes('text/plain');
    
    if (hasTrackData) {
      event.dataTransfer.dropEffect = 'move';
      activeDropZone.value = { tandaIndex, position };
    } else {
      event.dataTransfer.dropEffect = 'none';
    }
  }
};

const handleDragLeave = (event: DragEvent) => {
  event.preventDefault();
  // Проверяем, действительно ли мы вышли из элемента, а не просто перешли на дочерний
  const relatedTarget = event.relatedTarget as Node;
  const currentTarget = event.currentTarget as HTMLElement;
  
  if (!currentTarget.contains(relatedTarget)) {
    activeDropZone.value = null;
  }
};

const handleDrop = async (event: DragEvent, tandaIndex: number, position: number) => {
  event.preventDefault();
  event.stopPropagation();
  
  console.log('Drop event data types:', event.dataTransfer?.types); // Для отладки
  
  let track: Track | null = null;
  
  try {
    // В первую очередь пробуем получить кастомные JSON данные
    const jsonData = event.dataTransfer?.getData('application/json');
    if (jsonData) {
      try {
        const trackData = JSON.parse(jsonData);
        if (trackData.type === 'amethyst/track') {
          console.log('Found track data in JSON:', trackData); // Для отладки
          
          // Ищем трек по абсолютному пути в candidate tracks
          track = amethyst.state.milongaCandidateTracks.find(t => 
            t.absolutePath === trackData.absolutePath || 
            t.path === trackData.path
          );
        }
      } catch (error) {
        console.error('Error parsing JSON data:', error);
      }
    }

    // Если не нашли через JSON, пробуем через text/plain (абсолютный путь)
    if (!track) {
      const pathData = event.dataTransfer?.getData('text/plain');
      if (pathData) {
        console.log('Found path data in text:', pathData); // Для отладки
        
        track = amethyst.state.milongaCandidateTracks.find(t => 
          t.absolutePath === pathData || 
          t.path === pathData
        );
      }
    }
    
    // Для отладки: выводим информацию о доступных треках
    if (!track) {
      console.log('Available candidate tracks:', amethyst.state.milongaCandidateTracks.map(t => ({
        absolutePath: t.absolutePath,
        path: t.path,
        title: t.getTitle()
      })));
    }
    if (track) {
      console.log('Successfully found track:', track.getTitle()); // Для отладки
      
      // Создаем новый массив треков
      const newTracks = [...props.tracks];
      const flatIndex = tandaIndex * 4 + position;
      
      // Заменяем или добавляем трек
      if (flatIndex < newTracks.length) {
        newTracks[flatIndex] = track;
      } else {
        // Добавляем null для заполнения пробелов если нужно
        while (newTracks.length < flatIndex) {
          newTracks.push(null as any);
        }
        newTracks.push(track);
      }
      
      // Фильтруем null'ы и отправляем обновленный список
      const filteredTracks = newTracks.filter(t => t !== null) as Track[];
      emit('tracksUpdated', filteredTracks);
    } else {
      console.warn('Track not found in candidate tracks');
    }
  } catch (error) {
    console.error('Error handling drop:', error);
  } finally {
    activeDropZone.value = null;
  }
};

// Функция для перетаскивания существующих треков внутри MilongaPlan
const handleDragStart = (event: DragEvent, track: Track) => {
  if (!event.dataTransfer) return;
  
  // Устанавливаем кастомные данные
  const trackData = {
    type: 'amethyst/track',
    absolutePath: track.absolutePath,
    path: track.path,
    filename: track.getFilename(),
    title: track.getTitle(),
    artist: track.getArtistsFormatted()
  };
  
  event.dataTransfer.setData('application/json', JSON.stringify(trackData));
  event.dataTransfer.setData('text/plain', track.absolutePath);
  event.dataTransfer.effectAllowed = 'move';
};

// Функция для добавления новой танды
const addNewTanda = () => {
  // Добавляем 4 пустых слота для новой танды
  const newTracks = [...props.tracks, null, null, null, null].filter(t => t !== null);
  emit('tracksUpdated', newTracks);
};
</script>

<template>
  <div class="flex gap-2 flex-col pr-2">
    <title-subtitle
      :title="title"
      :subtitle="subtitle"
    />
    <section class="flex gap-4 overflow-x-auto p-2">
      <div
        v-for="(tanda, tandaIndex) of tandas"
        :key="tandaIndex"
        class="tanda-block w-64 min-w-64 bg-surface-800 rounded-lg p-3 flex flex-col gap-2"
      >
        <div class="text-text-title text-sm font-semibold mb-1">
          Tanda {{ tandaIndex + 1 }}
        </div>
        
        <!-- Слоты для 4 позиций в тандe -->
        <div
          v-for="position in 4"
          :key="position"
          class="tanda-slot relative min-h-14"
          @dragover="handleDragOver($event, tandaIndex, position - 1)"
          @dragleave="handleDragLeave"
          @drop="handleDrop($event, tandaIndex, position - 1)"
          :class="{
            'bg-surface-700/50': activeDropZone?.tandaIndex === tandaIndex && activeDropZone?.position === position - 1,
            'border-2 border-dashed border-primary': activeDropZone?.tandaIndex === tandaIndex && activeDropZone?.position === position - 1
          }"
        >
          <!-- Существующий трек -->
          <div
            v-if="tanda[position - 1]"
            class="tanda-track flex items-start gap-2 p-0 rounded hover:bg-surface-700 transition-colors cursor-pointer"
            @click="amethyst.player.play(tanda[position - 1])"
            draggable="true"
            @dragstart="handleDragStart($event, tanda[position - 1])"
          >
            <div class="flex-none w-12 h-12">
              <cover-art
                v-if="tanda[position - 1].isLoaded && tanda[position - 1].getCover()"
                class="w-full h-full rounded"
                :url="tanda[position - 1].getCover()"
              />
              <div
                v-else
                class="w-full h-full bg-surface-600 rounded flex items-center justify-center"
              >
                <Icon icon="ic:outline-music-note" class="w-4 h-4 text-text-subtitle" />
              </div>
            </div>
            
            <div class="flex-grow min-w-0 flex flex-col justify-between h-12">
              <div class="flex flex-col">
                <div class="text-text-title text-xs font-medium truncate">
                  <template v-if="tanda[position - 1].getTitle() || tanda[position - 1].getFilename()">
                    {{ tanda[position - 1].getTitle() || tanda[position - 1].getFilename() }}
                  </template>
                  <NotApplicableText v-else />
                </div>
                <div class="text-text-subtitle text-xs truncate">
                  <template v-if="tanda[position - 1].getArtistsFormatted()">
                    {{ tanda[position - 1].getArtistsFormatted() }}
                  </template>
                  <NotApplicableText v-else />
                </div>
              </div>
              <div class="flex justify-end w-full">
                <div class="text-text-subtitle text-2xs opacity-80 whitespace-nowrap">
                  {{ tanda[position - 1].getDurationFormatted(true) || '--:--' }}
                </div>
              </div>
            </div>
          </div>
          
          <!-- Пустой слот -->
          <div
            v-else
            class="tanda-empty-slot flex items-center justify-center h-14 text-text-subtitle/50 border-2 border-dashed border-surface-600 rounded"
          >
            <Icon icon="ic:outline-add" class="w-5 h-5" />
            <span class="text-xs ml-1">Drop track here</span>
          </div>
        </div>
      </div>
      
      <!-- Кнопка для добавления новой танды -->
      <div 
        class="tanda-block w-64 min-w-64 bg-surface-800 rounded-lg p-3 flex items-center justify-center cursor-pointer hover:bg-surface-700 transition-colors"
        @click="addNewTanda"
      >
        <Icon icon="ic:outline-add" class="w-8 h-8 text-text-subtitle" />
        <span class="text-text-subtitle ml-2">Add tanda</span>
      </div>
    </section>
  </div>
</template>

<style scoped lang="postcss">
.tanda-block {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease;
}

.tanda-block:hover {
  transform: translateY(-2px);
}

.tanda-track {
  transition: all 0.2s ease;
}

.tanda-track:hover {
  transform: translateX(4px);
}

.text-2xs {
  font-size: 0.65rem;
  line-height: 0.75rem;
}

.tanda-slot {
  transition: all 0.2s ease;
}

.tanda-empty-slot {
  transition: all 0.2s ease;
}

.tanda-empty-slot:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.tanda-slot.drag-over {
  background-color: rgba(59, 130, 246, 0.1);
  border: 2px dashed rgb(59, 130, 246);
  border-radius: 4px;
}

.tanda-empty-slot.drag-over {
  background-color: rgba(59, 130, 246, 0.2);
  border-color: rgb(59, 130, 246);
}
</style>