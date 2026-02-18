<script setup lang="ts">
import { REPL_KEY } from '~/composables/useRepl'
import { parseStrudelCode, formatValue } from '~/composables/useStrudelParser'
import type {
  ParsedParam,
  ParsedCode,
  ParsedGroup,
} from '~/composables/useStrudelParser'

const repl = inject(REPL_KEY)!
const parsed = ref<ParsedCode | null>(null)
const pianoRef = ref()
const selectedNotes = ref<number[]>([])
const showPiano = ref(false)
const showDrums = ref(false)
const openPanels = ref<string[]>([])

async function scan() {
  // Wait for editor to be ready (CM initialized + code loaded)
  if (!repl.isReady.value) {
    await new Promise<void>((resolve) => {
      const stop = watch(repl.isReady, (ready) => {
        if (ready) { stop(); resolve() }
      }, { immediate: true })
    })
  }
  // The editor content from the HTML comment may load a tick after CM init
  let code = repl.getCode()
  if (!code.trim()) {
    await new Promise((r) => setTimeout(r, 200))
    code = repl.getCode()
  }

  parsed.value = parseStrudelCode(code)
  // Auto-show instruments based on detected content
  if (parsed.value) {
    showPiano.value = parsed.value.groups.length > 0
    showDrums.value = parsed.value.drums.length > 0
    // Open all accordion panels by default
    openPanels.value = [
      ...(parsed.value.globals.length ? ['global'] : []),
      ...parsed.value.groups.map((g) => g.sound),
    ]
  }
}

function toggleInstrument(inst: 'piano' | 'drums') {
  if (inst === 'piano') showPiano.value = !showPiano.value
  else showDrums.value = !showDrums.value
}

// --- Position shifting ---

function shiftPositionsAfter(anchor: number, delta: number) {
  if (!parsed.value || delta === 0) return
  const allParams = [...parsed.value.globals]
  for (const g of parsed.value.groups) {
    allParams.push(...g.params)
    if (g.voiceFrom > anchor) {
      g.voiceFrom += delta
      g.voiceTo += delta
    } else if (g.voiceTo > anchor) {
      g.voiceTo += delta
    }
  }
  for (const p of allParams) {
    if (p.valueFrom > anchor) {
      p.valueFrom += delta
      p.valueTo += delta
    }
    if (p.value2From != null && p.value2From > anchor) {
      p.value2From += delta
      p.value2To! += delta
    }
    if (p.methodFrom > anchor) {
      p.methodFrom += delta
      p.methodTo += delta
    } else if (p.methodTo > anchor) {
      p.methodTo += delta
    }
  }
  for (const d of parsed.value.drums) {
    if (d.patternFrom > anchor) {
      d.patternFrom += delta
      d.patternTo += delta
    }
  }
}

// --- Param change ---

async function onParamChange(param: ParsedParam, newValue: number) {
  const newStr = formatValue(newValue, param.config.step)
  const lengthDiff = newStr.length - (param.valueTo - param.valueFrom)

  repl.replaceValue(param.valueFrom, param.valueTo, newStr)

  param.value = newValue
  param.valueTo = param.valueFrom + newStr.length

  shiftPositionsAfter(param.valueFrom, lengthDiff)

  await repl.evaluate()
}

async function onRangeChange(param: ParsedParam, values: [number, number]) {
  const [newMin, newMax] = values

  // Update max first (comes later in source), then min
  const maxStr = formatValue(newMax, param.config.step)
  const maxDiff = maxStr.length - (param.value2To! - param.value2From!)
  repl.replaceValue(param.value2From!, param.value2To!, maxStr)
  param.value2 = newMax
  param.value2To = param.value2From! + maxStr.length
  shiftPositionsAfter(param.value2From!, maxDiff)

  const minStr = formatValue(newMin, param.config.step)
  const minDiff = minStr.length - (param.valueTo - param.valueFrom)
  repl.replaceValue(param.valueFrom, param.valueTo, minStr)
  param.value = newMin
  param.valueTo = param.valueFrom + minStr.length
  shiftPositionsAfter(param.valueFrom, minDiff)

  await repl.evaluate()
}

// --- Mute voice: append/remove .gain(0) ---

const MUTE_SUFFIX = '.gain(0)'

async function onMuteVoice(group: ParsedGroup) {
  if (group.muted) {
    // Unmute: remove trailing .gain(0)
    const removeFrom = group.voiceTo - MUTE_SUFFIX.length
    repl.replaceValue(removeFrom, group.voiceTo, '')
    const delta = -MUTE_SUFFIX.length
    group.voiceTo += delta
    group.muted = false
    shiftPositionsAfter(removeFrom, delta)
  } else {
    // Mute: append .gain(0) at the end of the voice
    repl.replaceValue(group.voiceTo, group.voiceTo, MUTE_SUFFIX)
    const delta = MUTE_SUFFIX.length
    group.muted = true
    shiftPositionsAfter(group.voiceTo, delta)
    group.voiceTo += delta
  }

  await repl.evaluate()
}

