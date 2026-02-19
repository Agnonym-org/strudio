import { parse } from 'acorn'

// ---- Types ----

export interface ParamConfig {
  min: number
  max: number
  step: number
  widget: 'dial' | 'slider' | 'range' | 'text'
  label: string
}

export interface ParsedParam {
  name: string
  value: number
  valueFrom: number
  valueTo: number
  /** Second value for range params */
  value2?: number
  value2From?: number
  value2To?: number
  methodFrom: number
  methodTo: number
  config: ParamConfig
  textValue?: string
  block?: string
  disabled?: boolean
}

export interface DrumPattern {
  sound: string
  pattern: string
  steps: boolean[]
  patternFrom: number
  patternTo: number
}

export interface ParsedGroup {
  sound: string
  params: ParsedParam[]
  voiceFrom: number
  voiceTo: number
  muted?: boolean
}

export interface ParsedCode {
  globals: ParsedParam[]
  groups: ParsedGroup[]
  drums: DrumPattern[]
}

// ---- Configs ----

const PARAM_CONFIG: Record<string, ParamConfig> = {
  // Filters — usable mix range (ensureRange expands if code value exceeds)
  lpf: { min: 100, max: 8000, step: 10, widget: 'slider', label: 'Low Pass' },
  hpf: { min: 20, max: 4000, step: 10, widget: 'slider', label: 'High Pass' },
  bpf: { min: 100, max: 6000, step: 10, widget: 'slider', label: 'Band Pass' },
  lpq: { min: 0, max: 12, step: 0.1, widget: 'dial', label: 'LP Resonance' },
  hpq: { min: 0, max: 12, step: 0.1, widget: 'dial', label: 'HP Resonance' },
  lpenv: { min: -4000, max: 4000, step: 10, widget: 'slider', label: 'LP Env' },
  lpd: { min: 0, max: 1, step: 0.01, widget: 'dial', label: 'LP Decay' },
  lpa: { min: 0, max: 1, step: 0.01, widget: 'dial', label: 'LP Attack' },
  // Amplitude
  gain: { min: 0, max: 1.5, step: 0.01, widget: 'slider', label: 'Gain' },
  postgain: { min: 0, max: 1.5, step: 0.01, widget: 'slider', label: 'Post Gain' },
  clip: { min: 0, max: 1, step: 0.01, widget: 'slider', label: 'Clip' },
  shape: { min: 0, max: 0.8, step: 0.01, widget: 'dial', label: 'Shape' },
  // Envelope
  attack: { min: 0, max: 2, step: 0.01, widget: 'slider', label: 'Attack' },
  decay: { min: 0, max: 2, step: 0.01, widget: 'slider', label: 'Decay' },
  sustain: { min: 0, max: 1, step: 0.01, widget: 'slider', label: 'Sustain' },
  release: { min: 0, max: 2, step: 0.01, widget: 'slider', label: 'Release' },
  // Distortion
  distort: { min: 0, max: 1, step: 0.01, widget: 'dial', label: 'Distort' },
  crush: { min: 1, max: 16, step: 1, widget: 'dial', label: 'Bit Crush' },
  coarse: { min: 1, max: 32, step: 1, widget: 'dial', label: 'Coarse' },
  // Effects
  room: { min: 0, max: 1.5, step: 0.05, widget: 'dial', label: 'Room' },
  roomsize: { min: 0, max: 1.5, step: 0.05, widget: 'dial', label: 'Room Size' },
  delay: { min: 0, max: 1, step: 0.01, widget: 'dial', label: 'Delay' },
  delaytime: { min: 0, max: 1, step: 0.001, widget: 'slider', label: 'Delay Time' },
  delayfeedback: { min: 0, max: 0.9, step: 0.01, widget: 'slider', label: 'Delay FB' },
  // Routing & playback
  orbit: { min: 0, max: 8, step: 1, widget: 'dial', label: 'Orbit' },
  pan: { min: 0, max: 1, step: 0.01, widget: 'dial', label: 'Pan' },
  speed: { min: -2, max: 2, step: 0.05, widget: 'slider', label: 'Speed' },
  cps: { min: 0.1, max: 4, step: 0.05, widget: 'dial', label: 'CPS' },
  cpm: { min: 20, max: 300, step: 1, widget: 'dial', label: 'CPM' },
}

