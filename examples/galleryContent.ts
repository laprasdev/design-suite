export const galleryCopy = {
  title: 'Bloom Design',
  description: 'One package, composed with your own content and theme.',
  open: 'Open Dialog',
  close: 'Close Dialog',
  dialog: 'Project Settings',
  details: 'Show Details',
  field: 'Project Name',
  outside: 'Outside Action',
  portrait: 'Select Portrait',
  selected: 'Portrait Selected',
  theme: 'Theme',
  status: 'Active Status',
  photo: 'Sample Portrait',
} as const;

/** The palettes the Theme cycle offers, in order; the first is the default. */
export const galleryPalettes = [
  { label: 'Rose', color: '#c4678f' },
  { label: 'Blue', color: '#69b8f4' },
] as const;
export type GalleryPalette = (typeof galleryPalettes)[number];
export const paletteOptions = galleryPalettes.map(palette => ({ value: palette, label: palette.label }));
