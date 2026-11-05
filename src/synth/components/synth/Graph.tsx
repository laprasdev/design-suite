import React, { useRef, useEffect } from 'react';
import { useStyle } from '../../StyleContext.tsx';
import { getColorScheme, mapLegacyColor, hexToRgba, getGridSpacing, type GridDistance, type ColorType } from '../../../color.ts';
import { D, F, C, O, Borders, T } from '../../design/index.ts';

// =====================================================
// UNIFIED GRAPH COMPONENT
// Replaces: WaveformBackground, PositiveNegativeGraph, UnipolarGraph, WaveformEnum
// =====================================================

export type GraphColor = 'primary' | 'secondary' | 'tertiary' | 'cyan' | 'pink' | 'green';
export type GraphVariant = 'bipolar' | 'unipolar' | 'waveform';

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
function getGraphColors(color: GraphColor, style: ReturnType<typeof useStyle>['getEffectiveStyle'] extends () => infer R ? R : never) {
  const colorType: ColorType = ['primary', 'secondary', 'tertiary'].includes(color)
    ? color as ColorType
    : mapLegacyColor(color as 'cyan' | 'pink' | 'green');

  const scheme = getColorScheme(colorType, style);

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

// =====================================================
// WAVEFORM BACKGROUND - Container with grid
// =====================================================
export interface WaveformBackgroundProps {
  children: React.ReactNode;
  className?: string;
  width?: number;
  height?: number;
  range?: 'unipolar' | 'bipolar';
}

export function WaveformBackground({
  children,
  className = '',
  range = 'unipolar',
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
          y1={range === 'bipolar' ? height / 2 : height - 4}
          x2={width}
          y2={range === 'bipolar' ? height / 2 : height - 4}
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

        {range === 'bipolar' && (
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
          {range === 'bipolar' ? 'y=-1' : 'y=0'}
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
// BIPOLAR GRAPH (PositiveNegativeGraph)
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

export function BipolarGraph({
  data,
  width = 300,
  height = 150,
  color = 'pink',
  className = '',
  showNodes = false
}: BipolarGraphProps) {
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

    // Draw center line (y=0)
    ctx.strokeStyle = hexToRgba(style.primaryColor, O.inactive);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    if (data.length < 2) return;

    const sortedData = [...data].sort((a, b) => a.x - b.x);

    const toCanvasX = (x: number) => x * width;
    const toCanvasY = (y: number) => height / 2 - (y * height / 2);

    // Draw filled area
    ctx.beginPath();
    ctx.moveTo(toCanvasX(sortedData[0].x), height / 2);
    sortedData.forEach(point => {
      ctx.lineTo(toCanvasX(point.x), toCanvasY(point.y));
    });
    ctx.lineTo(toCanvasX(sortedData[sortedData.length - 1].x), height / 2);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, colorScheme.gradient1);
    gradient.addColorStop(0.5, colorScheme.gradient2);
    gradient.addColorStop(1, colorScheme.gradient1);

    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw waveform line with glow
    ctx.strokeStyle = colorScheme.line;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 8;
    ctx.shadowColor = colorScheme.glow;
    ctx.beginPath();
    ctx.moveTo(toCanvasX(sortedData[0].x), toCanvasY(sortedData[0].y));
    sortedData.forEach(point => {
      ctx.lineTo(toCanvasX(point.x), toCanvasY(point.y));
    });
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
  }, [data, width, height, colorScheme, showNodes, style]);

  return (
    <div className={className} style={{ position: 'relative', width, height }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      />
    </div>
  );
}

// =====================================================
// UNIPOLAR GRAPH
// =====================================================
export interface UnipolarGraphProps {
  data: WaveformPoint[];
  width?: number;
  height?: number;
  color?: GraphColor;
  className?: string;
  showNodes?: boolean;
  backgroundWaveform?: WaveformPoint[];
}

export function UnipolarGraph({
  data,
  width = 300,
  height = 120,
  color = 'cyan',
  className = '',
  showNodes = false,
  backgroundWaveform
}: UnipolarGraphProps) {
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

    const padding = 4;
    const drawHeight = height - (padding * 2);

    const toCanvasX = (x: number) => x * width;
    const toCanvasY = (y: number) => height - padding - (y * drawHeight);

    // Draw background waveform
    if (backgroundWaveform && backgroundWaveform.length >= 2) {
      const sortedBg = [...backgroundWaveform].sort((a, b) => a.x - b.x);

      ctx.strokeStyle = colorScheme.background;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(toCanvasX(sortedBg[0].x), toCanvasY(sortedBg[0].y));
      sortedBg.forEach(point => {
        ctx.lineTo(toCanvasX(point.x), toCanvasY(point.y));
      });
      ctx.stroke();
    }

    if (data.length < 2) return;

    const sortedData = [...data].sort((a, b) => a.x - b.x);

    // Draw filled area with gradient
    ctx.beginPath();
    ctx.moveTo(toCanvasX(sortedData[0].x), height - padding);
    sortedData.forEach(point => {
      ctx.lineTo(toCanvasX(point.x), toCanvasY(point.y));
    });
    ctx.lineTo(toCanvasX(sortedData[sortedData.length - 1].x), height - padding);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, padding, 0, height - padding);
    gradient.addColorStop(0, colorScheme.gradient1);
    gradient.addColorStop(1, colorScheme.gradient2);

    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw waveform line with glow
    ctx.strokeStyle = colorScheme.line;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 8;
    ctx.shadowColor = colorScheme.glow;
    ctx.beginPath();
    ctx.moveTo(toCanvasX(sortedData[0].x), toCanvasY(sortedData[0].y));
    sortedData.forEach(point => {
      ctx.lineTo(toCanvasX(point.x), toCanvasY(point.y));
    });
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
  }, [data, backgroundWaveform, width, height, colorScheme, showNodes]);

  return (
    <div className={className} style={{ position: 'relative', width, height }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      />
    </div>
  );
}

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

  const colorType: ColorType = ['primary', 'secondary', 'tertiary'].includes(color)
    ? color as ColorType
    : mapLegacyColor(color as 'cyan' | 'pink' | 'green');

  const scheme = getColorScheme(colorType, style);
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
  variant?: 'bipolar' | 'unipolar';
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
  variant = 'unipolar',
  showNodes = false,
  showGrid = true,
  backgroundWaveform
}: GraphProps) {
  const graphContent = variant === 'bipolar' ? (
    <BipolarGraph
      data={data}
      width={width}
      height={height}
      color={color}
      showNodes={showNodes}
    />
  ) : (
    <UnipolarGraph
      data={data}
      width={width}
      height={height}
      color={color}
      showNodes={showNodes}
      backgroundWaveform={backgroundWaveform}
    />
  );

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
