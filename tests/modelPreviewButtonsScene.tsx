// The page the model preview Buttons test measures in a browser: a ModelPreview of one model whose file is not
// there, so the stage stops and its bar's notice offers its recovery Button, with the preview's own stylesheet.
import {modelStageDescription} from '../src/react/preview3d/descriptionModel.ts';
import {ModelPreview} from '../src/react/preview3d/ModelPreview.tsx';
import {THEME,describing} from './preview3dActorFixture.ts';
import {renderScene} from './renderScene.tsx';
import '../src/react/preview3d/preview.css';

const description=modelStageDescription(describing());
const {asset}=description.actors.actors[0];
renderScene(<div className="page-surface">
 <ModelPreview description={description} assets={[{id:asset.id,name:asset.id,animations:[]}]} theme={THEME}
  stageOptions={{floor:false,grid:false,kinds:[]}}/>
</div>);
