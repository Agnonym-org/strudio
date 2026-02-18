<script setup lang="ts">
import { formatValue } from '~/composables/useStrudelParser'
import PvSlider from 'primevue/slider'

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
</script>

<template>
  <div class="flex flex-col items-center gap-1 min-w-[48px]">
    <span class="text-xs text-orchid-400 truncate max-w-[80px]">{{ label }}</span>
    <PvSlider
      :model-value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      orientation="vertical"
      class="h-24"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <span class="text-xs text-orchid-200 font-mono">{{ displayValue }}</span>
  </div>
</template>
