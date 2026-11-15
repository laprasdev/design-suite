export type GalleryPalette = 'rose' | 'blue';

export const galleryCopy = {
  title: 'Bloom Design',
  subtitle: 'Dialogs, portraits and controls',
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
  progress: 'Progress',
  status: 'Active Status',
  photo: 'Sample Portrait',
} as const;

export const galleryColors: Readonly<Record<GalleryPalette, string>> = {
  rose: '#c4678f',
  blue: '#69b8f4',
};

export const themes: readonly { value: GalleryPalette; label: string; color: string }[] = [
  { value: 'rose', label: 'Rose', color: galleryColors.rose },
  { value: 'blue', label: 'Blue', color: galleryColors.blue },
];
