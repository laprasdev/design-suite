// What the menu form's test renders (listboxMenuScene.tsx) and reads: a ListboxSelect in each form side by side, the
// control after them that Tab reaches, the actions the menu offers and the select's options, and the attributes the
// scene writes on its root each time the menu runs an action: how many it has run and the last one.
import {element} from '../src/react/elementContract.ts';

export const MenuSceneElement=Object.freeze({ROOT:element('menu-scene'),AFTER:element('menu-scene-after')});
export const MENU_LABEL='Travel';
export const SELECT_LABEL='Region';
export const MENU_ACTIONS=Object.freeze(['Harbor','Market','Summit','Grove'].map(label=>
 Object.freeze({value:label.toLowerCase(),label})));
export const ACTION_COUNT_ATTRIBUTE='data-actions';
export const LAST_ACTION_ATTRIBUTE='data-last-action';
