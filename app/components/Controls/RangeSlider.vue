<script setup lang="ts">
import { formatValue } from '~/composables/useStrudelParser'
import PvSlider from 'primevue/slider'

const props = withDefaults(defineProps<{
  label?: string
  min?: number
  max?: number
  step?: number
  modelValue?: [number, number]
}>(), {
  label: '',
  min: 0,
  max: 1,
  step: 0.01,
  modelValue: () => [0, 0],
})

const displayValue = computed(() =>
  `${formatValue(props.modelValue[0], props.step)}–${formatValue(props.modelValue[1], props.step)}`,
)

const emit = defineEmits<{
  'update:modelValue': [value: [number, number]]
}>()

function onKeyDown(e: KeyboardEvent) {
  const [lo, hi] = props.modelValue
  if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
    e.preventDefault()
    emit('update:modelValue', [lo, Math.min(props.max, +(hi + props.step).toFixed(10))])
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
    e.preventDefault()
    emit('update:modelValue', [Math.max(props.min, +(lo - props.step).toFixed(10)), hi])
  }
}
</script>

<template>
  <div
    class="flex flex-col items-center gap-1 min-w-[72px] focus:outline-none"
    tabindex="0"
    @keydown="onKeyDown"
    @mouseenter="($event.currentTarget as HTMLElement).focus()"
    @mouseleave="($event.currentTarget as HTMLElement).blur()"
  >
    <span class="text-xs text-orchid-400 truncate max-w-[80px]">{{ label }}</span>
    <PvSlider
      :model-value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      :range="true"
      orientation="vertical"
      class="h-24"
      @update:model-value="emit('update:modelValue', $event as [number, number])"
    />
    <span class="text-xs text-orchid-200 font-mono">{{ displayValue }}</span>
  </div>
</template>
