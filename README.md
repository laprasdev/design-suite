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

Use `Modal` for short confirmations and bounded pickers. `ViewStack` composes it
for its shell, backdrop and Escape handler while owning its view transitions.
The Crossfade page form does not add a backdrop or Escape handler.

`ModalPlacement` puts the same `Modal` panel in the viewport (the default), contained in
its positioned parent, or anchored where its caller's positioning styles place it.
Contained and anchored panels keep the page interactive and leave focus to their caller;
an anchored panel has no backdrop. An anchored `Modal` may name its `anchor`, the element
it opens from: the panel and the anchor are its region, and the region also holds the
regions of the `Modal`s anchored inside its panel, such as a list opened from a detail.
Dismissed with focus in its panel, an anchored `Modal` hands focus back to its anchor. An
anchored `Modal` may also name a `group`, of which one is open at a time: opening one
dismisses the others. `HoverDetail`, `ListboxSelect`, the synth `Enum`'s grid picker and a
`Knob`'s refused number compose the anchored placement, the first three with their trigger
as the anchor. Every placement keeps the same surface and the module radius token.
`MODAL_PLACEMENT_ATTRIBUTE` carries the placement on the panel and its frame for styling
and browser checks, and `panelRef` exposes the panel for measurement or focus.

`Modal` alone decides how it is dismissed (`modalDismissal.ts`): whatever opens over
content and closes on Escape, a press elsewhere or a drag is a `Modal` placement, never a
handler of its own. Escape goes to one receiver. The innermost open `Modal` whose own
panel or anchor holds the focus receives it and stops it there; a contained or anchored
`Modal` receives an Escape only so. The topmost viewport `Modal` (the latest in the
document) receives every other Escape and stops it. With no viewport `Modal` open, the
topmost anchored `Modal` receives an Escape that no region holds, wherever the focus is,
and the key goes on to the focused control: a detail shown on hover closes on Escape
without moving pointer or focus (WCAG 1.4.13), and a control still cancels what it was
doing. The receiver closes if it is dismissible; a key that a control inside its panel has
already handled (its default prevented) stops there without closing it. A press outside an
anchored `Modal`'s region, or a drag starting anywhere, dismisses it if it is dismissible,
and the press goes on to what it lands on.

The window hears Escape, presses and drags in its capture phase. The topmost viewport
`Modal` takes an Escape aimed outside it, and an anchored `Modal` one at its anchor,
there, and stops it before the document or any element sees it; the topmost anchored
`Modal` takes an Escape no region holds there too, without stopping it. A receiver holding
the focus in its panel takes the key in its panel's React handler: React handlers around
it and the document's and window's bubbling listeners never see it, but the document's
capture listeners and native listeners on the elements between the focus and the
application root already have. A window capture listener added before the first `Modal`
opened sees every Escape. A dismissible viewport `Modal` also closes on its backdrop;
content may supply its own actions.