const MOD_CONFIG: Record<string, ParamConfig> = {
  slow: { min: 0.1, max: 32, step: 0.1, widget: 'dial', label: 'slow' },
  fast: { min: 0.1, max: 32, step: 0.1, widget: 'dial', label: 'fast' },
  mul: { min: 0, max: 10, step: 0.1, widget: 'dial', label: 'mul' },
}

const DEFAULT_CONFIG: ParamConfig = { min: 0, max: 100, step: 0.1, widget: 'dial', label: '' }

function getParamConfig(name: string): ParamConfig {
  return PARAM_CONFIG[name] ?? { ...DEFAULT_CONFIG, label: name }
}

function ensureRange(config: ParamConfig, value: number): ParamConfig {
  if (value >= config.min && value <= config.max) return config
  return {
    ...config,
    min: Math.min(config.min, value < 0 ? value * 1.5 : value * 0.5),
    max: Math.max(config.max, value * 1.5),
  }
}

const SKIP_METHODS = new Set([
  'sound', 's', 'bank', 'stack', 'note', 'n',
  'mask', 'superimpose', 'sometimes', 'rarely', 'often', 'almostNever', 'almostAlways',
  'jux', 'add', 'ftype', 'scale', 'struct', 'euclid', 'rev', 'hush',
  'split', 'pickRestart', 'pick', 'withValue', 'fmap', 'anchor', 'voicing',
  'patt', 'register',
])

export const DRUM_SOUNDS = new Set([
  'bd', 'sd', 'sn', 'hh', 'oh', 'ch', 'cp', 'cy', 'cb', 'rim',
  'clap', 'tom', 'lt', 'mt', 'ht', 'lc', 'mc', 'hc', 'cr', 'rd',
])

export const DEFAULT_STEPS = 8

// ---- AST helpers ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any // acorn node (untyped for brevity)

interface CommentInfo {
  block: boolean
  text: string
  start: number
  end: number
}

interface MethodInfo {
  name: string
  methodFrom: number // position of the `.`
  methodTo: number   // position after the `)`
  args: N[]
}

/** Flatten a.b().c().d() into { head: a, methods: [b, c, d] } */
function flattenChain(node: N, code: string): { head: N; methods: MethodInfo[] } {
  const methods: MethodInfo[] = []
  let cur = node
  while (
    cur.type === 'CallExpression' &&
    cur.callee?.type === 'MemberExpression' &&
    !cur.callee.computed
  ) {
    // Find the actual '.' position by scanning backwards from property start.
    // object.end can be before block comments (/*.foo()*/) that acorn skips,
    // so we must locate the real dot in the source.
    let dotPos = cur.callee.property.start - 1
    while (dotPos > cur.callee.object.end && code.charAt(dotPos) !== '.') dotPos--

    methods.unshift({
      name: cur.callee.property.name,
      methodFrom: dotPos,              // position of `.`
      methodTo: cur.end,               // after closing `)`
      args: cur.arguments,
    })
    cur = cur.callee.object
  }
  return { head: cur, methods }
}

function getCallName(node: N): string | null {
  if (node.type === 'CallExpression' && node.callee?.type === 'Identifier') {
    return node.callee.name
  }
  return null
}

function isNumericLiteral(node: N): boolean {
  if (node.type === 'Literal' && typeof node.value === 'number') return true
  if (node.type === 'UnaryExpression' && node.operator === '-' &&
    node.argument?.type === 'Literal' && typeof node.argument.value === 'number') return true
  return false
}

function numericValue(node: N): number {
  if (node.type === 'Literal') return node.value as number
  if (node.type === 'UnaryExpression' && node.operator === '-')
    return -(node.argument.value as number)
  return 0
}

// ---- Arg analysis (AST-based, recursive) ----

