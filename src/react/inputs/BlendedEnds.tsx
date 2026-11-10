import React from 'react';
import {Borders} from '../../tokens.ts';
import {MODULATOR_FADE, MODULATOR_GLOW, modulatorOpacity} from '../../synth/components/synth/modulation.ts';
import {ReachDirection} from './modulationBlend.ts';
import {endKey, endSlicePath, type BlendEndGroup} from './blendEnds.ts';
import {ModulationPart, sourcePart} from './modulationParts.ts';
import type {ModulationTrackProps} from './modulationTrackProps.ts';

export function BlendedEnds({groups, colors, modulators = [], selectedSource, onSelectSource, dot, centre}:
  Pick<ModulationTrackProps, 'modulators' | 'selectedSource' | 'onSelectSource'> & {
    groups: BlendEndGroup[]; colors: string[]; dot: number; centre: number;
  }) {
  return <>{groups.map(group => <div key={group.members.map(endKey).join(',')}
    {...{[ModulationPart.END_GROUP]: group.members.length}}
    style={{position: 'absolute', left: `${group.at}%`, bottom: centre - dot / 2, width: dot, height: dot,
      transform: 'translateX(-50%)', pointerEvents: 'none'}}>
    {group.members.map((end, index) => {
      const modulator = modulators[end.source], color = colors[end.source];
      const name = `Modulation source ${end.source + 1}${modulator.bipolar
        ? ` ${end.direction === ReachDirection.UP ? 'up' : 'down'}` : ''}`;
      const part = sourcePart(onSelectSource, modulator.source, name);
      return <div key={endKey(end)} {...part.attributes}
        {...{[ModulationPart.SOURCE]: modulator.source, [ModulationPart.ORDER]: end.source,
          [ModulationPart.END]: end.direction}}
        style={{...part.style, position: 'absolute', inset: 0, borderRadius: '50%', boxSizing: 'border-box',
          clipPath: endSlicePath(index, group.members.length, dot),
          background: end.clamped ? 'transparent' : color,
          border: end.clamped ? `${Borders.standard.width}px ${Borders.standard.style} ${color}` : 'none',
          boxShadow: `0 0 ${MODULATOR_GLOW}px ${color}`, transition: MODULATOR_FADE,
          opacity: modulatorOpacity(modulator.source, selectedSource)}}/>;
    })}
  </div>)}</>;
}
