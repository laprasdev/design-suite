import {useState} from 'react';
import {Check, X} from 'lucide-react';
import {HeaderIconButton} from '../HeaderIconButton.tsx';
import {ModuleTextInput} from '../inputs/ModuleTextInput.tsx';
import {ELEMENT_FEEDBACK_LIMIT} from '../../skinAssignments.ts';

interface Props {
  label: string;
  value: string;
  busy?: boolean;
  editing: boolean;
  onClose(): void;
  onSave(text: string): Promise<boolean>;
}
/** Saved text sits under the sample; the editor takes its place only while editing. Saving never assigns. */
export function ElementFeedback({editing, value, ...editor}: Props) {
  if (editing) return <FeedbackEditor value={value} {...editor}/>;
  return value ? <p className="element-feedback">{value}</p> : null;
}
function FeedbackEditor({label, value, busy, onClose, onSave}: Omit<Props, 'editing'>) {
  const [draft, setDraft] = useState(value), [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try { if (await onSave(draft)) onClose(); }
    finally { setSaving(false); }
  }
  return <div className="element-feedback" data-editing>
    <ModuleTextInput multiline fill ariaLabel={`Feedback on ${label}`} value={draft} onChange={setDraft}
      maxLength={ELEMENT_FEEDBACK_LIMIT} disabled={saving} placeholder="What should change?"/>
    <div className="element-feedback-actions">
      <HeaderIconButton label="Cancel feedback" disabled={saving} onClick={onClose}><X/></HeaderIconButton>
      <HeaderIconButton label="Save feedback" active disabled={busy || saving}
        onClick={() => {void save();}}><Check/></HeaderIconButton>
    </div>
  </div>;
}
