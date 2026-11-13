# design-suite

These repository rules extend `/Users/lap/Development/agent-rules/AGENTS.md`. Verify the shared policy is loaded before implementation.

One source for components, tokens, skins and the design language. It's published as `@looms/bloom-design`, and `unity/` is the Unity package `com.looms.design-suite`. The model is in `README.md`: kind, form, theme, skin.

- **Same kind, same data.** A new look is a form of an existing kind, not a new component. A surface can set the form of what's inside it. Compositions in this package use those primitives too: `LoadingIndicator` composes `Label`, which owns its typography; loading CSS owns layout, color and animation. Inspect `catalog/kinds.json` and the existing owner before adding JSX or styling.
- **Know the consumers:** slowbro-sports pins a commit, Unity pins a commit through `?path=/unity`, and the web synth and workbench read a local checkout. Never depend on a consumer. This repo is public, so keep secrets and private notes out.
- **After pushing a package change to `main`, update the consumers' pins in the same pass,** as `README.md` describes. Nothing automates this.
- **Before pushing,** run `npm run check`, `npm test` and `npm run build`. The check uses slowbro-sports' strict settings, because its type check reads this source.
- **Unity's skins and tokens under `unity/`:** exporters write some of them. Editing by hand gets overwritten unless the exporter changes too, and changing a value affects Unity on its next import.
- `src/synth` holds the web synth's moved code in its original layout. New shared code goes in `src/react` or the root token files.

- **Reuse contracts.** `npm run check:forms` (also run by CI) checks that the loader actually renders the existing `Label` and rejects loader-owned typography. Extend the existing contract checks for a regression; do not add a parallel validation framework. Prove both the valid composition and a deliberate violation. These checks cover declared contracts, not all semantic duplication.
