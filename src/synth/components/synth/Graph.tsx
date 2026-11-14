import React, { useRef, useEffect } from 'react';
import { useStyle } from '../../StyleContext.tsx';
import type { StyleTheme } from '../../StyleTypes.ts';
import { getColorScheme, hexToRgba, getGridSpacing, resolveColorType, type AnyColor, type GridDistance }
  from '../../../color.ts';
import { D, F, C, O, Borders, T } from '../../design/index.ts';
import {GraphForm, type GraphFormValue} from './graphForm.ts';

export type GraphColor = AnyColor;
export type GraphVariant = GraphFormValue | 'waveform';

export interface WaveformPoint {
  x: number; // 0-1
  y: number; // -1 to 1 for bipolar, 0 to 1 for unipolar
}

export interface WaveformShape {
  name: string;
  path: (width: number, height: number) => { x: number; y: number }[];
}

// =====================================================
// COLOR SCHEME HELPER
// =====================================================
function getGraphColors(color: GraphColor, style: StyleTheme) {
  const scheme = getColorScheme(resolveColorType(color), style);

  return {
    line: scheme.main,
    fillPositive: hexToRgba(scheme.main, O.low),
    fillNegative: hexToRgba(scheme.main, O.low - 0.1),
    gradient1: hexToRgba(scheme.main, O.medium),
    gradient2: hexToRgba(scheme.main, O.ghost),
    node: scheme.main,
    glow: scheme.glow,
    background: hexToRgba(scheme.main, O.faint)
  };
}

type GraphColors = ReturnType<typeof getGraphColors>;

// =====================================================
// WAVEFORM BACKGROUND - Container with grid
// =====================================================
export interface WaveformBackgroundProps {
  children: React.ReactNode;
  className?: string;
  width?: number;
  height?: number;
  range?: GraphFormValue;
}