function analyzeArg(
  parentName: string,
  argNode: N,
  methodFrom: number,
  methodTo: number,
  params: ParsedParam[],
  code: string,
  block?: string,
) {
  // Simple numeric literal
  if (isNumericLiteral(argNode)) {
    const config = getParamConfig(parentName)
    const value = numericValue(argNode)
    params.push({
      name: parentName, value,
      valueFrom: argNode.start,
      valueTo: argNode.end,
      methodFrom, methodTo,
      config: ensureRange(config, value),
      block,
    })
    return
  }

  // Complex expression: flatten and look for .range(), .slow(), etc.
  const { methods: subMethods } = flattenChain(argNode, code)
  const parentConfig = getParamConfig(parentName)
  const parentLabel = parentConfig.label || parentName
  const blockLabel = block || parentLabel

  let handled = false
  for (const sub of subMethods) {
    if (sub.name === 'range' && sub.args.length === 2) {
      const [minNode, maxNode] = sub.args
      if (isNumericLiteral(minNode) && isNumericLiteral(maxNode)) {
        const minVal = numericValue(minNode)
        const maxVal = numericValue(maxNode)
        let rangeConfig: ParamConfig = { ...parentConfig, widget: 'range', label: parentLabel }
        rangeConfig = ensureRange(rangeConfig, minVal)
        rangeConfig = ensureRange(rangeConfig, maxVal)
        params.push({
          name: `${parentName} range`, value: minVal,
          valueFrom: minNode.start, valueTo: minNode.end,
          value2: maxVal,
          value2From: maxNode.start, value2To: maxNode.end,
          methodFrom, methodTo,
          config: rangeConfig,
          block: blockLabel,
        })
        handled = true
      }
    } else if (sub.name === 'slow' || sub.name === 'fast' || sub.name === 'mul') {
      if (sub.args.length === 1 && isNumericLiteral(sub.args[0])) {
        const value = numericValue(sub.args[0])
        const modConfig = MOD_CONFIG[sub.name] ?? DEFAULT_CONFIG
        params.push({
          name: `${parentName} ${sub.name}`, value,
          valueFrom: sub.args[0].start, valueTo: sub.args[0].end,
          methodFrom, methodTo,
          config: ensureRange({ ...modConfig, label: sub.name }, value),
          block: blockLabel,
        })
        handled = true
      } else if (sub.args.length === 1) {
        // Recurse for complex modifier args (e.g. saw.fast(2) inside .mul())
        analyzeArg(`${parentName} ${sub.name}`, sub.args[0], methodFrom, methodTo, params, code, blockLabel)
        handled = true
      }
    }
  }

  // Fallback: unrecognized expression → text input (e.g. 120/4, x*2+1)
  // Skip variable refs, strings, template literals, arrays — not useful as editable params
  const SKIP_ARG_TYPES = new Set(['Identifier', 'TemplateLiteral', 'TaggedTemplateExpression', 'ArrayExpression', 'MemberExpression'])
  if (!handled && subMethods.length === 0 && !SKIP_ARG_TYPES.has(argNode.type)) {
    const rawText = code.slice(argNode.start, argNode.end)
    params.push({
      name: parentName, value: 0,
      textValue: rawText,
      valueFrom: argNode.start,
      valueTo: argNode.end,
      methodFrom, methodTo,
      config: { ...parentConfig, widget: 'text' as const, label: parentLabel },
      block,
    })
  }
}

// ---- Sound / Bank detection ----

function findSoundFromChain(head: N, methods: MethodInfo[]): string {
  const headName = getCallName(head)
  if ((headName === 's' || headName === 'sound') && head.arguments?.[0]?.type === 'Literal') {
    return String(head.arguments[0].value)
  }
  for (const m of methods) {
    if ((m.name === 's' || m.name === 'sound') && m.args[0]?.type === 'Literal') {
      return String(m.args[0].value)
    }
  }
  return 'default'
}

function findBankFromChain(methods: MethodInfo[]): string | null {
  for (const m of methods) {
    if (m.name === 'bank' && m.args[0]?.type === 'Literal') {
      return String(m.args[0].value)
    }
  }
  return null
}

// ---- Drum pattern parsing ----

function parseDrumPattern(pattern: string): { sounds: string[]; steps: Map<string, boolean[]> } | null {
  const tokens: string[] = []
  for (const token of pattern.split(/\s+/)) {
    const repeatMatch = /^(\w+)\*(\d+)$/.exec(token)
    if (repeatMatch && repeatMatch[1] && repeatMatch[2]) {
      const count = parseInt(repeatMatch[2])
      for (let i = 0; i < count; i++) tokens.push(repeatMatch[1])
    } else {
      tokens.push(token)
    }
  }
  const sounds = new Set<string>()
  for (const t of tokens) {
    if (DRUM_SOUNDS.has(t)) sounds.add(t)
  }
  if (sounds.size === 0) return null
  const stepCount = Math.max(tokens.length, DEFAULT_STEPS)
  const result = new Map<string, boolean[]>()
  for (const sound of sounds) {
    result.set(sound, new Array(stepCount).fill(false))
  }
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t && result.has(t)) result.get(t)![i] = true
  }
  return { sounds: [...sounds], steps: result }
}

