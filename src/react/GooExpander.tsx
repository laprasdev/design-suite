import React, {useId, type CSSProperties, type ReactNode} from 'react';
import {LayoutDimensions} from '../layout.ts';

export interface GooExpanderProps {
  open: boolean; onToggle(): void; label: string; children: ReactNode;
  x?: number; y?: number; width?: number; height?: number; top?: number;
  direction?: 'left' | 'right'; stationary?: boolean; icon?: ReactNode;
  tone?: string; color?: string; className?: string;
  /** A centered square trigger fits inside a header or rail; the Activity side tab is the default. */
  form?: 'tab' | 'square'; size?: number;
  /** An existing control can own the trigger; contentId links its aria-controls to this panel. */
  trigger?: boolean; contentId?: string;
  buttonProps?: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'children'>
    & {[key: `data-${string}`]: string | number | boolean};
}

/** Activity's fused side tab. Only its shape grows; the parent never participates in layout. */
export function GooExpander({open, onToggle, label, children, x = 0, y = 0, width = 96, height = 60,
  top = -height / 2, direction = 'right', stationary = false, icon, tone, color, className = '',
  buttonProps, form = 'tab', size = 16, trigger = true, contentId}: GooExpanderProps) {
  const id = useId().replace(/:/g, ''), filter = `goo-${id}`, content = contentId ?? `goo-content-${id}`;
  const variables = {left: x, top: y, '--goo-width': `${width}px`, '--goo-height': `${height}px`,
    '--goo-top': `${top}px`, '--goo-trigger-size': `${size}px`,
    '--goo-radius': `${LayoutDimensions.radius.button}px`,
    ...(color ? {'--task-color': color} : {})} as CSSProperties;
  return <div className={`bd-goo ${className}`} data-tone={tone} data-open={open || undefined}
    data-form={form} data-direction={direction} data-stationary={stationary || undefined} style={variables}>
    <svg className="bd-goo-defs" width="0" height="0" aria-hidden="true">
      <filter id={filter} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic"
          stdDeviation={form === 'square' ? LayoutDimensions.radius.button / 2 : 4} result="blur"/>
        <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8"/>
      </filter>
    </svg>
    <div className="bd-goo-shapes" style={{filter: `url(#${filter})`}} aria-hidden="true">
      <span className="bd-goo-stub"/><span className="bd-goo-body"/>
    </div>
    {trigger && <button {...buttonProps} type="button" className={`bd-goo-nub ${buttonProps?.className ?? ''}`}
      aria-label={label} aria-controls={content} aria-expanded={open}
      onClick={event => {event.currentTarget.focus(); onToggle();}}
      data-icon={icon ? true : undefined}>{icon}</button>}
    <div id={content} className="bd-goo-content" aria-label={label} aria-hidden={!open}
      // Inert also keeps the closed native controls out of the keyboard sequence during the fade.
      {...(!open ? {inert: ''} : {})}>{children}</div>
  </div>;
}
