// The page the lead rows test measures in a browser: an ends row whose control holds lead rows, as a list of named
// states with their tools does.
import {StyleProvider} from '../src/synth/StyleContext.tsx';
import {FieldEmphasis} from '../src/fields.ts';
import {ModuleFieldRow, ModuleFieldRows, RowsForm} from '../src/react/grid/ModuleFieldRows.tsx';
import {LEAD_ROWS, LeadRowsHost} from './leadRowsCases.ts';
import {renderScene} from './renderScene.tsx';

const {width, tool, line} = LEAD_ROWS;
const box = <span style={{display: 'block', width: tool, height: tool}}/>;
renderScene(<StyleProvider persist={false} documentStyles={false}>
  <div className={LeadRowsHost.className} style={{display: 'flex', width}}><ModuleFieldRows>
    <ModuleFieldRow label="List" emphasis={FieldEmphasis.SET}><ModuleFieldRows form={RowsForm.LEAD}>
      <ModuleFieldRow form={RowsForm.LEAD} label={line} emphasis={FieldEmphasis.SET} lead={<span>{line}</span>}
        tool={box}>{box}</ModuleFieldRow>
      <ModuleFieldRow form={RowsForm.LEAD} label={line} emphasis={FieldEmphasis.SET} lead={<span>{line}</span>}
        tool={box}/>
    </ModuleFieldRows></ModuleFieldRow>
  </ModuleFieldRows></div>
</StyleProvider>);
