// Renders the stage's stacking layers overlapping in one positioned stage: the arrange wrapper (no z-index of its own,
// holding gutters and the chip) mounts before the page wrapper (no z-index of its own, holding flip, frame and held
// tiles), so only z-index order puts the chip on top of a held tile.
import {PageShellDimensions} from '../src/pageShellLayout.ts';
import {
  ARRANGE_WRAPPED_LAYERS, STAGE_LAYER_BOX, STAGE_STACK_BOTTOM_TO_TOP, StageLayersHost, type StageLayerName,
} from './pageShellLayersCases.ts';
import {renderScene} from './renderScene.tsx';

const layerTile = (name: StageLayerName) => <div key={name} data-stage-layer={name}
  data-arrange-chip={name === 'arrangeChipLayer' || undefined}
  style={{position: 'absolute', inset: 0, zIndex: PageShellDimensions[name]}}/>;
const pageLayers = STAGE_STACK_BOTTOM_TO_TOP.filter(name => !ARRANGE_WRAPPED_LAYERS.includes(name));

renderScene(<div className={StageLayersHost.className} style={{position: 'relative', ...STAGE_LAYER_BOX}}>
  <div style={{position: 'absolute', inset: 0}}>{ARRANGE_WRAPPED_LAYERS.map(layerTile)}</div>
  <div style={{position: 'absolute', inset: 0}}>{pageLayers.map(layerTile)}</div>
</div>);
