import {SwitchBoolean} from '../../../react/inputs/SwitchBoolean.tsx';
import {IconBoolean} from '../../../react/inputs/IconBoolean.tsx';
import {BooleanForm, type BooleanGlyphs, type IconBooleanProps, type SwitchBooleanProps}
  from '../../../react/inputs/booleanForm.ts';
export {BooleanForm, type BooleanGlyphs, type IconBooleanProps, type SwitchBooleanProps};
import React, { useEffect, useState, useCallback } from 'react';
import { useStyle } from '../../StyleContext.tsx';
import { getColorScheme, getBooleanStyles, getInsetShadow, type ColorType } from '../../../color.ts';
import { D, F, C, TransitionKeys } from '../../design/index.ts';
import { controlTooltip, useTooltipSafe } from './TooltipContext.tsx';
import {HoverDetail} from '../../../react/HoverDetail.tsx';
import {SelectionMark} from '../../../react/SelectionMark.tsx';
import {pendingContent,pendingPress} from '../../../react/pending.tsx';
import {PendingForm} from '../../../react/pendingElements.ts';

export type BooleanSize = 'xs' | 'sm' | 'md' | 'lg';
export type BooleanColor = 'primary' | 'secondary' | 'green' | 'cyan' | 'pink';
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
  return _sizeMap ??= {
    xs: D.sizes.booleanMicro, sm: D.sizes.booleanSmall, md: D.sizes.booleanMedium, lg: D.sizes.booleanLarge,
  };
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
  pending?: boolean;
  className?: string;
}
function SettingBoolean({value,onChange,label,detail,iconOnly=false,title,disabled=false,pending=false,
  className=''}: SettingBooleanProps) {
  const mark=<SelectionMark selected={value}/>,name=<strong>{label}</strong>;
  const content=iconOnly?pendingContent({pending,form:PendingForm.MARK,content:mark}):
    <>{mark}{pendingContent({pending,form:PendingForm.TEXT,content:name})}</>;
  const props={className:`${iconOnly?'bd-check':'setting-option'} ${className}`,disabled,title};
  const press=pendingPress(pending,onChange&&(()=>onChange(!value)));
  return detail?<HoverDetail {...props} interactive panelRole="tooltip" triggerProps={{'aria-pressed':value}}
    label={label} content={detail} press={press}>{content}</HoverDetail>:
    <button type="button" {...props} {...press} role={iconOnly?'checkbox':undefined} aria-label={label}
      aria-checked={iconOnly?value:undefined} aria-pressed={iconOnly?undefined:value}>{content}</button>;
}
export function Boolean(props: BooleanProps|SettingBooleanProps|SwitchBooleanProps|IconBooleanProps) {
  if(props.form===BooleanForm.SWITCH) return <SwitchBoolean {...props}/>;
  if(props.form===BooleanForm.ICON) return <IconBoolean {...props}/>;
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

  const [isGlowing, setIsGlowing] = useState(false);

  useEffect(() => {
    if (variant !== 'oscillating' || !value) {
      setIsGlowing(false);
      return;
    }
    const interval = setInterval(() => setIsGlowing(prev => !prev), oscillateSpeed);
    return () => clearInterval(interval);
  }, [variant, value, oscillateSpeed]);

  const getTooltipText = useCallback(() => controlTooltip(tooltip, label, descriptions,
    `${label || 'Toggle'} — ${value ? 'Enabled' : 'Disabled'}`), [tooltip, label, value, descriptions]);

  const handleMouseEnter = useCallback(() => {
    setTooltip(getTooltipText());
  }, [setTooltip, getTooltipText]);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, [setTooltip]);

  const isActive = variant === 'oscillating' ? isGlowing : value;
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
