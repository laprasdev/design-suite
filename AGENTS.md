# design-suite

Shared policy: `/Users/lap/Development/agent-rules/AGENTS.md`. This file holds only design-suite's facts.

One source for components, tokens, skins and the design language, published as `@looms/bloom-design`; `unity/` is the Unity package `com.looms.design-suite`. `README.md` owns the model: kind, form, theme, skin. Inspect `catalog/kinds.json` and the existing owner before adding JSX or styling.

- **A surface can set the form of what is inside it.** Compositions here stand on the primitives: `LoadingIndicator` composes `Label`, which owns its typography; the loading CSS owns only layout, color and animation.
- **Consumers:** slowbro-sports and accounts pin a commit; Unity pins a commit through `?path=/unity`; the web synth and Workbench read the local checkout; bloom-3d-design links the checkout its `scripts/linked-stage.json` records. This repository is public: keep secrets and private notes out.
- **After pushing a package change to `main`, update the consumers' pins in the same pass,** as `README.md` describes. Nothing automates it.
- **Before pushing,** run `npm run check`, `npm test` and `npm run build`. The check uses slowbro-sports' strict settings, because its type check reads this source.
- **Unity's skins and tokens under `unity/`** are partly written by exporters: a hand edit is overwritten unless the exporter changes too, and a changed value reaches Unity on its next import.
- `src/synth` holds the web synth's moved code in its original layout. New shared code goes in `src/react` or the root token files.
- `npm run check:forms` (also in CI) checks that the loader renders the existing `Label` and rejects loader-owned typography. A regression extends these contract checks. They cover declared contracts, not all semantic duplication.
- `scripts/size-gate.mjs` is the one size gate (lines per file, characters per line, a baseline that only falls); bloom-3d-design and the web synth run it through its `run` entry.
- TypeScript: 10 tracked JavaScript modules (`catalog/build.mjs`, `catalog/scan.mjs`, `examples/gallery.jsx`, `examples/galleryContent.js`, `scripts/build.mjs`, `scripts/size-gate.mjs` and the four in `scripts/sizeGate/`). No gate stops a new one: `tsc -p .` reads only `src`. Adding it is open work.
