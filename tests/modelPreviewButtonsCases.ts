// What the model preview Buttons test renders (modelPreviewButtonsScene.tsx) and measures: the preview's bar with a
// model whose file never loads, so its notice offers the recovery Button. Each Button is named by its label and
// marked by whether the surface pads it.
import {MODEL_PREVIEW_TEXT} from '../src/react/preview3d/model.ts';

export const PADDING_TOKEN='--button-padding-inline';
export const PREVIEW_BUTTONS=Object.freeze([
 {label:MODEL_PREVIEW_TEXT.play,padded:true},
 {label:MODEL_PREVIEW_TEXT.reset,padded:false},
 {label:MODEL_PREVIEW_TEXT.retry,padded:false},
] as const);
