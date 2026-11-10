import {skinContainerCSS} from '../../skinContainer.ts';
import {ModuleVectorInput} from '../inputs/ModuleVectorInput.tsx';
import React, {useState} from 'react';
import {ModuleNumberInput} from '../inputs/ModuleNumberInput.tsx';
import {ModuleTextInput} from '../inputs/ModuleTextInput.tsx';
import {ModuleColorInput} from '../inputs/ModuleColorInput.tsx';
import {ModuleCurve} from '../inputs/ModuleCurve.tsx';
import {ModuleOpenButton} from '../inputs/ModuleOpenButton.tsx';
import {ModuleField, ModuleKnob} from '../../synth/components/synth/ModuleGrid.tsx';
import {Graph} from '../../synth/components/synth/Graph.tsx';
import {GraphForm} from '../../synth/components/synth/graphForm.ts';
import {GridModule} from '../module/GridModule.tsx';
import {useStyle} from '../../synth/StyleContext.tsx';
import {FieldEmphasis} from '../../fields.ts';
import {containerFormOf, SkinKind} from '../../skinKinds.ts';
import {GalleryGroup, SampleState, type ElementSampleProps} from './elementCatalog.ts';

const CURVE = [{x: 0, y: 0}, {x: 0.25, y: 1}, {x: 0.55, y: 0.65}, {x: 0.8, y: 0.65}, {x: 1, y: 0}];

export function DetailSample({group, option, state}: ElementSampleProps) {
  const style = useStyle().getEffectiveStyle();
  const [vector, setVector] = useState([20, 40, 60]), [name, setName] = useState('Motion');
  const [hex, setHex] = useState(style.primaryColor), [alpha, setAlpha] = useState(1);
  const [open, setOpen] = useState(false);
  const disabled = state === SampleState.DISABLED;
  if (group === SkinKind.VECTOR) return <ModuleVectorInput label="Vector" appearance={option} disabled={disabled}
    vector={{x: vector[0], y: vector[1], z: vector[2]}}
    limits={{x: {min: 0, max: 100}, y: {min: 0, max: 100}, z: {min: 0, max: 100}}}
    onAxis={(axis, value) => setVector(all => all.map((v, i) => i === ['x', 'y', 'z'].indexOf(axis) ? value : v))}/>;
  if (group === SkinKind.TEXT) return <ModuleTextInput ariaLabel="Name" value={name}
    onChange={setName} disabled={disabled} />;
  if (group === SkinKind.COLOR) return <ModuleColorInput ariaLabel="Tint" hex={hex} alpha={alpha}
    onHex={setHex} onAlpha={setAlpha} disabled={disabled} />;
  if (group === SkinKind.CURVE) return <ModuleCurve ariaLabel="Envelope" points={CURVE} />;
  if (group === GalleryGroup.GRAPH) return <Graph
    variant={option === GraphForm.BIPOLAR ? GraphForm.BIPOLAR : GraphForm.UNIPOLAR}
    data={CURVE} width={220} height={100} color="secondary" />;
  if (group === SkinKind.OPENS) return <div className="element-open">
    <ModuleOpenButton ariaLabel="Details" appearance={option} onPress={() => setOpen(!open)} disabled={disabled}/>
    {open && <ModuleNumberInput ariaLabel="Detail value" value={alpha} onChange={setAlpha} />}
  </div>;
  if (group === SkinKind.CONTAINER) return <div className="element-module"
    style={skinContainerCSS(style, containerFormOf(option))}>
    <GridModule title="Module"><div className="element-module-content">
      <ModuleKnob ariaLabel="Amount" disabled={disabled} value={vector[0]} min={0} max={100} integer
        onChange={next => setVector([next, vector[1], vector[2]])} />
      <ModuleCurve ariaLabel="Envelope" points={CURVE} />
    </div></GridModule>
  </div>;
  if (group === SkinKind.READOUT) return <ModuleField label="Value" value="42.0" emphasis={FieldEmphasis.SET}>
    <span aria-label="Read only">↗</span>
  </ModuleField>;
  throw new Error(`No element sample for ${group}/${option}`);
}
