import type { Ref, InjectionKey } from 'vue'

export interface Repl {
  isReady: Ref<boolean>
  isPlaying: Ref<boolean>
  draftMode: Ref<boolean>
  hasDraftChanges: Ref<boolean>
  getCode: () => string
  evaluate: () => Promise<void>
  stop: () => void
  replaceValue: (from: number, to: number, newValue: string) => void
  enterDraft: () => void
  applyDraft: () => Promise<void>
  discardDraft: () => void
}

export const REPL_KEY: InjectionKey<Repl> = Symbol('repl')

export function useRepl(editorEl: Ref<HTMLElement | undefined>): Repl {
  const isReady = ref(false)
  const isPlaying = ref(false)
  const draftMode = ref(false)
  const hasDraftChanges = ref(false)
  const draftSnapshot = ref<string | null>(null)

  // strudel-editor web component: .editor = StrudelMirror, .editor.editor = CodeMirror EditorView
  const strudelMirror = computed(() => (editorEl.value as any)?.editor)
  const cm = computed(() => strudelMirror.value?.editor)

  const interval = setInterval(() => {
    if (cm.value) {
      isReady.value = true
      clearInterval(interval)
    }
  }, 100)

  onUnmounted(() => clearInterval(interval))

  function getCode(): string {
    return cm.value?.state.doc.toString() ?? ''
  }

  async function evaluate() {
    if (draftMode.value) {
      hasDraftChanges.value = true
      return
    }
    await strudelMirror.value?.evaluate()
    isPlaying.value = true
  }

  function stop() {
    strudelMirror.value?.repl?.stop()
    isPlaying.value = false
  }

  function replaceValue(from: number, to: number, newValue: string) {
    cm.value?.dispatch({
      changes: { from, to, insert: newValue },
    })
  }

  function enterDraft() {
    draftSnapshot.value = getCode()
    hasDraftChanges.value = false
    draftMode.value = true
  }

  async function applyDraft() {
    draftMode.value = false
    draftSnapshot.value = null
    hasDraftChanges.value = false
    await strudelMirror.value?.evaluate()
    isPlaying.value = true
  }

  function discardDraft() {
    if (draftSnapshot.value != null) {
      const snapshot = draftSnapshot.value
      cm.value?.dispatch({
        changes: { from: 0, to: cm.value.state.doc.length, insert: snapshot },
      })
    }
    draftMode.value = false
    draftSnapshot.value = null
    hasDraftChanges.value = false
  }

  return {
    isReady, isPlaying, draftMode, hasDraftChanges,
    getCode, evaluate, stop, replaceValue,
    enterDraft, applyDraft, discardDraft,
  }
}
