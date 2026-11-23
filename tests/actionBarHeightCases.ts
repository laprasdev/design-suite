// What the action bar height test renders (actionBarHeightScene.tsx) and measures, all on a page surface: an
// ActionBar holding a Button in each slot and a notice with a recovery Button, a notice standing alone with and
// without one, a PageFooter whose setting is taller than its action, a footer on a surface scaled flat, the contents a
// persistent footer hosts (PageFooterContents) with a setting, and a Button outside any bar, each Button named by its
// label.
export const ACTION_BAR_BUTTONS=Object.freeze({left:'Play',center:'Centre',right:'Reset'} as const);
export const NOTICE_BUTTONS=Object.freeze({inBar:'Retry',alone:'Reload'} as const);
export const NOTICE_MESSAGES=Object.freeze({withButton:'Failed',bare:'Saved'} as const);
// The set footer's label is short enough to sit under its min width in any system font, so at a phone width the min
// width, not the label, sets the action's width.
export const FOOTER_ACTIONS=Object.freeze({set:'Next',flat:'Proceed'} as const);
// Each footer surface's list setting, by the surface that holds it, and the options they share.
export const FOOTER_SETTINGS=Object.freeze({PageFooter:'Palette',PageFooterContents:'Theme'} as const);
export const FOOTER_OPTIONS=Object.freeze([{value:'day',label:'Day'}] as const);
// A page surface may scale its bars' vertical chrome with its window (page-bar.css); at none, only the controls keep
// their size.
export const FLAT_SURFACE=Object.freeze({'--page-bar-height-scale':0});
export const OUTSIDE_BUTTON='Outside';
// Chromium lays out boxes in sixty-fourths of a CSS pixel, so a width computed in CSS lands within one of them.
export const LAYOUT_UNIT=1/64;
// A phone's bottom safe area, deeper than a footer's padding, which a footer's action pads its block end to.
export const SAFE_AREA=Object.freeze({bottom:40});
