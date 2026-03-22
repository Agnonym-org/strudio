<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'

defineProps<{
  mode?: 'writer' | 'mix'
}>()

const windowWidth = ref(window?.innerWidth ?? 1920)

function onResize() {
  windowWidth.value = window.innerWidth
}

onMounted(() => window.addEventListener('resize', onResize))
onUnmounted(() => window.removeEventListener('resize', onResize))

// < 1024px → stacked (tablet portrait and below)
const isStacked = computed(() => windowWidth.value < 1024)
</script>

<template>
  <div class="h-screen flex flex-col bg-navy-950 text-white overflow-hidden">
    <slot name="toolbar" />
    <Splitter
      v-if="mode === 'mix'"
      :layout="isStacked ? 'vertical' : 'horizontal'"
      class="flex-1 min-h-0 !border-0 !bg-transparent"
    >
      <!-- Stacked: controls first, then editor -->
      <template v-if="isStacked">
        <SplitterPanel :size="45" :min-size="20" class="min-h-0 overflow-hidden">
          <slot name="panel" />
        </SplitterPanel>
        <SplitterPanel :size="55" :min-size="20" class="min-h-0 overflow-auto">
          <slot name="editor" />
        </SplitterPanel>
      </template>
      <!-- Desktop: editor left, controls right -->
      <template v-else>
        <SplitterPanel :size="40" :min-size="20" class="min-h-0 overflow-auto">
          <slot name="editor" />
        </SplitterPanel>
        <SplitterPanel :size="60" :min-size="30" class="min-h-0 overflow-hidden">
          <slot name="panel" />
        </SplitterPanel>
      </template>
    </Splitter>
    <div v-else class="flex-1 min-h-0 overflow-auto">
      <slot name="editor" />
    </div>
  </div>
</template>
