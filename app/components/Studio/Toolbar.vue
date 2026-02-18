<script setup lang="ts">
import { REPL_KEY } from '~/composables/useRepl'

const config = useRuntimeConfig()
const repl = inject(REPL_KEY)!

const emit = defineEmits<{
  scan: []
}>()

function toggleDraft() {
  if (repl.draftMode.value) repl.applyDraft()
  else repl.enterDraft()
}

function onKeydown(e: KeyboardEvent) {
  const mod = e.metaKey || e.ctrlKey
  if (mod && e.key === 'Enter') {
    e.preventDefault()
    repl.evaluate()
  } else if (mod && e.key === '.') {
    e.preventDefault()
    repl.stop()
  } else if (mod && e.key === 'd') {
    e.preventDefault()
    toggleDraft()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="flex items-center gap-2 p-2 border-b border-navy-900">
    <button
      class="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-sm"
      @click="emit('scan')"
    >
      Scan
    </button>
    <button
      class="px-3 py-1 rounded text-sm"
      :class="repl.isPlaying.value ? 'bg-magenta-500 text-white' : 'bg-navy-800 text-navy-200 hover:bg-navy-700'"
      @click="repl.evaluate()"
    >
      Play
    </button>
    <button
      class="px-3 py-1 bg-navy-800 hover:bg-navy-700 text-navy-200 rounded text-sm"
      @click="repl.stop()"
    >
      Stop
    </button>
    <button
      class="px-3 py-1 rounded text-sm transition-colors"
      :class="repl.draftMode.value
        ? 'bg-magenta-700 hover:bg-magenta-600 text-white'
        : 'bg-navy-800 text-navy-200 hover:bg-navy-700'"
      @click="toggleDraft"
    >
      {{ repl.draftMode.value ? 'Apply' : 'Draft' }}
      <span v-if="repl.draftMode.value && repl.hasDraftChanges.value" class="ml-1 text-xs">&#9679;</span>
    </button>
    <button
      v-if="repl.draftMode.value"
      class="px-2 py-1 rounded text-sm bg-navy-800 text-navy-400 hover:text-magenta-400 hover:bg-navy-700 transition-colors"
      title="Discard draft changes"
      @click="repl.discardDraft()"
    >
      &#10005;
    </button>
    <span class="text-xs text-navy-400 ml-2">
      Ctrl+Enter: play &middot; Ctrl+. : stop
    </span>
    <div class="ml-auto flex items-center gap-2">
      <a
        :href="config.public.strudelDocsUrl"
        target="_blank"
        rel="noopener"
        class="text-navy-400 hover:text-orchid-300 transition-colors"
        title="Strudel docs"
      >
        <span class="inline-block rotate-90 text-lg leading-none">꩜</span>
      </a>
    </div>
  </div>
</template>
