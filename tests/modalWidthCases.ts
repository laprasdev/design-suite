// The Modals the width test opens (modalWidthScene.tsx), each inside an element naming its case, and what each
// measures: the widths the README gives, a stage of 24 control hit sizes from the theme, and fill, a contained frame's
// whole width inside its inset.
import {LayoutDimensions} from '../src/layout.ts';
import {ModalWidth,type ModalWidthValue} from '../src/react/modalElements.ts';
import {createTheme} from '../src/theme.ts';

export const CASE_ATTRIBUTE='data-case';
// The positioned parent each contained Modal opens in, the page tokens it sets on a page surface, a top past the
// page's inset and one within it.
export const CONTAINED_PARENT=Object.freeze({
 widthPx:600,heightPx:400,pageInsetPx:24,pageGutterPx:40,topPx:100,topInInsetPx:0,
});
// Outside a page surface, the page's inset is the theme's.
export const THEME_INSET_PX=createTheme().space.inset;
export const STAGE_CONTROLS=24;
// The width each value names, as its panel measures in a viewport wide enough for every one; fill's in its parent.
export const MODAL_WIDTH_PX: Readonly<Record<ModalWidthValue,number>>=Object.freeze({
 [ModalWidth.COMPACT]:380,[ModalWidth.TITLED]:420,[ModalWidth.READING]:520,
 [ModalWidth.STAGE]:STAGE_CONTROLS*LayoutDimensions.sizes.buttonHeight,
 [ModalWidth.FILL]:CONTAINED_PARENT.widthPx-2*CONTAINED_PARENT.pageInsetPx,
});
export const VIEWPORT_WIDTHS=[ModalWidth.COMPACT,ModalWidth.TITLED,ModalWidth.READING,ModalWidth.STAGE] as const;
export const VIEWPORT_PX=Object.freeze({width:1280,height:800});
// The cases besides one per width: a plain and a titled Modal naming none, a frame kept the page's gutter, a frame
// outside a page surface, a top past the inset and a top within it.
export const ModalCase=Object.freeze({
 PLAIN:'plain-default',TITLED:'titled-default',GUTTER:'gutter-fill',OUTSIDE_PAGE:'outside-page-fill',
 TOP:'contained-top',TOP_IN_INSET:'contained-top-in-inset',
} as const);
