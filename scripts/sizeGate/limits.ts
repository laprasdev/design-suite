// The size rules this repo and the web synth hold their code to.
export const FILE_LINE_LIMIT = 200;
export const LINE_CHARACTER_LIMIT = 120;

export interface LongLine {
  readonly line: number;
  readonly characters: number;
}

/** The numbers a size baseline records of a file over a limit, each a ceiling the file's measurement may not pass. */
export const SIZE_KINDS = ['lines', 'longLines'] as const;
export type BaselineNumbers = Readonly<Record<typeof SIZE_KINDS[number], number>>;

/** A file as read: its baselined numbers, the lines of its import statements, and each line over the limit. */
export interface FileMeasurement extends BaselineNumbers {
  readonly importLines: number;
  readonly long: readonly LongLine[];
}

export interface SizeSkip {
  readonly directories: readonly string[];
  readonly suffixes: readonly string[];
}

export interface SizeScope {
  readonly dirs: readonly string[];
  readonly files: readonly string[];
  readonly extensions: readonly string[];
  readonly skip: SizeSkip;
}

export interface AllowanceGrant {
  readonly path: string;
  readonly step: string;
  readonly reason: string;
  readonly date: string;
}

export interface SizeBaseline {
  readonly scope: SizeScope;
  readonly files: Readonly<Record<string, BaselineNumbers>>;
  readonly allowances: readonly AllowanceGrant[];
}
