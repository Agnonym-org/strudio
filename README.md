# Strudel Studio

A visual live-coding music studio built on top of [Strudel](https://strudel.cc/) with [PrimeVue](https://primevue.org/) controls.

## Concept

Write Strudel code in the embedded REPL, then **scan** the code to auto-generate graphical controls (knobs, faders, drum pads, piano) for every numeric parameter. Tweak values visually — the code updates in real-time.

## Stack

- **Nuxt 4** + **Vue 3** (Composition API, `ssr: false`)
- **Strudel** (`@strudel/web`, `@strudel/repl`) — live-coding music engine
- **PrimeVue** (Nora dark theme) — Knob, vertical Slider, range Slider
- **Tailwind CSS** — styling
- **Acorn** — AST parsing of Strudel code

## Architecture

```
app/
  composables/
    useRepl.ts             # Wraps strudel-editor: evaluate, stop, replaceValue, draft mode
    useStrudelParser.ts    # Parses Strudel code -> controllable params, variables, drum patterns

  components/
    Studio/
      Layout.vue           # Adaptive layout: Compose (editor only) / Mix (editor + controls)
      Toolbar.vue          # Mode toggle, Play, Stop, Scan, Draft/Apply + keyboard shortcuts
    Controls/
      Panel.vue            # Renders groups, instruments (piano, drums), getting started guide
      Group.vue            # Controls grouped by sound/variable, with block sub-groups
      Dial.vue             # PrimeVue Knob (room, pan, delay, orbit...)
      Slider.vue           # PrimeVue vertical Slider (lpf, gain, speed...)
      RangeSlider.vue      # PrimeVue range Slider (lpf range, hpf range...)
      TextInput.vue        # Text input for complex variable expressions (120/4, etc.)
      Piano.vue            # HTML/CSS piano with keyboard shortcuts
      DrumPad.vue          # Drum machine pads with numpad shortcuts

  app.vue                  # Root: provide/inject repl, load strudel client-side
```

## Features

### Layout modes

- **Compose** — full-screen editor for writing code
- **Mix** — split view with editor on the left and controls on the right
- Toggle via icon button in the toolbar; switching to Mix auto-triggers a scan

### Param scanning

Click **Scan** to parse the code and generate controls for all numeric parameters. The parser handles:
- Simple numeric args: `.room(2)`, `.gain(0.5)`
- Range expressions: `.lpf(sine.range(400,800))` -> single dual-handle range slider
- Modifiers: `.slow(16)`, `.fast(2)`, `.mul(4)` -> dedicated controls
- Nested modifiers: `.gain(saw.mul(saw.fast(2)))` -> recursive extraction
- Stack-aware grouping: each voice in a `stack()` gets its own control group

### Variable support

The parser handles `let` / `const` / `var` declarations:
- **Simple numeric** (`let x = 0.5`) -> dial control in the Global section
- **Method chain** (`let lead = s("sawtooth").attack(0.1).decay(.25)`) -> dedicated control group named after the variable
- **Complex expression** (`let cpm = 120/4`) -> editable text input in the Global section
- **Variable references** (`lead.lpf(2000).gain(0.8)`) -> params added to the variable's existing group

### Draft mode

- **Live** (default): every control change updates code and sound immediately
- **Draft**: tweak controls freely — code updates visually but sound doesn't change until you click **Apply**
- **Discard**: revert all draft changes back to the snapshot taken when entering draft mode
- Toggle via toolbar button or `Ctrl+D`

### Block sub-grouping

Complex expressions like `.lpq(cosine.range(6,14).slow(3))` generate a visual block named "LP Resonance" containing min, max, and slow controls together.

### In-place editing

When you change a control, only the numeric value in the source code is replaced. Positions of all other params are shifted mathematically — no re-scan, no widget destruction.

### Param toggle

Disable/enable individual params by wrapping them in block comments (`/*.gain(0.5)*/`). Disabled params appear dimmed and can be re-enabled with one click.

### Voice mute

Mute/unmute individual voices by appending/removing `.gain(0)` at the end of the voice chain.

### Piano

- AZERTY / QWERTY auto-detection (navigator.language + keypress heuristic)
- Musical mapping: A = La (A3), P = Do (C5) — one row of keys
- Shift = sharp (#), Ctrl = flat (b), arrows = octave shift
- **Single note**: select a number in the editor, the key lights up. Press a key to replace.
- **Multi-note compose**: select `36 43 52`, all keys highlight. Click to toggle notes.
- **Chord mode** (Tab): accumulate notes, Tab again to write them all

### Drum pad

- Numpad-style grid: 11 drum sounds (bd, sd, hh, oh, cr, rd, ht, mt, lt, rim, cp)
- Color-coded by category: amber (cymbals), blue (toms), emerald (snare), rose (kick)
- Numpad shortcuts: 0=kick, 1=snare, 2=rim, 3=clap, 4-6=toms, 7=crash, 8=ride, 9=open HH, .=closed HH
- **Combo mode** (Tab): build a `[bd sd hh]` simultaneous group

### Getting started guide

Before the first scan, the control panel displays a short onboarding guide explaining the workflow: Write -> Scan -> Play, with a note about Draft mode.

### Smart instrument visibility

Piano and drum pads are hidden by default. On scan:
- Melodic voices detected -> Piano auto-shown
- Drum patterns detected -> Drum pad auto-shown
- Manual toggle via buttons at the bottom

## Data flow

```
Scan -> parseStrudelCode(code) -> { globals, groups[], drums[] }
                                       |
                          +------------+-------------+
                          v            v             v
                    Group "lead"   Global (cps, x)  drums: [bd, hh]
                     +-- block "LP Res" --+
                     | min  max  slow     |  room  shape
                     +--------------------+
                          |
                     User tweaks knob / text input / piano key
                          |
                          v
              replaceValue(from, to, newStr)
                          |
                          v
                    evaluate() + shift positions
                    (skipped in draft mode)
```

## Keyboard shortcuts

| Shortcut          | Action               |
| ----------------- | -------------------- |
| `Ctrl+Enter`      | Play / Evaluate      |
| `Ctrl+.`          | Stop                 |
| `Ctrl+D`          | Toggle Draft mode    |
| Letter keys       | Piano notes          |
| `Shift+key`       | Sharp (#)            |
| `Ctrl+key`        | Flat (b)             |
| `Arrow Up/Down`   | Octave shift         |
| `Numpad 0-9, .`   | Drum pads            |
| `Tab`             | Chord / Combo mode   |

## Param ranges

Known parameters are mapped to musically useful ranges for mixing:

| Param       | Widget | Range              | Notes                        |
| ----------- | ------ | ------------------ | ---------------------------- |
| `lpf`       | Slider | 100 - 8,000 Hz     | Practical low-pass sweep     |
| `hpf`       | Slider | 20 - 4,000 Hz      | High-pass up to telephone    |
| `bpf`       | Slider | 100 - 6,000 Hz     | Band-pass mid range          |
| `lpq`/`hpq` | Dial  | 0 - 12             | Beyond 12 = auto-oscillation |
| `lpenv`     | Slider | -4,000 - 4,000     | Filter envelope sweep        |
| `gain`      | Slider | 0 - 1.5            | Unity = 1, above = boost     |
| `shape`     | Dial   | 0 - 0.8            | Beyond 0.8 = harsh distortion|
| `attack`    | Slider | 0 - 2s             |                              |
| `decay`     | Slider | 0 - 2s             |                              |
| `sustain`   | Slider | 0 - 1              |                              |
| `release`   | Slider | 0 - 2s             |                              |
| `room`      | Dial   | 0 - 1.5            | Beyond 1.5 = wash            |
| `delay`     | Dial   | 0 - 1              | Wet/dry mix                  |
| `delayfeedback` | Slider | 0 - 0.9        | 1.0 = infinite feedback      |
| `pan`       | Dial   | 0 - 1              | 0 = L, 0.5 = C, 1 = R       |
| `speed`     | Slider | -2 - 2             | Playback speed / pitch       |
| `cps`       | Dial   | 0.1 - 4            | Cycles per second            |

Modifier controls: `slow` / `fast` (Dial, 0.1 - 32), `mul` (Dial, 0 - 10).
Unknown params get a default Dial (0 - 100). Ranges auto-expand if the current value exceeds them.
Variables get auto-detected ranges based on their value type (numeric -> dial, expression -> text input).

## Strudel compatibility

The app registers missing Pattern methods (`theme`, `fontFamily`) not yet published on npm via `registerControl` at startup. This prevents crashes when evaluating code that uses methods from the latest Strudel repo.

## Setup

```bash
yarn install
yarn dev
```
