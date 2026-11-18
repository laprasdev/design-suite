// The page the module frame test measures in a browser: a module frame for every skin in every container form.
import {skinContainerCSS} from '../src/skinContainer.ts';
import {skinStyle} from '../src/synth/skinStyle.ts';
import {MODULE_FRAME_CASES, ModuleFrameElement, frameCaseName} from './moduleFrameCases.ts';
import {renderScene} from './renderScene.tsx';

renderScene(<div>{MODULE_FRAME_CASES.map(frame => <div key={frameCaseName(frame)} title={frameCaseName(frame)}
  className={ModuleFrameElement.className} style={skinContainerCSS(skinStyle(frame.skin), frame.form)}/>)}</div>);
