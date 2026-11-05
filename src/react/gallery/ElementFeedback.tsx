import {useState} from 'react';
import {MessageSquare} from 'lucide-react';
import {Button} from '../Button.tsx';
import {ModuleTextInput} from '../inputs/ModuleTextInput.tsx';
import {ELEMENT_FEEDBACK_LIMIT} from '../../skinAssignments.ts';

interface Props {
  label: string;
  value: string;
  busy?: boolean;
  onSave(text: string): Promise<boolean>;
}
/** Saving a note never selects, assigns or activates its component. */
export function ElementFeedback({label, value, busy, onSave}: Props) {
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try { if (await onSave(draft)) setEditing(false); }
    finally { setSaving(false); }
  }
  if (!editing) return <div className="element-feedback">
    {value && <p>{value}</p>}
    <Button variant="subtle" aria-label={`Feedback on ${label}`} onClick={() => {setDraft(value);setEditing(true);}}>
      <MessageSquare size={14} aria-hidden/>{value ? 'Edit feedback' : 'Feedback'}
    </Button>
  </div>;
  return <div className="element-feedback" data-editing>
    <ModuleTextInput multiline fill ariaLabel={`Feedback on ${label}`} value={draft} onChange={setDraft}
      maxLength={ELEMENT_FEEDBACK_LIMIT} disabled={saving} placeholder="What should change?"/>
    <div className="element-feedback-actions">
      <Button variant="accent" disabled={busy || saving} onClick={() => {void save();}}>
        {saving ? 'Saving…' : 'Save feedback'}
      </Button>
      <Button variant="subtle" disabled={saving} onClick={() => setEditing(false)}>Cancel</Button>
    </div>
  </div>;
}
