interface Constellation {name: string; stars: Record<string, [number, number]>; lines: string[][];}
// The header sky's stars: well-known constellations as stick figures, and a scatter of faint dots. Positions are
// J2000 right ascension in hours and declination in degrees, near enough for a sky a few dozen pixels tall.

// Each figure's lines are runs of its star keys, drawn one after another.
export const CONSTELLATIONS: readonly Constellation[] = Object.freeze<Constellation[]>([
  { name: 'Ursa Major', stars: { dubhe: [11.062, 61.75], merak: [11.031, 56.38], phecda: [11.897, 53.69],
    megrez: [12.257, 57.03], alioth: [12.9, 55.96], mizar: [13.399, 54.93], alkaid: [13.792, 49.31] },
    lines: [['dubhe', 'merak', 'phecda', 'megrez', 'dubhe'], ['megrez', 'alioth', 'mizar', 'alkaid']] },
  { name: 'Ursa Minor', stars: { polaris: [2.53, 89.26], yildun: [17.537, 86.59], epsilon: [16.766, 82.04],
    zeta: [15.734, 77.79], kochab: [14.845, 74.16], pherkad: [15.345, 71.83], eta: [16.292, 75.76] },
    lines: [['polaris', 'yildun', 'epsilon', 'zeta', 'kochab', 'pherkad', 'eta', 'zeta']] },
  { name: 'Cassiopeia', stars: { caph: [0.153, 59.15], schedar: [0.675, 56.54], gamma: [0.945, 60.72],
    ruchbah: [1.43, 60.24], segin: [1.907, 63.67] },
    lines: [['caph', 'schedar', 'gamma', 'ruchbah', 'segin']] },
  { name: 'Orion', stars: { betelgeuse: [5.919, 7.41], bellatrix: [5.419, 6.35], meissa: [5.585, 9.93],
    alnitak: [5.679, -1.94], alnilam: [5.604, -1.2], mintaka: [5.533, -0.3], saiph: [5.796, -9.67], rigel: [5.242,
    -8.2] },
    lines: [['betelgeuse', 'meissa', 'bellatrix', 'betelgeuse'], ['betelgeuse', 'alnitak', 'saiph'], ['bellatrix',
      'mintaka', 'rigel'], ['mintaka', 'alnilam', 'alnitak']] },
  { name: 'Cygnus', stars: { deneb: [20.69, 45.28], sadr: [20.37, 40.26], albireo: [19.512, 27.96], gienah: [20.77,
    33.97], delta: [19.75, 45.13] },
    lines: [['deneb', 'sadr', 'albireo'], ['gienah', 'sadr', 'delta']] },
  { name: 'Lyra', stars: { vega: [18.616, 38.78], zeta: [18.746, 37.61], delta: [18.908, 36.9], sulafat: [18.982,
    32.69], sheliak: [18.835, 33.36] },
    lines: [['vega', 'zeta', 'sheliak', 'sulafat', 'delta', 'zeta']] },
  { name: 'Aquila', stars: { altair: [19.846, 8.87], tarazed: [19.771, 10.61], alshain: [19.922, 6.41],
    delta: [19.425, 3.11], zeta: [19.09, 13.86], lambda: [19.104, -4.88] },
    lines: [['zeta', 'tarazed', 'altair', 'alshain'], ['altair', 'delta', 'lambda']] },
  { name: 'Scorpius', stars: { graffias: [16.091, -19.81], dschubba: [16.006, -22.62], pi: [15.981, -26.11],
    sigma: [16.353, -25.59], antares: [16.49, -26.43], tau: [16.598, -28.22], epsilon: [16.836, -34.29],
    mu: [16.864, -38.05], zeta: [16.91, -42.36], eta: [17.203, -43.24], sargas: [17.622, -43], iota: [17.793,
    -40.13], kappa: [17.708, -39.03], shaula: [17.56, -37.1] },
    lines: [['graffias', 'dschubba', 'pi'], ['dschubba', 'sigma', 'antares', 'tau', 'epsilon', 'mu', 'zeta', 'eta',
      'sargas', 'iota', 'kappa', 'shaula']] },
  { name: 'Sagittarius', stars: { alnasl: [18.097, -30.42], kausMedia: [18.35, -29.83], kausAustralis: [18.403,
    -34.38], kausBorealis: [18.466, -25.42], phi: [18.761, -26.99], nunki: [18.921, -26.3], tau: [19.116, -27.67],
    ascella: [19.044, -29.88] },
    lines: [['alnasl', 'kausMedia', 'kausAustralis', 'alnasl'], ['kausMedia', 'kausBorealis', 'phi', 'kausMedia'],
      ['phi', 'nunki', 'tau', 'ascella', 'phi'], ['ascella', 'kausAustralis']] },
  { name: 'Leo', stars: { regulus: [10.14, 11.97], eta: [10.122, 16.76], algieba: [10.333, 19.84],
    adhafera: [10.278, 23.42], rasalas: [9.879, 26.01], epsilon: [9.764, 23.77], zosma: [11.235, 20.52],
    chertan: [11.237, 15.43], denebola: [11.818, 14.57] },
    lines: [['epsilon', 'rasalas', 'adhafera', 'algieba', 'eta', 'regulus', 'chertan', 'denebola', 'zosma',
      'algieba'], ['zosma', 'chertan']] },
  { name: 'Gemini', stars: { castor: [7.577, 31.89], pollux: [7.755, 28.03], mebsuta: [6.732, 25.13], tejat: [6.383,
    22.51], wasat: [7.335, 21.98], alhena: [6.629, 16.4] },
    lines: [['tejat', 'mebsuta', 'castor', 'pollux', 'wasat', 'alhena']] },
  { name: 'Taurus', stars: { aldebaran: [4.599, 16.51], theta: [4.478, 15.87], gamma: [4.33, 15.63], delta: [4.382,
    17.54], epsilon: [4.477, 19.18], elnath: [5.438, 28.61], zeta: [5.627, 21.14], alcyone: [3.791, 24.11] },
    lines: [['elnath', 'epsilon', 'delta', 'gamma', 'theta', 'aldebaran', 'zeta']] },
  { name: 'Auriga', stars: { capella: [5.278, 46], menkalinan: [5.992, 44.95], theta: [5.995, 37.21],
    elnath: [5.438, 28.61], hassaleh: [4.95, 33.17], epsilon: [5.032, 43.82] },
    lines: [['capella', 'menkalinan', 'theta', 'elnath', 'hassaleh', 'epsilon', 'capella']] },
  { name: 'Perseus', stars: { gamma: [3.08, 53.51], mirfak: [3.405, 49.86], delta: [3.715, 47.79], epsilon: [3.964,
    40.01], zeta: [3.902, 31.88], algol: [3.136, 40.96] },
    lines: [['gamma', 'mirfak', 'delta', 'epsilon', 'zeta'], ['mirfak', 'algol']] },
  { name: 'Pegasus', stars: { markab: [23.079, 15.21], scheat: [23.063, 28.08], alpheratz: [0.14, 29.09],
    algenib: [0.22, 15.18], homam: [22.691, 10.83], baham: [22.17, 6.2], enif: [21.736, 9.88] },
    lines: [['markab', 'scheat', 'alpheratz', 'algenib', 'markab', 'homam', 'baham', 'enif']] },
  { name: 'Andromeda', stars: { alpheratz: [0.14, 29.09], delta: [0.655, 30.86], mirach: [1.162, 35.62],
    almach: [2.065, 42.33] },
    lines: [['alpheratz', 'delta', 'mirach', 'almach']] },
  { name: 'Boötes', stars: { arcturus: [14.261, 19.18], izar: [14.75, 27.07], delta: [15.258, 33.31],
    nekkar: [15.032, 40.39], seginus: [14.535, 38.31], rho: [14.531, 30.37] },
    lines: [['arcturus', 'izar', 'delta', 'nekkar', 'seginus', 'rho', 'arcturus']] },
  { name: 'Corona Borealis', stars: { theta: [15.549, 31.36], beta: [15.464, 29.11], alphecca: [15.578, 26.71],
    gamma: [15.713, 26.3], delta: [15.827, 26.07], epsilon: [15.96, 26.88] },
    lines: [['theta', 'beta', 'alphecca', 'gamma', 'delta', 'epsilon']] },
  { name: 'Canis Major', stars: { mirzam: [6.378, -17.96], sirius: [6.752, -16.72], wezen: [7.14, -26.39],
    adhara: [6.977, -28.97], aludra: [7.402, -29.3] },
    lines: [['mirzam', 'sirius', 'wezen', 'adhara'], ['wezen', 'aludra']] },
  { name: 'Canis Minor', stars: { procyon: [7.655, 5.22], gomeisa: [7.453, 8.29] },
    lines: [['procyon', 'gomeisa']] },
  { name: 'Crux', stars: { acrux: [12.443, -63.1], gacrux: [12.519, -57.11], mimosa: [12.795, -59.69],
    delta: [12.252, -58.75] },
    lines: [['acrux', 'gacrux'], ['mimosa', 'delta']] },
]);

// The faint dots: the same scatter over the whole sphere every time, so they turn with the sky rather than jumping.
const DOT_COUNT = 160;
const DOT_SEED = 0x5eed;
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = seeded(DOT_SEED);
export const DOTS = Object.freeze(Array.from({ length: DOT_COUNT }, () => (
  { ra: random() * 24, dec: Math.asin(2 * random() - 1) * 180 / Math.PI, glow: random() }
)));
