// CSS flex-grow only fills the track when its positive weights sum to at least one.
// Scale first so even large finite weights normalize without overflowing their sum.
export function progressWeights(values: readonly number[]): number[] {
 if(values.some(value => !Number.isFinite(value) || value < 0))
  throw new Error('Slider progress needs nonnegative finite values');
 const scale = values.reduce((max, value) => Math.max(max, value), 0);
 if(!scale) return values.map(() => 0);
 const scaled = values.map(value => value / scale), total = scaled.reduce((sum, value) => sum + value, 0);
 return scaled.map(value => value / total);
}
