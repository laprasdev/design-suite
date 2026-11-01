import React from 'react';
import { useStyle } from '../../StyleContext.tsx';
import { LayoutAPI, D, S } from '../../design/index.ts';
import { getColorScheme } from '../../../color.ts';

// =====================================================
// TITLE COMPONENTS
// Replaces: ModuleTitleText, TitleBase
// =====================================================

type TitleColor = 'primary' | 'secondary' | 'text';
type TitleSize = 'sm' | 'md' | 'lg';

export interface TitleProps {
  children: React.ReactNode;
  className?: string;
  color?: TitleColor;
  size?: TitleSize;
  glow?: boolean;
}

// =====================================================
// TITLE BASE - Simple inline title
// =====================================================
export function TitleBase({ 
  children, 
  className = '',
  color = 'primary',
  size = 'sm',
  glow = false
}: TitleProps) {
  const { getEffectiveStyle } = useStyle();
  const style = getEffectiveStyle();
  
  const textColor = color === 'text' 
    ? style.textColor 
    : getColorScheme(color, style).main;
  
  const fontSize = {
    sm: D.spacing.tightGap + 1, // 9
    md: D.spacing.itemGap - 2,  // 10
    lg: D.spacing.itemGap      // 12
  }[size];
  
  return (
    <div 
      className={className}
      style={{
        ...LayoutAPI.labelStyle(textColor),
        fontSize,
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
  const { getEffectiveStyle } = useStyle();
  const style = getEffectiveStyle();
  
  const textColor = color === 'text' 
    ? style.textColor 
    : getColorScheme(color, style).main;
  
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



