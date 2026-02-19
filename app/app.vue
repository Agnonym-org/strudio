<script setup lang="ts">
import { REPL_KEY, useRepl } from '~/composables/useRepl'

const editorEl = ref()
const panelRef = ref()
const viewMode = ref<'writer' | 'mix'>('mix')

// Repl composable — shared via provide
const repl = useRepl(editorEl)
provide(REPL_KEY, repl)

// Load strudel web component client-side + register missing controls
onMounted(async () => {
  await import('@strudel/repl/repl-component.mjs')
  // Register controls present in latest Strudel repo but not yet published on npm
  // @ts-expect-error no types for @strudel/core
  const { registerControl } = await import('@strudel/core')
  registerControl('theme')
  registerControl('fontFamily')
})

function onScan() {
  panelRef.value?.scan()
}
</script>

<template>
  <StudioLayout :mode="viewMode">
    <template #toolbar>
      <StudioToolbar :mode="viewMode" @update:mode="viewMode = $event" @scan="onScan" />
    </template>

    <template #editor>
      <strudel-editor ref="editorEl" id="repl">
        <!--
// "acidic tooth" @by eddyflux
// @version 1.0
  setcps(1)
  stack(
    note("[<g1 f1>/8](<3 5>,8)")
    .clip(perlin.range(.15,1.5))
    .release(.1)
    .s("sawtooth")
    .lpf(sine.range(400,800).slow(16))
    .lpq(cosine.range(6,14).slow(3))
    .lpenv(sine.mul(4).slow(4))
    .lpd(.2).lpa(.02)
    .ftype('24db')
    .rarely(add(note(12)))
    .room(.2).shape(.3).postgain(.5)
    .superimpose(x=>x.add(note(12)).delay(.5).bpf(1000))
    .gain("[.2 1@3]*2") // fake sidechain
    ,
    stack(
      s("bd*2").mask("<0@4 1@16>"),
      s("hh*8").gain(saw.mul(saw.fast(2))).clip(sine)
      .mask("<0@8 1@16>")
    ).bank('RolandTR909')
  )
  -->
      </strudel-editor>
    </template>

    <template #panel>
      <ControlsPanel ref="panelRef" />
    </template>
  </StudioLayout>
</template>
