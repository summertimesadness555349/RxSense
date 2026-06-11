import { useState } from 'react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import Input, { Select, Textarea } from '../ui/Input.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { addTimelineEntry } from '../../services/api.js';

const entryTypes = [
  { value: 'visit', label: '🏥 Doctor Visit' },
  // { value: 'note', label: '📝 Personal Note' },
  // { value: 'medication', label: '💊 Medication Change' },
  { value: 'vaccination', label: '💉 Vaccination' },
  { value: 'surgery', label: '🩹 Surgery' },
];

export default function AddEntryModal({ isOpen, onClose, onAdd }) {
  const [type, setType] = useState('visit');
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState({});

  const userId = user?.patient_id || user?.uuid || user?.id || null;

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        type,
        data: {
          ...form,
          date: form.date || new Date().toISOString().slice(0, 10),
        }
      };

      await addTimelineEntry(userId, payload);

      onAdd?.();
      addToast('Entry added to your timeline!', 'success');
      setForm({});
      onClose();
    } catch (err) {
      addToast(err.message || 'Failed to add entry', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Timeline Entry" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select label="Entry Type" value={type} onChange={(e) => setType(e.target.value)}>
          {entryTypes.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </Select>

        {type === 'visit' && (
          <>
            <Input label="Date" type="date" onChange={(e) => set('date', e.target.value)} required />
            <Input label="Doctor Name" placeholder="Dr. Karim Ahmed" onChange={(e) => set('doctor', e.target.value)} required />
            <Input label="Hospital / Clinic" placeholder="Dhaka Medical College" onChange={(e) => set('hospital', e.target.value)} />
            <Input label="Complaint" placeholder="e.g., recurring stomach pain" onChange={(e) => set('complaint', e.target.value)} />
            <Input label="Diagnosis" placeholder="e.g., Gastritis" onChange={(e) => set('diagnosis', e.target.value)} />
            <Textarea label="Notes" placeholder="Any additional notes..." rows={3} onChange={(e) => set('notes', e.target.value)} />
          </>
        )}

        {/* {type === 'note' && (
          <>
            <Textarea label="Note" placeholder="How are you feeling? Any symptoms?" rows={4} onChange={(e) => set('note', e.target.value)} required />
            <Select label="Mood (1 = Very Bad, 5 = Great)" onChange={(e) => set('mood', e.target.value)}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
            <Select label="Energy Level (1-5)" onChange={(e) => set('energy', e.target.value)}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
          </>
        )} */}

        {/* {type === 'medication' && (
          <>
            <Input label="Drug Name" placeholder="Metformin" onChange={(e) => set('drug', e.target.value)} required />
            <Input label="Old Dosage" placeholder="250mg" onChange={(e) => set('oldDosage', e.target.value)} />
            <Input label="New Dosage" placeholder="500mg" onChange={(e) => set('newDosage', e.target.value)} required />
            <Input label="Reason" placeholder="Blood sugar not controlled" onChange={(e) => set('reason', e.target.value)} />
            <Input label="Prescribing Doctor" placeholder="Dr. Karim Ahmed" onChange={(e) => set('prescribingDoctor', e.target.value)} />
          </>
        )} */}

        {type === 'vaccination' && (
          <>
            <Input label="Vaccine Name" placeholder="COVID-19 (Pfizer)" onChange={(e) => set('vaccine', e.target.value)} required />
            <Input label="Date" type="date" onChange={(e) => set('date', e.target.value)} required />
            <Input label="Dose Number / Type" placeholder="Dose 1, Booster..." onChange={(e) => set('dose', e.target.value)} />
            <Input label="Facility" placeholder="Dhaka City Health Center" onChange={(e) => set('facility', e.target.value)} />
          </>
        )}

        {type === 'surgery' && (
          <>
            <Input label="Surgery Name" placeholder="Appendectomy" onChange={(e) => set('surgery', e.target.value)} required />
            <Input label="Date" type="date" onChange={(e) => set('date', e.target.value)} required />
            <Input label="Doctor" placeholder="Dr. Karim Ahmed" onChange={(e) => set('doctor', e.target.value)} />
            <Input label="Hospital" placeholder="Dhaka Medical College" onChange={(e) => set('hospital', e.target.value)} />
          </>
        )}

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" loading={loading} className="flex-1">Add Entry</Button>
        </div>
      </form>
    </Modal>
  );
}
