import React, { useState } from 'react';
import {
  type HciDataComposable,
  containerCSS,
  textCSS,
  accentTextCSS,
  dividerCSS,
} from './Composable.ts';
import type { SettingDefinition } from './SettingsSchema.ts';

// ─── SECTION HEADER ───

export function SectionHeader({ label, composable }: {
  label: string;
  composable: HciDataComposable;
}) {
  return <div style={textCSS(composable)}>{label}</div>;
}

// ─── DIVIDER ───

export function Divider({ composable }: { composable: HciDataComposable }) {
  return <div style={dividerCSS(composable)} />;
}

// ─── BUTTON GRID ───

export function ButtonGrid({ options, activeId, onSelect, buttonComposable, labelComposable }: {
  options: { id: string; label: string }[];
  activeId: string;
  onSelect: (id: string) => void;
  buttonComposable: HciDataComposable;
  labelComposable: HciDataComposable;
}) {
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: buttonComposable.spacing?.padding[0] ?? 4,
    }}>
      {options.map(opt => {
        const isActive = opt.id === activeId;
        const primary = buttonComposable.palette?.primary ?? '#33A8A8';
        const bg = buttonComposable.palette?.background ?? '#0A0E10';
        const border = buttonComposable.palette?.border ?? primary;
        const r = buttonComposable.contentShape?.cornerRadius;
        const ew = buttonComposable.edge?.width ?? 1;
        const pad = buttonComposable.spacing;

        const btnStyle: React.CSSProperties = {
          borderRadius: r,
          border: `${ew}px solid ${primary}`,
          padding: pad ? `${pad.padding[1]}px ${pad.padding[0]}px` : undefined,
          background: isActive ? primary : 'transparent',
          color: isActive ? bg : primary,
          boxShadow: isActive ? `0 0 12px ${primary}80` : 'none',
          fontSize: labelComposable.text?.size ?? undefined,
          fontWeight: labelComposable.text?.weight,
          fontFamily: labelComposable.text?.family ?? undefined,
          letterSpacing: labelComposable.text?.kern != null ? `${labelComposable.text.kern}em` : undefined,
          opacity: isActive ? 1 : (labelComposable.opacity?.value ?? 0.8),
        };
        return (
          <button key={opt.id} onClick={() => onSelect(opt.id)}
            style={{ ...btnStyle, cursor: 'pointer', textTransform: 'uppercase' }}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── LABELED TOGGLE ───

export function LabeledToggle({ label, value, onChange, composable }: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  composable: HciDataComposable;
}) {
  const size = composable.text?.size ?? 10;
  const toggleSize = size + 4;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: composable.spacing?.padding[0] ?? 4,
      cursor: 'pointer',
    }} onClick={() => onChange(!value)}>
      <div style={{
        width: toggleSize,
        height: toggleSize,
        borderRadius: composable.contentShape?.cornerRadius ?? 2,
        border: `${composable.edge?.width ?? 1}px solid ${composable.palette?.primary ?? 'transparent'}`,
        background: value
          ? composable.palette?.primary ?? undefined
          : composable.palette?.cutoutBackground ?? undefined,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {value && (
          <div style={{
            width: toggleSize * 0.5,
            height: toggleSize * 0.5,
            background: composable.palette?.background ?? undefined,
            borderRadius: (composable.contentShape?.cornerRadius ?? 2) * 0.5,
          }} />
        )}
      </div>
      <span style={textCSS(composable)}>{label}</span>
    </div>
  );
}

// ─── ENUM ROW ───

export function EnumRow({ label, options, value, onChange, headerComposable, buttonComposable, labelComposable }: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  headerComposable: HciDataComposable;
  buttonComposable: HciDataComposable;
  labelComposable: HciDataComposable;
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: buttonComposable.spacing?.padding[1] ?? 4,
    }}>
      <span style={textCSS(headerComposable)}>{label}</span>
      <ButtonGrid
        options={options}
        activeId={value}
        onSelect={onChange}
        buttonComposable={buttonComposable}
        labelComposable={labelComposable}
      />
    </div>
  );
}

// ─── COLLAPSIBLE SECTION ───

export function CollapsibleSection({ label, composable, children }: {
  label: string;
  composable: HciDataComposable;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div
        onClick={() => setOpen(!open)}
        style={{
          ...accentTextCSS(composable),
          cursor: 'pointer',
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: composable.spacing?.padding[0] ?? 4,
        }}
      >
        <span style={{
          display: 'inline-block',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.15s',
        }}>
          ▸
        </span>
        {label}
      </div>
      {open && (
        <div style={{
          paddingTop: composable.spacing?.padding[1] ?? 4,
          display: 'flex',
          flexDirection: 'column',
          gap: composable.spacing?.padding[1] ?? 4,
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── RANGE SLIDER ───

export function RangeSlider({ label, min, max, step, value, onChange, formatValue, composable }: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  formatValue?: (v: number) => string;
  composable: HciDataComposable;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const trackHeight = composable.edge?.width ? composable.edge.width + 2 : 4;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: composable.spacing?.padding[0] ?? 8,
    }}>
      <span style={{ ...textCSS(composable), minWidth: 60 }}>{label}</span>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{
          flex: 1,
          height: trackHeight,
          accentColor: composable.palette?.primary ?? undefined,
          cursor: 'pointer',
        }}
      />
      <span style={{
        ...accentTextCSS(composable),
        minWidth: 32,
        textAlign: 'right',
      }}>
        {formatValue ? formatValue(value) : value}
      </span>
    </div>
  );
}

// ─── SETTING ROW (JSON-driven enum from SettingDefinition) ───

export function SettingRow({ setting, value, onChange, headerComposable, buttonComposable, labelComposable }: {
  setting: SettingDefinition;
  value: string;
  onChange: (id: string) => void;
  headerComposable: HciDataComposable;
  buttonComposable: HciDataComposable;
  labelComposable: HciDataComposable;
}) {
  const formatKey = (s: string) => s.replace(/([A-Z])/g, ' $1').trim().toUpperCase();
  const options = setting.variantKeys.map(k => ({ id: k, label: formatKey(k) }));
  return (
    <EnumRow
      label={formatKey(setting.key)}
      options={options}
      value={value}
      onChange={onChange}
      headerComposable={headerComposable}
      buttonComposable={buttonComposable}
      labelComposable={labelComposable}
    />
  );
}
