import {Label} from '../accents.tsx';
import {ListboxSelect} from '../ListboxSelect.tsx';
import {ListboxForm} from '../listboxSelectElements.ts';
import {usePhoneWidth} from '../phoneWidth.ts';
import type {ElementGroup} from './elementCatalog.ts';

/** The page's jump to a kind: an even grid of links, or at phone width the select's menu form in the same slot. */
export function ElementKindIndex({groups}: {groups: readonly ElementGroup[]}) {
  const phone = usePhoneWidth();
  return <nav className="elements-index" aria-label="Element kinds">
    {phone
      ? <ListboxSelect form={ListboxForm.MENU} label="Jump to kind" title="Jump to kind" field
        options={groups.map(group => ({value: group.id, label: group.label}))}
        onAction={id => {window.location.hash = id;}}><Label kind="action">Kinds</Label></ListboxSelect>
      : groups.map(group => <a key={group.id} href={`#${group.id}`}>{group.label}</a>)}
  </nav>;
}
