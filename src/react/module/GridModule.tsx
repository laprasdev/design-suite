import React from 'react';
import { useStyle } from '../../synth/StyleContext.tsx';
import { D, T } from '../../synth/design/index.ts';
import { ModuleHeaderRow } from './ModuleHeaderRow.tsx';

const G = D.moduleGrid;
const FILLS: React.CSSProperties = { flex: 1, minWidth: 0, minHeight: 0 };

/** A module on a page: its name, open group and tabs over a body filling the tile. The tile draws the only border. */
export function GridModule({ title, group, tabs, children }: {
  title: string; group?: string; tabs?: React.ReactNode; children: React.ReactNode;
}) {
  const style = useStyle().getEffectiveStyle();
  const headerStyle: React.CSSProperties = {
    flexShrink: 0, display: 'flex', alignItems: 'stretch', gap: G.headerTitleGap, paddingLeft: G.headerInset,
  };
  const titleStyle: React.CSSProperties = {
    ...T.title, margin: 0, alignSelf: 'flex-start', lineHeight: `${G.headerLineHeight}px`, color: style.primaryColor,
    textTransform: 'uppercase', cursor: 'default',
  };
  return (
    <section data-grid-module data-module-owner={title} aria-label={title}
      style={{ ...FILLS, display: 'flex', flexDirection: 'column' }}>
      <header data-module-header={title} style={headerStyle}>
        <h2 style={titleStyle}>{title}</h2>
        <ModuleHeaderRow group={group}>{tabs}</ModuleHeaderRow>
      </header>
      <div data-module-body={title} style={{ ...FILLS, display: 'flex' }}>{children}</div>
    </section>
  );
}
