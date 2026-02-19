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
  if (parsed.value) {
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

// --- Text param change ---

async function onTextChange(param: ParsedParam, newText: string) {
  const lengthDiff = newText.length - (param.valueTo - param.valueFrom)

  repl.replaceValue(param.valueFrom, param.valueTo, newText)

  param.textValue = newText
  param.valueTo = param.valueFrom + newText.length

  shiftPositionsAfter(param.valueFrom, lengthDiff)

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
    const unwrapped = slice.slice(2, -2)
    repl.replaceValue(param.methodFrom, param.methodTo, unwrapped)
    param.disabled = false
    const delta = -4 // removed /* and */
    param.methodTo += delta
    param.valueFrom -= 2
    param.valueTo -= 2
    if (param.value2From != null) {
      param.value2From! -= 2
      param.value2To! -= 2
    }
    shiftPositionsAfter(param.methodFrom, delta)
  } else {
    // Wrap with /* */
    repl.replaceValue(param.methodFrom, param.methodTo, `/*${slice}*/`)
    param.disabled = true
    const delta = 4 // added /* and */
    param.methodTo += delta
    param.valueFrom += 2
    param.valueTo += 2
    if (param.value2From != null) {
      param.value2From! += 2
      param.value2To! += 2
    }
    shiftPositionsAfter(param.methodFrom, delta)
  }

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
      <!-- Getting started guide (before first scan) -->
      <div v-if="!parsed" class="flex flex-col gap-4 text-navy-300 text-sm leading-relaxed">
        <h3 class="text-orchid-300 font-mono text-base">Getting started</h3>
        <ol class="list-decimal list-inside flex flex-col gap-2">
          <li><span class="text-orchid-200">Write</span> your music in the editor using Strudel syntax</li>
          <li>Hit <span class="text-orchid-200">Scan</span> to detect parameters and generate controls</li>
          <li>Press <span class="text-orchid-200">Play</span> <span class="text-navy-500">(Ctrl+Enter)</span> and enjoy</li>
        </ol>
        <div class="border-t border-navy-800 pt-3 flex flex-col gap-2">
          <p class="text-navy-400 text-xs">Tweak knobs, sliders and inputs — the code updates in real-time and the sound follows.</p>
          <p class="text-navy-400 text-xs">Use <span class="text-orchid-400">Draft</span> mode to tweak freely without triggering sound, then <span class="text-orchid-400">Apply</span> all changes at once.</p>
        </div>
      </div>

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
                @text-change="onTextChange"
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
                  <img
                    :src="group.muted ? '/assets/icon/sound-off.svg' : '/assets/icon/sound-on.svg'"
                    :alt="group.muted ? 'Muted' : 'Sound on'"
                    class="w-3.5 h-3.5"
                  >
                </button>
              </div>
            </AccordionHeader>
            <AccordionContent>
              <ControlsGroup
                :params="group.params"
                @param-change="onParamChange"
                @range-change="onRangeChange"
                @text-change="onTextChange"
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
      <div v-if="showPiano || showDrums" class="flex gap-4 items-end mb-3 px-3">
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
