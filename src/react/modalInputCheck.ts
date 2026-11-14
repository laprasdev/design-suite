/* What a consumer may not declare: a suite component's private custom properties. Each starts with the suite's private
   prefix and its family's name, and belongs to the family's owner, which sets it from its props. A family's row names
   the prop a consumer passes for each property consumers once declared, among them inputs a prop replaced, such as
   the Modal's `--modal-frame-inset`. A consumer's source check runs `modalInputFailures` on each stylesheet and module
   it owns; each failure names the file, the line, the property, its owner and the prop to pass instead. Reading a
   property, as in `var(--sd-modal-width)`, is not declaring it. The next component's family is a row, not a module. */
import {MODAL_FRAME_INSET_PROPERTY} from './modalElements.ts';

const PRIVATE_PREFIX='--sd-',REPLACED_FRAME_INSET='--modal-frame-inset';
interface PrivateFamily {
 readonly owner: string;
 // The start of its properties' names after the private prefix.
 readonly family: string;
 // The prop a consumer passes for each property it once declared.
 readonly props: Readonly<Partial<Record<string,string>>>;
}
const PRIVATE_FAMILIES: readonly PrivateFamily[]=Object.freeze([
 {owner:'Modal',family:'modal-',props:{
  [`${PRIVATE_PREFIX}modal-width`]:'width',
  [MODAL_FRAME_INSET_PROPERTY]:'frameInset',[REPLACED_FRAME_INSET]:'frameInset',
 }},
]);
const familyPrefix=(row: PrivateFamily)=>`${PRIVATE_PREFIX}${row.family}`;
// Custom property names hold only name characters, so each is its own pattern.
const PROPERTY=PRIVATE_FAMILIES.flatMap(row=>[String.raw`${familyPrefix(row)}[\w-]+`,
 ...Object.keys(row.props).filter(property=>!property.startsWith(familyPrefix(row)))]).join('|');
// Declared in a stylesheet or a style object (`--x:`, `'--x':`, `['--x']:`), or set with `setProperty('--x', …)`.
const DECLARED=new RegExp(String.raw`(?<![\w-])(${PROPERTY})(?![\w-])`
 +String.raw`(?:(?=['"\x60]?\]?\s*:)|(?<=setProperty\(\s*['"\x60](?:${PROPERTY})))`,'g');
const BLOCK_COMMENT=/\/\*[\s\S]*?\*\//g;
const familyOf=(property: string)=>PRIVATE_FAMILIES.find(row=>property.startsWith(familyPrefix(row))
 ||property in row.props)??(()=>{throw new Error(`${property} matched no private family's pattern.`);})();

export function modalInputFailures(source: string,name: string): string[] {
 // A comment keeps its line breaks, so each failure names the line its declaration is on.
 const code=source.replace(BLOCK_COMMENT,comment=>comment.replace(/[^\n]/g,' '));
 return [...code.matchAll(DECLARED)].map(match=>{
  const property=match[1],{owner,props}=familyOf(property),prop=props[property];
  const line=code.slice(0,match.index).split('\n').length;
  const remedy=prop?`pass its \`${prop}\` prop instead`:'no consumer declares it';
  return `${name}:${line}: ${property} belongs to ${owner}; ${remedy}.`;
 });
}
