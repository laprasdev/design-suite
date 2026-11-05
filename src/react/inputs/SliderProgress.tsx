import React from 'react';
import {progressWeights} from './progressWeights.ts';
import {SliderTrack, SLIDER_TRACK_HEIGHT} from './SliderTrack.tsx';

export interface SliderProgressSegment {
 id: string;
 value: number;
 color: string;
 active?: boolean;
}
export interface SliderProgressProps {
 form: 'progress';
 segments: readonly SliderProgressSegment[];
 'aria-label': string;
 compact?: boolean;
 className?: string;
}
// A weighted distribution is an image, not an editable slider or a single completion value.
export function SliderProgress({segments, compact = false, className = '', 'aria-label': label}: SliderProgressProps) {
 const scale = compact ? 1 : 2;
 const weights = progressWeights(segments.map(segment => segment.value));
 if(new Set(segments.map(s => s.id)).size !== segments.length)
  throw new Error('Slider progress needs unique segment IDs');
 return <div role="img" aria-label={label} data-slider-form="progress" className={'bd-slider-progress '+className}
  style={{position: 'relative', height: SLIDER_TRACK_HEIGHT * scale}}>
  <SliderTrack background="var(--line)" width="100%" scale={scale}>
   {segments.map((segment, index) => <span key={segment.id} data-segment={segment.id}
    data-active={segment.active || undefined}
    style={{flexGrow: weights[index], backgroundColor: segment.color}}/>) }
  </SliderTrack>
 </div>;
}
