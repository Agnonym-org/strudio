<template>
  <div class="h-screen flex flex-col bg-navy-950 text-white overflow-hidden">
    <slot name="toolbar" />
    <Splitter class="flex-1 min-h-0 !border-0 !bg-transparent">
      <SplitterPanel :size="40" :min-size="20" class="min-h-0 overflow-auto">
        <slot name="editor" />
      </SplitterPanel>
      <SplitterPanel :size="60" :min-size="30" class="min-h-0 overflow-hidden">
        <slot name="panel" />
      </SplitterPanel>
    </Splitter>
  </div>
</template>
