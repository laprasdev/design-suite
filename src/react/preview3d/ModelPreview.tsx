import {useMemo, type CSSProperties, type ReactNode} from 'react';
import {Button} from '../Button.tsx';
import {ActionBar} from '../ActionBar.tsx';
import {ListboxSelect} from '../ListboxSelect.tsx';
import {LoadingIndicator} from '../Pokeball.tsx';
import {SegmentedControl} from '../SegmentedControl.tsx';
import {createTheme, themeVariables} from '../../theme.ts';
import {Typography} from '../../tokens.ts';
import {MODEL_READY_ATTRIBUTE, MODEL_PREVIEW_REVIEW, MODEL_REST_POSE, ModelPreviewElement as element} from './model.ts';
import type {ModelPreviewAsset, ModelStageOptions, ModelStageTheme, ModelPreviewPresentation} from './model.ts';
import type {ModelStageCamera, ModelEnvironment, ModelStageActor} from './model.ts';
import {MODEL_PREVIEW_TEXT as copy, MODEL_PREVIEW_DISPLAY_OPTIONS} from './model.ts';
import {MODEL_PREVIEW_MATERIAL_TEXT as surface, MODEL_PREVIEW_MATERIAL_OPTIONS} from './model.ts';
import {MODEL_PREVIEW_LIGHTING_TEXT as lighting, MODEL_PREVIEW_LIGHTING_OPTIONS} from './model.ts';
import {useModelPreview} from './useModelPreview.ts';

export interface ModelPreviewProps {
  assets: readonly ModelPreviewAsset[];
  selectedId: string;
  onSelectAsset?: (id: string) => void;
  theme: ModelStageTheme;
  reviewKey?: string;
  stageOptions?: Omit<ModelStageOptions, 'reviewKey' | 'clock' | 'actors'>;
  presentation?: ModelPreviewPresentation | null;
  camera?: ModelStageCamera | null;
  environment?: ModelEnvironment | null;
  /** Declared actors beside the selected model; a change replaces them without reloading the model. */
  actors?: readonly ModelStageActor[];
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

function PreviewContents({asset, assets, onSelectAsset, theme, reviewKey = MODEL_PREVIEW_REVIEW,
  stageOptions, presentation, camera, environment, actors, chrome = true, stageOverlay}:
  ModelPreviewProps & {asset: ModelPreviewAsset}) {
  const view = useModelPreview(asset, theme, reviewKey, stageOptions, presentation, {camera, environment}, actors);
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
          <ListboxSelect field label={copy.animation} value={view.animation} onChange={view.chooseAnimation}
            disabled={!view.ready} options={animations}/>
        </label>
      </div>}
      {!view.external && <div className="model-preview-fields">
        <div className="model-preview-field model-preview-choice" style={share(MODEL_PREVIEW_MATERIAL_OPTIONS)}>
          <span>{surface.label}</span>
          <SegmentedControl options={MODEL_PREVIEW_MATERIAL_OPTIONS} value={view.materialMode}
            onChange={view.chooseMaterialMode} ariaLabel={surface.label} fit
            disabled={!view.ready || !view.materialAvailable}/>
          {view.ready && !view.materialAvailable && <span role="status">{surface.unavailable}</span>}
        </div>
        <div className="model-preview-field model-preview-choice" style={share(MODEL_PREVIEW_LIGHTING_OPTIONS)}>
          <span>{lighting.label}</span>
          <SegmentedControl options={MODEL_PREVIEW_LIGHTING_OPTIONS} value={view.lighting}
            onChange={view.chooseLighting} ariaLabel={lighting.label} fit disabled={!view.ready}/>
        </div>
      </div>}
      <ActionBar compact className="model-preview-actions" slots={{
        left: !view.external && <Button variant="primary" disabled={!view.ready || view.animation === MODEL_REST_POSE}
          onClick={view.togglePlayback}>{view.playing ? copy.pause : copy.play}</Button>,
        center: <SegmentedControl options={displayOptions} value={view.display} onChange={view.chooseDisplay}
          ariaLabel={copy.display} disabled={!view.loaded}/>,
        right: <Button variant="subtle" disabled={!view.loaded} onClick={view.resetCamera}>{copy.reset}</Button>,
      }}/>
    </div>}
    <div ref={view.host} className={element.STAGE.className} aria-label={copy.canvas(asset.name)}
      aria-busy={!view.loaded && !view.error}
      {...{[MODEL_READY_ATTRIBUTE]: view.ready && (!view.external || view.poseStatus === 'ready')}}>{stageOverlay}</div>
    {(chrome || !view.ready || view.failure || (view.external && view.poseStatus !== 'ready')) &&
      <div className="model-preview-status">
      {view.error ? <div role="alert">{copy.failed}{' '}
        <Button variant="subtle" onClick={view.retry}>{copy.retry}</Button>
      </div> : view.external && view.poseStatus === 'error' ? <span role="alert">{copy.runtimeInvalid}</span> :
        view.failure ? <span role="alert">{copy.sceneInvalid}</span> :
        view.external && view.poseStatus === 'waiting' ? <span role="status">{copy.runtimeWaiting}</span> :
        view.ready ? <span role="status">
          {view.external ? copy.runtimeReady(asset.name) : copy.ready(asset.name)}</span> :
        <LoadingIndicator>{copy.loading}</LoadingIndicator>}
      {!view.external && view.ready && view.materialMode === 'emission' && view.emissiveCount === 0 &&
        <span role="status">{surface.noEmission}</span>}
      {chrome && view.loaded && stageOptions?.orbit !== false && <span>{copy.orbit}</span>}
    </div>}
  </>;
}

export function ModelPreview(props: ModelPreviewProps) {
  const asset = props.assets.find(model => model.id === props.selectedId);
  const style = useMemo(() => previewTheme(props.theme), [props.theme]);
  const bindings = asset ? Object.entries(asset.attachments).sort(([a], [b]) => a.localeCompare(b)) : [];
  const instance = JSON.stringify([asset?.id, asset?.path, asset?.revision, asset?.sha256, bindings,
    props.presentation !== undefined, asset?.runtimeMaterials]);
  return <div className={`${element.ROOT.className}${props.className ? ` ${props.className}` : ''}`}
    style={style} data-model-id={asset?.id}>
    {asset ? <PreviewContents key={instance} {...props} asset={asset}/> :
      <p role="status">{copy.unavailable}</p>}
  </div>;
}
