<script setup lang="ts">
import type { ParsedParam } from '~/composables/useStrudelParser'

const props = defineProps<{
  params: ParsedParam[]
}>()

const emit = defineEmits<{
  paramChange: [param: ParsedParam, value: number]
  rangeChange: [param: ParsedParam, values: [number, number]]
  toggleParam: [param: ParsedParam]
}>()

const layout = computed(() => {
  const loose: ParsedParam[] = []
  const blocks = new Map<string, ParsedParam[]>()

  for (const p of props.params) {
    if (p.block) {
      if (!blocks.has(p.block)) blocks.set(p.block, [])
      blocks.get(p.block)!.push(p)
    } else {
      loose.push(p)
    }
  }

  return { loose, blocks }
})
</script>

<template>
  <div>
    <!-- Loose params (no block) -->
    <div v-if="layout.loose.length" class="flex flex-wrap gap-3 mb-3">
      <template v-for="param in layout.loose" :key="param.name + param.valueFrom">
        <div class="relative group/param" :class="{ 'opacity-30': param.disabled }">
          <button
            class="absolute -top-1 -right-1 z-10 text-[9px] w-3.5 h-3.5 rounded-full bg-navy-800 text-navy-400 hover:bg-navy-700 hover:text-navy-200 opacity-0 group-hover/param:opacity-100 transition-opacity flex items-center justify-center"
            :title="param.disabled ? 'Enable' : 'Disable'"
            @click="emit('toggleParam', param)"
          >
            {{ param.disabled ? '+' : '−' }}
          </button>
          <ControlsDial
            v-if="param.config.widget === 'dial'"
            :label="param.config.label || param.name"
            :min="param.config.min"
            :max="param.config.max"
            :step="param.config.step"
            :model-value="param.value"
            @update:model-value="emit('paramChange', param, $event)"
          />
          <ControlsSlider
            v-if="param.config.widget === 'slider'"
            :label="param.config.label || param.name"
            :min="param.config.min"
            :max="param.config.max"
            :step="param.config.step"
            :model-value="param.value"
            @update:model-value="emit('paramChange', param, $event)"
          />
          <ControlsRangeSlider
            v-if="param.config.widget === 'range'"
            :label="param.config.label || param.name"
            :min="param.config.min"
            :max="param.config.max"
            :step="param.config.step"
            :model-value="[param.value, param.value2 ?? param.value]"
            @update:model-value="emit('rangeChange', param, $event)"
          />
        </div>
      </template>
    </div>

    <!-- Block sub-groups -->
    <div v-if="layout.blocks.size" class="flex flex-wrap gap-2">
      <div
        v-for="[blockName, blockParams] in layout.blocks"
        :key="blockName"
        class="border border-navy-700 rounded p-2"
      >
        <h4 class="text-xs font-mono text-orchid-400/60 mb-2">{{ blockName }}</h4>
        <div class="flex flex-wrap gap-3">
          <template v-for="param in blockParams" :key="param.name + param.valueFrom">
            <div class="relative group/param" :class="{ 'opacity-30': param.disabled }">
              <button
                class="absolute -top-1 -right-1 z-10 text-[9px] w-3.5 h-3.5 rounded-full bg-navy-800 text-navy-400 hover:bg-navy-700 hover:text-navy-200 opacity-0 group-hover/param:opacity-100 transition-opacity flex items-center justify-center"
                :title="param.disabled ? 'Enable' : 'Disable'"
                @click="emit('toggleParam', param)"
              >
                {{ param.disabled ? '+' : '−' }}
              </button>
              <ControlsDial
                v-if="param.config.widget === 'dial'"
                :label="param.config.label || param.name"
                :min="param.config.min"
                :max="param.config.max"
                :step="param.config.step"
                :model-value="param.value"
                @update:model-value="emit('paramChange', param, $event)"
              />
              <ControlsSlider
                v-if="param.config.widget === 'slider'"
                :label="param.config.label || param.name"
                :min="param.config.min"
                :max="param.config.max"
                :step="param.config.step"
                :model-value="param.value"
                @update:model-value="emit('paramChange', param, $event)"
              />
              <ControlsRangeSlider
                v-if="param.config.widget === 'range'"
                :label="param.config.label || param.name"
                :min="param.config.min"
                :max="param.config.max"
                :step="param.config.step"
                :model-value="[param.value, param.value2 ?? param.value]"
                @update:model-value="emit('rangeChange', param, $event)"
              />
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
