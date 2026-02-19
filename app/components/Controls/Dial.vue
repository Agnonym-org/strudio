<script setup lang="ts">
import { formatValue } from '~/composables/useStrudelParser'

const props = withDefaults(defineProps<{
  label?: string
  min?: number
  max?: number
  step?: number
  modelValue?: number
}>(), {
  label: '',
  min: 0,
  max: 1,
  step: 0.01,
  modelValue: 0,
})

const displayValue = computed(() => formatValue(props.modelValue, props.step))

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
    e.preventDefault()
    emit('update:modelValue', Math.min(props.max, +(props.modelValue + props.step).toFixed(10)))
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
    e.preventDefault()
    emit('update:modelValue', Math.max(props.min, +(props.modelValue - props.step).toFixed(10)))
  }
}
</script>

<template>
  <div
    class="flex flex-col items-center gap-1 focus:outline-none"
    tabindex="0"
    @keydown="onKeyDown"
    @mouseenter="($event.currentTarget as HTMLElement).focus()"
    @mouseleave="($event.currentTarget as HTMLElement).blur()"
  >
    <Knob
      :model-value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      :size="60"
      :stroke-width="14"
      :show-value="false"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <span class="text-xs text-orchid-400 truncate max-w-[80px]">{{ label }}</span>
    <span class="text-xs text-orchid-200 font-mono">{{ displayValue }}</span>
  </div>
</template>
