# design-suite

The component kinds and design language shared by Bloom's Unity synth, the web synth and the baseball apps.

## Model

A rendered control is resolved from four independent choices, in this order:

| Choice | Meaning | Examples |
|---|---|---|
| Kind | The component, chosen by the data it edits | MultiChoice, Knob, Slider, ActionBar |
| Form | A named variant of a kind | text, joined, icons, tabs, pills |
| Skin | Component form assignments | flat, classic, a named mix |
| Palette | Colors, independently of the skin | bloom, serum, analog |

`WidgetInteractionStatus` variants apply last.

A surface can set the form of what's inside it: a `SegmentedControl` in an `ActionBar` takes the text form on its own, and `compact` gives a second-level bar its smaller size. A control's own props still win.

## Catalog

`catalog/` records which source implements each kind. `kinds.json` is the hand-kept map and `scan.mjs` reads the sources statically, so Unity never has to run. `build.mjs` writes `catalog.json` and exits non-zero if the map names something the sources lack.

```sh
git -C ../slowbro-sports archive origin/dev packages src | tar -x -C /tmp/bb
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

Consumers install this package plus React and React DOM, and import compiled ESM.

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
| `/preview3d` | Optional browser GLB stage: camera, lights, materials, clips and diagnostic skeleton |
| `/preview3d/model` | Preview types and settings without importing Three |
| `/preview3d/react` | Complete `ModelPreview` view with selection, playback, display and camera controls |
| `/preview3d/styles.css` | Complete styles for `ModelPreview`, including the shared control styles |
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

For ordered peer destinations, pass `activeKey` with the same entries. Visited pages stay mounted;
direction follows their order, and their actual retained surfaces animate without cloning embedded apps.

`PageHeaderBar` and `PageFooter` own the shared page chrome. `HeaderNavigation` takes the same typed
segmented-control options as the sport selector: applications supply glyphs, labels, values and navigation.
Brand, Back, settings and page controls fill the existing slots. Notices reuse `ActionBar`'s notice surface.

Keep the fixed header and footer outside the moving page body. The exported page
motion helpers also support stationary chrome within a composed page.
`Crossfade` recognizes nested `[data-page-bar]` surfaces and fades their controls in place. The consumer owns routes, push/Back controls, guards and the
retained entries' lifetime. Removing an entry unmounts it. The existing
`<Crossfade view={key}>{content}</Crossfade>` keeps its compact fade behavior.
For composed pages, `animateCardFlip(outgoing, incoming)` rotates each supplied surface in place, using the shared
page duration and easing. It returns the same cancellable `PageMotion` handle; the caller owns retained mounts.
Hidden retained pages still run React effects: consumers must deactivate their
header/footer portals, dialogs and global input handlers using the active page state.

Outgoing copies remap local IDs and references and preserve authored rules from
readable document stylesheets, including inheritance from each SVG `use` instance.
Affected ID rules in cross-origin stylesheets that deny CSSOM access, or imports
with `layer()`/`supports()` modifiers, cannot be copied; those rules must be inline,
inside the copied page, or in a readable application stylesheet. Global font,
keyframe and property definitions stay with their existing stylesheet owner.

The motion helper lifecycle is `capturePage(source)` → `placePageCopy(parent, snapshot)`
→ `removePageCopy(snapshot)`. Capture leaves both content and its stylesheet detached;
placement mounts the stylesheet outside the content, and removal disposes both.
Passing an empty detached wrapper to `capturePage(source, wrapper)` captures only
the source's children and keeps the wrapper's layout. Consumers retain the snapshot
for cleanup; `.copy` and the placement result expose its element for animation.

Use `Modal` for short confirmations and bounded pickers. `ViewStack` keeps its
existing modal behavior; the page form does not add a backdrop or Escape handler.

Give a `Modal` a `title` and it lays its children out on one grid: the title, which
names the dialog, then each `ModalRow` (a label and its control on two shared columns,
or one full-width row without a label), then an optional `actions` row that stays in
view while the rows scroll. `actions` needs a `title`. Each child of a titled modal is
a `ModalRow`; `ModalElement` names the parts for styling and browser checks. The titled
form scrolls its rows; held growth after a disclosure opens is the plain form's. A modal
without a title keeps its children as they are.

## 3D preview

The browser renderer for the existing `RenderTextureView` kind lives in `/preview3d`. Install the optional
`three@0.180.0` peer and load the entry only when a 3D view opens; the package root and `/react` do not import it.
`/preview3d/model` holds the data (types, constants, validators) for eager imports, `/preview3d/react` the
`ModelPreview` view, and `/preview3d/styles.css` its styles.

```ts
import {MODEL_PREVIEW_REVIEW} from '@looms/bloom-design/preview3d/model';
const {createModelStage} = await import('@looms/bloom-design/preview3d');
const dispose = createModelStage(host, description, theme, onReady, onError,
  {reviewKey: MODEL_PREVIEW_REVIEW, clock: 'local', floor: true, grid: true, kinds: []});
