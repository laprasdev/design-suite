import React, {useId, type CSSProperties, type ReactNode} from 'react';
import {LayoutDimensions} from '../layout.ts';
import {Shadows} from '../tokens.ts';
import {EXTENSION_MOTION} from './motion.ts';

export const GooForm = Object.freeze({TAB: 'tab', SQUARE: 'square', PANEL: 'panel'} as const);

interface GooExpanderBase {
  open: boolean; onToggle(): void; label: string; children: ReactNode;
  x?: number; y?: number; width?: number; height?: number; top?: number;
  direction?: 'left' | 'right'; stationary?: boolean; icon?: ReactNode;
  tone?: string; color?: string; className?: string;
  size?: number; layer?: number;
  /** An existing control can own the trigger; contentId links its aria-controls to this panel. */
  contentId?: string;
  buttonProps?: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'children'>
    & {[key: `data-${string}`]: string | number | boolean};
}

export type GooExpanderProps = GooExpanderBase & (
  | {form?: typeof GooForm.TAB | typeof GooForm.SQUARE; trigger?: boolean}
  | {form: typeof GooForm.PANEL; trigger: false}
);

/** A floating tab, square extension or crisp panel. Expansion never participates in parent layout. */
export function GooExpander({open, onToggle, label, children, x = 0, y = 0, width = 96, height = 60,
  top = -height / 2, direction = 'right', stationary = false, icon, tone, color, className = '',
  buttonProps, form = GooForm.TAB, size = 16, trigger = true, contentId, layer}: GooExpanderProps) {
  const id = useId().replace(/:/g, ''), filter = `goo-${id}`, content = contentId ?? `goo-content-${id}`;
  const variables = {left: x, top: y, zIndex: layer, '--goo-width': `${width}px`, '--goo-height': `${height}px`,
    '--goo-top': `${top}px`, '--goo-trigger-size': `${size}px`,
    '--goo-radius': `${LayoutDimensions.radius.button}px`,
    ...(form === GooForm.PANEL ? {'--goo-shadow': Shadows.nodeElevated,
      '--goo-duration': `${EXTENSION_MOTION.duration}ms`, '--goo-easing': EXTENSION_MOTION.easing} : {}),
    ...(color ? {'--task-color': color} : {})} as CSSProperties;
  return <div className={`bd-goo ${className}`} data-tone={tone} data-open={open || undefined}
    data-form={form} data-direction={direction} data-stationary={stationary || undefined} style={variables}>
    {form !== GooForm.PANEL && <><svg className="bd-goo-defs" width="0" height="0" aria-hidden="true">
      <filter id={filter} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic"
          stdDeviation={form === GooForm.SQUARE ? LayoutDimensions.radius.button / 2 : 4} result="blur"/>
        <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8"/>
      </filter>
    </svg>
    <div className="bd-goo-shapes" style={{filter: `url(#${filter})`}} aria-hidden="true">
      <span className="bd-goo-stub"/><span className="bd-goo-body"/>
    </div>
    </>}
    {trigger && <button {...buttonProps} type="button" className={`bd-goo-nub ${buttonProps?.className ?? ''}`}
      aria-label={label} aria-controls={content} aria-expanded={open}
      onClick={event => {event.currentTarget.focus(); onToggle();}}
      data-icon={icon ? true : undefined}>{icon}</button>}
    <div id={content} className="bd-goo-content" aria-label={label} aria-hidden={!open}
      // Inert also keeps the closed native controls out of the keyboard sequence during the fade.
      {...(!open ? {inert: ''} : {})}>{children}</div>
  </div>;
}