export function stepsToMiniNotation(sound: string, steps: boolean[], totalSteps: number): string {
  const tokens: string[] = []
  for (let i = 0; i < totalSteps; i++) tokens.push(steps[i] ? sound : '~')
  return tokens.join(' ')
}

function extractDrums(head: N): DrumPattern[] {
  const headName = getCallName(head)
  if (headName !== 's' && headName !== 'sound') return []
  const arg = head.arguments?.[0]
  if (!arg || arg.type !== 'Literal' || typeof arg.value !== 'string') return []
  const pattern = arg.value as string
  const parsed = parseDrumPattern(pattern)
  if (!parsed) return []
  const patternFrom = arg.start + 1 // skip opening quote
  const patternTo = arg.end - 1     // skip closing quote
  const drums: DrumPattern[] = []
  for (const [sound, steps] of parsed.steps) {
    drums.push({ sound, pattern, steps, patternFrom, patternTo })
  }
  return drums
}

// ---- Voice extraction ----

interface VoiceInfo {
  node: N
  bankSuffix?: string
}

function extractVoices(expr: N, code: string): VoiceInfo[] {
  const { head, methods } = flattenChain(expr, code)
  const headName = getCallName(head)

  if (headName === 'stack' && head.arguments?.length > 0) {
    const bank = findBankFromChain(methods)
    const voices: VoiceInfo[] = []
    for (const arg of head.arguments) {
      const nested = extractVoices(arg, code)
      if (nested.length > 0) {
        for (const v of nested) {
          if (!v.bankSuffix && bank) v.bankSuffix = bank
          voices.push(v)
        }
      } else {
        voices.push({ node: arg, bankSuffix: bank || undefined })
      }
    }
    return voices
  }

  return [] // not a stack — caller handles as single voice
}

// ---- Recursive method param extraction ----

/** Extract params from methods, recursing into arrow function callbacks */
function extractMethodParams(
  methods: MethodInfo[],
  params: ParsedParam[],
  drums: DrumPattern[],
  code: string,
  block?: string,
) {
  for (const m of methods) {
    // layer(fn1, fn2) → each arrow fn becomes a named sub-block
    if (m.name === 'layer') {
      for (let li = 0; li < m.args.length; li++) {
        const layerArg = m.args[li]
        if (layerArg?.type !== 'ArrowFunctionExpression') continue
        const { head: lHead, methods: lMethods } = flattenChain(layerArg.body, code)
        const lSound = findSoundFromChain(lHead, lMethods)
        const blockName = lSound !== 'default' ? lSound : `layer ${li + 1}`
        drums.push(...extractDrums(lHead))
        extractMethodParams(lMethods, params, drums, code, blockName)
      }
      continue
    }

    // Normal param extraction
    if (!SKIP_METHODS.has(m.name) && m.args.length >= 1) {
      analyzeArg(m.name, m.args[0], m.methodFrom, m.methodTo, params, code, block)
    }

    // Recurse into arrow function arguments (split, superimpose, etc.)
    for (const arg of m.args) {
      if (arg.type === 'ArrowFunctionExpression') {
        const { head: cbHead, methods: cbMethods } = flattenChain(arg.body, code)
        drums.push(...extractDrums(cbHead))
        extractMethodParams(cbMethods, params, drums, code, block)
      }
    }
  }
}

// ---- Parse a single voice ----