// dispose() removes the canvas and the review handle; calling it again does nothing.
```

The last argument is fixed for the stage's life, and states exactly these fields (one left out or one it does not
have is refused by name): `clock` (`'local'` or `'external'`), whether the stage lays its own `floor` and `grid`,
the surface `kinds` a description may use (each kind's declaration, `[]` for none), and the host property
`reviewKey` the controller is published under once the first description is shown, which is also when
`onReady(controller)` is called; it does not signal a connected or running state machine. An actor's id and its
asset's `id`, `path`, `revision`, `sha256` and `runtimeMaterials` identify a loaded instance: change `revision` when
the same URL's contents change. Every file the stage loads (a model, a texture, a kind's program) is read once,
whole, through one read that can be abandoned and that checks the SHA-256 the description states for it.

### The description

One `ModelStageDescription` states everything the host decides, and every field is required. Each record states
exactly its fields: one it omits or one it does not have is refused by its path (`Actor a.animation omits name`).

- `actors`: `{focus, actors}`, a non-empty list and the id of the one the camera fits and the snapshot reports.
  Each actor is `{id, asset, placement, animation, surfaces}`. `asset` states `id` and `path`, and each of
  `revision`, `sha256` and `runtimeMaterials` with a value or not at all; any other field is refused. A stated
  `sha256` is checked on every read of the file; with none the file is read unverified. `placement` is a whole pose:
  `position`,
  `rotationQuaternion` and `scale`. `animation` is `{kind: 'rest'}`, `{kind: 'playing', name}` (local clock only)
  or `{kind: 'held', name, timeSeconds}` within the clip; a field of another shape is refused, never dropped.
  Actor ids are the host's; two actors may draw one asset. `surfaces` is `{from: 'file'}` (the file's own
  materials throughout) or `{from: 'set', set}`, naming one of `surfaceSets`.
- `surfaceSets`: named sets, each keyed by every renderer of the file it is for (`gltf-node:<n>/primitive:<m>`,
  each exactly once, checked against the loaded file), each entry `{kind: 'file'}` or a record `{kind, values}` of a
  surface kind the stage was given (`kinds`, a creation option: each kind's declaration, `[]` for none). A record
  is drawn by its kind's web program (one shared material per record, compiled before the description is shown; a
  kind is lit by three's standard model or unlit, may move its vertices, and may read a file's own attributes);
  an engine frame's material values are taken only on a parameter the renderer's kind declares. A record's
  `values` give every parameter of its kind one of `{color: [r, g, b, a]}`, `{vector: [...]}`, `{float}`,
  `{keyword}` or `{texture}`, a texture being `{path, sha256, wrap: [u, v], scale: [u, v], offset: [u, v]}` (a PNG,
  JPEG or WebP) or `{constant: 'white' | 'black'}`: the types `ModelSurfaceValue` and `ModelSurfaceTexture`.
- `environment`: `{reflectZ, plane, boxes}` scenery, or `null`: `plane` is `{position, size, color}` and a `grid`
  `{spacing, color}` when stated, or `null`; each box is `{id, position, size, color}` and a `rotationQuaternion`
  when stated. It is the scene's, fogged, bloomed and curved with the actors.
- `framing`: `{kind: 'focus'}`, `{kind: 'all'}` (every actor) or `{kind: 'pose', position, target}`.
- `orbit`: whether the person may orbit away from the framing.
- `lighting`: `{time, times}`, the id of the time of day in force and the description's own times, each
  `{id, label, look}`; ids and labels are each a time's own. Two times are built in, `MODEL_STAGE_TIME.light` (the
  consumer's theme) and `.dark`; `MODEL_STAGE_THEME_LIGHTING` is `{time: 'light', times: []}`. A look states
  `backdrop`, `key` `{color, strength, direction}`, `ambient` `{sky, ground, strength}`, `shadow`, `night` (0 to 1),
  `aids` `{floor, share}`, `fog` (`{near, far, height}` or `null`), `toneCurve` (`'aces-filmic'` or `null`) and
  `glow` (`{threshold, strength, radius}` with `radius` from 0 to 1, or `null`); colours are sRGB triples in [0, 1],
  and under glow the scene is drawn once in linear light, the bloom added, then the curve and the display encoding
  applied once (the stage's floor, grid and rigs are drawn after, neither bloomed nor curved). The types and
  `modelStageLighting`, which checks a lighting as the stage does, come from `/preview3d/model`, with
  `modelStageDescription`, which checks a whole description, and `modelFrameScope` and `modelPreviewFrame`, which
  check a frame against it. The theme's `stage`, `text` and `surface` must be `#rrggbb`.
