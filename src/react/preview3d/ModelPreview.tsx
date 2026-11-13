import {useMemo, type CSSProperties, type ReactNode} from 'react';
import {Button} from '../Button.tsx';
import {ActionBar, ActionNotice} from '../ActionBar.tsx';
import {ListboxSelect} from '../ListboxSelect.tsx';
import {LoadingIndicator} from '../Pokeball.tsx';
import {SegmentedControl} from '../SegmentedControl.tsx';
import {createTheme, themeVariables} from '../../theme.ts';
import {Typography} from '../../tokens.ts';
import {MODEL_ACTOR_ANIMATION, MODEL_READY_ATTRIBUTE, MODEL_PREVIEW_REVIEW, MODEL_REST_POSE,
  ModelPreviewElement as element} from './model.ts';
import type {ModelPreviewAsset, ModelStageDescription, ModelStageTheme, ModelPreviewFrame} from './model.ts';
import {MODEL_PREVIEW_TEXT as copy, MODEL_PREVIEW_DISPLAY_OPTIONS} from './model.ts';
import {MODEL_PREVIEW_MATERIAL_TEXT as surface, MODEL_PREVIEW_MATERIAL_OPTIONS} from './model.ts';
import {MODEL_PREVIEW_LIGHTING_TEXT as lighting, MODEL_PREVIEW_LIGHTING_OPTIONS} from './model.ts';
import {useModelPreview, type ModelPreviewStageOptions} from './useModelPreview.ts';
import {modelStageFocus} from './actorModel.ts';
import {modelPreviewClip} from './previewDescription.ts';

export interface ModelPreviewProps {
  /** The host's whole stage. Its focused actor is the model the controls act on; the person's choices are edits of
   * it, held by the view until the host changes the same value. */
  description: ModelStageDescription;
  /** The catalog's models, for the model picker and the focused model's name and clips. */
  assets: readonly ModelPreviewAsset[];
  onSelectAsset?: (id: string) => void;
  theme: ModelStageTheme;
  reviewKey?: string;
  /** Fixed when the stage is created: whether it lays its own floor and grid. */
  stageOptions: ModelPreviewStageOptions;
  /** The engine's frame: omitted for the local view, null while waiting. Its entities name actor ids. */
  frame?: ModelPreviewFrame | null;
  className?: string;
  chrome?: boolean;
  /** Consumer controls anchored within the rendered stage. */
  stageOverlay?: ReactNode;
}
function previewTheme(theme: ModelStageTheme): CSSProperties {
  const value = createTheme({colors: theme.colors});
  const colors = Object.fromEntries(Object.entries(value.colors).map(([key, color]) =>
    [`--color-${key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())}`, color]));
  const variables = themeVariables(value);
  variables['--caption-size'] = `${Typography.moduleLabel.fontSize}px`;
  return {...variables, ...colors};
}

// Each field takes a share of its row equal to its option count, so every segment in the row is one width.
const share = (options: readonly unknown[]) => ({'--field-share': options.length}) as CSSProperties;

