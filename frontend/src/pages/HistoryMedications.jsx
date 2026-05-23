import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Bell } from 'lucide-react';
import MedicationCard from '../components/history/MedicationCard.jsx';
import Button from '../components/ui/Button.jsx';
import Modal from '../components/ui/Modal.jsx';
import Card from '../components/ui/Card.jsx';
import Input, { Select, Textarea } from '../components/ui/Input.jsx';
import { mockCurrentMedications, mockPastMedications } from '../data/mockMedications.js';
import { useToast } from '../context/ToastContext.jsx';

export default function HistoryMedications() {
  const [current, setCurrent] = useState(mockCurrentMedications);
  const [pastOpen, setPastOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const { addToast } = useToast();
  const [form, setForm] = useState({ name: '', dosage: '', frequency: '1x daily', startDate: '', doctor: '', purpose: '' });

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleAdd = () => {
    if (!form.name) { addToast('Drug name is required.', 'error'); return; }
    setCurrent((p) => [...p, { ...form, id: `med_${Date.now()}`, status: 'active', reminderEnabled: false, refillDaysRemaining: 30 }]);
    addToast(`${form.name} added to your medications.`, 'success');
    setShowAdd(false);
    setForm({ name: '', dosage: '', frequency: '1x daily', startDate: '', doctor: '', purpose: '' });
  };

  return (
    <div className="space-y-5">
      {/* Refill alerts */}
      <div className="space-y-2">
        {current.filter((m) => m.refillDaysRemaining <= 7).map((m) => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm">
            <Bell className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="flex-1 text-amber-800 dark:text-amber-300 font-medium">
              {m.name} {m.dosage} — ~{m.refillDaysRemaining} days remaining
            </p>
            <button onClick={() => addToast(`Refill reminder set for ${m.name}!`, 'success')} className="text-xs text-amber-700 dark:text-amber-400 font-semibold hover:underline">
              Remind Me
            </button>
          </div>
        ))}
      </div>

      {/* Current medications */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 dark:text-white">Current Medications ({current.length})</h2>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4" /> Add Medication
          </Button>
        </div>
        <div className="space-y-3">
          {current.map((med) => (
            <MedicationCard key={med.id} med={med} onUpdate={(updated) => setCurrent((p) => p.map((m) => m.id === updated.id ? updated : m))} />
          ))}
        </div>
      </div>

      {/* Medication Timeline (placeholder) */}
      <Card hover={false}>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Medication Timeline</h3>
        <div className="space-y-2">
          {[
            { name: 'Metformin 250mg', start: 'Jun 2023', end: 'Mar 2026', active: false },
            { name: 'Metformin 500mg', start: 'Mar 2026', end: 'Present', active: true },
            { name: 'Iron Supplement', start: 'May 2026', end: 'Present', active: true },
            { name: 'Amoxicillin 500mg', start: '20 May', end: '27 May', active: false },
          ].map(({ name, start, end, active }) => (
            <div key={name} className="flex items-center gap-3 text-xs">
              <span className="w-36 flex-shrink-0 text-gray-700 dark:text-gray-300 font-medium truncate">{name}</span>
              <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-800 rounded relative overflow-hidden">
                <div className={`absolute inset-y-0 left-0 rounded ${active ? 'bg-emerald-400' : 'bg-gray-400'}`}
                  style={{ width: active ? '60%' : '35%', left: active ? '30%' : '0%' }} />
              </div>
              <span className="text-gray-400 flex-shrink-0">{start} → {end}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">Hover over a bar to see details (coming soon)</p>
      </Card>

      {/* Past medications */}
      <div>
        <button
          onClick={() => setPastOpen((p) => !p)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          {pastOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Past Medications ({mockPastMedications.length})
        </button>
        {pastOpen && (
          <div className="mt-3 space-y-3">
            {mockPastMedications.map((med) => (
              <div key={med.id} className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 opacity-70">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-medium text-gray-600 dark:text-gray-400 line-through text-sm">{med.name} {med.dosage}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${med.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                    {med.status === 'completed' ? 'Course Completed' : 'Stopped'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{med.startDate} → {med.endDate}</p>
                {med.stoppedReason && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Reason: {med.stoppedReason}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Medication Modal */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Medication" size="md">
        <div className="space-y-3">
          <Input label="Drug Name *" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Metformin" />
          <Input label="Dosage" value={form.dosage} onChange={(e) => set('dosage', e.target.value)} placeholder="500mg" />
          <Select label="Frequency" value={form.frequency} onChange={(e) => set('frequency', e.target.value)}>
            <option>1x daily</option>
            <option>2x daily</option>
            <option>3x daily</option>
            <option>As needed</option>
          </Select>
          <Input label="Start Date" type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
          <Input label="Prescribing Doctor" value={form.doctor} onChange={(e) => set('doctor', e.target.value)} placeholder="Dr. Karim Ahmed" />
          <Textarea label="Purpose / Notes" value={form.purpose} onChange={(e) => set('purpose', e.target.value)} placeholder="Blood sugar control..." rows={2} />
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" onClick={() => setShowAdd(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleAdd} className="flex-1">Add Medication</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
