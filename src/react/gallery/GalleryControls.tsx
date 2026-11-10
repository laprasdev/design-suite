import React, {type ReactNode} from 'react';
import {ArrowRight, Check, LayoutGrid} from 'lucide-react';
import {PageHeaderBar, PageFooter, type PageHeaderBarProps} from '../PageBar.tsx';
import {Label} from '../accents.tsx';
import {ListboxSelect} from '../ListboxSelect.tsx';
import type {ActionBarNotice} from '../ActionBar.tsx';
import {SegmentedControl, ICON_SEGMENT_VARIANT} from '../SegmentedControl.tsx';
import {SELECTABLE_SKINS} from '../../skins.ts';
import type {ComponentSkin} from '../../skinAssignments.ts';
import {ElementFilter, PalettePick, SampleModulation, SampleState, sampleLabel, type ElementFilterValue,
  type SampleModulationValue, type SampleStateValue} from './elementCatalog.ts';

const STATES = Object.values(SampleState).map(value => ({value, label: sampleLabel(value)}));
const MODULATION = Object.values(SampleModulation).map(value => ({value, label: sampleLabel(value)}));
const FILTERS = [
  {value: ElementFilter.ALL, label: <LayoutGrid/>, ariaLabel: 'All', title: 'All'},
  {value: ElementFilter.ASSIGNED, label: <Check/>, ariaLabel: 'Assigned', title: 'Assigned'},
];
const PALETTES = [{value: PalettePick.HOST, label: 'Workbench'},
  ...SELECTABLE_SKINS.map(({name, label}) => ({value: name, label}))];
interface Props {
  pageHeader?: Pick<PageHeaderBarProps, 'slots' | 'back'>;
  position: 'header' | 'footer'; skin: ComponentSkin; skins: readonly ComponentSkin[];
  palette: string; state: SampleStateValue; modulation: SampleModulationValue; filter: ElementFilterValue;
  notice?: ActionBarNotice | null; index?: ReactNode;
  busy?: boolean; header?: ReactNode; footerSettings?: ReactNode; previewLabel: string;
  onSkin(id: string): void; onCreate(name: string): void; onPalette(id: string): void;
  onState(state: SampleStateValue): void; onModulation(value: SampleModulationValue): void;
  onFilter(value: ElementFilterValue): void; onPreview(): void;
}
/** The same bars and controls as the host. The gallery supplies options and actions only. */
export function GalleryControls(props: Props) {
  const {position, skin, skins, palette, state, modulation, filter, busy, header, notice, index, previewLabel} = props;
  if (position === 'header') return <PageHeaderBar aria-label="Element assignments" centerRow floatingNotice
    below={index}
    back={props.pageHeader?.back} notice={notice}
      slots={{left: props.pageHeader?.slots.left ?? <Label kind="action">Elements</Label>,
        center: <><Label kind="action">Skin</Label>
          <ListboxSelect label="Skin" value={skin.id}
            options={skins.map(item => ({value: item.id, label: item.name}))} onChange={props.onSkin}
            onCreate={props.onCreate} searchSubject="skins" title="Choose a skin, or type a new name" disabled={busy}/>
          <SegmentedControl ariaLabel="Show elements" value={filter} onChange={props.onFilter}
            iconOnly variant={ICON_SEGMENT_VARIANT} options={FILTERS}/>
          {props.pageHeader?.slots.center}</>,
        right: <>{header}{props.pageHeader?.slots.right}</>,
      }}/>;
  return <PageFooter aria-label="Element preview settings" compact settings={<>
    <div className="page-footer-setting"><Label kind="action">Palette</Label>
      <ListboxSelect label="Palette" value={palette} options={PALETTES} onChange={props.onPalette} title="Palette"
        above/>
    </div>
    <div className="page-footer-setting"><Label kind="action">State</Label>
      <ListboxSelect label="Preview state" value={state} options={STATES} onChange={props.onState} title="State" above/>
    </div>
    <div className="page-footer-setting"><Label kind="action">Modulation</Label>
      <ListboxSelect label="Modulation" value={modulation} options={MODULATION} onChange={props.onModulation}
        title="Modulation" above/>
    </div>
    {props.footerSettings}
  </>} action={{disabled: busy, onClick: props.onPreview, 'aria-label': previewLabel, title: previewLabel,
    label: <><span className="element-preview-text">{previewLabel}</span><ArrowRight size={14} aria-hidden/></>}}/>;
}
