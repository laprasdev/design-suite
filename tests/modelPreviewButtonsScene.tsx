// The page the model preview Buttons test measures in a browser: a ModelPreview, with its own stylesheet, of the
// cases' one model, whose file fails to load, so the stage stops and its bar's notice offers its recovery Button.
import {ModelPreview} from '../src/react/preview3d/ModelPreview.tsx';
import {PREVIEW_ASSET,PREVIEW_DESCRIPTION} from './modelPreviewButtonsCases.ts';
import {THEME} from './preview3dActorFixture.ts';
import {renderScene} from './renderScene.tsx';
import '../src/react/preview3d/preview.css';

renderScene(<div className="page-surface">
 <ModelPreview description={PREVIEW_DESCRIPTION} assets={[{id:PREVIEW_ASSET.id,name:PREVIEW_ASSET.id,animations:[]}]}
  theme={THEME}
  stageOptions={{floor:false,grid:false,kinds:[]}}/>
</div>);
