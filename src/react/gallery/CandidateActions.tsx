import {useState} from 'react';
import {Check, MessageSquare, Star} from 'lucide-react';
import {HeaderIconButton} from '../HeaderIconButton.tsx';
import type {ComponentSkin} from '../../skinAssignments.ts';
import {candidateKey, type ElementGroup, type ElementOption} from './elementCatalog.ts';

export const candidateState = (skin: ComponentSkin, group: ElementGroup, option: ElementOption) => ({
  selected: !!skin.candidates[group.id]?.includes(option.id), active: skin.active[group.id] === option.id,
});
/** Which candidates' feedback editors are open; each tile keeps its own. */
export function useFeedbackEditing() {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const change = (group: string, option: string, editing: boolean) => setOpen(previous => {
    const next = new Set(previous);
    if (editing) next.add(candidateKey(group, option)); else next.delete(candidateKey(group, option));
    return next;
  });
  return {isEditing: (group: string, option: string) => open.has(candidateKey(group, option)), change};
}
interface Props {
  group: ElementGroup; option: ElementOption; skin: ComponentSkin; busy?: boolean; editing: boolean;
  onAssign(selected: boolean): void; onActivate(): void; onEdit(): void;
}
/** A tile's heading controls: assign, use when assigned but not active, and feedback. */
export function CandidateActions({group, option, skin, busy, editing, onAssign, onActivate, onEdit}: Props) {
  const {selected, active} = candidateState(skin, group, option);
  return <span className="element-actions" data-candidate-actions={candidateKey(group.id, option.id)}>
    {option.assignable !== false && <HeaderIconButton label={`Assign ${option.label} to ${skin.name}`}
      active={selected} disabled={busy} onClick={() => onAssign(!selected)}><Check/></HeaderIconButton>}
    {option.assignable !== false && selected && !active && <HeaderIconButton
      label={`Use ${option.label} in ${skin.name}`} disabled={busy} onClick={onActivate}><Star/></HeaderIconButton>}
    <HeaderIconButton label={`Feedback on ${group.label}: ${option.label}`} active={editing}
      onClick={onEdit}><MessageSquare/></HeaderIconButton>
  </span>;
}