export function WaveformBackground({
  children,
  className = '',
  range = GraphForm.UNIPOLAR,
  width = 300,
  height = 120
}: WaveformBackgroundProps) {
  const { getEffectiveStyle, advancedSettings } = useStyle();
  const style = getEffectiveStyle();

  const xGridEnabled = advancedSettings.graphGridX === 'on';
  const yGridEnabled = advancedSettings.graphGridY === 'on';
  const gridOpacity = advancedSettings.graphGridOpacity;

  const xSpacing = getGridSpacing(advancedSettings.graphGridXDistance as GridDistance, width);
  const ySpacing = getGridSpacing(advancedSettings.graphGridYDistance as GridDistance, height);

  const xLines = xGridEnabled ? Math.floor(width / xSpacing) : 0;
  const yLines = yGridEnabled ? Math.floor(height / ySpacing) : 0;

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        borderRadius: D.radius.tiny,
        overflow: 'hidden',
        background: style.cutoutBackground,
        boxShadow: style.shadowStyle,
        border: `${Borders.standard.width}px ${Borders.standard.style} ${style.cutoutBorder}`,
        width: '100%',
        maxWidth: width,
        height
      }}
    >
      {/* Grid overlay */}
      {(xGridEnabled || yGridEnabled) && (
        <svg
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', opacity: gridOpacity }}
          width="100%"
          height={height}
          preserveAspectRatio="none"
          viewBox={`0 0 ${width} ${height}`}
        >
          {/* Vertical grid lines */}
          {xGridEnabled && Array.from({ length: xLines + 1 }).map((_, i) => (
            <line
              key={`x-${i}`}
              x1={i * xSpacing}
              y1={0}
              x2={i * xSpacing}
              y2={height}
              stroke={style.inactiveColor}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* Horizontal grid lines */}
          {yGridEnabled && Array.from({ length: yLines + 1 }).map((_, i) => (
            <line
              key={`y-${i}`}
              x1={0}
              y1={i * ySpacing}
              x2={width}
              y2={i * ySpacing}
              stroke={style.inactiveColor}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      )}

      {/* X axis baseline - always visible with boosted opacity */}
      <svg
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        viewBox={`0 0 ${width} ${height}`}
      >
        <line
          x1={0}
          y1={range === GraphForm.BIPOLAR ? height / 2 : height - 4}
          x2={width}
          y2={range === GraphForm.BIPOLAR ? height / 2 : height - 4}
          stroke={style.inactiveColor}
          strokeWidth={1.5}
          strokeOpacity={Math.min(gridOpacity * 2.5, 0.9)}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Axis labels */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute',
          left: D.spacing.microGap,
          top: 2,
          fontSize: T.moduleValue.fontSize,
          color: style.textColor,
          opacity: O.low,
          fontWeight: T.label.fontWeight,
          letterSpacing: T.label.letterSpacing
        }}>
          y=1
        </div>

        {range === GraphForm.BIPOLAR && (
          <div style={{
            position: 'absolute',
            left: D.spacing.microGap,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: T.moduleValue.fontSize,
            color: style.textColor,
            opacity: O.low,
            fontWeight: T.label.fontWeight,
            letterSpacing: T.label.letterSpacing
          }}>
            y=0
          </div>
        )}

        <div style={{
          position: 'absolute',
          left: D.spacing.microGap,
          bottom: 0,
          fontSize: T.moduleValue.fontSize,
          color: style.textColor,
          opacity: O.low,
          fontWeight: T.label.fontWeight,
          letterSpacing: T.label.letterSpacing
        }}>
          {range === GraphForm.BIPOLAR ? 'y=-1' : 'y=0'}
        </div>

        <div style={{
          position: 'absolute',
          right: 2,
          bottom: 0,
          fontSize: T.moduleValue.fontSize,
          color: style.textColor,
          opacity: O.low,
          fontWeight: T.label.fontWeight,
          letterSpacing: T.label.letterSpacing
        }}>
          x={Math.floor(width)}
        </div>
      </div>

      {children}
    </div>
  );
}

// =====================================================
// WAVEFORM GRAPHS - one canvas, drawn in either range
// =====================================================
export interface BipolarGraphProps {
  data: WaveformPoint[];
  width?: number;
  height?: number;
  color?: GraphColor;
  className?: string;
  showNodes?: boolean;
  interactive?: boolean;
  onDataChange?: (data: WaveformPoint[]) => void;
}

export interface UnipolarGraphProps {
  data: WaveformPoint[];
  width?: number;
  height?: number;
  color?: GraphColor;
  className?: string;
  showNodes?: boolean;
  backgroundWaveform?: WaveformPoint[];
}

/**
 * How each range lays a waveform on its canvas: the lowest value (the highest is 1), the inset above and below, whether
 * the canvas draws its own zero line, and the fill's gradient from top to bottom; and the height and color its own
 * graph is drawn at unless told.
 */
const WAVEFORM_RANGE: Readonly<Record<GraphFormValue, {
  least: number; inset: number; zeroLine: boolean; fill: readonly (keyof GraphColors)[];
  height: number; color: GraphColor;
}>> = Object.freeze({
  [GraphForm.BIPOLAR]: { least: -1, inset: 0, zeroLine: true, fill: ['gradient1', 'gradient2', 'gradient1'],
    height: 150, color: 'pink' },
  [GraphForm.UNIPOLAR]: { least: 0, inset: 4, zeroLine: false, fill: ['gradient1', 'gradient2'],
    height: 120, color: 'cyan' },
});

interface WaveformCanvasProps {
  range: GraphFormValue;
  data: WaveformPoint[];
  width: number;
  height: number;
  color: GraphColor;
  className: string;
  showNodes: boolean;
  backgroundWaveform?: WaveformPoint[];
}

const byX = (points: WaveformPoint[]) => [...points].sort((a, b) => a.x - b.x);

function WaveformCanvas({ range, data, width, height, color, className, showNodes, backgroundWaveform }:
  WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { getEffectiveStyle } = useStyle();
  const style = getEffectiveStyle();
  const colorScheme = getGraphColors(color, style);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    const { least, inset, zeroLine, fill } = WAVEFORM_RANGE[range];
    const toCanvasX = (x: number) => x * width;
    const toCanvasY = (y: number) => height - inset - (y - least) / (1 - least) * (height - inset * 2);
    const zero = toCanvasY(0);
    const trace = (points: WaveformPoint[]) => {
      ctx.beginPath();
      ctx.moveTo(toCanvasX(points[0].x), toCanvasY(points[0].y));
      points.forEach(point => ctx.lineTo(toCanvasX(point.x), toCanvasY(point.y)));
    };

    if (zeroLine) {
      ctx.strokeStyle = hexToRgba(style.primaryColor, O.inactive);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, zero);
      ctx.lineTo(width, zero);
      ctx.stroke();
    }

    if (backgroundWaveform && backgroundWaveform.length >= 2) {
      ctx.strokeStyle = colorScheme.background;
      ctx.lineWidth = 1.5;
      trace(byX(backgroundWaveform));
      ctx.stroke();
    }

    if (data.length < 2) return;

    const sortedData = byX(data);

    // Draw filled area, closed along the zero line
    ctx.beginPath();
    ctx.moveTo(toCanvasX(sortedData[0].x), zero);
    sortedData.forEach(point => {
      ctx.lineTo(toCanvasX(point.x), toCanvasY(point.y));
    });
    ctx.lineTo(toCanvasX(sortedData[sortedData.length - 1].x), zero);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, inset, 0, height - inset);
    fill.forEach((stop, index) => gradient.addColorStop(index / (fill.length - 1), colorScheme[stop]));

    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw waveform line with glow
    ctx.strokeStyle = colorScheme.line;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 8;
    ctx.shadowColor = colorScheme.glow;
    trace(sortedData);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw nodes
    if (showNodes) {
      sortedData.forEach(point => {
        ctx.fillStyle = colorScheme.node;
        ctx.shadowBlur = 4;
        ctx.shadowColor = colorScheme.glow;
        ctx.beginPath();
        ctx.arc(toCanvasX(point.x), toCanvasY(point.y), 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });
    }
  }, [range, data, backgroundWaveform, width, height, colorScheme, showNodes, style]);

  return (
    <div className={className} style={{ position: 'relative', width, height }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      />
    </div>
  );
}