The page's own keys and presses have one owner for each thing they do: `modalDismissal.ts`
(how an open `Modal` is dismissed), `useDragSession.ts` (a drag from its press to its end)
and `pageKeys.ts` (a key going down or up on the page, heard by what is not focused, and
the order it is heard in). A listener hears the key at a moment: `FIRST` and then `SECOND`
in the window's capture phase, before anything on the page, or `LAST` in its bubble phase,
after everything on the page that let the key pass. Everything else that reads a key on
the page hears it through `pageKeys.ts`: a drag session's keys, `FIRST`; Space held to pan
a canvas, which a Space typed into a field does not hold, and `ThemeMoon`'s Shift over the
moon and its idle reset, `LAST`; and `controlCancel.ts`, which alone with
`modalDismissal.ts` names Escape. Escape cancels what is under way, a drag, a move or a
gesture, `FIRST`, and marks the key handled so a `Modal` around it stays open. It clears a
selection `LAST`, so a dialog over the selection closes, or a focused control cancels its
own edit, first, and the selection stays. `check:forms` reads the `addEventListener` calls
in `src` that name their event literally, and fails if a file other than the three owners
listens on the document, its body or root element, the window or the global object
(`globalThis` or `self`) for a key going down, up or pressed, a pointer, mouse or touch
press or release, a click, a double or auxiliary click, or a context menu. It also fails if
any file but those two names Escape. It does not see a listener on an element, an event
named by a variable or an `on…` property.
`HoverDetail` keeps a document `dragstart` listener that keeps details from opening while
a drag lasts, which is about opening, not dismissal; it also closes a hover detail when
the pointer leaves or focus moves away. `ThemeMoon`'s swatches close on idle and have no
Escape: they are choices fanned from the moon without a panel, and giving them the rule
would make them an anchored `Modal` with its surface, which changes the approved reveal
and is the owner's to decide.

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
  kind is lit by three's standard model or unlit, may move its vertices within a declared reach that its renderer's
  culling bounds grow by, may read a file's own attributes, its shading normal, view direction and position in the
  model's own space and the look's light, may write its normal and its light response, may be cut out at a declared
  threshold the stage sharpens, and may include shared GLSL by path and SHA-256);
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
  `glow` (`{threshold, strength, radius}` with `radius` from 0 to 1, or `null`); colours are sRGB triples in [0, 1].
  Everything the look colours, the backdrop included, passes through its curve. Under glow the scene is drawn once in
  linear light, the bloom (blurred by tapered Gaussians, so a bright emitter's halo is round) added, then the curve
  and the display encoding applied once (the stage's floor, grid and rigs are drawn after, neither bloomed nor
  curved). The types and
  `modelStageLighting`, which checks a lighting as the stage does, come from `/preview3d/model`, with
  `modelStageDescription`, which checks a whole description, and `modelFrameScope` and `modelPreviewFrame`, which
  check a frame against it. The theme's `stage`, `text` and `surface` must be `#rrggbb`, and its `stage` a colour the
  built-in times' ACES curve can show: their backdrop is stated as the colour that curve draws as it.
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

### Surface kinds

A surface kind is how a host draws a renderer with a program of its own instead of the file's material. This is for
whoever writes one; the stage's code is not needed. The declaration's type is `ModelSurfaceKind` and its validator
`modelSurfaceKind`; records are `ModelSurfaceValue` and `ModelSurfaceTexture`. All come from `/preview3d/model`. The
stage's own test kind, `tests/preview3dToonKind.glsl`, is a toon ramp written against this contract.

#### The declaration

A kind is one exported constant of the kind's own repository, host-neutral except for `webProgram`, the web stage's
program (another host brings its own program for the same kind id):

```ts
export const TOON_SURFACE: ModelSurfaceKind = {
  id: 'example-toon',                 // anything but 'file', the file's own material
  parameters: {                       // keyed by the source shader's reference names, exactly
    _Color: {type: 'color', space: 'srgb', hdr: false},
    _EmissionColor: {type: 'color', space: 'srgb', hdr: true},
    MainTex: {type: 'texture', space: 'srgb'},
    _Speed_XY: {type: 'vector', size: 2},
    _EMISSION: {type: 'keyword'},
    _Rim: {type: 'float'},
  },
  inert: {_Rim: 0},                   // a declared float drawn only at this value; another is refused by name
  attributes: ['uv', 'normal'],       // three's 'uv', 'color', 'normal', 'position'; a file's own is {name, size}
  light: 'unlit',                     // 'standard' (three's lit model) or 'unlit' (the kind lights itself)
  coverage: 'opaque',                 // 'blended', 'cutout', {cutout: '<declared float>'} or {cutout: 0.5}
  side: 'double', fog: true,
  displacement: null,                 // or {reach: '<declared float>'}: the kind moves vertices
  webProgram: {path: '<url of the .glsl>', sha256: '<64 lowercase hex>',
    includes: [{path: '<url of shared .glsl>', sha256: '<hex>'}]},  // optional: shared GLSL placed ahead of it
};
```

- **Parameters** are one vocabulary. A record states each of them and no other. An engine value is taken only under
  the same name, on a colour or float parameter of the same type; a name the frame leaves out shows the record's value.
  A name is a GLSL name: a letter or underscore, then letters, digits and underscores, never two underscores in a row.
  Leave out any source property the port does not read (a record that states it is refused); one it reads only at one
  value goes in `inert`.
- **Colours.** `srgb` colours are decoded to linear per channel (HDR channels above 1 by the same curve) and alpha is
  carried as stated; `linear` colours are used as stored; `hdr: false` keeps [0, 1]. Engine values follow the same rule.
- **Attributes.** Declare only what the program reads; nothing undeclared is added to it. A file's own attribute (a
  glTF custom attribute `_DEPTH`, which three names `_depth`) is `{name, size}` with 1 to 4 numbers a vertex.
- **Textures.** A record names each by `{path, sha256, wrap: [u, v], scale, offset}` (a PNG, JPEG or WebP; another
  format is refused where the record is read), or `{constant: 'white' | 'black'}` for an empty slot. Orientation is
  glTF's (`flipY` false). A kind never reads an image embedded in the model file.
- **Shared GLSL.** `webProgram.includes` lists GLSL files the kind's repository owns, each by path and SHA-256. They are
  read with the program, once, and placed ahead of it in the order listed, so one formula is written once. A file
  listed twice is refused; one whose bytes are not its digest refuses the description, naming the file.

