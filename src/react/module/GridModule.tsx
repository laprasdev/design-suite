import React from 'react';
import { useStyle } from '../../synth/StyleContext.tsx';
import { Borders, D, T } from '../../synth/design/index.ts';
import { ModuleHeaderRow } from './ModuleHeaderRow.tsx';

const G = D.moduleGrid;
const FILLS: React.CSSProperties = { flex: 1, minWidth: 0, minHeight: 0 };

/**
 * A module on a page: its name, open group and tabs over a body filling the tile. The tile draws the only border.
 * An untitled module's drawing says what it is, so its name is only its label, and a header with nothing else goes.
 */
export function GridModule({ title, titled = true, group, tabs, children }: {
  title: string; titled?: boolean; group?: string; tabs?: React.ReactNode; children: React.ReactNode;
}) {
  const style = useStyle().getEffectiveStyle();
  const headerStyle: React.CSSProperties = {
    flexShrink: 0, display: 'flex', alignItems: 'center', gap: G.headerTitleGap,
    paddingInline: G.headerInset, borderBottom: `${Borders.standard.width}px solid ${style.borderColor}`,
  };
  const titleStyle: React.CSSProperties = {
    ...T.title, margin: 0, lineHeight: `${G.headerLineHeight}px`, color: style.primaryColor,
    textTransform: 'uppercase', cursor: 'default', whiteSpace: 'nowrap', minWidth: 0,
    overflow: 'hidden', textOverflow: 'ellipsis',
  };
  return (
    <section data-grid-module data-module-owner={title} aria-label={title}
      style={{ ...FILLS, display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-chrome, inherit)' }}>
      {(titled || group || tabs) && <header data-module-header={title} style={headerStyle}>
        {titled && <h2 style={titleStyle}>{title}</h2>}
        <ModuleHeaderRow group={group}>{tabs}</ModuleHeaderRow>
      </header>}
      <div data-module-body={title} style={{ ...FILLS, display: 'flex', overflow: 'auto' }}>{children}</div>
    </section>
  );
}