/** One range's own graph: its waveform canvas, at the range's height and color unless told. */
function rangeGraph(range: GraphFormValue) {
  const own = WAVEFORM_RANGE[range];
  return function RangeGraph({ data, width = 300, height = own.height, color = own.color, className = '',
    showNodes = false, backgroundWaveform }: BipolarGraphProps & UnipolarGraphProps) {
    return <WaveformCanvas range={range} data={data} width={width} height={height} color={color}
      className={className} showNodes={showNodes} backgroundWaveform={backgroundWaveform} />;
  };
}

export const BipolarGraph = rangeGraph(GraphForm.BIPOLAR);
export const UnipolarGraph = rangeGraph(GraphForm.UNIPOLAR);

// =====================================================
// WAVEFORM ENUM - Waveform shape selector
// =====================================================
export interface WaveformEnumProps {
  shapes: WaveformShape[];
  selectedIndex: number;
  onChange?: (index: number) => void;
  color?: GraphColor;
  className?: string;
}

export function WaveformEnum({
  shapes,
  selectedIndex,
  onChange,
  color = 'pink',
  className = ''
}: WaveformEnumProps) {
  const { getEffectiveStyle } = useStyle();
  const style = getEffectiveStyle();

  const scheme = getColorScheme(resolveColorType(color), style);
  const unselectedColor = hexToRgba(scheme.main, O.low);
  const glowColor = hexToRgba(scheme.main, O.medium);

  const renderWaveform = (shape: WaveformShape, isSelected: boolean) => {
    const width = 40;
    const height = 30;
    const points = shape.path(width, height);
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <path
          d={pathD}
          fill="none"
          stroke={isSelected ? scheme.main : unselectedColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <div
      className={className}
      style={{
        display: F.flex,
        gap: D.spacing.tightGap,
        background: style.cutoutBackground,
        border: `${Borders.standard.width}px ${Borders.standard.style} ${style.cutoutBorder}`,
        borderRadius: D.radius.button,
        boxShadow: style.shadowStyle,
        padding: D.spacing.microGap + 2
      }}
    >
      {shapes.map((shape, index) => {
        const isSelected = index === selectedIndex;
        const glowFilter = isSelected
          ? `drop-shadow(0 0 4px ${glowColor}) drop-shadow(0 0 8px ${glowColor}) drop-shadow(0 0 12px ${glowColor})`
          : 'none';

        return (
          <button
            key={index}
            onClick={() => onChange?.(index)}
            style={{
              padding: D.spacing.microGap + 2,
              borderRadius: D.radius.tiny,
              background: 'transparent',
              border: 'none',
              filter: glowFilter,
              cursor: C.pointer
            }}
          >
            {renderWaveform(shape, isSelected)}
          </button>
        );
      })}
    </div>
  );
}

// =====================================================
// UNIFIED GRAPH COMPONENT
// =====================================================
export interface GraphProps {
  data: WaveformPoint[];
  width?: number;
  height?: number;
  color?: GraphColor;
  className?: string;
  variant?: GraphFormValue;
  showNodes?: boolean;
  showGrid?: boolean;
  backgroundWaveform?: WaveformPoint[];
}

export function Graph({
  data,
  width = 300,
  height = 120,
  color = 'cyan',
  className = '',
  variant = GraphForm.UNIPOLAR,
  showNodes = false,
  showGrid = true,
  backgroundWaveform
}: GraphProps) {
  const graphContent = <WaveformCanvas range={variant} data={data} width={width} height={height} color={color}
    className="" showNodes={showNodes} backgroundWaveform={backgroundWaveform} />;

  if (showGrid) {
    return (
      <WaveformBackground
        className={className}
        width={width}
        height={height}
        range={variant}
      >
        {graphContent}
      </WaveformBackground>
    );
  }

  return (
    <div className={className} style={{ width, height }}>
      {graphContent}
    </div>
  );
}

// =====================================================
// PREDEFINED WAVEFORM SHAPES
// =====================================================
export const BASIC_WAVEFORMS: WaveformShape[] = [
  {
    name: 'Sine',
    path: (w, h) => {
      const points = [];
      for (let i = 0; i <= 20; i++) {
        const x = (i / 20) * w;
        const y = h / 2 + Math.sin((i / 20) * Math.PI * 2) * (h / 2 - 4);
        points.push({ x, y });
      }
      return points;
    }
  },
  {
    name: 'Square',
    path: (w, h) => [
      { x: 0, y: h - 4 },
      { x: w * 0.25, y: h - 4 },
      { x: w * 0.25, y: 4 },
      { x: w * 0.75, y: 4 },
      { x: w * 0.75, y: h - 4 },
      { x: w, y: h - 4 }
    ]
  },
  {
    name: 'Sawtooth',
    path: (w, h) => [
      { x: 0, y: h - 4 },
      { x: w * 0.5, y: 4 },
      { x: w * 0.5, y: h - 4 },
      { x: w, y: 4 }
    ]
  },
  {
    name: 'Triangle',
    path: (w, h) => [
      { x: 0, y: h / 2 },
      { x: w * 0.25, y: 4 },
      { x: w * 0.75, y: h - 4 },
      { x: w, y: h / 2 }
    ]
  },
  {
    name: 'Pulse',
    path: (w, h) => [
      { x: 0, y: h - 4 },
      { x: w * 0.1, y: h - 4 },
      { x: w * 0.1, y: 4 },
      { x: w * 0.9, y: 4 },
      { x: w * 0.9, y: h - 4 },
      { x: w, y: h - 4 }
    ]
  },
  {
    name: 'Noise',
    path: (w, h) => {
      const points = [];
      for (let i = 0; i <= 15; i++) {
        const x = (i / 15) * w;
        const y = 4 + Math.random() * (h - 8);
        points.push({ x, y });
      }
      return points;
    }
  }
];

// =====================================================
// CONVENIENCE EXPORTS for backwards compatibility
// =====================================================

export function PositiveNegativeGraph(props: BipolarGraphProps) {
  return <BipolarGraph {...props} />;
}
