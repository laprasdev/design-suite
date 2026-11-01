# design-suite

One source for components, tokens, skins and the design language. It's published as `@looms/bloom-design`, and Unity reads `unity/` as `com.looms.design-suite`. The model is in `README.md`: kind, form, theme, skin.

- **Same kind, same data.** A new look is a form of an existing kind, not a new component. A surface can set the form of what's inside it.
- **Know the consumers:** slowbro-sports pins a commit, while the web synth and workbench read a local checkout, and Unity reads `unity/` directly. Never depend on a consumer.
- **After pushing `main`, open a pull request in slowbro-sports moving its pin in the same pass.** Nothing automates this.
- **Before pushing,** run `npm run check` and `npm run build`. The check uses slowbro-sports' strict settings, because its type check reads this source.
- **Unity's skins and tokens under `unity/`:** exporters write some of them. Editing by hand gets overwritten unless the exporter changes too, and changing a value affects Unity on its next import.
- `src/synth` holds the web synth's moved code in its original layout. New shared code goes in `src/react` or the root token files.
