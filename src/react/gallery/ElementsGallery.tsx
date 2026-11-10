import React, {useState, type CSSProperties, type ReactNode} from 'react';
import type {PageHeaderBarProps} from '../PageBar.tsx';
import type {ActionBarNotice} from '../ActionBar.tsx';
import {RecordTable} from '../table/RecordTable.tsx';
import {ElementFeedback} from './ElementFeedback.tsx';
import {StyleProvider} from '../../synth/StyleContext.tsx';
import {DEFAULT_SKIN} from '../../skins.ts';
import {PHI, LayoutDimensions} from '../../layout.ts';
import {createSkinTheme} from '../../skinTheme.ts';
import {themeVariables} from '../../theme.ts';
import type {ThemeData} from '../../themeChannel.ts';
import type {ComponentSkin, SkinAssignments} from '../../skinAssignments.ts';
import {Label} from '../accents.tsx';
import {NumberSample} from './NumberSamples.tsx';
import {ChoiceSample} from './ChoiceSamples.tsx';
import {DetailSample} from './DetailSamples.tsx';
import {ElementKindIndex} from './ElementKindIndex.tsx';
import {GalleryControls} from './GalleryControls.tsx';
import {CandidateActions, candidateState, useFeedbackEditing} from './CandidateActions.tsx';
import {DEFAULT_ELEMENT_WIDTH, ELEMENT_GROUPS, ElementFilter, PalettePick, SampleModulation, SampleState, candidateKey,
  supportsSampleState, type ElementFilterValue, type ElementGroup, type ElementOption, type ElementSampleProps,
  type SampleModulationValue, type SampleStateValue} from './elementCatalog.ts';

