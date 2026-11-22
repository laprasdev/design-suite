// Components rendered under Node without React. A bundle built with STATEFUL_HOOKS (through bundled.ts' replacedHooks)
// runs a hook against the Component rendering it: state and refs last across renders, and an effect runs when the
// component commits, if its deps changed, after the cleanup of its last run; a memo is made again when its deps
// change, and a context reads its default, as a scene renders no providers. As in React, a parent renders before the
// components it renders, and they commit before it. Two things are simpler than React: a state setter changes the
// value for the next render but schedules none, so a scene renders again itself (`rendered`); and useLayoutEffect is
// useEffect, where React runs every layout effect before any passive one (Modal's one layout effect does not mind).
const RENDERING='renderingComponent';
export const STATEFUL_HOOKS=`const rendering = () => globalThis.${RENDERING};
export const useState = initial => rendering().state(initial);
export const useRef = current => rendering().cell(() => ({current}));
export const useEffect = (effect, deps) => rendering().effect(effect, deps), useLayoutEffect = useEffect;
export const useMemo = (make, deps) => rendering().memo(make, deps);
export const useCallback = (callback, deps) => rendering().memo(() => callback, deps);
export const useContext = context => context._currentValue;`;
type Cleanup=void|(()=>void);
type Deps=readonly unknown[]|undefined;
interface EffectCell {deps: Deps; cleanup: Cleanup; ran: boolean}
interface MemoCell {deps: Deps; value: unknown; made: boolean}
const same=(deps: Deps,was: Deps)=>
 !!deps&&!!was&&deps.length===was.length&&deps.every((dep,i)=>Object.is(dep,was[i]));
// A state's next value: given, or made from the last one.
const next=(value: unknown,from: unknown)=>typeof value==='function'?(value as (was: unknown)=>unknown)(from):value;

export class Component<Out> {
 readonly #hooks: ()=>Out;
 readonly #cells: unknown[]=[];
 readonly #waiting: (()=>void)[]=[];
 #at=0;
 #out: {readonly value: Out}|undefined;
 constructor(hooks: ()=>Out) {this.#hooks=hooks;}
 // What the last render returned.
 get now() {
  if(!this.#out)throw new Error('A component is read before it renders.');
  return this.#out.value;
 }
 cell<Cell>(make: ()=>Cell) {
  if(this.#at===this.#cells.length)this.#cells.push(make());
  return this.#cells[this.#at++] as Cell;
 }
 state(initial: unknown) {
  const cell=this.cell(()=>({value:next(initial,undefined)}));
  return [cell.value,(value: unknown)=>{cell.value=next(value,cell.value);}];
 }
 memo(make: ()=>unknown,deps: Deps) {
  const cell=this.cell<MemoCell>(()=>({deps:undefined,value:undefined,made:false}));
  if(!cell.made||!same(deps,cell.deps))Object.assign(cell,{deps,value:make(),made:true});
  return cell.value;
 }
 effect(effect: ()=>Cleanup,deps: Deps) {
  const cell=this.cell<EffectCell>(()=>({deps:undefined,cleanup:undefined,ran:false}));
  if(cell.ran&&same(deps,cell.deps))return;
  this.#waiting.push(()=>{
   if(cell.cleanup)cell.cleanup();
   cell.cleanup=effect();cell.deps=deps;cell.ran=true;
  });
 }
 render() {
  Object.assign(globalThis,{[RENDERING]:this});
  this.#at=0;
  this.#out={value:this.#hooks()};
 }
 commit() {for(const run of this.#waiting.splice(0))run();}
}
// Renders a component and the components it renders, in that order, then commits them the other way round.
export function rendered(...components: readonly Component<unknown>[]) {
 for(const component of components)component.render();
 for(const component of [...components].reverse())component.commit();
}
