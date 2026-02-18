<script setup lang="ts">
const emit = defineEmits<{
  hit: [event: { sound: string }]
  combo: [sounds: string[]]
}>()

// ---- Pad definitions ----
interface Pad {
  id: string
  name: string
  code: string
  shortcut: string
  color: string
  span2?: boolean
}

const PADS: Pad[] = [
  // Row 1: Cymbals
  { id: 'cr', name: 'Crash', code: 'Numpad7', shortcut: '7', color: 'cyan' },
  { id: 'rd', name: 'Ride', code: 'Numpad8', shortcut: '8', color: 'cyan' },
  { id: 'oh', name: 'Open HH', code: 'Numpad9', shortcut: '9', color: 'cyan' },
  // Row 2: Toms
  { id: 'ht', name: 'Hi Tom', code: 'Numpad4', shortcut: '4', color: 'navy' },
  { id: 'mt', name: 'Mid Tom', code: 'Numpad5', shortcut: '5', color: 'navy' },
  { id: 'lt', name: 'Low Tom', code: 'Numpad6', shortcut: '6', color: 'navy' },
  // Row 3: Snare area
  { id: 'sd', name: 'Snare', code: 'Numpad1', shortcut: '1', color: 'orchid' },
  { id: 'rim', name: 'Rim', code: 'Numpad2', shortcut: '2', color: 'orchid' },
  { id: 'cp', name: 'Clap', code: 'Numpad3', shortcut: '3', color: 'orchid' },
  // Row 4: Kick + HH
  { id: 'bd', name: 'Kick', code: 'Numpad0', shortcut: '0', color: 'magenta', span2: true },
  { id: 'hh', name: 'HH', code: 'NumpadDecimal', shortcut: '.', color: 'cyan' },
]

const CODE_MAP = new Map(PADS.map(p => [p.code, p]))

// ---- State ----
const activePads = ref(new Set<string>())
const chordMode = ref(false)
const pendingCombo = ref<string[]>([])

// ---- Hit flash ----
function flash(id: string) {
  activePads.value.add(id)
  setTimeout(() => activePads.value.delete(id), 150)
}

// ---- Chord mode ----
function toggleChordMode() {
  if (chordMode.value) {
    if (pendingCombo.value.length) {
      emit('combo', [...pendingCombo.value])
    }
    pendingCombo.value = []
    chordMode.value = false
  } else {
    chordMode.value = true
    pendingCombo.value = []
  }
}

function addToCombo(id: string) {
  const idx = pendingCombo.value.indexOf(id)
  if (idx >= 0) {
    pendingCombo.value.splice(idx, 1)
  } else {
    pendingCombo.value.push(id)
  }
}

// ---- Interaction ----
function onPadHit(pad: Pad) {
  flash(pad.id)
  if (chordMode.value) {
    addToCombo(pad.id)
    return
  }
  emit('hit', { sound: pad.id })
}

function onKbDown(e: KeyboardEvent) {
  if (e.repeat) return
  const target = e.target as HTMLElement
  const tag = target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  if (target?.closest('.cm-editor')) {
    const cm = (document.querySelector('#repl') as any)?.editor?.editor
    const sel = cm?.state?.selection?.main
    if (!sel || sel.from === sel.to) return // no selection → let CM handle the key
  }

  if (e.code === 'Tab') {
    e.preventDefault()
    toggleChordMode()
    return
  }

  const pad = CODE_MAP.get(e.code)
  if (!pad) return

  e.preventDefault()
  onPadHit(pad)
}

onMounted(() => window.addEventListener('keydown', onKbDown))
onUnmounted(() => window.removeEventListener('keydown', onKbDown))

// ---- Color classes ----
const colorClasses: Record<string, { base: string; active: string; combo: string }> = {
  cyan: {
    base: 'bg-cyan-950/50 text-cyan-300 border-cyan-800 hover:bg-cyan-900/50',
    active: 'bg-cyan-500 text-white border-cyan-400',
    combo: 'ring-2 ring-cyan-400',
  },
  navy: {
    base: 'bg-navy-800/50 text-navy-200 border-navy-700 hover:bg-navy-700/50',
    active: 'bg-navy-500 text-white border-navy-400',
    combo: 'ring-2 ring-navy-400',
  },
  orchid: {
    base: 'bg-orchid-950/50 text-orchid-300 border-orchid-800 hover:bg-orchid-900/50',
    active: 'bg-orchid-500 text-white border-orchid-400',
    combo: 'ring-2 ring-orchid-400',
  },
  magenta: {
    base: 'bg-magenta-950/50 text-magenta-300 border-magenta-800 hover:bg-magenta-900/50',
    active: 'bg-magenta-500 text-white border-magenta-400',
    combo: 'ring-2 ring-magenta-400',
  },
}

function padClasses(pad: Pad) {
  const c = colorClasses[pad.color]!
  const isActive = activePads.value.has(pad.id)
  const inCombo = chordMode.value && pendingCombo.value.includes(pad.id)
  return [
    isActive ? c.active : c.base,
    inCombo ? c.combo : '',
  ]
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-2 text-[10px] text-navy-400 font-mono">
      <span>numpad</span>
      <span class="text-navy-600">|</span>
      <span
        class="cursor-pointer"
        :class="chordMode ? 'text-cyan-400' : 'text-navy-400 hover:text-navy-300'"
        @click="toggleChordMode"
      >tab:combo{{ chordMode ? ` (${pendingCombo.length})` : '' }}</span>
    </div>

    <div class="grid grid-cols-3 gap-1" style="width: 150px">
      <div
        v-for="pad in PADS"
        :key="pad.id"
        class="border rounded cursor-pointer transition-all select-none flex flex-col items-center justify-center h-9"
        :class="[padClasses(pad), pad.span2 ? 'col-span-2' : '']"
        @pointerdown.prevent="onPadHit(pad)"
      >
        <span class="text-xs font-bold font-mono leading-none">{{ pad.id }}</span>
        <span class="text-[7px] opacity-40 font-mono leading-none mt-0.5">{{ pad.shortcut }}</span>
      </div>
    </div>
  </div>
</template>
