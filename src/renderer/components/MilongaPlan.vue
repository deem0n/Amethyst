<script setup lang="ts">
import { computed, ref } from "vue";
import type { Track } from "@/logic/track";
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
  // Разрешаем только перемещение
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
  activeDropZone.value = { tandaIndex, position };
};

const handleDragLeave = () => {
  activeDropZone.value = null;
};

const handleDrop = async (event: DragEvent, tandaIndex: number, position: number) => {
  event.preventDefault();
  activeDropZone.value = null;
  
  try {
    // Получаем данные о перетаскиваемых файлах из electron drag&drop
    const files = event.dataTransfer?.files;
    
    if (files && files.length > 0) {
      // Берем первый файл (предполагаем, что перетаскивается один трек)
      const file = files[0];
      const filePath = file.path;
      
      // Ищем трек в общем списке треков по абсолютному пути
      const track = amethyst.state.milongaCandidateTracks.find(t => 
        t.absolutePath === filePath || t.path === filePath
      );
      
      if (track) {
        // Создаем новый массив треков с обновленной тандой
        const newTracks = [...props.tracks];
        
        // Вычисляем индекс в плоском массиве
        const flatIndex = tandaIndex * 4 + position;
        
        // Если позиция уже занята, заменяем трек
        if (flatIndex < newTracks.length) {
          newTracks[flatIndex] = track;
        } else {
          // Если позиция пустая, добавляем новый трек
          // Заполняем пробелы null'ами если нужно
          while (newTracks.length < flatIndex) {
            newTracks.push(null as any);
          }
          newTracks.push(track);
        }
        
        // Фильтруем null'ы (если они были добавлены)
        const filteredTracks = newTracks.filter(t => t !== null);
        
        // Отправляем обновленный список наружу
        emit('tracksUpdated', filteredTracks);
      } else {
        console.log('Track not found in candidate tracks:', filePath);
      }
    }
  } catch (error) {
    console.error('Error handling drop:', error);
  }
};

// Функция для начала перетаскивания существующих треков из самой танды
const handleDragStart = (event: DragEvent, track: Track) => {
  if (!event.dataTransfer) return;
  
  // Используем electron drag&drop для перетаскивания файлов
  // Создаем File объект для перетаскивания
  const file = new File([], track.getFilename(), { 
    type: 'audio/' + track.getContainer() 
  });
  
  // Добавляем свойство path для electron
  (file as any).path = track.absolutePath;
  
  const dataTransfer = event.dataTransfer;
  dataTransfer.effectAllowed = 'move';
  
  // Используем DataTransferItemList для добавления файла
  const dataTransferItemList = dataTransfer.items;
  dataTransferItemList.add(file);
  
  // Также добавляем путь как plain text для обратной совместимости
  dataTransfer.setData('text/plain', track.absolutePath);
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
</style>