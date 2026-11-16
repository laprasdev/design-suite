// The size rules this repo and the web synth hold their code to.
export const FILE_LINE_LIMIT = 200;
export const LINE_CHARACTER_LIMIT = 120;

export interface LongLine {
  readonly line: number;
  readonly characters: number;
}

export interface FileMeasurement {
  readonly lines: number;
  readonly longLines: number;
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

export type BaselineNumbers = {
  readonly lines: number;
  readonly longLines: number;
  readonly importLines: number;
};

export interface AllowanceSpan {
  readonly lines: number;
  readonly importLines: number;
}

export interface AllowanceGrant {
  readonly path: string;
  readonly step: string;
  readonly reason: string;
  readonly date: string;
}

export interface AllowanceRecord extends AllowanceGrant {
  readonly from: AllowanceSpan;
  readonly to: AllowanceSpan;
}

export interface SizeBaseline {
  readonly scope: SizeScope;
  readonly files: Readonly<Record<string, BaselineNumbers>>;
  readonly allowances: readonly AllowanceRecord[];
}