function parseVoiceNode(
  voiceNode: N,
  code: string,
  comments: CommentInfo[],
  bankSuffix?: string,
): { group: ParsedGroup; drums: DrumPattern[] } {
  const { head, methods } = flattenChain(voiceNode, code)

  // Check for mute marker: trailing .gain(0)
  let muted = false
  const lastMethod = methods[methods.length - 1]
  if (
    lastMethod?.name === 'gain' &&
    lastMethod.args.length === 1 &&
    isNumericLiteral(lastMethod.args[0]) &&
    numericValue(lastMethod.args[0]) === 0
  ) {
    muted = true
    methods.pop() // exclude .gain(0) from params
  }

  // Sound / bank
  let sound = findSoundFromChain(head, methods)
  const bank = findBankFromChain(methods)
  if (bank) sound = sound !== 'default' ? `${sound} (${bank})` : bank
  else if (bankSuffix) sound = sound !== 'default' ? `${sound} (${bankSuffix})` : bankSuffix

  // Extract params from method chain (recursing into arrow function callbacks)
  const params: ParsedParam[] = []
  const callbackDrums: DrumPattern[] = []
  extractMethodParams(methods, params, callbackDrums, code)

  // Extract disabled params from block comments within voice range
  const voiceComments = comments.filter(
    c => c.block && c.start >= voiceNode.start && c.end <= voiceNode.end + 10,
  )
  for (const comment of voiceComments) {
    const content = comment.text.trim()
    if (content === '@m') continue
    const dm = /^\.(\w+)\((.+)\)$/.exec(content)
    if (!dm || !dm[1] || !dm[2]) continue
    const methodName = dm[1]
    if (SKIP_METHODS.has(methodName)) continue
    const argStr = dm[2].trim()
    const numMatch = /^(-?\d*\.?\d+)$/.exec(argStr)
    if (numMatch && numMatch[1]) {
      const value = parseFloat(numMatch[1])
      const config = getParamConfig(methodName)
      const contentStart = comment.start + 2 // after /*
      const valIdx = comment.text.indexOf(numMatch[1])
      params.push({
        name: methodName, value,
        valueFrom: contentStart + valIdx,
        valueTo: contentStart + valIdx + numMatch[1].length,
        methodFrom: comment.start,
        methodTo: comment.end,
        config: ensureRange(config, value),
        disabled: true,
      })
    }
  }

  // Extract drums
  const drums = [...extractDrums(head), ...callbackDrums]

  return {
    group: {
      sound, params,
      voiceFrom: voiceNode.start,
      voiceTo: voiceNode.end,
      muted,
    },
    drums,
  }
}

// ---- Main ----

