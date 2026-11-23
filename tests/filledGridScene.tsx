// The page the filled grid test measures in a browser: each case's grid in a host whose width and height the test sets.
import {StyleProvider} from '../src/synth/StyleContext.tsx';
import {FilledModuleGrid} from '../src/react/grid/FilledModuleGrid.tsx';
import {ModuleKnob} from '../src/synth/components/synth/ModuleGrid.tsx';
import {FILLED_GRID, FILLED_GRID_CASES, FilledGridCell, FilledGridHost} from './filledGridCases.ts';
import {renderScene} from './renderScene.tsx';

const {rows, cellHeight, widths, heights} = FILLED_GRID;
renderScene(<StyleProvider persist={false} documentStyles={false}>
  <div>{FILLED_GRID_CASES.map(({name, growRows}) => <div key={name} title={name}
    className={FilledGridHost.className}
    style={{display: 'flex', flexDirection: 'column', width: widths[0].width, height: heights[0]}}>
    <FilledModuleGrid rows={rows} growRows={growRows}>
      {Array.from({length: rows}, (_, row) => <div key={row} className={FilledGridCell.className}
        style={{gridRow: row + 1, gridColumn: 1, minHeight: cellHeight}}>
        {row === 0 && <ModuleKnob ariaLabel={`${name} knob`} value={0.5} min={0} max={1} integer={false}
          onChange={() => {}}/>}
      </div>)}
    </FilledModuleGrid>
  </div>)}</div>
</StyleProvider>);
