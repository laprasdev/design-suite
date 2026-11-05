import React, {useState, type CSSProperties, type ReactNode} from 'react';
import {Check, Plus} from 'lucide-react';
import {RecordTable} from '../table/RecordTable.tsx';
import {ElementFeedback} from './ElementFeedback.tsx';
import {StyleProvider} from '../../synth/StyleContext.tsx';
import {DEFAULT_SKIN} from '../../skins.ts';
import {PHI, LayoutDimensions} from '../../layout.ts';
import {createSkinTheme} from '../../skinTheme.ts';
import {themeVariables} from '../../theme.ts';
import type {ThemeData} from '../../themeChannel.ts';
import type {ComponentSkin, SkinAssignments} from '../../skinAssignments.ts';
import {Button} from '../Button.tsx';
import {Label} from '../accents.tsx';
import {NumberSample} from './NumberSamples.tsx';
import {ChoiceSample} from './ChoiceSamples.tsx';
import {DetailSample} from './DetailSamples.tsx';
import {GalleryControls, SampleModulation, type SampleModulationValue} from './GalleryControls.tsx';
import {ELEMENT_GROUPS, SampleState, supportsSampleState, type ElementGroup,
  type ElementOption, type ElementSampleProps, type SampleStateValue} from './elementCatalog.ts';

