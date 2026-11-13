import React, {forwardRef, useMemo, type HTMLAttributes, type AnchorHTMLAttributes} from 'react';
import {useStyleContext} from '../../../StyleContext.tsx';
import {LayoutAPI, ContainerType, type ContainerTypeValue} from '../../../design/index.ts';
import {ContainerForm, SkinKind, type ContainerFormValue} from '../../../../skinKinds.ts';
import {skinForm} from '../../../../skinForms.ts';
export interface BaseContainerProps extends HTMLAttributes<HTMLElement> {
  type?: ContainerTypeValue;
  as?: 'div' | 'section' | 'aside' | 'a';
  form?: ContainerFormValue;
  href?: string;
  target?: AnchorHTMLAttributes<HTMLAnchorElement>['target'];
  rel?: string;
}
export const BaseContainer = forwardRef<HTMLElement, BaseContainerProps>(function BaseContainer({
  type, as: Tag = 'div', form, children, className = '', style, ...attributes
}, ref) {
  const context = useStyleContext();
  const containerStyle = useMemo(() => {
    if (!type) return undefined;
    if (!context) throw new Error('A synth container requires StyleProvider');
    return LayoutAPI.getContainer(type, context.getEffectiveStyle(), context.advancedSettings.moduleDisplayMode);
  }, [type, context]);
  // A callback ref handles each supported semantic element without a cast.
  const attach = (node: HTMLElement | null) => {
    if (typeof ref === 'function') ref(node); else if (ref) ref.current = node;
  };
  return <Tag {...attributes} ref={attach} className={`bd-container ${className}`}
    data-container-form={type ? undefined : form ?? skinForm(context?.skin, SkinKind.CONTAINER) ?? ContainerForm.CUTOUT}
    style={{...containerStyle, ...style}}>{children}</Tag>;
});
export function ModuleContainer(props: Omit<BaseContainerProps, 'type'>) {
  return <BaseContainer type={ContainerType.MODULE} {...props}/>;
}
export function CutoutContainer(props: Omit<BaseContainerProps, 'type'>) {
  return <BaseContainer type={ContainerType.CUTOUT} {...props}/>;
}
export function NodeContainer(props: Omit<BaseContainerProps, 'type'>) {
  return <BaseContainer type={ContainerType.NODE} {...props}/>;
}
