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
  // These are native DOM properties (not Vue-reactive), so we use a polling watcher.
  let strudelMirror: any = null
  let cmInstance: any = null
  let pollTimer: ReturnType<typeof setInterval> | null = null

  function startPolling() {
    stopPolling()
    isReady.value = false
    pollTimer = setInterval(() => {
      strudelMirror = (editorEl.value as any)?.editor ?? null
      cmInstance = strudelMirror?.editor ?? null
      if (cmInstance) {
        isReady.value = true
        stopPolling()
      }
    }, 100)
  }

  function stopPolling() {
    if (pollTimer != null) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  // Start polling immediately, and restart when editorEl changes (HMR, mode switch)
  startPolling()
  watch(editorEl, () => startPolling())
  onUnmounted(() => stopPolling())

  function getCode(): string {
    return cmInstance?.state.doc.toString() ?? ''
  }

  async function evaluate() {
    if (draftMode.value) {
      hasDraftChanges.value = true
      return
    }
    await strudelMirror?.evaluate()
    isPlaying.value = true
  }

  function stop() {
    strudelMirror?.repl?.stop()
    isPlaying.value = false
  }

  function replaceValue(from: number, to: number, newValue: string) {
    cmInstance?.dispatch({
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
    await strudelMirror?.evaluate()
    isPlaying.value = true
  }

  function discardDraft() {
    if (draftSnapshot.value != null) {
      const snapshot = draftSnapshot.value
      cmInstance?.dispatch({
        changes: { from: 0, to: cmInstance.state.doc.length, insert: snapshot },
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
