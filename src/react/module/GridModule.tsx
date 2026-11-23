import React from 'react';
import { useStyle } from '../../synth/StyleContext.tsx';
import { Borders, D, MODULE_TITLE } from '../../synth/design/index.ts';
import { ModuleHeaderRow } from './ModuleHeaderRow.tsx';
import { ListboxSelect, type ListboxOption } from '../ListboxSelect.tsx';
import { ListboxForm } from '../listboxSelectElements.ts';
import { styleThemeVariables } from '../styleTheme.ts';
import {
  MODULE_HEADER_ATTRIBUTE, MODULE_HEADER_FORM_ATTRIBUTE, ModuleHeaderForm, ModuleTitleChoiceElement,
} from './gridModuleElements.ts';

const G = D.moduleGrid;
const FILLS: React.CSSProperties = { flex: 1, minWidth: 0, minHeight: 0 };
/** The room between a title's word and its chosen name, set only where a title heads a choice. */
const CHOICE_GAP: Record<'--module-title-gap', string> = { '--module-title-gap': `${G.headerTitleGap}px` };

/** What a module's name heads: one of `options`, each named as the title shows it, the module's word and the chosen
 *  one's name opening the list, the two carets after them and the arrows on the closed title stepping to the previous
 *  or next option. An option that is unavailable refuses with its reason. */
export interface ModuleTitleChoice<V extends string | number> {
  options: readonly ListboxOption<V>[];
  value: V;
  onChange(value: NoInfer<V>): void;
  onRefuse(option: ListboxOption<NoInfer<V>>): void;
}

/**
 * A module on a page: its name, open group and tabs over a body filling the tile. The tile draws the only border.
 * An untitled module's drawing says what it is, so its name is only its label, and a header with nothing else goes.
 * A titled module whose name heads a `choice` draws its word as that choice's trigger.
 */
export function GridModule<V extends string | number>({ title, titled = true, group, tabs, choice, children }: {
  title: string; titled?: boolean; group?: string; tabs?: React.ReactNode; choice?: ModuleTitleChoice<V>;
  children: React.ReactNode;
}) {
  const style = useStyle().getEffectiveStyle();
  const headerStyle: React.CSSProperties = {
    flexShrink: 0, display: 'flex', alignItems: 'center', gap: G.headerTitleGap,
    paddingInline: G.headerInset, borderBottom: `${Borders.standard.width}px solid ${style.borderColor}`,
  };
  const titleBase: React.CSSProperties = {
    ...MODULE_TITLE, margin: 0, lineHeight: `${G.headerLineHeight}px`, color: style.primaryColor,
    cursor: 'default',
  };
  const titleStyle: React.CSSProperties = {
    ...titleBase, whiteSpace: 'nowrap', minWidth: 0,
    overflow: 'hidden', textOverflow: 'ellipsis',
  };
  const choiceTitleStyle: React.CSSProperties = {
    ...titleBase, minWidth: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center',
    ...CHOICE_GAP, ...styleThemeVariables(style),
  };
  const chosen = choice?.options.find(option => option.value === choice.value);
  if (choice && !chosen) throw new Error(`${title}'s choice holds ${choice.value}, which none of its options is.`);
  const headerAttrs = {
    [MODULE_HEADER_ATTRIBUTE]: title,
    [MODULE_HEADER_FORM_ATTRIBUTE]: choice ? ModuleHeaderForm.CHOICE : undefined,
  };
  return (
    <section data-grid-module data-module-owner={title} aria-label={title}
      style={{ ...FILLS, display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-chrome, inherit)' }}>
      {(titled || group || tabs) && <header {...headerAttrs} style={headerStyle}>
        {titled && <h2 style={choice ? choiceTitleStyle : titleStyle}>{choice && chosen
          ? <ListboxSelect form={ListboxForm.STEP} label={title} className={ModuleTitleChoiceElement.className}
            options={choice.options} value={choice.value} onChange={choice.onChange} onRefuse={choice.onRefuse}>
            {title}
          </ListboxSelect>
          : title}</h2>}
        <ModuleHeaderRow group={group}>{tabs}</ModuleHeaderRow>
      </header>}
      <div data-module-body={title} style={{ ...FILLS, display: 'flex', overflow: 'auto' }}>{children}</div>
    </section>
  );
}
