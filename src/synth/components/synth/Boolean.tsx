import {SwitchBoolean} from '../../../react/inputs/SwitchBoolean.tsx';
import {BooleanForm, type SwitchBooleanProps} from './booleanForm.ts';
export {BooleanForm, type SwitchBooleanProps};
import React, { useEffect, useState, useCallback } from 'react';
import { useStyle } from '../../StyleContext.tsx';
import { getColorScheme, getBooleanStyles, getInsetShadow, type ColorType } from '../../../color.ts';
import { D, F, C, DC, SYNTH_LABEL, TransitionKeys } from '../../design/index.ts';
import { useTooltipSafe } from './TooltipContext.tsx';
import {HoverDetail} from '../../../react/HoverDetail.tsx';
import {SelectionMark} from '../../../react/SelectionMark.tsx';


type BooleanSize = 'xs' | 'sm' | 'md' | 'lg';
type BooleanColor = 'primary' | 'secondary' | 'green' | 'cyan' | 'pink';
type BooleanVariant = 'standard' | 'basic' | 'oscillating';

export interface BooleanProps {
  form?: typeof BooleanForm.CELL;
  value: boolean;
  onChange?: (value: boolean) => void;
  className?: string;
  size?: BooleanSize;
  color?: BooleanColor;
  variant?: BooleanVariant;
  rounded?: boolean;
  oscillateSpeed?: number;
  label?: string; // For tooltip generation
  tooltip?: string; // Override auto-generated tooltip
  disabled?: boolean;
}

let _sizeMap: Record<BooleanSize, number> | null = null;
function getSizeMap(): Record<BooleanSize, number> {
  return _sizeMap ??= { xs: D.sizes.booleanMicro, sm: D.sizes.booleanSmall, md: D.sizes.booleanMedium, lg: D.sizes.booleanLarge };
}

export interface SettingBooleanProps {
  form: typeof BooleanForm.SETTING;
  value: boolean;
  onChange?(value: boolean): void;
  label: string;
  detail?: React.ReactNode;
  iconOnly?: boolean;
  title?: string;
  disabled?: boolean;
  className?: string;
}
function SettingBoolean({value,onChange,label,detail,iconOnly=false,title,disabled=false,className=''}: SettingBooleanProps) {
  const content=<><SelectionMark selected={value}/>{!iconOnly&&<strong>{label}</strong>}</>;
  const props={className:`${iconOnly?'bd-check':'setting-option'} ${className}`,disabled,title};
  const activate=onChange ? ()=>onChange(!value) : undefined;
  return detail?<HoverDetail {...props} interactive panelRole="tooltip" triggerProps={{'aria-pressed':value}}
    label={label} content={detail} onActivate={activate}>{content}</HoverDetail>:
    <button type="button" {...props} role={iconOnly?'checkbox':undefined} aria-label={label}
      aria-checked={iconOnly?value:undefined} aria-pressed={iconOnly?undefined:value} onClick={activate}>{content}</button>;
}
export function Boolean(props: BooleanProps|SettingBooleanProps|SwitchBooleanProps) {
  if(props.form===BooleanForm.SWITCH) return <SwitchBoolean {...props}/>;
  if(props.form===BooleanForm.SETTING) return <SettingBoolean {...props}/>;
  return <CellBoolean {...props}/>;
}

function CellBoolean({
  value,
  onChange,
  className = '',
  size = 'md',
  color = 'primary',
  variant = 'standard',
  rounded = true,
  oscillateSpeed = D.timing.oscillateNormal,
  label,
  tooltip, disabled
}: BooleanProps) {
  const { getEffectiveStyle } = useStyle();
  const style = getEffectiveStyle();
  const scheme = getColorScheme(color as ColorType, style);
  const { setTooltip, descriptions } = useTooltipSafe();

  // Oscillating state
  const [isGlowing, setIsGlowing] = useState(false);

  useEffect(() => {
    if (variant !== 'oscillating' || !value) {
      setIsGlowing(false);
      return;
    }
    const interval = setInterval(() => setIsGlowing(prev => !prev), oscillateSpeed);
    return () => clearInterval(interval);
  }, [variant, value, oscillateSpeed]);

  // Generate auto-tooltip if none provided
  const getTooltipText = useCallback(() => {
    if (tooltip) return tooltip;
    // Look up the host's descriptions by label key
    if (label) {
      const key = label.toLowerCase().replace(/\s+/g, '').replace(/[^a-z]/g, '');
      if (descriptions?.[key]) return descriptions[key];
    }
    // Generate default tooltip
    const name = label || 'Toggle';
    return `${name} — ${value ? 'Enabled' : 'Disabled'}`;
  }, [tooltip, label, value, descriptions]);

  const handleMouseEnter = useCallback(() => {
    setTooltip(getTooltipText());
  }, [setTooltip, getTooltipText]);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, [setTooltip]);
  
  // Determine active state based on variant
  const isActive = variant === 'oscillating' ? isGlowing : value;
  
  // Get styles based on variant
  const boolStyles = variant === 'basic'
    ? (isActive 
        ? { background: scheme.main, boxShadow: `0 0 ${D.spacing.tightGap}px ${scheme.glow}, 0 0 2px ${scheme.main}` }
        : { background: style.cutoutBorder, boxShadow: getInsetShadow('medium') })
    : getBooleanStyles(isActive, scheme, style);
  
  const sizeValue = getSizeMap()[size];
  const borderRadius = rounded ? D.radius.button : D.radius.tiny;
  
  const containerStyle: React.CSSProperties = {
    width: sizeValue,
    height: sizeValue,
    borderRadius,
    cursor: onChange ? C.pointer : C.default,
    transition: TransitionKeys.normal,
    ...boolStyles
  };

  // Oscillating variant is not interactive
  if (variant === 'oscillating') {
    return (
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={className}
        style={containerStyle}
      />
    );
  }

  return (
    <button
      type="button" disabled={disabled} aria-label={label}
      data-control-anchor="leading"
      onClick={() => onChange?.(!value)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={className}
      style={containerStyle}
      aria-pressed={value}
    />
  );
}


export function LightUpBoolean(props: Omit<BooleanProps, 'color' | 'variant'>) {
  return <Boolean {...props} color="primary" variant="standard" />;
}

export function PinkBoolean(props: Omit<BooleanProps, 'color' | 'variant'>) {
  return <Boolean {...props} color="secondary" variant="standard" />;
}

export function BasicBoolean(props: Omit<BooleanProps, 'variant'>) {
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
    <div style={{ display: 'flex', flexDirection: isColumn ? 'column' : 'row', alignItems: 'center', gap: isColumn ? 2 : DC.rowGap }}>
      <LightUpBoolean value={value} onChange={onChange} size="sm" />
      <span style={{ ...SYNTH_LABEL, color, opacity: value ? 1 : 0.5 }}>{label}</span>
    </div>
  );
}

