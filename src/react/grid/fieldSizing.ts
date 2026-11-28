// Pure sizing of `ModuleField` (`LineField` / `StackField`), one-column least room, `ModuleGroups` strips and the
// header that holds them.
import { captionWidth, readingWidth, textRunWidth, type CaptionWidthTable } from '../../captionWidths.ts';
import { Typography } from '../../tokens.ts';
import { ControlKind, type ChoiceFormValue, type ControlKindValue } from '../../fields.ts';
import { ModuleGridDimensions as G, TEXT_FLOOR } from '../../moduleGridLayout.ts';
import { CONTROL_KINDS, LINE_TEXT_HEIGHT, controlBoxOf } from './controlBoxes.ts';
import type { CaptionRoom, FilledControlFit } from './filledControlFit.ts';
import { ONE_LINE_HEIGHT } from './lineTrack.ts';

const TIGHT_LINE_PX = TEXT_FLOOR * G.tightLine;

export interface FieldCaptionMetrics {
  readonly labelWidth: number;
  readonly wordWidths: readonly number[];
  readonly readWidth: number;
  readonly spaceWidth: number;
  readonly minCaptionWidth: number;
  readonly captionRoom: CaptionRoom;
  readonly pressable: boolean;
}

export function fieldCaptionMetrics(
  label: string,
  reads: string,
  iconWidth: number,
  pressable: boolean,
  table: CaptionWidthTable,
): FieldCaptionMetrics {
  const words = label.trim().split(/\s+/).filter(Boolean);
  const wordWidths = words.map((word, idx) => captionWidth(word, table) + (idx === 0 ? iconWidth : 0));
  const labelWidth = captionWidth(label, table);
  const nameWidth = iconWidth + labelWidth;
  const readWidth = reads.length > 0 ? readingWidth(reads, table) : 0;
  const minNameWidth = wordWidths.length > 0 ? Math.max(...wordWidths) : 0;
  return {
    labelWidth,
    wordWidths,
    readWidth,
    spaceWidth: captionWidth(' ', table),
    minCaptionWidth: Math.max(minNameWidth, readWidth),
    captionRoom: {
      stacked: Math.max(nameWidth, readWidth),
      beside: nameWidth + (readWidth > 0 ? G.fieldGap + readWidth : 0),
    },
    pressable,
  };
}

/** Least `{ width, height }` a field of `kind` needs in a one-column grid. */
export function oneColumnFieldNeed(
  kind: ControlKindValue, metrics: FieldCaptionMetrics,
): { readonly width: number; readonly height: number } {
  const spec = CONTROL_KINDS[kind];
  if (kind === ControlKind.YES_NO) {
    return { width: Math.ceil(spec.width + G.fieldGap + metrics.labelWidth), height: ONE_LINE_HEIGHT };
  }
  const height = kind === ControlKind.KNOB || kind === ControlKind.RANGE ? spec.height : ONE_LINE_HEIGHT;
  const width = spec.besideInOneColumn
    ? spec.width + G.fieldGap + metrics.captionRoom.beside
    : Math.max(spec.width, metrics.captionRoom.beside);
  return { width: Math.ceil(width), height };
}

function captionBoxHeight(metrics: FieldCaptionMetrics, availableWidth: number): number {
  let nameLines = 1, lineUsed = 0;
  for (const wordWidth of metrics.wordWidths) {
    if (lineUsed > 0 && lineUsed + metrics.spaceWidth + wordWidth > availableWidth) {
      nameLines += 1;
      lineUsed = wordWidth;
    } else {
      lineUsed = lineUsed === 0 ? wordWidth : lineUsed + metrics.spaceWidth + wordWidth;
    }
  }
  const rawNamePx = nameLines * TIGHT_LINE_PX;
  const namePx = Math.max(metrics.pressable ? ONE_LINE_HEIGHT : 0, rawNamePx);
  if (metrics.readWidth === 0) return Math.ceil(namePx);
  const fitsBesideName = nameLines === 1 && lineUsed + G.fieldGap + metrics.readWidth <= availableWidth;
  return fitsBesideName ? Math.max(Math.ceil(namePx), LINE_TEXT_HEIGHT) : Math.ceil(namePx + TIGHT_LINE_PX);
}

export interface ModuleCellSizeInput {
  readonly kind: ControlKindValue;
  readonly columns: number;
  readonly choiceForm?: ChoiceFormValue;
  readonly optionCount?: number;
  readonly beneathHeight: number;
  readonly metrics: FieldCaptionMetrics;
  readonly fit: FilledControlFit;
  readonly cellWidth: number;
}

/** Pixel height of a placed cell inside `FilledModuleGrid` (`ModuleYesNo`, `LineField`, or `StackField`). */
export function moduleCellHeight(input: ModuleCellSizeInput): number {
  const { kind, columns, choiceForm, optionCount, beneathHeight, metrics, fit, cellWidth } = input;
  if (kind === ControlKind.YES_NO) return ONE_LINE_HEIGHT + beneathHeight;
  const box = controlBoxOf({ kind, knobSize: fit.size, columns, choiceForm, optionCount });
  if (fit.beside) {
    if (box.width > 0 && box.width + G.fieldGap + metrics.minCaptionWidth > cellWidth) {
      return box.height + G.fieldGap + captionBoxHeight(metrics, Math.max(1, cellWidth));
    }
    const avail = Math.max(1, cellWidth - (box.width > 0 ? box.width + G.fieldGap : 0));
    return Math.max(ONE_LINE_HEIGHT, box.height, captionBoxHeight(metrics, avail));
  }
  if (kind === ControlKind.KNOB || (kind === ControlKind.RANGE && columns === 1)) {
    return box.height + G.fieldTextRoom;
  }
  const stackLines = metrics.readWidth > 0 ? G.fieldGap * 2 + LINE_TEXT_HEIGHT * 2 : G.fieldGap + LINE_TEXT_HEIGHT;
  return box.height + stackLines;
}

/** Pixel height of a `ModuleGroups` segmented strip with `chips` (each chip's inline width) inside `innerWidth`. */
export function moduleGroupsHeight(chips: readonly number[], innerWidth: number): number {
  const available = Math.max(1, innerWidth - G.headerInset * 2);
  let rows = 1, used = 0;
  for (const chip of chips) {
    if (used > 0 && used + G.groupGap + chip > available) [rows, used] = [rows + 1, chip];
    else used = used === 0 ? chip : used + G.groupGap + chip;
  }
  return G.groupStripPadding + rows * ONE_LINE_HEIGHT + (rows - 1) * G.groupGap;
}

// A module's title, and an inline group chip drawn as the shown one: bold as a title, in label type (ModuleGroups).
const TITLE_RUN = { ...Typography.title, uppercase: true }, SHOWN_CHIP_RUN = {
  ...Typography.label, fontWeight: Typography.title.fontWeight, uppercase: true,
};

/** Least width of a module's header holding `title` and inline `ModuleGroups` `chips` whole. The open group's name
 *  yields first (ModuleHeaderRow), so it needs no room; every chip is measured as the shown one, the widest. */
export function moduleHeaderLeastWidth(title: string, chips: readonly string[], table: CaptionWidthTable): number {
  const chipWidths = chips.map(chip => Math.ceil(textRunWidth(chip, SHOWN_CHIP_RUN, table)) + G.groupPaddingInline * 2);
  const chipsWidth = chipWidths.reduce((sum, width) => sum + width, 0) + G.groupGap * (chips.length - 1);
  return G.headerInset * 2 + Math.ceil(textRunWidth(title, TITLE_RUN, table)) + G.headerTitleGap + G.headerGap
    + chipsWidth;
}
