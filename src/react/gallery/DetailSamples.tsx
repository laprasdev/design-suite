import {skinContainerCSS} from '../../skinContainer.ts';
import {ModuleVectorInput} from '../inputs/ModuleVectorInput.tsx';
import React, {useState} from 'react';
import {Layers} from 'lucide-react';
import {ModuleNumberInput} from '../inputs/ModuleNumberInput.tsx';
import {ModuleTextInput} from '../inputs/ModuleTextInput.tsx';
import {ModuleColorInput} from '../inputs/ModuleColorInput.tsx';
import {ModuleCurve} from '../inputs/ModuleCurve.tsx';
import {ModuleOpenButton} from '../inputs/ModuleOpenButton.tsx';
import {ModuleToolButton} from '../inputs/ModuleToolButton.tsx';
import {ModuleField, ModuleKnob} from '../../synth/components/synth/ModuleGrid.tsx';
import {Graph} from '../../synth/components/synth/Graph.tsx';
import {GridModule} from '../module/GridModule.tsx';
import {useStyle} from '../../synth/StyleContext.tsx';
import {FieldEmphasis} from '../../fields.ts';
import {containerCSS} from '../../synth/design/Composable.ts';
import {SampleState, type ElementSampleProps} from './elementCatalog.ts';

const CURVE = [{x: 0, y: 0}, {x: 0.25, y: 1}, {x: 0.55, y: 0.65}, {x: 0.8, y: 0.65}, {x: 1, y: 0}];

export function DetailSample({group, option, state}: ElementSampleProps) {
  const style = useStyle().getEffectiveStyle();
  const [vector, setVector] = useState([20, 40, 60]), [name, setName] = useState('Motion');
  const [hex, setHex] = useState(style.primaryColor), [alpha, setAlpha] = useState(1);
  const [open, setOpen] = useState(false);
  const disabled = state === SampleState.DISABLED;
  if (group === 'vector') return <ModuleVectorInput label="Vector" appearance={option} disabled={disabled}
    vector={{x: vector[0], y: vector[1], z: vector[2]}}
    limits={{x: {min: 0, max: 100}, y: {min: 0, max: 100}, z: {min: 0, max: 100}}}
    onAxis={(axis, value) => setVector(all => all.map((v, i) => i === ['x', 'y', 'z'].indexOf(axis) ? value : v))}/>;
  if (group === 'text') return <ModuleTextInput ariaLabel="Name" value={name}
    onChange={setName} disabled={disabled} />;
  if (group === 'color') return <ModuleColorInput ariaLabel="Tint" hex={hex} alpha={alpha}
    onHex={setHex} onAlpha={setAlpha} disabled={disabled} />;
  if (group === 'curve') return <ModuleCurve ariaLabel="Envelope" points={CURVE} />;
  if (group === 'graph') return <Graph variant={option === 'bipolar' ? 'bipolar' : 'unipolar'}
    data={CURVE} width={220} height={100} color="secondary" />;
  if (group === 'opens') return <div className="element-open">
    <ModuleOpenButton ariaLabel="Details" appearance={option} onPress={() => setOpen(!open)} disabled={disabled}/>
    {open && <ModuleNumberInput ariaLabel="Detail value" value={alpha} onChange={setAlpha} />}
  </div>;
  if (group === 'container') return <div className="element-module" style={skinContainerCSS(style, option)}>
    <GridModule title="Module"><div className="element-module-content">
      <ModuleKnob ariaLabel="Amount" disabled={disabled} value={vector[0]} min={0} max={100} integer
        onChange={next => setVector([next, vector[1], vector[2]])} />
      <ModuleCurve ariaLabel="Envelope" points={CURVE} />
    </div></GridModule>
  </div>;
  if (group === 'readout') return <ModuleField label="Value" value="42.0" emphasis={FieldEmphasis.SET}>
    <span aria-label="Read only">↗</span>
  </ModuleField>;
  throw new Error(`No element sample for ${group}/${option}`);
}
