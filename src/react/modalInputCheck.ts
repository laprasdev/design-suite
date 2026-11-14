/* What a Modal's consumer may not declare: the custom properties a Modal's stylesheet owns. Every `--sd-modal-`
   property is the Modal's own. It sets the ones consumers once declared from its props: a consumer passes `width` for
   its panel's width and, for a contained Modal, `frameInset` for its frame's inset, which replaced
   `--modal-frame-inset`. A consumer's source check runs `modalInputFailures` on each stylesheet and module it owns.
   Each failure names the file, the line, the property and the prop to pass instead. Reading a property, as in
   `var(--sd-modal-width)`, is not declaring it. */
import {MODAL_FRAME_INSET_PROPERTY} from './modalElements.ts';

const MODAL_PROPERTY_PREFIX='--sd-modal-',REPLACED_FRAME_INSET='--modal-frame-inset';
// The prop a consumer passes for each property it once declared.
const MODAL_PROPERTY_PROPS: Readonly<Partial<Record<string,string>>>=Object.freeze({
 [`${MODAL_PROPERTY_PREFIX}width`]:'width',
 [MODAL_FRAME_INSET_PROPERTY]:'frameInset',[REPLACED_FRAME_INSET]:'frameInset',
});
const PROPERTY=String.raw`${MODAL_PROPERTY_PREFIX}[\w-]+|${REPLACED_FRAME_INSET}`;
// Declared in a stylesheet or a style object (`--x:`, `'--x':`, `['--x']:`), or set with `setProperty('--x', …)`.
const DECLARED=new RegExp(String.raw`(?<![\w-])(${PROPERTY})(?![\w-])`
 +String.raw`(?:(?=['"\x60]?\]?\s*:)|(?<=setProperty\(\s*['"\x60](?:${PROPERTY})))`,'g');
const BLOCK_COMMENT=/\/\*[\s\S]*?\*\//g;

export function modalInputFailures(source: string,name: string): string[] {
 // A comment keeps its line breaks, so each failure names the line its declaration is on.
 const code=source.replace(BLOCK_COMMENT,comment=>comment.replace(/[^\n]/g,' '));
 return [...code.matchAll(DECLARED)].map(match=>{
  const property=match[1],prop=MODAL_PROPERTY_PROPS[property],line=code.slice(0,match.index).split('\n').length;
  const remedy=prop?`pass its \`${prop}\` prop instead`:'no consumer declares it';
  return `${name}:${line}: ${property} belongs to Modal; ${remedy}.`;
 });
}
