// What the action bar height test renders (actionBarHeightScene.tsx) and measures: an ActionBar holding a Button in
// each slot and a notice with a recovery Button, a notice standing alone, a PageFooter's action, and a Button outside
// any bar, each Button named by its label.
export const ACTION_BAR_BUTTONS=Object.freeze({left:'Play',center:'Centre',right:'Reset'} as const);
export const NOTICE_BUTTONS=Object.freeze({inBar:'Retry',alone:'Reload'} as const);
export const FOOTER_ACTION='Continue';
export const OUTSIDE_BUTTON='Outside';
export const NOTICE_MESSAGE='Failed';
