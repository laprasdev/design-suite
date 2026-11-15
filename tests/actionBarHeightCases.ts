// What the action bar height test renders (actionBarHeightScene.tsx) and measures: a compact ActionBar holding a Button
// in each slot, each named by its label, at a desktop and a phone viewport.
export const ACTION_BAR_BUTTONS=Object.freeze({left:'Play',center:'Centre',right:'Reset'} as const);
export const ACTION_BAR_VIEWPORTS=Object.freeze([{width:1440,height:200},{width:390,height:200}] as const);
