// The page the segmented text test reads in a browser: a SegmentedControl in each density segmentedTextCases.ts
// names, under the default theme.
import {SegmentedControl} from '../src/react/SegmentedControl.tsx';
import {SEGMENT_DENSITIES,SEGMENT_OPTIONS} from './segmentedTextCases.ts';
import {renderScene} from './renderScene.tsx';

const ignore=()=>undefined;
renderScene(<>{SEGMENT_DENSITIES.map(({name,...density})=><SegmentedControl key={name} {...density}
 ariaLabel={name} value={SEGMENT_OPTIONS[0].value} options={SEGMENT_OPTIONS} onChange={ignore}/>)}</>);
