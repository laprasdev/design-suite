# design-suite

The component kinds and design language shared by Bloom's Unity synth, the web synth and the baseball apps.

## Model

A rendered control is resolved from four independent choices, in this order:

| Choice | Meaning | Examples |
|---|---|---|
| Kind | The component, chosen by the data it edits | MultiChoice, Knob, Slider, ActionBar |
| Form | A named variant of a kind | text, joined, icons, tabs, pills |
| Theme | The general structure | flat, cutout |
| Skin | The palette | bloom, serum, analog |

`WidgetInteractionStatus` variants apply last.

A surface can set the form of what's inside it: a `SegmentedControl` in an `ActionBar` takes the text form on its own, and `compact` gives a second-level bar its smaller size. A control's own props still win.

## Catalog

`catalog/` records which source implements each kind. `kinds.json` is the hand-kept map and `scan.mjs` reads the sources statically, so Unity never has to run. `build.mjs` writes `catalog.json` and exits non-zero if the map names something the sources lack.

```sh
git -C ../baseball archive origin/dev packages src | tar -x -C /tmp/bb
BASEBALL_ROOT=/tmp/bb node catalog/build.mjs
```

## Package

This repo publishes `@looms/bloom-design`. Consumers pin a commit of this repo, and the `prepare` script builds `dist` on install.

**Rule: after pushing to `main`, update every consumer in the same pass.** Baseball pins a commit, so open a pull request there:

```sh
npm install --no-audit --no-fund "git+https://github.com/laprasdev/design-suite.git#$(git -C ../design-suite rev-parse origin/main)"
```

The web synth reads a local checkout and needs no update. Unity pins a commit of this repo's `unity/` folder through `?path=/unity`.

## Skins

Skins are data. `unity/Runtime/Resources/SharedSchema/Design/Synth` holds the base skin, the skins and the design tokens, and this repo is where they're edited. Unity reads those files through `Resources`, and web consumers import them from `@looms/bloom-design/skins`. The highest `meta.priority` is the default on every platform, and `meta.label` makes a skin selectable.

`SynthDesignTokens.json` is the one exception: `com.bloom.state-machine` still exports it from C# when its Editor runs with this package checked out locally.

## Use

Consumers install this package plus React, and import compiled ESM.

```jsx
import {createTheme} from '@looms/bloom-design';
import {Button,Modal} from '@looms/bloom-design/react';
import '@looms/bloom-design/react/styles.css';
```

`createTheme` returns data without touching the document, and `applyTheme` writes it to CSS variables. `src/synth` holds the web synth's controls, which read their colors through `StyleProvider`.

## Entrypoints

| Import | Contents |
| --- | --- |
| `@looms/bloom-design` | Tokens, layout constants, colors and `createTheme`; no React |
| `/tokens`, `/layout`, `/color`, `/theme`, `/skins` | Focused framework-independent APIs |
| `/react` | Composed controls: bars, segmented controls, dialogs, portraits, node graphs and the shared kinds |
| `/modal-room` | Dialog growth and measurement contract |
| `/react/styles.css` | All component styles; import once |
| `/synth/*` | The web synth's controls and design layer, as source |

## Pages and dialogs

Browsing and editing flows occupy pages. `Crossfade`'s page form takes a controlled
`readonly StackView[]`, using the same `{key, node}` entries as `ViewStack`:

```tsx
<Crossfade form="page" views={pages} className="workspace-pages" focusRef={headingRef}/>
```

The last entry is visible. Push by appending an entry: its page enters from the
right while the previous page leaves left and fades. Back removes entries and
reverses that motion. Replacing an unrelated page fades in place. Stable keys
retain their React mounts, form state and scroll positions; inactive pages are
hidden and inert. Back restores the retained page's focused control. The optional
`focusRef` names a destination heading or control; otherwise the page takes focus.
Reduced motion settles immediately, and a new navigation cancels the old motion.

Keep the fixed header and footer outside the moving page body. The exported page
motion helpers also support stationary chrome within a composed page; applications
name those regions. The consumer owns routes, push/Back controls, guards and the
retained entries' lifetime. Removing an entry unmounts it. The existing
`<Crossfade view={key}>{content}</Crossfade>` keeps its compact fade behavior.

Use `Modal` for short confirmations and bounded pickers. `ViewStack` keeps its
existing modal behavior; the page form does not add a backdrop or Escape handler.

## Verify

```sh
npm run check
npm test
npm run build
```

## Boundary

Sports rules, state-machine modules, application routes, services and branded assets stay with their owners. This package never imports from an app.

`UNLICENSED`: published for reading and for use by the projects that depend on it.
