<script setup lang="ts">
const props = withDefaults(defineProps<{
  label?: string
  modelValue?: string
}>(), {
  label: '',
  modelValue: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const localValue = ref(props.modelValue)

watch(() => props.modelValue, (v) => { localValue.value = v })

function commit() {
  if (localValue.value !== props.modelValue) {
    emit('update:modelValue', localValue.value)
  }
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <span class="text-xs text-orchid-400 truncate max-w-[120px]">{{ label }}</span>
    <input
      v-model="localValue"
      type="text"
      class="bg-navy-800 text-orchid-200 text-xs font-mono px-2 py-1 rounded border border-navy-700 focus:border-orchid-500 focus:outline-none w-28"
      @keydown.enter="commit"
      @blur="commit"
    >
  </div>
</template>