The stage owns side, coverage, fog, the program cache key and every value a uniform holds, never the kind's code.

#### The program

The file is GLSL text, no JavaScript. It defines one function, which the stage places before three's `main`, with
everything it may read declared ahead of it:

```glsl
// Called once, just before three's <emissivemap_fragment>: after the base colour, alpha and normal chunks, before
// any light is computed. `diffuse` arrives white and opaque (times the vertex colour when 'color' is declared),
// `emissive` black. Write what the surface is; three's lighting, fog, tone curve and output run after it.
void kindSurface( inout vec4 diffuse, inout vec3 emissive ) { ... }
```

- A lit kind (`light: 'standard'`) is built on three's standard program. Its diffuse is lit at roughness 1 and
  metalness 0 unless it writes its light response: `kindOcclusion` (scales the ambient), `kindRoughness` and
  `kindMetalness` arrive at 1, 1 and 0 and exist only in a program that names one of them. With `'normal'` declared it
  may write `kindNormal` (world space, unit), and three lights the surface with it. From a tangent-space normal map:
  `kindNormal = kindNormalFromTangentSpace( mapNormal, uv )`, with `mapNormal` the map decoded to [-1, 1] (its xy
  scaled by a strength) and `uv` the uv it was sampled at; the map is a `linear` texture parameter. The tangent frame
  is three's own, from derivatives; a file's own tangents are not read.
- An unlit kind (`light: 'unlit'`) is built on three's basic program. What is drawn is `diffuse.rgb` plus `emissive`;
  no light of three's reaches it, while fog, the tone curve and output still apply. It lights itself from the look's
  light by the shared names below: a toon ramp reads `dot( kindNormal, stageKeyDirection )` through its steps.
- `emissive` may exceed 1: what is above the look's glow threshold glows.
- Coverage uses alpha: `blended` blends it and writes no depth, `opaque` ignores it, plain `cutout` writes it as
  coverage as it is. A threshold (`{cutout: '_Cutoff'}` or a number) cuts the surface there: the stage sharpens the
  alpha once, `kindCoverage(alpha, threshold)`, as URP's AlphaClip under alpha to coverage (SharpenAlphaStrict, a
  one-pixel ramp across the threshold; at 0 or below, the surface whole). Write the alpha the source computes and do
  not sharpen it yourself.
- Do not write `gl_FragColor`, declare uniforms of your own, or clone or replace three's chunks.
- The Surface modes act on the same material: Clay replaces colour and emission after `kindSurface`, Color shows
  `diffuse` untoned, Emission shows `emissive`. An unlit kind is drawn as it is in every mode, and its mesh makes the
  modes unavailable, as any unlit material does.

**A kind that moves vertices** (`displacement: {reach}`) also defines, in the same file:

```glsl
// Called once a vertex, after three's morphs and skinning, before projection. `world` is the vertex's world
// position (metres, Y up); return its offset in world space. The stage takes the offset to the object's space
// through the inverse of its world transform (model, instance and batch matrices), so projection, fog and the
// world position follow the moved vertex. Normals do not move.
vec3 kindDisplacement( vec3 world ) { ... }
```

- It may read its argument, the parameter accessors, `stageDecorativeSeconds` and the other shared values, and a file's
  own attribute. Decorative time holds under reduced motion and on a hidden page, so a swaying kind holds still with it.
- A wind graph that adds noise of the world position (with wind direction times speed times time) to the world
  position and then transforms World to Object maps exactly: the world position is the argument, time is
  `stageDecorativeSeconds`, and the stage performs the World to Object step. A graph that adds one noise value to all
  three axes returns `vec3(n)`.
- The file is compiled into both stages. In the vertex stage `KIND_VERTEX_STAGE` is defined: put what only a fragment
  stage has (`fwidth`, `dFdx`, `dFdy`, `gl_FrontFacing`, `discard`), or the whole `kindSurface`, inside
  `#ifndef KIND_VERTEX_STAGE ... #endif`. Everything else must compile in both stages from what both declare.
- `reach` names the declared float that bounds the offset's length, in metres; below 0 it is refused. The stage grows
  the renderer's culling bounds by the reach in force (the record's, or the engine's for that tick), in world metres
  whatever the renderer's scale. The reach bounds the length: `vec3(n)` is up to 1.73 times `n` long. An offset longer
  than the reach can be culled while part of it is in view. The camera's fit reads the undisplaced model.

**What the GLSL may read.**

