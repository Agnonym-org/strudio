<script setup lang="ts">
import { REPL_KEY } from '~/composables/useRepl'

const config = useRuntimeConfig()
const repl = inject(REPL_KEY)!

const props = defineProps<{
  mode: 'writer' | 'mix'
}>()

const emit = defineEmits<{
  scan: []
  'update:mode': [value: 'writer' | 'mix']
}>()

const isMix = computed(() => props.mode === 'mix')

function toggleMode() {
  const next = isMix.value ? 'writer' : 'mix'
  emit('update:mode', next)
  if (next === 'mix') nextTick(() => emit('scan'))
}

function toggleDraft() {
  if (repl.draftMode.value) repl.applyDraft()
  else repl.enterDraft()
}

function onKeydown(e: KeyboardEvent) {
  const mod = e.ctrlKey
  if (mod && e.key === 'Enter') {
    e.preventDefault()
    repl.evaluate()
  } else if (mod && (e.key === '.' || e.code === 'NumpadDecimal')) {
    e.preventDefault()
    repl.stop()
  } else if (mod && e.key === 'd') {
    e.preventDefault()
    if (isMix.value) toggleDraft()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="flex items-center gap-2 p-2 border-b border-navy-900">
    <button
      v-tooltip.bottom="isMix ? 'Compose mode' : 'Mix mode'"
      class="w-8 h-7 rounded flex items-center justify-center transition-colors"
      :class="isMix
        ? 'bg-navy-800 text-navy-200 hover:bg-navy-700'
        : 'bg-cyan-600 hover:bg-cyan-500 text-white'"
      @click="toggleMode"
    >
      <img
        :src="`/assets/icon/${isMix ? 'mode-compose' : 'mode-mix'}.svg`"
        :alt="isMix ? 'Compose' : 'Mix'"
        class="w-4 h-4"
      >
    </button>
    <button
      v-tooltip.bottom="repl.isPlaying.value ? 'Update (Ctrl+Enter)' : 'Play (Ctrl+Enter)'"
      class="h-7 rounded flex items-center justify-center gap-1.5 transition-colors w-8 lg:w-auto lg:px-3"
      :class="repl.isPlaying.value ? 'bg-magenta-500 text-white' : 'bg-navy-800 text-navy-200 hover:bg-navy-700'"
      @click="repl.evaluate()"
    >
      <img :src="`/assets/icon/${repl.isPlaying.value ? 'action-update' : 'action-play'}.svg`" alt="" class="w-4 h-4 shrink-0 lg:hidden">
      <span class="hidden lg:inline text-sm">{{ repl.isPlaying.value ? 'Update' : 'Play' }}</span>
    </button>
    <button
      v-tooltip.bottom="'Stop (Ctrl+.)'"
      class="h-7 rounded flex items-center justify-center gap-1.5 bg-navy-800 hover:bg-navy-700 text-navy-200 transition-colors w-8 lg:w-auto lg:px-3"
      @click="repl.stop()"
    >
      <img src="/assets/icon/action-stop.svg" alt="" class="w-4 h-4 shrink-0 lg:hidden">
      <span class="hidden lg:inline text-sm">Stop</span>
    </button>
    <button
      v-if="isMix"
      v-tooltip.bottom="'Scan controls'"
      class="h-7 rounded flex items-center justify-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white transition-colors w-8 lg:w-auto lg:px-3"
      @click="emit('scan')"
    >
      <img src="/assets/icon/action-scan.svg" alt="" class="w-4 h-4 shrink-0 lg:hidden">
      <span class="hidden lg:inline text-sm">Scan</span>
    </button>
    <button
      v-if="isMix"
      v-tooltip.bottom="repl.draftMode.value ? 'Apply draft (Ctrl+D)' : 'Enter draft mode (Ctrl+D)'"
      class="relative h-7 rounded flex items-center justify-center gap-1.5 transition-colors w-8 lg:w-auto lg:px-3"
      :class="repl.draftMode.value
        ? 'bg-magenta-700 hover:bg-magenta-600 text-white'
        : 'bg-navy-800 text-navy-200 hover:bg-navy-700'"
      @click="toggleDraft"
    >
      <img :src="`/assets/icon/${repl.draftMode.value ? 'action-apply' : 'action-draft'}.svg`" alt="" class="w-4 h-4 shrink-0 lg:hidden">
      <span class="hidden lg:inline text-sm">{{ repl.draftMode.value ? 'Apply' : 'Draft' }}</span>
      <span v-if="repl.draftMode.value && repl.hasDraftChanges.value" class="lg:hidden absolute -top-1 -right-1 w-2 h-2 rounded-full bg-magenta-400" />
      <span v-if="repl.draftMode.value && repl.hasDraftChanges.value" class="hidden lg:inline text-xs">&#9679;</span>
    </button>
    <button
      v-if="repl.draftMode.value && isMix"
      v-tooltip.bottom="'Discard draft'"
      class="h-7 rounded flex items-center justify-center gap-1.5 bg-navy-800 text-navy-400 hover:text-magenta-400 hover:bg-navy-700 transition-colors w-8 lg:w-auto lg:px-2"
      @click="repl.discardDraft()"
    >
      <img src="/assets/icon/action-discard.svg" alt="" class="w-4 h-4 shrink-0">
    </button>
    <span class="hidden lg:inline text-xs text-navy-400 ml-2">
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
