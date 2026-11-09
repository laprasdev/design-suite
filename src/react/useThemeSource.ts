import {useEffect, useState} from 'react';
import {connectThemeClient, THEME_SOURCE_TIMEOUT_MS, type ThemeData} from '../themeChannel.ts';

/** Bind a surface to a theme data source without copying its palette or storage logic. */
export function useThemeSource(sourceUrl: string) {
  const [data, setData] = useState<ThemeData>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    const source = new URL(sourceUrl), frame = document.createElement('iframe');
    frame.hidden = true;
    frame.title = 'Theme data';
    let disconnect: (() => void) | undefined;
    const timeout = window.setTimeout(() => setError('Theme source unavailable'), THEME_SOURCE_TIMEOUT_MS);
    frame.onload = () => {
      disconnect?.();
      if (frame.contentWindow) disconnect = connectThemeClient(frame.contentWindow, source.origin, next => {
        window.clearTimeout(timeout);
        setError(undefined);
        setData(next);
      });
    };
    frame.src = source.href;
    document.body.append(frame);
    return () => { window.clearTimeout(timeout); disconnect?.(); frame.remove(); };
  }, [sourceUrl]);
  return {data, error};
}
