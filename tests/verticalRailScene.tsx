// The page the vertical rail test measures in a browser: a closed vertical joined control for one choice and for
// several, side by side on a page surface in an application root, as consumers mount it.
import {JOINED_SEGMENT_VARIANT,SegmentedControl} from '../src/react/SegmentedControl.tsx';
import {RAIL_OPTIONS,RailLabel} from './verticalRailCases.ts';
import {renderScene} from './renderScene.tsx';

const ignore=()=>undefined;
const options=RAIL_OPTIONS.map(value=>({value,label:value}));
renderScene(<div className="app-root page-surface">
 <SegmentedControl variant={JOINED_SEGMENT_VARIANT} orientation="vertical" closed ariaLabel={RailLabel.SINGLE}
  options={options} value={RAIL_OPTIONS[0]} onChange={ignore}/>
 <SegmentedControl variant={JOINED_SEGMENT_VARIANT} orientation="vertical" closed multiple
  ariaLabel={RailLabel.MULTIPLE} options={options} value={[RAIL_OPTIONS[0]]} onChange={ignore}/>
</div>);
