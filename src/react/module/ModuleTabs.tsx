import React from 'react';
import { useStyle } from '../../synth/StyleContext.tsx';
import { D, O } from '../../synth/design/index.ts';
import { EnabledCell, Strip } from '../../synth/components/synth/TabStrip.tsx';

export interface ModuleTab<Id extends string> { id: Id; label: string; content: React.ReactNode; authored: boolean }

const ROW: React.CSSProperties = { display: 'flex', alignItems: 'stretch', flex: 'none' };
const CELL: React.CSSProperties = { justifyContent: 'center' };

/**
 * Siblings share a module's room: one is open, and a dim tab has nothing set inside it. The open tab is never dim:
 * what it holds is in view.
 */
export function ModuleTabs<Id extends string>({ tabs, value, onChange, ariaLabel }: {
  tabs: ModuleTab<Id>[]; value: Id; onChange: (id: Id) => void; ariaLabel: string;
}) {
  const { primaryColor } = useStyle().getEffectiveStyle();
  const tabStyle = (tab: ModuleTab<Id>): React.CSSProperties => ({
    display: 'grid', placeItems: 'center', minWidth: D.moduleGrid.tabMinWidth, minHeight: D.moduleGrid.tabMinHeight,
    outline: 'none', opacity: tab.authored || tab.id === value ? O.full : O.low,
  });
  const pressed = (id: Id) => (event: React.KeyboardEvent) => { if (event.key === 'Enter') onChange(id); };
  return (
    <div role="tablist" aria-label={ariaLabel} style={ROW}>
      <Strip edge="inline" reachesEdge>
        {tabs.map((tab, index) => (
          <EnabledCell key={tab.id} enabled={tab.id === value} color={primaryColor} isLast={index === tabs.length - 1}
            onClick={() => onChange(tab.id)} style={CELL}>
            <span role="tab" tabIndex={0} aria-selected={tab.id === value} aria-label={tab.label} title={tab.label}
              data-tab={tab.id} data-tab-set={tab.authored} onKeyDown={pressed(tab.id)}
              style={tabStyle(tab)}>{tab.content}</span>
          </EnabledCell>
        ))}
      </Strip>
    </div>
  );
}
