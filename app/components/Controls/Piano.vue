<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    lowNote?: number
    highNote?: number
    mode?: 'button' | 'toggle'
  }>(),
  {
    lowNote: 48,
    highNote: 72,
    mode: 'toggle',
  },
)

const emit = defineEmits<{
  change: [event: { note: number; state: boolean }]
  chord: [notes: number[]]
}>()

// ---- State ----
const activeNotes = ref(new Set<number>())
const pressedKeys = ref(new Set<number>())
const octaveOffset = ref(0)
const isAzerty = ref(false)
const chordMode = ref(false)
const pendingChord = ref<number[]>([])

// ---- Note helpers ----
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const BLACK_SEMITONES = new Set([1, 3, 6, 8, 10])

function isBlack(midi: number) {
  return BLACK_SEMITONES.has(midi % 12)
}

function noteName(midi: number) {
  return NOTE_NAMES[midi % 12]! + (Math.floor(midi / 12) - 1)
}

// ---- Keyboard mapping ----
// Single row (top letter row). Shift = sharp, Ctrl = flat, arrows = octave.
// Both layouts: first key = A3 (La), P = C5 (Do)
const CODE_TO_WHITE: Record<string, number> = {
  // Q/A  W/Z  E  R  T  Y  U  I  O  P  [/^  ]/$ \/\*
  // A3   B3  C4 D4 E4 F4 G4 A4 B4 C5  D5   E5  F5
  KeyQ: 57, KeyW: 59, KeyE: 60, KeyR: 62, KeyT: 64, KeyY: 65, KeyU: 67,
  KeyI: 69, KeyO: 71, KeyP: 72, BracketLeft: 74, BracketRight: 76, Backslash: 77,
}

const CODE_LABELS_QWERTY: Record<string, string> = {
  KeyQ: 'Q', KeyW: 'W', KeyE: 'E', KeyR: 'R', KeyT: 'T', KeyY: 'Y', KeyU: 'U',
  KeyI: 'I', KeyO: 'O', KeyP: 'P', BracketLeft: '[', BracketRight: ']', Backslash: '\\',
}

const CODE_LABELS_AZERTY: Record<string, string> = {
  KeyQ: 'A', KeyW: 'Z', KeyE: 'E', KeyR: 'R', KeyT: 'T', KeyY: 'Y', KeyU: 'U',
  KeyI: 'I', KeyO: 'O', KeyP: 'P', BracketLeft: '^', BracketRight: '$', Backslash: '*',
}

const codeLabels = computed(() =>
  isAzerty.value ? CODE_LABELS_AZERTY : CODE_LABELS_QWERTY,
)

// Reverse map: white MIDI → shortcut label, black MIDI → "⇧" + label of white key below
const shortcutMap = computed(() => {
  const mapping = CODE_TO_WHITE
  const labels = codeLabels.value
  const whiteMap = new Map<number, string>()
  for (const [code, whiteMidi] of Object.entries(mapping)) {
    const midi = whiteMidi + octaveOffset.value * 12
    if (labels[code]) {
      whiteMap.set(midi, labels[code]!)
    }
  }
  // Second pass: black keys = sharp of the white key below
  const map = new Map<number, string>(whiteMap)
  for (const [midi, label] of whiteMap) {
    const sharpMidi = midi + 1
    if (isBlack(sharpMidi) && !map.has(sharpMidi)) {
      map.set(sharpMidi, '⇧' + label)
    }
  }
  return map
})

// ---- Visible keys (shift with octave) ----
interface PianoKey {
  midi: number
  black: boolean
  label: string
  shortcut: string
}

const effectiveLow = computed(() => props.lowNote + octaveOffset.value * 12)
const effectiveHigh = computed(() => props.highNote + octaveOffset.value * 12)

const keys = computed<PianoKey[]>(() => {
  const result: PianoKey[] = []
  for (let midi = effectiveLow.value; midi <= effectiveHigh.value; midi++) {
    result.push({
      midi,
      black: isBlack(midi),
      label: noteName(midi),
      shortcut: shortcutMap.value.get(midi) ?? '',
    })
  }
  return result
})

const whiteKeys = computed(() => keys.value.filter(k => !k.black))
const blackKeys = computed(() => keys.value.filter(k => k.black))

