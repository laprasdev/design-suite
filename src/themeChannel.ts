import {createTheme, type Theme} from './theme.ts';

export const THEME_PROTOCOL = 'looms.theme';
export const THEME_VERSION = 1;
const SUBSCRIBE = 'subscribe', UNSUBSCRIBE = 'unsubscribe', UPDATE = 'update';
export interface ThemeData { skin: string; theme: Theme }
const message = (type: string) => ({protocol: THEME_PROTOCOL, version: THEME_VERSION, type});
const isMessage = (data: unknown): data is Record<string, unknown> => !!data && typeof data === 'object'
  && 'protocol' in data && data.protocol === THEME_PROTOCOL && 'version' in data && data.version === THEME_VERSION;

/** Theme values are data, never CSS text or executable content. */
export function isThemeData(data: unknown): data is ThemeData {
  if (!data || typeof data !== 'object') return false;
  const {skin, theme} = data as Partial<ThemeData>;
  if (typeof skin !== 'string' || !skin || !theme || typeof theme.name !== 'string') return false;
  const defaults = createTheme();
  if (theme.typography !== undefined && (!theme.typography || typeof theme.typography !== 'object'
    || Array.isArray(theme.typography))) return false;
  if (theme.typography !== undefined && Object.entries(defaults.typography).some(([key, fallback]) => {
    const value = theme.typography[key as keyof Theme['typography']];
    return typeof fallback === 'string' ? typeof value !== 'string' || !value.trim() || value.length > 256
      : typeof value !== 'number' || !Number.isFinite(value) || value <= 0;
  })) return false;
  if (!theme.colors || Object.keys(defaults.colors).some(key =>
    typeof theme.colors[key as keyof Theme['colors']] !== 'string')) return false;
  return (['radius', 'stroke', 'space'] as const).every(group => theme[group]
    && Object.keys(defaults[group]).every(key => {
      const value = (theme[group] as Record<string, number>)[key];
      return typeof value === 'number' && Number.isFinite(value) && value >= 0;
    }));
}

/** A read-only source. Subscribers can receive theme data, never change the source's choice. */
export function connectThemeSource(read: () => ThemeData, host: Window = window) {
  const clients = new Map<Window, string>();
  const send = (client: Window, origin: string) => {
    const data = read();
    if (!isThemeData(data)) throw new Error('Invalid theme source data');
    client.postMessage({...message(UPDATE), data}, origin);
  };
  const hear = (event: MessageEvent) => {
    if (!isMessage(event.data) || !event.source || event.origin === 'null') return;
    const client = event.source as Window;
    if (event.data.type === SUBSCRIBE) { clients.set(client, event.origin); send(client, event.origin); }
    if (event.data.type === UNSUBSCRIBE) clients.delete(client);
  };
  host.addEventListener('message', hear);
  return {
    publish: () => clients.forEach((origin, client) => send(client, origin)),
    dispose: () => { host.removeEventListener('message', hear); clients.clear(); },
  };
}

/** Subscribe to one explicit source window and origin; other messages cannot repaint this consumer. */
export function connectThemeClient(source: Window, origin: string, receive: (data: ThemeData) => void,
  client: Window = window) {
  const hear = (event: MessageEvent) => {
    if (event.source !== source || event.origin !== origin || !isMessage(event.data)) return;
    if (event.data.type === UPDATE && isThemeData(event.data.data)) receive(event.data.data);
  };
  client.addEventListener('message', hear);
  source.postMessage(message(SUBSCRIBE), origin);
  return () => {
    client.removeEventListener('message', hear);
    source.postMessage(message(UNSUBSCRIBE), origin);
  };
}
