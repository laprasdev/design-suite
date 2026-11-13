export interface SkyObserver {latitude: number; longitude: number; failure?: string;}
export interface SkyPosition {altitude: number; azimuth: number;}
export interface SkyPoint {x: number; y: number;}
// Where a star stands in the observer's sky, and where that falls in the header's strip of sky. The strip faces
// south: north at both ends, east a quarter of the way in and west three quarters, so the sky turns left to right.
// Its height runs from the horizon at the grass up to TOP_ALTITUDE.
const RADIANS = Math.PI / 180;
const DAY_MS = 86_400_000;
const UNIX_EPOCH_JD = 2440587.5;
const J2000_JD = 2451545;
// Greenwich mean sidereal time at J2000 and its daily turn, in degrees.
const GMST_AT_J2000 = 280.46061837;
const GMST_PER_DAY = 360.98564736629;
export const TOP_ALTITUDE = 75;

// Altitude above the horizon and azimuth east from north, in degrees.
export function horizontal({ra, dec}: {ra: number; dec: number}, {latitude, longitude}: SkyObserver, date: Date) {
  const days = date.getTime() / DAY_MS + UNIX_EPOCH_JD - J2000_JD;
  const hourAngle = (GMST_AT_J2000 + GMST_PER_DAY * days + longitude - ra * 15) * RADIANS;
  const d = dec * RADIANS, lat = latitude * RADIANS;
  const x = Math.cos(d) * Math.cos(hourAngle), y = Math.cos(d) * Math.sin(hourAngle), z = Math.sin(d);
  const north = x * Math.sin(lat) - z * Math.cos(lat), up = x * Math.cos(lat) + z * Math.sin(lat);
  const azimuth = ((Math.atan2(y, north) / RADIANS + 180) % 360 + 360) % 360;
  return { altitude: Math.asin(up) / RADIANS, azimuth };
}

// A share of the strip's width and of its height up from the grass, or null when the star is below the horizon or
// above the strip's top.
export function inStrip({altitude, azimuth}: SkyPosition) {
  if (altitude < 0 || altitude > TOP_ALTITUDE) return null;
  return { x: azimuth / 360, y: altitude / TOP_ALTITUDE };
}
