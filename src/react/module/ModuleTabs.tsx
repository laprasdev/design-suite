import React from 'react';
import {useStyle} from '../../synth/StyleContext.tsx';
import {D, O, T} from '../../synth/design/index.ts';
import {SegmentedControl, ICON_SEGMENT_VARIANT} from '../SegmentedControl.tsx';
import {useStyleThemeVariables} from '../styleTheme.ts';

export interface ModuleTab<Id extends string> {id: Id; label: string; content: React.ReactNode; authored: boolean}

/** Module tabs use the shared indicator and keyboard behavior. The active name belongs to its clickable tab. */
export function ModuleTabs<Id extends string>({tabs, value, onChange, ariaLabel, labelActive = false}: {
  tabs: ModuleTab<Id>[]; value: Id; onChange: (id: Id) => void; ariaLabel: string; labelActive?: boolean;
}) {
  const {primaryColor} = useStyle().getEffectiveStyle();
  return <div style={{display: 'flex', alignItems: 'stretch', flex: 'none',
    minWidth: 0, maxWidth: '100%', ...useStyleThemeVariables()}}>
    <SegmentedControl<Id> tabs scroll variant={ICON_SEGMENT_VARIANT} density="compact" iconOnly={!labelActive}
      ariaLabel={ariaLabel} value={value} onChange={onChange} options={tabs.map(tab => ({
        value: tab.id, ariaLabel: tab.label, title: tab.label,
        data: {'data-tab': tab.id, 'data-tab-set': tab.authored},
        style: {minWidth: D.moduleGrid.tabMinWidth, minHeight: D.moduleGrid.tabMinHeight,
          color: primaryColor, opacity: tab.authored || tab.id === value ? O.full : O.low},
        label: <span style={{display: 'flex', alignItems: 'center', gap: D.moduleGrid.fieldGap}}>
          {tab.content}{labelActive && tab.id === value &&
            <span style={{...T.moduleLabel, textTransform: 'uppercase'}}>{tab.label}</span>}
        </span>,
      }))}/>
  </div>;
}