- `surfaceParameter<name>()` for each declared parameter, named as declared (`surfaceParameter_Color()`): the value in
  force, the record's or the engine's for this draw. A colour is a `vec4` (decoded as above), a vector a `vec2` to
  `vec4`, a float a `float`, a keyword a `bool`. A texture's is a lookup, `vec4 surfaceParameterMainTex( vec2 uv )`,
  that applies the record's scale and offset. For a texture also `vec4 surfaceTiling<name>()` (scale in xy, offset in
  zw, Unity's `_ST` layout in glTF's uv space) and `vec4 surfaceSample<name>( vec2 uv )` (the texture at a uv as
  given), so a port that samples every map at one map's tiling does exactly that.
- `vUv` with `'uv'` declared; `vColor` with `'color'`; a file's own attribute as `surfaceAttribute<name>` in both stages
  (`surfaceAttribute_depth`: a `float` for size 1, `vec2` to `vec4` above).
- With `'normal'` (fragment stage only): `kindNormal`, the shading normal after three's double-sided flip, and
  `kindViewDirection`, toward the camera; both unit, in world space (metres, Y up). A Fresnel term is
  `pow( 1.0 - saturate( dot( kindNormal, kindViewDirection ) ), power )`.
- With `'position'` (fragment stage only): `kindObjectPosition`, the fragment's position in the space the model file
  states the mesh in (glTF: right-handed, Y up, metres), before the node's, an instance's or a batch's transform and
  after morphs, skinning and displacement. It is a source engine's object space only through the converter's axis
  change.
- The look's light, for any kind: `stageKeyDirection` (unit, toward the key, world space), `stageKeyColor` (linear
  colour times strength), `stageAmbientSky` and `stageAmbientGround` (linear colours times strength; the sky is +Y) and
  `stageShadow` (the time's shadow colour, linear). These are the values three hands its own lit programs. Three's
  diffuse divides by pi (`RECIPROCAL_PI`, as `BRDF_Lambert`); a ramp meant to match a lit kind does the same. The
  stage has exactly two lights, the key `directionalLights[0]` and the ambient `hemisphereLights[0]`.
- `stageDecorativeSeconds`, decorative time on either clock, never for gameplay (what the game decides arrives as an
  engine value), and `stageNight`, 0 by day and 1 by night.

Names a kind must not declare: anything starting `surfaceParameter`, `surfaceValues`, `surfaceTexture`,
`surfaceAttribute`, `surfaceTiling`, `surfaceSample` or `stageNumbers`; `stageDecorativeSeconds`, `stageNight`,
`stageShadow`, `stageKeyDirection`, `stageKeyColor`, `stageAmbientSky`, `stageAmbientGround`; `kindSurface` and
`kindDisplacement` beyond its one definition of each; `kindEmissive`, `kindWorld`, `kindObjectToWorld`, `kindNormal`,
`kindViewDirection`, `kindObjectPosition`, `kindViewNormal`, `kindNormalFromTangentSpace`, `kindOcclusion`,
`kindRoughness`, `kindMetalness`, `kindCoverage`, `KIND_VERTEX_STAGE`; a file attribute's own name; and three's names.

The stage does not yet state an engine-to-stage space convention, so a kind cannot yet sample world space in its
source engine's basis.

#### Refusals

| Where | Refused |
|---|---|
| Declaration | A missing or stray field; an unknown option; a parameter name that is not a GLSL name; an `inert` entry, `reach` or threshold that names no declared float; a threshold outside [0, 1]; an include listed twice; a bad hash. |
| Stage creation | A three attribute other than `'uv'`, `'color'`, `'normal'` and `'position'` (a file's own states `{name, size}`). |
| Record, before anything loads | An unknown kind; a parameter missing or stray; a value of the wrong type or size; a non-HDR colour outside [0, 1]; an inert value not met; a reach below 0; a texture format the stage does not decode. |
| Actor | A set the description lacks; a surface set together with `asset.runtimeMaterials`. |
| Staged load | A program, include or texture that cannot be read or decoded, named by path and SHA-256. |
| Staged build | A set that leaves out a renderer of the file or names one it lacks; a record on a renderer of lines or points; an attribute the mesh lacks or holds at another size; a mesh without normals under `'normal'`; a program that fails to compile or link, with the compiler's log. Each names the actor, renderer and kind, and refuses the description: the one in force stays drawn. |
| Frame | A value on a renderer the actor's surfaces do not list or that draws the file's material, under a name the kind does not declare with that type, or one the record's rule refuses; a slot other than 0. |

#### How the stage draws a kind

- One material per record (the kind and its values), compiled the first time a renderer needs it, shared by every
  renderer and actor with that record, freed once none draws with it. A changed record is another material, compiled in
  the staged build; no model is reloaded.
- An engine value is per draw: each renderer holds its own values and hands them to the shared material just before it
  is drawn, so many actors of one record are one material and one program.
- A kind's material counts as one that emits, since its program decides its emission.

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
