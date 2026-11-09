import React, {type ReactNode} from 'react';

export const SLIDER_TRACK_HEIGHT = 3;
// The Synth rounded track. Progress scales its geometry without changing cell sliders.
export function SliderTrack({background, width, thin = false, scale = 1, children}: {
 background: string; width: number | '100%'; thin?: boolean; scale?: number; children?: ReactNode;
}) {
 return <div className="bd-slider-track" style={{width, height: (thin ? 1 : SLIDER_TRACK_HEIGHT) * scale,
  borderRadius: SLIDER_TRACK_HEIGHT * scale, background,
  position: 'absolute', top: '50%', transform: 'translateY(-50%)'}}>{children}</div>;
}
