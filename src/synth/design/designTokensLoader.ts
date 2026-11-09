// The shape of SynthDesignTokens.json. Read the data through `skins.ts`.

export interface ScaleStep {
  sizing: number;
  spacing?: number[];
  text?: TextLabelComponent;
}

export interface TextLabelComponent {
  size: number;
  weight: number;
  kern: number;
  lead?: number;
  glowIntensity?: number;
  casing?: string;
  truncation?: string;
  nameLabelResourcePath?: string;
  nameLabelFlipHorizontal?: boolean;
}

export interface ScaleConfig {
  defaultIndex: number;
  steps: ScaleStep[];
}

export interface PaletteComponent {
  primary?: { rgba: number[] };
  secondary?: { rgba: number[] };
  background?: { rgba: number[] };
  text?: { rgba: number[] };
  glow?: { rgba: number[] };
  cutoutBackground?: { rgba: number[] };
  cutoutBorder?: { rgba: number[] };
}

/** What a composition's `wrap` asks of a group: its cells flow onto rows, or stay on one line. */
export const CompositionWrap = Object.freeze({ WRAP: 'wrap', LINEAR: 'linear' } as const);
export type CompositionWrapValue = typeof CompositionWrap[keyof typeof CompositionWrap];

export interface HciComposableStyle {
  visibility?: string;
  inherit?: string;
  scaleOffset?: number;
  text?: TextLabelComponent;
  spacing?: { padding?: number[]; gap?: number };
  sizing?: { sizeX?: number; minX?: number; sizeY?: number; aspectRatio?: number; weightX?: number };
  glyph?: { resourcePath?: string; size?: number; kind?: string };
  flow?: string;
  wrap?: CompositionWrapValue;
  minimumCellWidth?: number;
  maximumColumns?: number;
  showAllSubmodules?: boolean;
  childAlignment?: string;
  perpendicularAxisExpand?: boolean;
  accents?: string;
  variants?: Record<string, { opacity?: { value: number } }>;
  edgePlacement?: { at?: string[]; anchorX?: number; anchorY?: number };
  palette?: PaletteComponent;
  border?: { width?: number; borderEdges?: string[] };
}

export interface KnobGeometry {
  defaultSize: number;
  startAngle: number;
  endAngle: number;
}

export interface DesignTokens {
  scale: ScaleConfig;
  styles: Record<string, HciComposableStyle>;
  knobGeometry: KnobGeometry;
  nameLabelIconHeight: number;
  controllerGeometry: Record<string, number>;
  graphInset: number;
  controllerControls: Record<string, number[]>;
  controllerDpadOutline: number[][];
}