export function parseStrudelCode(code: string): ParsedCode {
  const comments: CommentInfo[] = []
  let ast: N
  try {
    ast = parse(code, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      onComment(block: boolean, text: string, start: number, end: number) {
        comments.push({ block, text, start, end })
      },
    })
  } catch {
    return { globals: [], groups: [], drums: [] }
  }

  const globals: ParsedParam[] = []
  const groups: ParsedGroup[] = []
  const drums: DrumPattern[] = []
  const varGroups = new Map<string, ParsedGroup>()

  for (let stmt of ast.body) {
    // Capture label name before unwrapping (gtr:, vox:, p1:, etc.)
    let stmtLabel: string | null = null
    if (stmt.type === 'LabeledStatement') {
      stmtLabel = stmt.label.name
    }
    while (stmt.type === 'LabeledStatement') stmt = stmt.body

    // --- VariableDeclaration: let/const/var ---
    if (stmt.type === 'VariableDeclaration') {
      for (const decl of stmt.declarations) {
        if (!decl.init || decl.id?.type !== 'Identifier') continue
        const varName: string = decl.id.name
        const init = decl.init

        // Simple numeric → global param (dial)
        if (isNumericLiteral(init)) {
          const value = numericValue(init)
          const config: ParamConfig = {
            min: 0,
            max: Math.max(100, value * 2),
            step: value % 1 === 0 ? 1 : 0.01,
            widget: 'dial',
            label: varName,
          }
          globals.push({
            name: varName, value,
            valueFrom: init.start, valueTo: init.end,
            methodFrom: stmt.start, methodTo: stmt.end,
            config: ensureRange(config, value),
          })
          continue
        }

        // Method chain → treat as a voice
        const { methods } = flattenChain(init, code)
        if (methods.length > 0) {
          const result = parseVoiceNode(init, code, comments)
          result.group.sound = varName
          varGroups.set(varName, result.group)
          if (result.group.params.length > 0 || result.drums.length > 0) {
            groups.push(result.group)
          }
          drums.push(...result.drums)
          continue
        }

        // Complex expression → global param (text input)
        globals.push({
          name: varName, value: 0,
          textValue: code.slice(init.start, init.end),
          valueFrom: init.start, valueTo: init.end,
          methodFrom: stmt.start, methodTo: stmt.end,
          config: { min: 0, max: 100, step: 0.1, widget: 'text' as const, label: varName },
        })
      }
      continue
    }

    // --- ExpressionStatement ---
    if (stmt.type !== 'ExpressionStatement') continue
    const expr = stmt.expression

    // Variable reference: varName.method1().method2()
    const exprChain = flattenChain(expr, code)
    if (exprChain.head.type === 'Identifier' && varGroups.has(exprChain.head.name)) {
      const existingGroup = varGroups.get(exprChain.head.name)!
      for (const m of exprChain.methods) {
        if (SKIP_METHODS.has(m.name)) continue
        if (m.args.length >= 1) {
          analyzeArg(m.name, m.args[0], m.methodFrom, m.methodTo, existingGroup.params, code)
        }
      }
      existingGroup.voiceTo = Math.max(existingGroup.voiceTo, expr.end)
      if (!groups.includes(existingGroup) && existingGroup.params.length > 0) {
        groups.push(existingGroup)
      }
      continue
    }

    // all(x => x.room(.3).delay(.2)) → global params
    if (getCallName(expr) === 'all' && expr.arguments?.length >= 1) {
      const allArg = expr.arguments[0]
      if (allArg.type === 'ArrowFunctionExpression') {
        const { methods: allMethods } = flattenChain(allArg.body, code)
        for (const m of allMethods) {
          if (SKIP_METHODS.has(m.name)) continue
          if (m.args.length >= 1) {
            analyzeArg(m.name, m.args[0], m.methodFrom, m.methodTo, globals, code)
          }
        }
      }
      continue
    }

    // setcps(N) / setcpm(N) → global
    const callName = getCallName(expr)
    if ((callName === 'setcps' || callName === 'setcpm') && expr.arguments?.length === 1) {
      const arg = expr.arguments[0]
      const paramName = callName === 'setcpm' ? 'cpm' : 'cps'
      if (isNumericLiteral(arg)) {
        const config = paramName === 'cpm'
          ? { min: 20, max: 300, step: 1, widget: 'dial' as const, label: 'CPM' }
          : getParamConfig('cps')
        globals.push({
          name: paramName,
          value: numericValue(arg),
          valueFrom: arg.start,
          valueTo: arg.end,
          methodFrom: expr.start,
          methodTo: expr.end,
          config,
        })
      }
      continue
    }

    // Try to split into voices via stack()
    const voices = extractVoices(expr, code)
    if (voices.length > 0) {
      // Extract outer methods on the stack itself → globals (e.g. stack(...).cpm(120).room(0.3))
      const { methods: outerMethods } = flattenChain(expr, code)
      const outerParams: ParsedParam[] = []
      const outerDrums: DrumPattern[] = []
      extractMethodParams(outerMethods, outerParams, outerDrums, code)
      globals.push(...outerParams)
      drums.push(...outerDrums)

      for (const voice of voices) {
        const result = parseVoiceNode(voice.node, code, comments, voice.bankSuffix)
        if (stmtLabel) result.group.sound = stmtLabel
        if (result.group.params.length > 0 || result.drums.length > 0) {
          groups.push(result.group)
        }
        drums.push(...result.drums)
      }
    } else {
      // No stack — treat the expression as a single voice
      const result = parseVoiceNode(expr, code, comments)
      if (stmtLabel) result.group.sound = stmtLabel
      if (result.group.params.length > 0 || result.drums.length > 0) {
        groups.push(result.group)
      }
      drums.push(...result.drums)
    }
  }

  // Uniform naming: "Pattern 1", "Pattern 2 · gm_choir_aahs", ...
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i]!
    g.sound = g.sound === 'default'
      ? `Pattern ${i + 1}`
      : `Pattern ${i + 1} · ${g.sound}`
  }

  return { globals, groups, drums }
}

export function formatValue(value: number, step: number): string {
  if (step >= 1) return String(Math.round(value))
  const decimals = Math.max(0, -Math.floor(Math.log10(step)))
  return parseFloat(value.toFixed(decimals)).toString()
}
