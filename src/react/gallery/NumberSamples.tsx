import React, {useState} from 'react';
import {Knob, KnobPreset, KnobLayout, KnobLabelStyle, KnobValueType}
  from '../../synth/components/synth/Knob.tsx';
import {DualTickRangeKnob} from '../../synth/components/synth/lifecycle/DualTickRangeKnob.tsx';
import {Slider} from '../../synth/components/synth/Slider.tsx';
import {SliderForm} from '../inputs/sliderForm.ts';
import {ModuleNumberInput} from '../inputs/ModuleNumberInput.tsx';
import {ModuleField} from '../../synth/components/synth/ModuleGrid.tsx';
import {FieldEmphasis, NO_VALUE} from '../../fields.ts';
import {ModulationDisplay, ModulationRoot, type ControlModulator} from '../../synth/components/synth/modulation.ts';
import {knobSkinConfig, skinForm} from '../../skinForms.ts';
import {NumberSkinForm, SkinKind, SliderSkinForm, RangeSkinForm} from '../../skinKinds.ts';
import {useStyle} from '../../synth/StyleContext.tsx';
import {GalleryGroup, SampleModulation, SampleState, type ElementSampleProps} from './elementCatalog.ts';

const CONFIG = {...KnobPreset.minimal, layout: KnobLayout.KNOB_ONLY,
  labelStyle: KnobLabelStyle.PLAIN, valueType: KnobValueType.INTEGER};
const MODULATORS: ControlModulator[] = [
  {source: 'computation', root: ModulationRoot.COMPUTATION, depth: -20, sample: 0.5},
  {source: 'relationship', root: ModulationRoot.RELATIONSHIP, depth: 15, sample: 0.7},
];
export function NumberSample({group, option, state, modulation = SampleModulation.OFF}: ElementSampleProps) {
  const {skin} = useStyle();
  const [value, setValue] = useState(40), [low, setLow] = useState(20);
  const [source, setSource] = useState<string | null>(null);
  const disabled = state !== SampleState.SET;
  const previewValue = state === SampleState.UNSET ? 0 : value;
  const emphasis = state === SampleState.SET ? FieldEmphasis.SET : FieldEmphasis.QUIET;
  const shown = state === SampleState.UNSET ? NO_VALUE : String(Math.round(value));
  const mode = group === GalleryGroup.MODULATION ? option : modulation;
  const modulators = mode === SampleModulation.OFF ? []
    : mode === SampleModulation.STACKED || mode === SampleModulation.BLENDED ? MODULATORS
      : [{...MODULATORS[0], bipolar: mode === SampleModulation.BIPOLAR}];
  const modulationDisplay = mode === SampleModulation.BLENDED
    ? ModulationDisplay.BLENDED : ModulationDisplay.LINES;
  const feedback = {modulators, modulationDisplay, selectedSource: source,
    onSelectSource: (next: string) => setSource(current => current === next ? null : next)};
  const meter = option === NumberSkinForm.METER;
  if (group === SkinKind.NUMBER) return <ModuleNumberInput ariaLabel="Amount" appearance={option} integer={meter}
    value={meter ? Math.round(value / 10) : value} min={0} max={meter ? 10 : 100}
    onChange={next => setValue(meter ? next * 10 : next)} disabled={disabled}/>;
  if (group === SkinKind.SLIDER && option === SliderSkinForm.SETTING) return <Slider form={SliderForm.SETTING}
    label="Amount"
    value={value} min={0} max={100} step={1} defaultValue={50} onChange={setValue}
    resetLabel="Reset amount" disabled={disabled} {...feedback}/>;
  const track = group === SkinKind.RANGE && option === RangeSkinForm.TRACK;
  if (group === SkinKind.SLIDER || track) return <div className="element-track">
    <span>{group === SkinKind.RANGE ? low.toFixed(0) : '0'}</span>
    <Slider form={SliderForm.RANGE} ariaLabel="Amount"
      appearance={option === SliderSkinForm.MINIMAL || option === SliderSkinForm.LINE ? option : SliderSkinForm.TRACK}
      low={group === SkinKind.SLIDER ? 0 : low} high={value} min={0} max={100}
      step={1} singleEnded={group === SkinKind.SLIDER} disabled={disabled} {...feedback}
      onChange={(nextLow, nextHigh) => {setLow(nextLow); setValue(nextHigh);}}/>
    <span>{shown}</span>
  </div>;
  if (group === SkinKind.RANGE) return <ModuleField label="Range"
    value={state === SampleState.UNSET ? NO_VALUE : `${low}–${shown}`} emphasis={emphasis}>
    <DualTickRangeKnob config={knobSkinConfig(CONFIG, skinForm(skin, SkinKind.KNOB))}
      minValue={state === SampleState.UNSET ? 0 : low}
      maxValue={previewValue} min={0} max={100} {...feedback}
      minimumGapFraction={0} onMinChange={setLow} onMaxChange={setValue}
      showLimits={false} disabled={disabled} color="primary"/>
  </ModuleField>;
  const config = knobSkinConfig(CONFIG, group === GalleryGroup.MODULATION ? skinForm(skin, SkinKind.KNOB) : option);
  return <ModuleField label="Amount" value={shown} emphasis={emphasis}>
    <Knob config={config} value={previewValue} min={0} max={100} onChange={setValue} disabled={disabled}
      tooltip="Amount" color="primary" {...feedback}/>
  </ModuleField>;
}
