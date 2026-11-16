// What the model preview Buttons test renders (modelPreviewButtonsScene.tsx) and measures: the preview's bar with one
// model, whose file fails to load (the page has no address to read it from), so the stage stops and its notice
// offers the recovery Button and names that file. Each Button is named by its label and marked by whether the
// surface pads it.
import {modelStageDescription} from '../src/react/preview3d/descriptionModel.ts';
import {MODEL_PREVIEW_TEXT} from '../src/react/preview3d/model.ts';
import {describing} from './preview3dActorFixture.ts';

export const PREVIEW_DESCRIPTION=modelStageDescription(describing());
export const PREVIEW_ASSET=PREVIEW_DESCRIPTION.actors.actors[0].asset;

export const PADDING_TOKEN='--button-padding-inline';
export const PREVIEW_BUTTONS=Object.freeze([
 {label:MODEL_PREVIEW_TEXT.play,padded:true},
 {label:MODEL_PREVIEW_TEXT.reset,padded:false},
 {label:MODEL_PREVIEW_TEXT.retry,padded:false},
] as const);
