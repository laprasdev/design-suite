import React from 'react';
import {useControlGesture} from './base/useControlBehavior.ts';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import {T} from '../../design/index.ts';
import { useStyle } from '../../StyleContext.tsx';
import { getColorScheme, getInsetShadow } from '../../../color.ts';
import {METER_VALUE_ATTRIBUTE,METER_FIXED_ATTRIBUTE} from '../../../react/settingElements.ts';
import {IncrementerForm, type StepperDirection} from './incrementerForm.ts';


interface IntegerIncrementerProps {
  form?: typeof IncrementerForm.STEPPER;
  value: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  variant?: StepperDirection;
  className?: string;
  displayValue?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
}

export interface MeterIncrementerProps {
  form: typeof IncrementerForm.METER;
  label: string;
  value: number;
  min?: number;
  max: number;
  onChange(value: number): void;
  onMinimum?: ()=>void;
  disabled?: boolean;
  unit?: React.ReactNode;
  special?: Readonly<Record<number,string>>;
  stacked?: boolean;
}
function MeterIncrementer({label,value,min=1,max,onChange,onMinimum,disabled,unit,special={},stacked=false}: MeterIncrementerProps) {
  const choose=(n: number)=>{onChange(Math.max(min,Math.min(max,n)));if(n<min)onMinimum?.();};
  const key=(e: React.KeyboardEvent<HTMLDivElement>)=>{
    const steps: Partial<Record<string,number>>={ArrowRight:value+1,ArrowUp:value+1,ArrowLeft:value-1,ArrowDown:value-1,Home:min,End:max},next=steps[e.key];
    if(next===undefined||disabled)return;
    e.preventDefault();const n=Math.max(min,Math.min(max,next));choose(next);
    e.currentTarget.querySelector<HTMLElement>(`[${METER_VALUE_ATTRIBUTE}="${Math.max(1,n)}"]`)?.focus();
  };
  return <div className="meter-control" data-stacked={stacked}><div className="meter-steps" role="radiogroup" aria-label={label} onKeyDown={key}>
    {Array.from({length:max},(_,i)=>i+1).map(n=><button key={n} type="button" role="radio" aria-checked={value===n} aria-label={`${label}: ${special[n]??n}`} tabIndex={value===n||(value===0&&n===1)?0:-1} {...{[METER_VALUE_ATTRIBUTE]:n,[METER_FIXED_ATTRIBUTE]:n<min}} data-filled={n<=value} disabled={disabled} onClick={()=>choose(n===value&&min===0?0:n)}><span/></button>)}
  </div><span className="meter-label" aria-live="polite">{special[value]??<><strong>{value}</strong> {unit}</>}</span></div>;
}

export function IntegerIncrementer(props: IntegerIncrementerProps|MeterIncrementerProps) {
  return 'form' in props&&props.form===IncrementerForm.METER?<MeterIncrementer {...props}/>:<StepperIncrementer {...props as IntegerIncrementerProps}/>;
}

function StepperIncrementer({ 
  value, 
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  variant = IncrementerForm.VERTICAL,
  className = '',
  displayValue, children, disabled = false, ariaLabel = 'Value'
}: IntegerIncrementerProps) {
  const { getEffectiveStyle } = useStyle();
  const style = getEffectiveStyle();
  const scheme = getColorScheme('primary', style);

  const gesture = useControlGesture();
  const change = (next: number) => {gesture.begin(); onChange?.(next); gesture.end();};
  const increment = () => change(Math.min(value + step, max));
  const decrement = () => change(Math.max(value - step, min));

  const isVertical = variant === IncrementerForm.VERTICAL;
  const UpIcon = isVertical ? ChevronUp : ChevronRight;
  const DownIcon = isVertical ? ChevronDown : ChevronLeft;

  const buttonStyle = {
    background: style.cutoutBorder,
    boxShadow: getInsetShadow('shallow'),
    border: '1px solid rgba(0, 0, 0, 0.4)'
  };

  return (
    <div className={`flex ${isVertical ? 'flex-col' : 'flex-row'} items-center gap-0.5 ${className}`}>
      <button
        onClick={decrement}
        type="button" aria-label={`Decrease ${ariaLabel}`} disabled={disabled || !onChange || value <= min}
        className="w-5 h-5 flex items-center justify-center rounded-sm transition-all"
        style={buttonStyle}
      >
        <DownIcon className="w-3 h-3" style={{ color: scheme.main }} />
      </button>
      
      <div 
        className="min-w-[32px] h-5 flex items-center justify-center rounded-sm px-1"
        style={{
          background: style.cutoutBorder,
          boxShadow: getInsetShadow('medium'),
          border: '1px solid rgba(0, 0, 0, 0.4)',
          color: scheme.main,
          fontWeight: 600, fontSize: T.moduleValue.fontSize
        }}
      >
        {children ?? displayValue ?? value}
      </div>
      
      <button
        onClick={increment}
        type="button" aria-label={`Increase ${ariaLabel}`} disabled={disabled || !onChange || value >= max}
        className="w-5 h-5 flex items-center justify-center rounded-sm transition-all"
        style={buttonStyle}
      >
        <UpIcon className="w-3 h-3" style={{ color: scheme.main }} />
      </button>
    </div>
  );
}