function PreviewContents({description, asset, assets, onSelectAsset, theme, reviewKey = MODEL_PREVIEW_REVIEW,
  stageOptions, frame, chrome = true, stageOverlay}: ModelPreviewProps & {asset: ModelPreviewAsset}) {
  const view = useModelPreview(description, theme, reviewKey, stageOptions, frame);
  const {selection, choose} = view;
  const clip = modelPreviewClip(selection.animation);
  const playing = selection.animation.kind === MODEL_ACTOR_ANIMATION.playing;
  // A held time moves no clip: the control says why, and neither plays nor pauses.
  const held = view.hold !== null && clip !== MODEL_REST_POSE;
  const animations = [{value: MODEL_REST_POSE, label: copy.rest},
    ...asset.animations.filter(clip => clip.name !== MODEL_REST_POSE)
      .map(clip => ({value: clip.name, label: clip.label}))];
  const displayOptions = MODEL_PREVIEW_DISPLAY_OPTIONS.map(option =>
    ({...option, disabled: option.value !== 'model' && view.boneCount === 0}));
  return <>
    {chrome && <div className={element.CONTROLS.className}>
      {!view.external && <div className="model-preview-fields">
        {assets.length > 1 && onSelectAsset && <label className="model-preview-field">
          <span>{copy.model}</span>
          <ListboxSelect field label={copy.model} value={asset.id} onChange={onSelectAsset}
            searchSubject={copy.modelSearch}
            options={assets.map(model => ({value: model.id, label: model.name}))}/>
        </label>}
        <label className="model-preview-field">
          <span>{copy.animation}</span>
          <ListboxSelect field label={copy.animation} value={clip}
            onChange={view.pick}
            disabled={!view.ready} options={animations}/>
        </label>
      </div>}
      {!view.external && <div className="model-preview-fields">
        <div className="model-preview-field model-preview-choice" style={share(MODEL_PREVIEW_MATERIAL_OPTIONS)}>
          <span>{surface.label}</span>
          <SegmentedControl options={MODEL_PREVIEW_MATERIAL_OPTIONS} value={selection.materialMode}
            onChange={materialMode => choose({materialMode})} ariaLabel={surface.label} fit
            disabled={!view.ready || !view.materialAvailable}/>
          {view.ready && !view.materialAvailable && <span role="status">{surface.unavailable}</span>}
        </div>
        <div className="model-preview-field model-preview-choice" style={share(MODEL_PREVIEW_LIGHTING_OPTIONS)}>
          <span>{lighting.label}</span>
          <SegmentedControl options={MODEL_PREVIEW_LIGHTING_OPTIONS} value={selection.lighting}
            onChange={lighting => choose({lighting})} ariaLabel={lighting.label} fit disabled={!view.ready}/>
        </div>
      </div>}
      <ActionBar compact className="model-preview-actions" notice={view.notice} slots={{
        left: !view.external && <Button variant="primary"
          disabled={!view.ready || clip === MODEL_REST_POSE || held} onClick={view.togglePlayback}>
          {held && view.hold !== null ? copy.held[view.hold] : playing ? copy.pause : copy.play}</Button>,
        center: <SegmentedControl options={displayOptions} value={selection.display}
          onChange={display => choose({display})}
          ariaLabel={copy.display} disabled={!view.loaded}/>,
        right: <Button variant="subtle" disabled={!view.loaded} onClick={view.resetCamera}>{copy.reset}</Button>,
      }}/>
    </div>}
    <div ref={view.host} className={element.STAGE.className} aria-label={copy.canvas(asset.name)}
      aria-busy={!view.loaded && !view.error}
      {...{[MODEL_READY_ATTRIBUTE]: view.ready && (!view.external || view.poseStatus === 'ready')}}>{stageOverlay}</div>
    {(chrome || !view.ready || view.notice || (view.external && view.poseStatus !== 'ready')) &&
      <div className="model-preview-status">
      {!chrome && <ActionNotice notice={view.notice}/>}
      {view.error ? null :
        view.external && view.poseStatus === 'waiting' ? <span role="status">{copy.runtimeWaiting}</span> :
        view.ready ? <span role="status">
          {view.external ? copy.runtimeReady(asset.name) : copy.ready(asset.name)}</span> :
        <LoadingIndicator>{copy.loading}</LoadingIndicator>}
      {!view.external && view.ready && selection.materialMode === 'emission' && view.emissiveCount === 0 &&
        <span role="status">{surface.noEmission}</span>}
      {chrome && view.loaded && description.orbit && <span>{copy.orbit}</span>}
    </div>}
  </>;
}

export function ModelPreview(props: ModelPreviewProps) {
  // The focused actor's asset, named in the catalog; its stage is created again for another asset or clock.
  const focused = modelStageFocus(props.description.actors).asset;
  const asset = props.assets.find(model => model.id === focused.id);
  const style = useMemo(() => previewTheme(props.theme), [props.theme]);
  const instance = JSON.stringify([focused, props.frame !== undefined]);
  return <div className={`${element.ROOT.className}${props.className ? ` ${props.className}` : ''}`}
    style={style} data-model-id={asset?.id}>
    {asset ? <PreviewContents key={instance} {...props} asset={asset}/> :
      <p role="status">{copy.unavailable}</p>}
  </div>;
}
