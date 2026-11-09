import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createSkinTheme} from '../src/skinTheme.ts';
import {skinStyle} from '../src/synth/skinStyle.ts';
import {SKIN_NAMES} from '../src/skins.ts';
import {themeVariables} from '../src/theme.ts';
import {connectThemeClient, connectThemeSource, isThemeData, THEME_PROTOCOL, THEME_VERSION}
  from '../src/themeChannel.ts';

class Port {
  listeners = new Set<(event: unknown) => void>();
  sent: {message: any; origin: string}[] = [];
  addEventListener(_type: string, fn: (event: unknown) => void) { this.listeners.add(fn); }
  removeEventListener(_type: string, fn: (event: unknown) => void) { this.listeners.delete(fn); }
  postMessage(message: unknown, origin: string) { this.sent.push({message, origin}); }
  emit(data: unknown, source: Port, origin = 'http://theme.localhost') {
    this.listeners.forEach(fn => fn({data, source, origin}));
  }
  window() { return this as unknown as Window; }
}
const message = (type: string, data?: unknown) => ({protocol: THEME_PROTOCOL, version: THEME_VERSION, type, data});
const bloom = {skin: 'bloom', theme: createSkinTheme('bloom')};

test('theme consumer accepts only its source, origin, protocol and complete data', () => {
  const source = new Port(), client = new Port(), unrelated = new Port(), received: unknown[] = [];
  const close = connectThemeClient(source.window(), 'http://theme.localhost', x => received.push(x), client.window());
  assert.equal(source.sent[0].message.type, 'subscribe');
  client.emit(message('update', bloom), unrelated);
  client.emit(message('update', bloom), source, 'http://unrelated.localhost');
  client.emit({...message('update', bloom), version: THEME_VERSION + 1}, source);
  client.emit(message('update', {skin: 'bloom', theme: {name: 'bloom'}}), source);
  assert.equal(received.length, 0);
  client.emit(message('update', bloom), source);
  assert.deepEqual(received, [bloom]);
  close();
  client.emit(message('update', bloom), source);
  assert.equal(received.length, 1);
  assert.equal(source.sent.at(-1)?.message.type, 'unsubscribe');
});

test('theme source publishes current data and unsubscribes without accepting writes', () => {
  const host = new Port(), client = new Port();
  let data = bloom;
  const source = connectThemeSource(() => data, host.window());
  host.emit(message('subscribe'), client);
  assert.deepEqual(client.sent[0].message.data, bloom);
  host.emit(message('update', {skin: 'fake'}), client);
  assert.equal(data, bloom);
  data = {skin: 'promethium', theme: createSkinTheme('promethium')};
  source.publish();
  assert.deepEqual(client.sent.at(-1)?.message.data, data);
  host.emit(message('unsubscribe'), client);
  source.publish();
  assert.equal(client.sent.length, 2);
  source.dispose();
  assert.equal(host.listeners.size, 0);
});

test('theme data rejects missing and non-finite geometry before reaching CSS', () => {
  assert.equal(isThemeData(bloom), true);
  for (const radius of [undefined, {lg: NaN, sm: 2}, {lg: 2, sm: -1}]) {
    assert.equal(isThemeData({...bloom, theme: {...bloom.theme, radius}}), false);
  }
});

test('composed widgets and page chrome project the same theme colors', () => {
  const vars = themeVariables(createSkinTheme('promethium'));
  for (const [widget, chrome] of [['--color-surface', '--card'], ['--color-text', '--text'],
    ['--color-line', '--line'], ['--color-accent', '--pink']]) assert.equal(vars[widget], vars[chrome]);
});

test('all skin names, including structure-only skins, share canonical palette resolution', () => {
  for (const name of SKIN_NAMES) {
    const theme = createSkinTheme(name), style = skinStyle(name);
    assert.equal(theme.colors.accent, style.primaryColor, name);
    assert.equal(theme.colors.bg, style.backgroundColor, name);
    assert.equal(theme.colors.surface, style.cutoutBackground, name);
  }
});


test('theme typography travels with the palette and rejects invalid supplied type values', () => {
  const typography = {...bloom.theme.typography, reading: 'serif', chrome: 'monospace', controlSize: 16};
  const theme = {...bloom.theme, typography};
  assert.equal(isThemeData({skin: 'bloom', theme}), true);
  const vars = themeVariables(theme);
  assert.equal(vars['--font-reading'], 'serif');
  assert.equal(vars['--font-chrome'], 'monospace');
  assert.equal(vars['--type-control'], '16px');
  for (const invalid of [{...typography, controlSize: NaN}, {...typography, reading: ''}])
    assert.equal(isThemeData({skin: 'bloom', theme: {...theme, typography: invalid}}), false);
  for (const typography of [false, 0, '', null, []])
    assert.equal(isThemeData({skin: 'bloom', theme: {...bloom.theme, typography}}), false);
  const {typography: _type, ...legacy} = bloom.theme;
  assert.equal(isThemeData({skin: 'bloom', theme: legacy}), true);
});
