// What the module frame test renders (moduleFrameScene.tsx) and measures: a frame for every skin in every container
// form, each found by the frame element and named by its skin and form.
import {element} from '../src/react/elementContract.ts';
import {ContainerForm, type ContainerFormValue} from '../src/skinKinds.ts';
import {SKIN_NAMES} from '../src/skins.ts';

export const ModuleFrameElement = element('module-frame-case');
export interface ModuleFrameCase {readonly skin: string; readonly form: ContainerFormValue}
export const MODULE_FRAME_CASES: readonly ModuleFrameCase[] = Object.freeze(SKIN_NAMES.flatMap(skin =>
  Object.values(ContainerForm).map(form => ({skin, form}))));
export const frameCaseName = ({skin, form}: ModuleFrameCase) => `${skin} ${form}`;
