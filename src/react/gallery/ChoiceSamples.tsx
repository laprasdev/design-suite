import {OptionsEnum} from '../inputs/OptionsEnum.tsx';
import React, {useState} from 'react';
import {ArrowUp, ArrowRight, ArrowDown} from 'lucide-react';
import {ModuleYesNo} from '../../synth/components/synth/ModuleGrid.tsx';
import {PhaseGlyph, PhaseGlyphMode} from '../../synth/components/synth/PhaseGlyph.tsx';
import {FieldEmphasis, YesNo} from '../../fields.ts';
import {SkinKind, ChoiceSkinForm} from '../../skinKinds.ts';
import {PICTURED_ICON_SIZE} from '../inputs/picturedParts.ts';
import {SampleState, type ElementSampleProps} from './elementCatalog.ts';

const OPTIONS = ['X', 'Y', 'Z'].map(value => ({value, label: value}));
const ICONS = [ArrowRight, ArrowUp, ArrowDown];
/** A pictured form's cells size the slot an icon sits in, so its icons fill it. */
const iconOptions = () => OPTIONS.map((option, index) => {
  const Icon = ICONS[index];
  return {...option,
    label: <Icon size={PICTURED_ICON_SIZE} aria-hidden style={{color: 'var(--icon-foreground, currentColor)'}} />,
    ariaLabel: option.label, title: option.label};
});

export function ChoiceSample({group, option, state}: ElementSampleProps) {
  const [value, setValue] = useState('X'), [flags, setFlags] = useState(['X']);
  const [on, setOn] = useState(true), [phases, setPhases] = useState({entrance: true, maintain: true});
  const disabled = state === SampleState.DISABLED;
  if (group === SkinKind.YES_NO) {
    const yesNo = state === SampleState.UNSET ? YesNo.UNSET : state === SampleState.INHERITED
      ? YesNo.INHERIT : on ? YesNo.ON : YesNo.OFF;
    return <ModuleYesNo label="Enabled" state={yesNo} appearance={option}
      emphasis={disabled ? FieldEmphasis.INERT : state === SampleState.SET ? FieldEmphasis.SET : FieldEmphasis.QUIET}
      onPress={() => setOn(!on)}/>;
  }
  if (group === SkinKind.PHASES) return <PhaseGlyph ariaLabel="Phases" height={20} value={phases}
    onChange={disabled ? undefined : setPhases} mode={state === SampleState.UNSET ? PhaseGlyphMode.UNSET
      : state === SampleState.INHERITED ? PhaseGlyphMode.INHERITED : PhaseGlyphMode.SET} />;
  const options = group === SkinKind.LAYERS
    ? Array.from({length: 8}, (_, i) => ({value: String(i), label: String(i + 1)}))
    : group === SkinKind.REFERENCE ? [{value: 'X', label: 'Self'}, {value: 'Y', label: 'Related'}]
    : OPTIONS.map((item, index) => ({...item, tooltip: item.label,
      icon: iconOptions()[index].label}));
  const multi = group === SkinKind.FLAGS || group === SkinKind.LAYERS;
  return <OptionsEnum ariaLabel={group} options={options} value={value} disabled={disabled}
    appearance={group === SkinKind.LAYERS ? ChoiceSkinForm.JOINED : option} litValues={multi ? flags : undefined}
    onChange={next => multi ? setFlags(all => all.includes(next) ? all.filter(item => item !== next) : [...all, next])
      : setValue(next)}/>;
}