// ---- Black key positioning ----
// Black key CENTER positions within an octave of 7 white keys (C=0 D=1 E=2 F=3 G=4 A=5 B=6).
// Each value is in white-key-units. Boundaries between white keys are at integer positions.
// Black keys sit at (or near) these boundaries with slight offsets for realistic grouping.
const BLACK_POSITIONS: Record<number, number> = {
  1: 0.97,   // C#: just left of C-D boundary
  3: 2.03,   // D#: just right of D-E boundary
  6: 3.97,   // F#: just left of F-G boundary
  8: 5.0,    // G#: centered at G-A boundary
  10: 6.03,  // A#: just right of A-B boundary
}

function blackKeyLeft(midi: number): number {
  const semitone = midi % 12
  const octaveStart = midi - semitone
  const low = effectiveLow.value
  // Count white keys from visible start to this octave's C
  let whitesBefore = 0
  for (let m = low; m < octaveStart; m++) {
    if (!isBlack(m)) whitesBefore++
  }
  // If visible start is mid-octave, adjust
  if (octaveStart < low) {
    for (let m = octaveStart; m < low; m++) {
      if (!isBlack(m)) whitesBefore--
    }
  }
  return whitesBefore + (BLACK_POSITIONS[semitone] ?? 0)
}

// ---- Chord mode ----
function toggleChordMode() {
  if (chordMode.value) {
    // Finalize chord
    if (pendingChord.value.length) {
      emit('chord', [...pendingChord.value].sort((a, b) => a - b))
    }
    pendingChord.value = []
    activeNotes.value.clear()
    chordMode.value = false
  } else {
    chordMode.value = true
    pendingChord.value = []
  }
}

function addToChord(midi: number) {
  const idx = pendingChord.value.indexOf(midi)
  if (idx >= 0) {
    pendingChord.value.splice(idx, 1)
    activeNotes.value.delete(midi)
  } else {
    pendingChord.value.push(midi)
    activeNotes.value.add(midi)
  }
}

// ---- Mouse interaction ----
function onMouseDown(midi: number) {
  if (chordMode.value) {
    addToChord(midi)
    return
  }
  if (props.mode === 'toggle') {
    const wasActive = activeNotes.value.has(midi)
    if (wasActive) activeNotes.value.delete(midi)
    else activeNotes.value.add(midi)
    emit('change', { note: midi, state: !wasActive })
  } else {
    activeNotes.value.add(midi)
    emit('change', { note: midi, state: true })
  }
}

function onMouseUp(midi: number) {
  if (props.mode === 'button') {
    activeNotes.value.delete(midi)
    emit('change', { note: midi, state: false })
  }
}

// ---- Keyboard interaction ----
function detectLayout(e: KeyboardEvent) {
  // Detect AZERTY from any key that differs between layouts
  const expected: Record<string, string> = { KeyQ: 'q', KeyW: 'w', KeyA: 'a', KeyZ: 'z' }
  const exp = expected[e.code]
  if (exp) isAzerty.value = e.key.toLowerCase() !== exp
}

function onKbDown(e: KeyboardEvent) {
  if (e.repeat) return
  if (e.metaKey) return // let Cmd shortcuts through (Cmd+A, Cmd+C, etc.)
  const target = e.target as HTMLElement
  const tag = target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  if (target?.closest('.cm-editor')) {
    const cm = (document.querySelector('#repl') as any)?.editor?.editor
    const sel = cm?.state?.selection?.main
    if (!sel || sel.from === sel.to) return // no selection → let CM handle the key
  }

  detectLayout(e)

  if (e.code === 'Tab') {
    e.preventDefault()
    toggleChordMode()
    return
  }

  if (e.code === 'ArrowUp') {
    e.preventDefault()
    octaveOffset.value = Math.min(octaveOffset.value + 1, 3)
    return
  }
  if (e.code === 'ArrowDown') {
    e.preventDefault()
    octaveOffset.value = Math.max(octaveOffset.value - 1, -3)
    return
  }

  const whiteMidi = CODE_TO_WHITE[e.code]
  if (whiteMidi == null) return

  e.preventDefault()

  let midi = whiteMidi + octaveOffset.value * 12
  if (e.shiftKey) midi++ // sharp
  if (e.ctrlKey) midi--  // flat

  if (midi < 0 || midi > 127) return

  if (chordMode.value) {
    addToChord(midi)
    return
  }

  pressedKeys.value.add(midi)
  activeNotes.value.add(midi)
  emit('change', { note: midi, state: true })
}

