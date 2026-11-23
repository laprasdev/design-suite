// The Boolean cell's fixed looks, each a colour and variant of the one cell, and a cell beside its name.
import { Boolean, type BooleanProps, type BooleanSize, type BooleanColor } from './Boolean.tsx';
import { D, DC, T } from '../../design/index.ts';
import type { Without } from '../../../react/refusedKeys.ts';

export function LightUpBoolean(props: Without<BooleanProps, 'color' | 'variant'>) {
  return <Boolean {...props} color="primary" variant="standard" />;
}

export function PinkBoolean(props: Without<BooleanProps, 'color' | 'variant'>) {
  return <Boolean {...props} color="secondary" variant="standard" />;
}

export function BasicBoolean(props: Without<BooleanProps, 'variant'>) {
  return <Boolean {...props} variant="basic" />;
}

export interface OscillatingBooleanProps {
  active: boolean;
  speed?: number;
  className?: string;
  size?: BooleanSize;
  color?: BooleanColor;
  rounded?: boolean;
}

export function OscillatingBoolean({
  active,
  speed = D.timing.oscillateNormal,
  color = 'primary',
  ...rest
}: OscillatingBooleanProps) {
  return <Boolean value={active} oscillateSpeed={speed} color={color} variant="oscillating" {...rest} />;
}

export interface LabeledBoolProps {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  color: string;
  layout?: 'row' | 'column';
}

export function LabeledBool({ label, value, onChange, color, layout = 'row' }: LabeledBoolProps) {
  const isColumn = layout === 'column';
  return (
    <div style={{ display: 'flex', flexDirection: isColumn ? 'column' : 'row', alignItems: 'center',
      gap: isColumn ? 2 : DC.rowGap }}>
      <LightUpBoolean value={value} onChange={onChange} size="sm" />
      <span style={{ ...T.label, color, opacity: value ? 1 : 0.5 }}>{label}</span>
    </div>
  );
}