// --- Toggle param (wrap/unwrap .method(arg) with /* */) ---

async function onToggleParam(param: ParsedParam) {
  const code = repl.getCode()
  const slice = code.slice(param.methodFrom, param.methodTo)

  if (param.disabled) {
    // Unwrap: remove /* and */
    if (!slice.startsWith('/*') || !slice.endsWith('*/')) return
    repl.replaceValue(param.methodFrom, param.methodTo, slice.slice(2, -2))
  } else {
    // Wrap with /* */
    repl.replaceValue(param.methodFrom, param.methodTo, `/*${slice}*/`)
  }

  // Re-parse from scratch for correct positions (avoids fragile offset arithmetic)
  parsed.value = parseStrudelCode(repl.getCode())
  await repl.evaluate()
}

// --- Piano ---

function syncPiano() {
  const cm = (repl as any).isReady?.value ? getCm() : null
  if (!cm) return
  const { from, to } = cm.state.selection.main
  if (from === to) {
    pianoRef.value?.highlightNote(null)
    return
  }
  const text = cm.state.sliceDoc(from, to).trim()

  const tokens = text.split(/\s+/)
  const notes = tokens
    .map(Number)
    .filter((n: number) => !isNaN(n) && n >= 0 && n <= 127)
  if (notes.length > 1) {
    selectedNotes.value = notes
    pianoRef.value?.highlightNotes(notes)
    return
  }
  if (notes.length === 1) {
    selectedNotes.value = []
    pianoRef.value?.highlightNote(notes[0])
    return
  }

  selectedNotes.value = []
  pianoRef.value?.highlightNote(null)
}

function getCm() {
  return (document.querySelector('#repl') as any)?.editor?.editor
}

function onPianoChange({ note, state }: { note: number; state: boolean }) {
  const cm = getCm()
  if (!cm) return
  const { from, to } = cm.state.selection.main

  if (from !== to) {
    const text = cm.state.sliceDoc(from, to).trim()
    const tokens = text.split(/\s+/)
    const existingNotes = tokens
      .map(Number)
      .filter((n: number) => !isNaN(n) && n >= 0 && n <= 127)

    if (existingNotes.length > 1 || selectedNotes.value.length > 0) {
      const idx = selectedNotes.value.indexOf(note)
      if (idx >= 0) {
        selectedNotes.value.splice(idx, 1)
      } else {
        selectedNotes.value.push(note)
      }
      const newText = selectedNotes.value.join(' ')
      cm.dispatch({
        changes: { from, to, insert: newText },
        selection: { anchor: from, head: from + newText.length },
      })
      pianoRef.value?.highlightNotes(selectedNotes.value)
      repl.evaluate()
      return
    }
  }

  if (!state) return
  if (from === to) return
  cm.dispatch({
    changes: { from, to, insert: String(note) },
    selection: { anchor: from, head: from + String(note).length },
  })
  repl.evaluate()
}

// --- Drum pad ---

function onDrumHit({ sound }: { sound: string }) {
  const cm = getCm()
  if (!cm) return
  const { from, to } = cm.state.selection.main
  if (from === to) return
  cm.dispatch({
    changes: { from, to, insert: sound },
    selection: { anchor: from, head: from + sound.length },
  })
  repl.evaluate()
}

function onDrumCombo(sounds: string[]) {
  const cm = getCm()
  if (!cm) return
  const { from, to } = cm.state.selection.main
  if (from === to) return
  const text = `[${sounds.join(' ')}]`
  cm.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from, head: from + text.length },
  })
  repl.evaluate()
}

function onPianoChord(notes: number[]) {
  const cm = getCm()
  if (!cm) return
  const { from, to } = cm.state.selection.main
  if (from === to) return
  const text = notes.join(' ')
  cm.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from, head: from + text.length },
  })
  selectedNotes.value = notes
  pianoRef.value?.highlightNotes(notes)
  repl.evaluate()
}

onMounted(() => {
  document.addEventListener('selectionchange', syncPiano)
  document.addEventListener('keyup', syncPiano)
  document.addEventListener('mouseup', syncPiano)
})

onUnmounted(() => {
  document.removeEventListener('selectionchange', syncPiano)
  document.removeEventListener('keyup', syncPiano)
  document.removeEventListener('mouseup', syncPiano)
})