const SAMPLES: Record<string, React.ComponentType<ElementSampleProps>> = {
  number: NumberSample, choice: ChoiceSample, detail: DetailSample,
};
export interface ElementsGalleryProps {
  groups?: readonly ElementGroup[]; samples?: Record<string, React.ComponentType<ElementSampleProps>>;
  pageHeader?: Pick<PageHeaderBarProps, 'slots' | 'back'>;
  hostTheme?: ThemeData; library: SkinAssignments; skinId: string;
  onSkin(id: string): void; onCreate(name: string): void;
  onAssign(group: string, option: string, selected: boolean): void;
  onActivate(group: string, option: string): void;
  onFeedback(group: string, option: string, text: string): Promise<boolean>;
  onPreview(skin: ComponentSkin, palette: string): void;
  busy?: boolean; header?: ReactNode; footerSettings?: ReactNode; notice?: ActionBarNotice | null;
  previewLabel?: string;
}
function Candidate({group, option, skin, palette, state, modulation, feedback, editing, onClose,
  onFeedback, samples, typography, busy}: {
  typography?: ThemeData['theme']['typography'];
  samples: Record<string, React.ComponentType<ElementSampleProps>>;
  group: ElementGroup; option: ElementOption; skin: ComponentSkin; palette: string;
  state: SampleStateValue; modulation: SampleModulationValue; busy?: boolean;
  feedback: string; editing: boolean; onClose(): void; onFeedback: ElementsGalleryProps['onFeedback'];
}) {
  const Sample = samples[group.sample];
  if (!Sample) throw new Error(`No sample renderer named ${group.sample}`);
  const {selected, active} = candidateState(skin, group, option);
  return <div className="element-candidate" data-candidate={candidateKey(group.id, option.id)}
    data-assigned={selected || undefined} data-active={active || undefined}>
    <StyleProvider persist={false} palette={palette} skin={skin} documentStyles={false}>
      <fieldset className="element-sample" aria-label={`${group.label}: ${option.label}`} data-sample-state={state}
        disabled={state === SampleState.DISABLED} data-preview-palette={palette}
        style={{...themeVariables({...createSkinTheme(palette, true), ...(typography && {typography})}),
          minHeight: group.preview?.height}}>
        <div className="element-sample-content" style={{height: group.preview?.height}}>
          <Sample group={group.id} option={option.id} state={state} modulation={modulation}/>
        </div>
      </fieldset>
    </StyleProvider>
    <ElementFeedback label={`${group.label}: ${option.label}`} value={feedback} busy={busy} editing={editing}
      onClose={onClose} onSave={text => onFeedback(group.id, option.id, text)}/>
  </div>;
}
export function ElementsGallery(props: ElementsGalleryProps) {
  const {library, skinId, hostTheme, busy, header, notice, onSkin, onCreate, onAssign, onActivate,
    onPreview, onFeedback} = props;
  const skin = library.skins.find(item => item.id === skinId);
  if (!skin) throw new Error('The selected component skin is unavailable.');
  const [palette, setPalette] = useState<string>(PalettePick.HOST);
  const [state, setState] = useState<SampleStateValue>(SampleState.SET);
  const [modulation, setModulation] = useState<SampleModulationValue>(SampleModulation.SINGLE);
  const editing = useFeedbackEditing(), [filter, setFilter] = useState<ElementFilterValue>(ElementFilter.ALL);
  const hostPalette = hostTheme?.skin ?? DEFAULT_SKIN;
  const samplePalette = palette === PalettePick.HOST ? hostPalette : palette;
  const samples = {...SAMPLES, ...props.samples};
  const shown = (group: ElementGroup, option: ElementOption) => supportsSampleState(option, state)
    && (filter === ElementFilter.ALL || skin.candidates[group.id]?.includes(option.id));
  const groups = (props.groups ?? ELEMENT_GROUPS).map(group => ({...group,
    options: group.options.filter(option => shown(group, option))})).filter(group => group.options.length);
  const variables = {...themeVariables(hostTheme?.theme ?? createSkinTheme(DEFAULT_SKIN)),
    '--element-ratio': PHI, '--element-gap': `${LayoutDimensions.spacing.rowGap}px`} as CSSProperties;
  const controls = {pageHeader: props.pageHeader, footerSettings: props.footerSettings, skin, skins: library.skins,
    palette, state, modulation, filter, busy, header, notice,
    index: <ElementKindIndex groups={groups}/>,
    previewLabel: props.previewLabel ?? 'Preview', onSkin, onCreate, onPalette: setPalette, onState: setState,
    onModulation: setModulation, onFilter: setFilter, onPreview: () => onPreview(skin, samplePalette)};
  return <StyleProvider persist={false} palette={hostPalette} documentStyles={false}>
    <main className="element-gallery page-surface app-root" data-elements-gallery
      data-host-palette={hostPalette} style={variables}>
      <GalleryControls position="header" {...controls}/>
      <div className="elements-list">
        {groups.map(group => <section key={group.id} id={group.id} className="element-row"
          data-element-kind={group.id} aria-label={group.label}
          style={{'--element-width': `${group.preview?.minWidth ?? DEFAULT_ELEMENT_WIDTH}px`,
            maxWidth: group.preview?.maxWidth} as CSSProperties}>
          <h2 className="element-kind"><Label kind="action">{group.label}</Label></h2>
          <RecordTable comparison flat label={`${group.label} options`} records={[group]} values={{}}
            columns={group.options.map(option => ({key: option.id, sortable: false,
              label: <span className="element-column-heading">
                <span className="element-option-name">{option.label}</span>
                <CandidateActions group={group} option={option} skin={skin} busy={busy}
                  editing={editing.isEditing(group.id, option.id)}
                  onAssign={selected => onAssign(group.id, option.id, selected)}
                  onActivate={() => onActivate(group.id, option.id)}
                  onEdit={() => editing.change(group.id, option.id, true)}/></span>,
              value: () => <Candidate group={group} option={option} skin={skin} palette={samplePalette}
                samples={samples} state={state} modulation={modulation} busy={busy}
                typography={hostTheme?.theme.typography}
                editing={editing.isEditing(group.id, option.id)}
                onClose={() => editing.change(group.id, option.id, false)}
                feedback={library.feedback[group.id]?.[option.id] ?? ''} onFeedback={onFeedback}/>,
            }))}/>
        </section>)}
        {!groups.length && <p role="status">No assigned forms for this state.</p>}
      </div>
      <GalleryControls position="footer" {...controls}/>
    </main>
  </StyleProvider>;
}
