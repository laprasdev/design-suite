// =====================================================
// BASE CONTAINER - DisplayMode-aware container component
// All container components should use this internally
// =====================================================

import React, { useMemo } from 'react';
import { useStyle } from '../../../StyleContext.tsx';
import { LayoutAPI, ContainerType, type ContainerTypeValue } from '../../../design/index.ts';

export interface BaseContainerProps {
  type: ContainerTypeValue;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function BaseContainer({
  type,
  children,
  className = '',
  style: customStyle
}: BaseContainerProps) {
  const { getEffectiveStyle, advancedSettings } = useStyle();
  const theme = getEffectiveStyle();
  const displayMode = advancedSettings.moduleDisplayMode;

  const containerStyle = useMemo(() =>
    LayoutAPI.getContainer(type, theme, displayMode),
    [type, theme, displayMode]
  );

  return (
    <div
      className={className}
      style={{
        ...containerStyle,
        ...customStyle
      }}
    >
      {children}
    </div>
  );
}

// Convenience exports for specific container types
export function ModuleContainer(props: Omit<BaseContainerProps, 'type'>) {
  return <BaseContainer type={ContainerType.MODULE} {...props} />;
}

export function CutoutContainer(props: Omit<BaseContainerProps, 'type'>) {
  return <BaseContainer type={ContainerType.CUTOUT} {...props} />;
}

export function NodeContainer(props: Omit<BaseContainerProps, 'type'>) {
  return <BaseContainer type={ContainerType.NODE} {...props} />;
}