const SAMPLES: Record<string, React.ComponentType<ElementSampleProps>> = {
  number: NumberSample, choice: ChoiceSample, detail: DetailSample,
};
export interface ElementsGalleryProps {
  groups?: readonly ElementGroup[]; samples?: Record<string, React.ComponentType<ElementSampleProps>>;
  hostTheme?: ThemeData; library: SkinAssignments; skinId: string;
  onSkin(id: string): void; onCreate(name: string): void;
  onAssign(group: string, option: string, selected: boolean): void;
  onActivate(group: string, option: string): void;
  onFeedback(group: string, option: string, text: string): Promise<boolean>;
  onPreview(skin: ComponentSkin, palette: string): void;
  busy?: boolean; header?: ReactNode; footerSettings?: ReactNode; status?: ReactNode; previewLabel?: string;
}
function Candidate({group, option, skin, palette, state, modulation, busy, feedback,
  onAssign, onActivate, onFeedback, samples}: {
  samples: Record<string, React.ComponentType<ElementSampleProps>>;
  group: ElementGroup; option: ElementOption; skin: ComponentSkin; palette: string;
  state: SampleStateValue; modulation: SampleModulationValue;
  feedback: string; onFeedback: ElementsGalleryProps['onFeedback'];
  busy?: boolean; onAssign: ElementsGalleryProps['onAssign']; onActivate: ElementsGalleryProps['onActivate'];
}) {
  const Sample = samples[group.sample];
  if (!Sample) throw new Error(`No sample renderer named ${group.sample}`);
  const selected = !!skin.candidates[group.id]?.includes(option.id), active = skin.active[group.id] === option.id;
  const Icon = selected ? Check : Plus;
  return <div className="element-candidate" data-candidate={`${group.id}/${option.id}`}
    data-assigned={selected || undefined} data-active={active || undefined}>
    <StyleProvider persist={false} palette={palette} skin={skin} documentStyles={false}>
      <fieldset className="element-sample" aria-label={`${group.label}: ${option.label}`} data-sample-state={state}
        disabled={state === SampleState.DISABLED} data-preview-palette={palette}
        style={{...themeVariables(createSkinTheme(palette, true)),
          minHeight: group.preview?.height}}>
        <div className="element-sample-content" style={{height: group.preview?.height}}>
          <Sample group={group.id} option={option.id} state={state} modulation={modulation}/>
        </div>
      </fieldset>
    </StyleProvider>
    {option.assignable !== false && <div className="element-actions">
      <Button variant={selected ? 'accent' : 'ghost'} aria-pressed={selected}
        aria-label={`Assign ${option.label} to ${skin.name}`} disabled={busy}
        onClick={() => onAssign(group.id, option.id, !selected)}>
        <Icon size={14} aria-hidden/>{selected ? 'Assigned' : 'Assign'}
      </Button>
      {selected && !active && <Button aria-label={`Use ${option.label} in ${skin.name}`} disabled={busy}
        onClick={() => onActivate(group.id, option.id)}>Use</Button>}
    </div>}
    <ElementFeedback label={`${group.label}: ${option.label}`} value={feedback} busy={busy}
      onSave={text => onFeedback(group.id, option.id, text)}/>
  </div>;
}
export function ElementsGallery(props: ElementsGalleryProps) {
  const {library, skinId, hostTheme, busy, header, status, onSkin, onCreate, onAssign, onActivate,
    onPreview, onFeedback} = props;
  const skin = library.skins.find(item => item.id === skinId);
  if (!skin) throw new Error('The selected component skin is unavailable.');
  const [palette, setPalette] = useState('host'), [state, setState] = useState<SampleStateValue>(SampleState.SET);
  const [modulation, setModulation] = useState<SampleModulationValue>(SampleModulation.SINGLE);
  const [filter, setFilter] = useState('all');
  const hostPalette = hostTheme?.skin ?? DEFAULT_SKIN, samplePalette = palette === 'host' ? hostPalette : palette;
  const samples = {...SAMPLES, ...props.samples};
  const groups = (props.groups ?? ELEMENT_GROUPS).map(group => ({...group, options: group.options.filter(option =>
    supportsSampleState(option, state) && (filter === 'all' || skin.candidates[group.id]?.includes(option.id)))}))
    .filter(group => group.options.length);
  const variables = {...themeVariables(hostTheme?.theme ?? createSkinTheme(DEFAULT_SKIN)),
    '--element-ratio': PHI, '--element-gap': `${LayoutDimensions.spacing.rowGap}px`} as CSSProperties;
  const controls = {footerSettings: props.footerSettings, skin, skins: library.skins,
    palette, state, modulation, filter, busy, header,
    previewLabel: props.previewLabel ?? 'Preview', onSkin, onCreate, onPalette: setPalette, onState: setState,
    onModulation: setModulation, onFilter: setFilter, onPreview: () => onPreview(skin, samplePalette)};
  return <StyleProvider persist={false} palette={hostPalette} documentStyles={false}>
    <main className="element-gallery page-surface app-root" data-elements-gallery
      data-host-palette={hostPalette} style={variables}>
      <GalleryControls position="header" {...controls}/>
      <nav className="elements-index" aria-label="Element kinds">
        {groups.map(group => <a key={group.id} href={`#${group.id}`}>{group.label}</a>)}
      </nav>
      <div className="elements-list">
        {groups.map(group => <section key={group.id} id={group.id} className="element-row"
          data-element-kind={group.id} aria-label={group.label}
          style={{'--element-width': `${group.preview?.minWidth ?? 240}px`,
            maxWidth: group.preview?.maxWidth} as CSSProperties}>
          <h2 className="element-kind"><Label kind="action">{group.label}</Label></h2>
          <RecordTable comparison flat label={`${group.label} options`} records={[group]} values={{}}
            columns={group.options.map(option => ({key: option.id, sortable: false,
              label: <span className="element-column-heading">{option.label}
                {skin.active[group.id] === option.id && <span>Active</span>}</span>,
              value: () => <Candidate group={group} option={option} skin={skin} palette={samplePalette}
                samples={samples} state={state} modulation={modulation} busy={busy}
                onAssign={onAssign} onActivate={onActivate}
                feedback={library.feedback[group.id]?.[option.id] ?? ''} onFeedback={onFeedback}/>,
            }))}/>
        </section>)}
        {!groups.length && <p role="status">No assigned forms for this state.</p>}
      </div>
      {status}
      <GalleryControls position="footer" {...controls}/>
    </main>
  </StyleProvider>;
}
