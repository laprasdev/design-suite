import type {StackView} from './ViewStack.tsx';
import type {PageDirection} from './pageMotion.ts';

// Only a retained prefix means push or pop. Unrelated replacements fade.
export function pageStackDirection(before: readonly string[],after: readonly string[]): PageDirection {
 const common=Math.min(before.length,after.length);
 if(!common||before.length===after.length)return 0;
 if(!before.slice(0,common).every((key,index)=>key===after[index]))return 0;
 return after.length>before.length?1:-1;
}
export function pageStackKeys(views: readonly StackView[]): string[] {
 const keys=views.map(view=>view.key);
 if(new Set(keys).size!==keys.length)throw new Error('Page keys must be unique within a stack.');
 return keys;
}