- `display` (`'model'`, `'rig'`, `'both'`) and `surfaceMode` (`'lit'`, `'clay'`, `'color'`, `'emission'`).
- `size`: `{rule: 'real'}` (each actor at its file's size) or `{rule: 'normalized', height}`; `origin`: `'file'`
  (the file's own origin, as an engine places it) or `'centred'` (centred over the placement, standing on it).

### The controller

- `setDescription(value)` applies a whole description, keeping every unchanged part: an unchanged asset is not
  reloaded. One that loads nothing applies or throws at once; one that loads (an asset, a texture or a kind's
  program a record names, or the glow's passes the first time a time brings glow) returns a promise that settles
  when they arrive, rejects with the previous description still shown, and is superseded by a later call.
- `setFrame(frame)` (external clock only) applies `{simulationTimeSeconds, entities}`. Each entity names a declared
  actor by `entityId` and carries `modelId`, a whole `pose`, `animationLayers`, `partPoses: []` and `materials`
  (values only on a parameter its renderer's kind declares). The whole frame is refused before anything changes. A
  description may not change, replace or remove an actor a frame has driven.
- `resetCamera()` returns a view the person orbited to the described framing.
- `snapshot()` reports the focused actor at the top level (`animation`, `time`, `playing`, `hold`, `display`,
  `boneCount`, `parts`, `poses`, `surfaceMode`, `surfaceModesAvailable`, the emission and visibility counts) and
  every actor under `actors`, each with its `driver` (`'host'` or `'engine'`), `pose` and applied `samples`.
  `renderedModelMeshes` counts the meshes of the actors on the stage that the last frame drew (shown, and inside
  the camera's view), read when asked.

Under the local clock the stage keeps one presentation time that every playing clip follows; it holds while the
person asks for reduced motion or the page is hidden, and `hold` says which. Under the external clock only frames
move the pose. A stated time outside `[0, duration]` is refused, never wrapped or clamped.

An engine frame plays at most one animation layer per actor, with `blendMode: 'override'`; a mask (`maskId`), an
additive layer or a second layer is refused. `MODEL_PREVIEW_CAPABILITIES` (in `/preview3d/model`) states what a
frame may carry. The host owns session, epoch, publication, generation and binding-revision guards; this surface
does not interpret a runtime frame or evaluate gameplay.

`modelPoseForBinding(pose, {reflectZ, rotationQuaternion})` (in `/preview3d/model`) is a pure coordinate adapter.
Positions enter and leave in metres. Z reflection maps position to `[x,y,-z]` and rotation to `[-x,-y,z,w]`, then
postmultiplies the declared local model-alignment quaternion; the composed rotation is normalized and scale is
unchanged.

### Failures

A `ModelStageRefusal` means the request was not applied and the stage is exactly as it was. Any other error, or a
failure with no stage yet, means the stage is unusable; so does a frame that fails to draw, which stops the stage and
reaches `onError`. `ModelPreview` shows either only through the suite's
`ActionBar` notice (`ActionNotice` when `chrome` is false), with the failure's message as its detail: "Not applied"
for a refusal, and "Preview stopped" with Retry for an unusable stage.

### Rig points

A point a host attaches to is an empty node named `PART-<name>` under the bone it follows. `snapshot().parts`
reports each by `<name>` with its world `position` and `rotationQuaternion`; Rig and Both draw a marker on it.
Rig draws the joints a skinned vertex is weighted to, and the fit in Rig and Both follows what is drawn.

### ModelPreview

```tsx
<ModelPreview description={description} assets={assets} theme={theme} stageOptions={{floor: true, grid: true, kinds: []}}/>
```

`description` is the host's stage; its focused actor is the model the controls act on. `assets` are the catalog's
`ModelPreviewAsset`s (`id`, `name`, `animations` as `{name, label}`) for the model picker, the name and the clip
list, which starts with Rest Pose. `onSelectAsset` shows the model picker when there is more than one asset.
`frame` is the engine's input: omit it for the local clock, pass `null` while waiting, then each
`ModelPreviewFrame`. `stageOptions` (`floor`, `grid`, `kinds`), `reviewKey` (default `MODEL_PREVIEW_REVIEW`, on
`ModelPreviewElement.STAGE`), `className`, `chrome` and `stageOverlay` complete the props. The stage is created
again when the focused asset, the clock, `stageOptions`, `reviewKey` or the theme's colours change. With a `frame`
the view shows only the display choice and Reset Camera, and an engine-driven actor keeps Lit materials. A `null`
or invalid frame shows the waiting or error status while the last valid pose stays drawn; a later valid frame
recovers without reloading, and a loading model receives only the latest valid frame. `MODEL_PREVIEW_TEXT` and
`MODEL_PREVIEW_DISPLAY_OPTIONS` (in `/preview3d/model`) own the view's labels and display choices.

The Surface choice is diagnostic: Lit keeps the loaded materials, Clay removes surface detail to show shape, Color
shows the unlit base color and Emission the authored emissive channel; a model with none reports "No emission". A
mode other than Lit shows its term as stated: no fog, and no glow (the frame is drawn straight to the canvas). It
covers a mesh's standard or physical material and a kind built on the standard program; a model's lines and points
are drawn as they are in every mode. A model whose meshes draw another material (an unlit one) stays Lit with
`surfaceModesAvailable` false.

The person's choices (the focused actor's clip, play or pause, the display, the surface and the lighting) are edits
of the description held by the view; a host change of the same value replaces them. While a refusal stands, the
controls show and act on the description the stage holds. Mount the view inside the suite's `app-root`, where its
pickers place their popovers and its controls take their styles.

Consumers own asset catalogs, character selection, UI and the bridge from runtime output to the description and
the frame. The state-machine engine evaluates states; this renderer does not. Native Unity previews keep their
camera adapter to the same runtime contract.

## Verify

```sh
npm run check
npm test
npm run build
```

## Boundary

Sports rules, state-machine modules, application routes, services and branded assets stay with their owners. This package never imports from an app.

`UNLICENSED`: published for reading and for use by the projects that depend on it.

## Theme data source

`ThemeData` is the shared read-only theme contract: `{skin, theme}`. A host supplies
`connectThemeSource(() => data)`; consumers bind to its window and explicit origin through
`connectThemeClient(sourceWindow, origin, receive)`. Both use the versioned `looms.theme` protocol,
with subscribe, update and unsubscribe messages. Source/origin and payload shape are validated.
The source publishes resolved theme data; consumers apply `themeVariables(data.theme)` without
reconstructing a palette. `createSkinTheme(name)` and synth controls use the same `skinPalette` resolver.

React consumers can bind a source URL with `useThemeSource(url)`. Workbench exposes its selected
theme at `http://workbench.localhost/?theme-source`; storage changes update all subscribers and
Workbench tabs. The Elements gallery uses this source for its shell and scopes preview skins to
the samples. New Knob forms `thin` and `cutout`, and Slider form `thin`, share the existing value
and drag behavior. The cutout knob masks the indicator out of the face, exposing the surface below.

## Component skins and palettes

`ComponentSkin` stores candidates and one active form per element kind. `SkinAssignments` is the versioned data
contract; `parseSkinAssignments` reads existing shortlists without losing candidates. `assignSkinChoice` applies
one revision-checked create, assign, activate or independent feedback action. Storage belongs to the host, not the component library.
`ElementsGallery` receives this data and callbacks; its full page header/footer use `PageHeaderBar` and `PageFooter`,
and its comparisons use core-derived `RecordTable`. Generic table geometry, grouped/windowed rows and page surfaces
live here. Consumer identity cells, sorting/data, journeys and portals remain with their apps.

Feedback is keyed by element/form outside the skin assignments. A note neither selects nor activates a form; older
v2 payloads without feedback read as empty. `ThemeData.theme.typography` carries reading/chrome/code font families,
body/control sizes and line height. Legacy theme messages retain the canonical Workbench defaults.

A gallery host can register additional `groups` and `samples` through the same renderer contract. Preview size belongs
to group metadata; authoring data and draft writes belong to the consumer. Synth registers its actual nodes and
modules, and the shared table provides assignment, feedback and comparison behavior without importing Synth.
`GooExpander` is the Activity side-tab form: it animates an absolute fused shape, supports left expansion with a
stationary icon, keeps closed controls inert, and respects reduced motion. Workbench supplies facts/tone; Synth
supplies output terminals. `GraphDisplay`, `GraphFill` and `graphEdgeFade` share the classic graph treatment.

`StyleProvider` accepts optional controlled `skin` and `palette` inputs. A component skin changes presentation,
not values, bounds, bitmasks, graph polarity or authoring states. The palette-only projection uses canonical base
geometry with the selected color roles; scoped previews start from clean defaults and can disable document styling.
Legacy `skin` JSON filenames, `ThemeData.skin`, Unity assets and existing provider callers retain their established
meaning for compatibility. No serialized rename is implied by the new UI vocabulary.

`Slider` has a readonly `progress` form for weighted distributions: pass stable `{id, value, color, active?}` segments and an `aria-label`. It shares the rounded Synth track; `compact` uses its original thickness. Existing cell, thin, setting and range forms retain their gestures. Consumers own domain counts and activity; reduced motion keeps progress static.

`GraphWires` can attach to a consumer's existing node canvas without adding a second node-drag system. Supply stable
edge IDs, node boxes, port fractions and optional edge colors; mark custom node roots with `data-graph-node` so
Shift sweeps leave their controls alone. Ties change drawing routes only. The interaction viewport may differ from
the scaled drawing surface. Escape, blur, pointer cancellation, lost capture and unmount cancel a pending gesture.
`graphDots` supplies the Workbench dot field; `graphEdgeFade` can mask its background without fading controls.

Module tabs compose the shared `SegmentedControl`, including keyboard navigation and bounded scrolling; `labelActive`
puts the current name inside its button. `ModuleToolButton.iconOnly` retains its accessible name and tooltip.
Controller capsule shoulders and rounded D-pad bars are shared drawing helpers; gesture bindings belong to consumers.
