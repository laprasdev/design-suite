import {hexToFloatRgba, hexToRgba} from '../color.ts';
import {useEffect} from 'react';

/** The app owner opts into document styling; scoped previews never touch it. */
export function useDocumentPalette(primaryColor: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const effectiveStyle = {primaryColor};
    document.documentElement.style.setProperty('--theme-primary', effectiveStyle.primaryColor);

    let styleEl = document.getElementById('dynamic-scrollbar-style') as HTMLStyleElement;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'dynamic-scrollbar-style';
      document.head.appendChild(styleEl);
    }

    const rgb = hexToFloatRgba(primaryColor);
    const scrollThumb = rgb ? hexToRgba(primaryColor, 0.4) : 'rgba(51, 169, 168, 0.4)';
    const scrollThumbHover = rgb ? hexToRgba(primaryColor, 0.7) : 'rgba(51, 169, 168, 0.7)';
    const scrollTrack = 'rgba(10, 14, 16, 0.5)';

    styleEl.textContent = `
      html ::-webkit-scrollbar, body ::-webkit-scrollbar, * ::-webkit-scrollbar {
        width: 3px !important; height: 3px !important;
      }
      html ::-webkit-scrollbar-track, body ::-webkit-scrollbar-track, * ::-webkit-scrollbar-track {
        background: ${scrollTrack} !important;
      }
      html ::-webkit-scrollbar-thumb, body ::-webkit-scrollbar-thumb, * ::-webkit-scrollbar-thumb {
        background: ${scrollThumb} !important; border-radius: 0 !important;
      }
      html ::-webkit-scrollbar-thumb:hover, body ::-webkit-scrollbar-thumb:hover, * ::-webkit-scrollbar-thumb:hover {
        background: ${scrollThumbHover} !important;
      }
      html ::-webkit-scrollbar-corner, body ::-webkit-scrollbar-corner, * ::-webkit-scrollbar-corner {
        background: transparent !important;
      }
      html, body, * {
        scrollbar-width: thin !important;
        scrollbar-color: ${scrollThumb} ${scrollTrack} !important;
      }
    `;
  }, [primaryColor, enabled]);
}
