import type {StackView} from './ViewStack.tsx';
import type {PageDirection} from './pageMotion.ts';

// Only a retained prefix means push or pop. Unrelated replacements fade.
export function pageStackDirection(before: readonly string[],after: readonly string[]): PageDirection {
 const common=Math.min(before.length,after.length);
 if(!common||before.length===after.length)return 0;
 if(!before.slice(0,common).every((key,index)=>key===after[index]))return 0;
 return after.length>before.length?1:-1;
}
// The way from one ordered peer to another: along their order, or round a `ring` (a carousel) the shorter way, so a
// step past the last peer to the first goes on forward; a tie goes along the order.
export function peerDirection(keys: readonly string[],from: string,to: string,ring: boolean): PageDirection {
 const along=keys.indexOf(to)-keys.indexOf(from);
 if(along===0)return 0;
 const forward=ring&&Math.abs(along)*2>keys.length?along<0:along>0;
 return forward?1:-1;
}
export function pageStackKeys(views: readonly StackView[]): string[] {
 const keys=views.map(view=>view.key);
 if(new Set(keys).size!==keys.length)throw new Error('Page keys must be unique within a stack.');
 return keys;
}
