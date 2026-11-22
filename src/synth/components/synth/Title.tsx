import React from 'react';
import { useStyle } from '../../StyleContext.tsx';
import { LayoutAPI, D, S } from '../../design/index.ts';
import { getColorScheme } from '../../../color.ts';

// =====================================================
// TITLE COMPONENTS
// Replaces: ModuleTitleText, TitleBase
// =====================================================

type TitleColor = 'primary' | 'secondary' | 'text';

export interface TitleProps {
  children: React.ReactNode;
  className?: string;
  color?: TitleColor;
  glow?: boolean;
}

// A title's colour: the style's text colour, or the main tone of the named scheme.
function useTitleColor(color: TitleColor): string {
  const style = useStyle().getEffectiveStyle();
  return color === 'text' ? style.textColor : getColorScheme(color, style).main;
}

// =====================================================
// TITLE BASE - Simple inline title
// =====================================================
export function TitleBase({ 
  children, 
  className = '',
  color = 'primary',
  glow = false
}: TitleProps) {
  const textColor = useTitleColor(color);

  return (
    <div 
      className={className}
      style={{
        ...LayoutAPI.labelStyle(textColor),
        textShadow: glow ? `0 0 ${D.spacing.tightGap}px ${textColor}` : undefined
      }}
    >
      {children}
    </div>
  );
}

// =====================================================
// MODULE TITLE TEXT - Large module header
// =====================================================
export interface ModuleTitleTextProps {
  children: React.ReactNode;
  className?: string;
  color?: TitleColor;
}

export function ModuleTitleText({ 
  children, 
  className = '',
  color = 'primary'
}: ModuleTitleTextProps) {
  const textColor = useTitleColor(color);

  return (
    <div 
      className={className}
      style={{
        ...LayoutAPI.titleStyle(textColor),
        marginBottom: D.spacing.tightGap,
        textShadow: `0 0 ${D.spacing.itemGap}px ${S.glow(textColor, 0.5)}`
      }}
    >
      {children}
    </div>
  );
}