function onKbUp(e: KeyboardEvent) {
  const whiteMidi = CODE_TO_WHITE[e.code]
  if (whiteMidi == null) return

  const base = whiteMidi + octaveOffset.value * 12
  for (const offset of [-1, 0, 1]) {
    const midi = base + offset
    if (pressedKeys.value.has(midi)) {
      pressedKeys.value.delete(midi)
      if (props.mode === 'button') {
        activeNotes.value.delete(midi)
        emit('change', { note: midi, state: false })
      }
    }
  }
}

// ---- Expose API ----
function highlightNote(note: number | null) {
  activeNotes.value.clear()
  if (note != null) activeNotes.value.add(note)
}

function highlightNotes(notes: number[]) {
  activeNotes.value = new Set(notes)
}

defineExpose({ highlightNote, highlightNotes })

onMounted(() => {
  // Guess layout from browser language
  const lang = navigator.language?.toLowerCase() ?? ''
  if (lang.startsWith('fr') || lang.startsWith('be')) isAzerty.value = true
  window.addEventListener('keydown', onKbDown)
  window.addEventListener('keyup', onKbUp)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKbDown)
  window.removeEventListener('keyup', onKbUp)
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-2 text-[10px] text-navy-400 font-mono">
      <span>oct {{ octaveOffset >= 0 ? '+' : '' }}{{ octaveOffset }}</span>
      <span class="text-navy-600">|</span>
      <span>shift=#  ctrl=b</span>
      <span class="text-navy-600">|</span>
      <span>{{ isAzerty ? 'azerty' : 'qwerty' }}</span>
      <span class="text-navy-600">|</span>
      <span
        class="cursor-pointer"
        :class="chordMode ? 'text-cyan-400' : 'text-navy-400 hover:text-navy-300'"
        @click="toggleChordMode"
      >tab:chord{{ chordMode ? ` (${pendingChord.length})` : '' }}</span>
    </div>

    <div
      class="relative select-none"
      :style="{ width: whiteKeys.length * 28 + 'px', height: '100px' }"
    >
      <!-- White keys -->
      <div
        v-for="(key, i) in whiteKeys"
        :key="key.midi"
        class="absolute top-0 border border-navy-600 rounded-b-sm cursor-pointer transition-colors flex flex-col items-center justify-end pb-1 gap-0.5"
        :class="activeNotes.has(key.midi) ? 'bg-magenta-400 border-magenta-500' : 'bg-gray-200 hover:bg-gray-100'"
        :style="{ left: i * 28 + 'px', width: '27px', height: '100px' }"
        @pointerdown.prevent="onMouseDown(key.midi)"
        @pointerup="onMouseUp(key.midi)"
        @pointerleave="onMouseUp(key.midi)"
      >
        <span
          v-if="key.shortcut"
          class="text-[8px] font-mono leading-none"
          :class="activeNotes.has(key.midi) ? 'text-white' : 'text-navy-500'"
        >{{ key.shortcut }}</span>
        <span
          class="text-[7px] leading-none"
          :class="activeNotes.has(key.midi) ? 'text-magenta-100' : 'text-navy-400'"
        >{{ key.label }}</span>
      </div>

      <!-- Black keys -->
      <div
        v-for="key in blackKeys"
        :key="key.midi"
        class="absolute top-0 rounded-b-sm cursor-pointer transition-colors z-10 flex flex-col items-center justify-end pb-0.5"
        :class="activeNotes.has(key.midi) ? 'bg-magenta-600 border border-magenta-500' : 'bg-navy-950 hover:bg-navy-800 border border-navy-700'"
        :style="{ left: (blackKeyLeft(key.midi) * 28 - 9) + 'px', width: '18px', height: '62px' }"
        @pointerdown.prevent="onMouseDown(key.midi)"
        @pointerup="onMouseUp(key.midi)"
        @pointerleave="onMouseUp(key.midi)"
      >
        <span
          v-if="key.shortcut"
          class="text-[6px] font-mono leading-none"
          :class="activeNotes.has(key.midi) ? 'text-white' : 'text-navy-500'"
        >{{ key.shortcut }}</span>
      </div>
    </div>
  </div>
</template>
