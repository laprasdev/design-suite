// The page the width test measures in a browser: every width a viewport Modal names and each default, open at once,
// and contained Modals in positioned parents: filling one inside either inset on a page surface, filling one outside
// any page surface, and placing one past the page's inset and one within it; and an anchored Modal naming a width and
// one taking its content's.
import type {CSSProperties,ReactNode} from 'react';
import {Modal,ModalRow} from '../src/react/index.ts';
import {ModalFrameInset,ModalPlacement,ModalWidth} from '../src/react/modalElements.ts';
import {ANCHORED_WIDTH,CASE_ATTRIBUTE,CONTAINED_PARENT,ModalCase,VIEWPORT_WIDTHS} from './modalWidthCases.ts';
import {renderScene} from './renderScene.tsx';

const {widthPx,heightPx,pageInsetPx,pageGutterPx,topPx,topInInsetPx}=CONTAINED_PARENT;
const PASSAGE='A passage long enough to reach each width a Modal names before it wraps onto another line of text.';
// Content far narrower than its frame, which only fill widens.
const WORD='Fill';
// The page tokens a page surface sets around its content.
const PAGE_SURFACE: CSSProperties={'--page-inset':`${pageInsetPx}px`,'--page-gutter':`${pageGutterPx}px`};
const Case=({name,children}: {name: string;children: ReactNode})=><div {...{[CASE_ATTRIBUTE]:name}}>{children}</div>;
const Parent=({name,page,children}: {name: string;page: CSSProperties;children: ReactNode})=><div
 {...{[CASE_ATTRIBUTE]:name}} style={{position:'relative',width:`${widthPx}px`,height:`${heightPx}px`,...page}}>
 {children}
</div>;

renderScene(<>
 {VIEWPORT_WIDTHS.map(width=><Case key={width} name={width}><Modal open width={width}>{PASSAGE}</Modal></Case>)}
 <Case name={ModalCase.PLAIN}><Modal open>{PASSAGE}</Modal></Case>
 <Case name={ModalCase.TITLED}><Modal open title="Titled"><ModalRow>{PASSAGE}</ModalRow></Modal></Case>
 <Parent name={ModalWidth.FILL} page={PAGE_SURFACE}>
  <Modal open placement={ModalPlacement.CONTAINED} width={ModalWidth.FILL}>{WORD}</Modal>
 </Parent>
 <Parent name={ModalCase.GUTTER} page={PAGE_SURFACE}>
  <Modal open placement={ModalPlacement.CONTAINED} width={ModalWidth.FILL} frameInset={ModalFrameInset.GUTTER}>
   {WORD}
  </Modal>
 </Parent>
 <Parent name={ModalCase.OUTSIDE_PAGE} page={{}}>
  <Modal open placement={ModalPlacement.CONTAINED} width={ModalWidth.FILL}>{WORD}</Modal>
 </Parent>
 <Parent name={ModalCase.TOP} page={PAGE_SURFACE}>
  <Modal open placement={ModalPlacement.CONTAINED} top={topPx}>{PASSAGE}</Modal>
 </Parent>
 <Parent name={ModalCase.TOP_IN_INSET} page={PAGE_SURFACE}>
  <Modal open placement={ModalPlacement.CONTAINED} top={topInInsetPx}>{PASSAGE}</Modal>
 </Parent>
 <Case name={ModalCase.ANCHORED_NAMED}>
  <Modal open placement={ModalPlacement.ANCHORED} width={ANCHORED_WIDTH}>{WORD}</Modal>
 </Case>
 <Case name={ModalCase.ANCHORED_CONTENT}><Modal open placement={ModalPlacement.ANCHORED}>{WORD}</Modal></Case>
</>);
