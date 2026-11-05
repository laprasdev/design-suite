import React, {type ReactNode} from 'react';
import {ArrowRight} from 'lucide-react';
import {PageHeaderBar, PageFooter} from '../PageBar.tsx';
import {Label} from '../accents.tsx';
import {ListboxSelect} from '../ListboxSelect.tsx';
import {SegmentedControl} from '../SegmentedControl.tsx';
import {SELECTABLE_SKINS} from '../../skins.ts';
import type {ComponentSkin} from '../../skinAssignments.ts';
import {SampleState, type SampleStateValue} from './elementCatalog.ts';

export const SampleModulation = {OFF: 'off', SINGLE: 'single', STACKED: 'stacked', BIPOLAR: 'bipolar'} as const;
export type SampleModulationValue = typeof SampleModulation[keyof typeof SampleModulation];
const STATES = Object.values(SampleState).map(value => ({value, label: value[0].toUpperCase() + value.slice(1)}));
const MODULATION = Object.values(SampleModulation).map(value => ({value,
  label: value === SampleModulation.OFF ? 'No modulation' : `${value[0].toUpperCase() + value.slice(1)} modulation`}));
const PALETTES = [{value: 'host', label: 'Workbench'},
  ...SELECTABLE_SKINS.map(({name, label}) => ({value: name, label}))];
interface Props {
  position: 'header' | 'footer'; skin: ComponentSkin; skins: readonly ComponentSkin[];
  palette: string; state: SampleStateValue; modulation: SampleModulationValue; filter: string;
  busy?: boolean; header?: ReactNode; footerSettings?: ReactNode; previewLabel: string;
  onSkin(id: string): void; onCreate(name: string): void; onPalette(id: string): void;
  onState(state: SampleStateValue): void; onModulation(value: SampleModulationValue): void;
  onFilter(value: string): void; onPreview(): void;
}
/** The same bars and controls as the host. The gallery supplies options and actions only. */
export function GalleryControls(props: Props) {
  const {position, skin, skins, palette, state, modulation, filter, busy, header, previewLabel} = props;
  if (position === 'header') return <PageHeaderBar aria-label="Element assignments" slots={{
    left: <><Label kind="action">Elements</Label><Label kind="action">Skin</Label>
      <ListboxSelect label="Skin" value={skin.id}
      options={skins.map(item => ({value: item.id, label: item.name}))} onChange={props.onSkin}
      onCreate={props.onCreate} searchSubject="skins" title="Choose a skin, or type a new name" disabled={busy}/></>,
    center: <SegmentedControl ariaLabel="Show elements" value={filter} onChange={props.onFilter}
      options={[{value: 'all', label: 'All'}, {value: 'assigned', label: 'Assigned'}]}/>,
    right: header,
  }}/>;
  return <PageFooter aria-label="Element preview settings" settings={<>
    <div className="page-footer-setting"><Label kind="action">Palette</Label>
      <ListboxSelect label="Palette" value={palette} options={PALETTES} onChange={props.onPalette} above/>
    </div>
    <div className="page-footer-setting"><Label kind="action">State</Label>
      <ListboxSelect label="Preview state" value={state} options={STATES} onChange={props.onState} above/>
    </div>
    <div className="page-footer-setting"><Label kind="action">Modulation</Label>
      <ListboxSelect label="Modulation" value={modulation} options={MODULATION} onChange={props.onModulation} above/>
    </div>
    {props.footerSettings}
  </>} action={{disabled: busy, onClick: props.onPreview,
    label: <>{previewLabel}<ArrowRight size={14} aria-hidden/></>}}/>;
}
