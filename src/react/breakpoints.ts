/**
 * The window widths the suite's stylesheets break at, by name. CSS media queries can't read a token, so
 * tests/breakpoints.test.ts holds every `max-width` query under src/react to one of these: changing a width here
 * without its stylesheets, or adding an unnamed width there, fails the suite's tests.
 */
export const Breakpoint = Object.freeze({
  /** Phone width: bars and the gallery change form below it. */
  PHONE: 760,
  /** The settings meter's narrow layout. */
  NARROW: 600,
  /** Small phones: the settings panel and the 3D preview's controls tighten. */
  SMALL: 480,
  /** The page header's smallest form. */
  TINY: 440,
} as const);
export type BreakpointValue = typeof Breakpoint[keyof typeof Breakpoint];

/** The media query for a window at or under `width`, as the stylesheets spell it. */
export const maxWidthQuery = (width: BreakpointValue) => `(max-width:${width}px)`;
