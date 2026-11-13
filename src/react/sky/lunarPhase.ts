// The moon's phase on a date: its phase angle from the moon's and sun's mean motions with the largest periodic terms
// (Meeus, Astronomical Algorithms, ch. 48), good to well under a percent of the lit face.
const DAY_MS = 86_400_000;
const UNIX_EPOCH_JD = 2440587.5;
const J2000_JD = 2451545;
const JULIAN_CENTURY_DAYS = 36525;
const RADIANS = Math.PI / 180;
// Degrees at J2000 and per Julian century: the moon's elongation from the sun, the sun's anomaly, the moon's anomaly.
const ELONGATION = [297.8501921, 445267.1114034];
const SUN_ANOMALY = [357.5291092, 35999.0502909];
const MOON_ANOMALY = [134.9633964, 477198.8675055];

export const MoonPhaseName = Object.freeze({
  NEW: 'new moon',
  WAXING_CRESCENT: 'waxing crescent',
  FIRST_QUARTER: 'first quarter',
  WAXING_GIBBOUS: 'waxing gibbous',
  FULL: 'full moon',
  WANING_GIBBOUS: 'waning gibbous',
  LAST_QUARTER: 'last quarter',
  WANING_CRESCENT: 'waning crescent',
});
// New, full and the quarters are moments, so they name only a face within a few percent of theirs.
const MOMENT_SPAN = 0.03;
function phaseName(illuminated: number, waxing: boolean) {
  if (illuminated < MOMENT_SPAN) return MoonPhaseName.NEW;
  if (illuminated > 1 - MOMENT_SPAN) return MoonPhaseName.FULL;
  if (Math.abs(illuminated - 0.5) < MOMENT_SPAN) return waxing ? MoonPhaseName.FIRST_QUARTER
    : MoonPhaseName.LAST_QUARTER;
  if (illuminated < 0.5) return waxing ? MoonPhaseName.WAXING_CRESCENT : MoonPhaseName.WANING_CRESCENT;
  return waxing ? MoonPhaseName.WAXING_GIBBOUS : MoonPhaseName.WANING_GIBBOUS;
}

// Where the moon is in its cycle (0 new, 0.5 full), how much of its face is lit, and whether that's growing.
export function lunarPhase(date: Date) {
  const centuries = (date.getTime() / DAY_MS + UNIX_EPOCH_JD - J2000_JD) / JULIAN_CENTURY_DAYS;
  const [d, m, mm] = [ELONGATION, SUN_ANOMALY, MOON_ANOMALY].map(([at, rate]) => (at + rate * centuries) * RADIANS);
  const phaseAngle = 180 - d / RADIANS
    - 6.289 * Math.sin(mm) + 2.1 * Math.sin(m) - 1.274 * Math.sin(2 * d - mm)
    - 0.658 * Math.sin(2 * d) - 0.214 * Math.sin(2 * mm) - 0.11 * Math.sin(d);
  // The true elongation, as a share of the cycle: 0 new, 0.5 full.
  const cycle = (((180 - phaseAngle) / 360) % 1 + 1) % 1;
  const illuminated = (1 - Math.cos(2 * Math.PI * cycle)) / 2;
  const waxing = cycle < 0.5;
  return { cycle, illuminated, waxing, name: phaseName(illuminated, waxing) };
}

// The lit part of a moon of radius r centred at (cx, cy), as an SVG path: the lit limb as a half circle, closed by the
// terminator, a half ellipse whose width follows the phase. As seen from the north, a waxing moon is lit on the right.
export function litPath({cycle, waxing}: Pick<ReturnType<typeof lunarPhase>, "cycle" | "waxing">, {cx, cy,
  r}: {cx: number; cy: number; r: number}) {
  const width = Math.abs(Math.cos(2 * Math.PI * cycle)) * r;
  const gibbous = Math.cos(2 * Math.PI * cycle) < 0;
  const limbSweep = waxing ? 1 : 0;
  const terminatorSweep = gibbous === waxing ? 1 : 0;
  const top = `${cx} ${cy - r}`, bottom = `${cx} ${cy + r}`;
  return `M${top}A${r} ${r} 0 0 ${limbSweep} ${bottom}A${width} ${r} 0 0 ${terminatorSweep} ${top}Z`;
}