defineExpose({ scan })
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Scrollable controls -->
    <div class="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-3">
      <template v-if="parsed">
        <Accordion
          v-if="parsed.globals.length || parsed.groups.length"
          v-model:value="openPanels"
          multiple
        >
          <!-- Global params -->
          <AccordionPanel v-if="parsed.globals.length" value="global">
            <AccordionHeader>
              <span class="text-sm font-mono text-orchid-300">Global</span>
            </AccordionHeader>
            <AccordionContent>
              <ControlsGroup
                :params="parsed.globals"
                @param-change="onParamChange"
                @range-change="onRangeChange"
                @toggle-param="onToggleParam"
              />
            </AccordionContent>
          </AccordionPanel>

          <!-- Voice groups -->
          <AccordionPanel
            v-for="group in parsed.groups"
            :key="group.sound"
            :value="group.sound"
            :class="{ 'opacity-40': group.muted }"
            class="transition-opacity"
          >
            <AccordionHeader>
              <div class="flex items-center gap-2 w-full">
                <span class="text-sm font-mono text-orchid-300 flex-1">{{ group.sound }}</span>
                <button
                  class="w-6 h-6 flex items-center justify-center rounded transition-colors"
                  :class="group.muted ? 'bg-magenta-800 text-magenta-200' : 'bg-navy-800 text-navy-400 hover:text-navy-200'"
                  :title="group.muted ? 'Unmute' : 'Mute'"
                  @click.stop="onMuteVoice(group)"
                >
                  <!-- sound-off -->
                  <svg v-if="group.muted" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="m21.707 20.293l-2.023-2.023A9.566 9.566 0 0 0 21.999 12c0-4.091-2.472-7.453-5.999-9v2c2.387 1.386 3.999 4.047 3.999 7a8.113 8.113 0 0 1-1.672 4.913l-1.285-1.285C17.644 14.536 18 13.19 18 12c0-1.771-.775-3.9-2-5v7.586l-2-2V4a1 1 0 0 0-1.554-.832L7.727 6.313l-4.02-4.02l-1.414 1.414l18 18zM12 5.868v4.718L9.169 7.755zM4 17h2.697l5.748 3.832a1.004 1.004 0 0 0 1.027.05A1 1 0 0 0 14 20v-1.879l-2-2v2.011l-4.445-2.964c-.025-.017-.056-.02-.082-.033a.986.986 0 0 0-.382-.116C7.059 15.016 7.032 15 7 15H4V9h.879L3.102 7.223A1.995 1.995 0 0 0 2 9v6c0 1.103.897 2 2 2"/></svg>
                  <!-- sound-on -->
                  <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M16 21c3.527-1.547 5.999-4.909 5.999-9S19.527 4.547 16 3v2c2.387 1.386 3.999 4.047 3.999 7S18.387 17.614 16 19z"/><path fill="currentColor" d="M16 7v10c1.225-1.1 2-3.229 2-5s-.775-3.9-2-5M4 17h2.697l5.748 3.832a1.004 1.004 0 0 0 1.027.05A1 1 0 0 0 14 20V4a1 1 0 0 0-1.554-.832L6.697 7H4c-1.103 0-2 .897-2 2v6c0 1.103.897 2 2 2m0-8h3c.033 0 .061-.016.093-.019a1.027 1.027 0 0 0 .38-.116c.026-.015.057-.017.082-.033L12 5.868v12.264l-4.445-2.964c-.025-.017-.056-.02-.082-.033a.986.986 0 0 0-.382-.116C7.059 15.016 7.032 15 7 15H4z"/></svg>
                </button>
              </div>
            </AccordionHeader>
            <AccordionContent>
              <ControlsGroup
                :params="group.params"
                @param-change="onParamChange"
                @range-change="onRangeChange"
                @toggle-param="onToggleParam"
              />
            </AccordionContent>
          </AccordionPanel>
        </Accordion>

        <p
          v-if="
            !parsed.globals.length &&
            !parsed.groups.length &&
            !parsed.drums.length
          "
          class="text-navy-400 text-sm"
        >
          No numeric params detected. Try .room(2), .gain(0.5), etc.
        </p>
      </template>
    </div>

    <!-- Instruments (sticky bottom) -->
    <div class="border-t border-navy-800 p-3 flex-shrink-0">
      <!-- Instrument panels (conditional) -->
      <div v-if="showPiano || showDrums" class="flex gap-4 items-end mb-3">
        <div v-if="showPiano" class="flex-1 min-w-0">
          <ControlsPiano
            ref="pianoRef"
            :low-note="48"
            :high-note="83"
            mode="button"
            @change="onPianoChange"
            @chord="onPianoChord"
          />
        </div>
        <div v-if="showDrums" class="flex-shrink-0">
          <ControlsDrumPad @hit="onDrumHit" @combo="onDrumCombo" />
        </div>
      </div>

      <!-- Toggle bar -->
      <div class="flex gap-2">
        <button
          class="text-xs font-mono px-2 py-1 rounded transition-colors"
          :class="
            showPiano
              ? 'bg-magenta-500 text-white'
              : 'bg-navy-800 text-navy-400 hover:text-navy-200'
          "
          @click="toggleInstrument('piano')"
        >
          Piano
        </button>
        <button
          class="text-xs font-mono px-2 py-1 rounded transition-colors"
          :class="
            showDrums
              ? 'bg-magenta-500 text-white'
              : 'bg-navy-800 text-navy-400 hover:text-navy-200'
          "
          @click="toggleInstrument('drums')"
        >
          Drums
        </button>
      </div>
    </div>
  </div>
</template>
