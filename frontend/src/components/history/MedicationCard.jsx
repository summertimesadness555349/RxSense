import { useState } from 'react';
import { Bell, BellOff, Edit2, Square } from 'lucide-react';
import Badge from '../ui/Badge.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export default function MedicationCard({ med, onUpdate }) {
  const [reminder, setReminder] = useState(med.reminderEnabled);
  const { addToast } = useToast();

  const toggleReminder = () => {
    const next = !reminder;
    setReminder(next);
    addToast(next ? `Reminder set for ${med.name}` : `Reminder off for ${med.name}`, 'info');
  };

  const handleStop = () => {
    addToast(`${med.name} marked as stopped.`, 'warning');
    onUpdate?.({ ...med, status: 'stopped' });
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{med.name}</h3>
            <Badge variant="emerald">{med.dosage}</Badge>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{med.frequency} • Since {med.startDate}</p>
        </div>
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0 mt-1.5" title="Active" />
      </div>

      <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
        <div><span className="font-medium">Prescribed by:</span> {med.prescribedBy}</div>
        <div><span className="font-medium">Purpose:</span> {med.purpose}</div>
        {med.timing?.length > 0 && (
          <div><span className="font-medium">Timing:</span> {med.timing.join(', ')}</div>
        )}
        {med.refillDaysRemaining !== undefined && med.refillDaysRemaining <= 7 && (
          <div className="text-amber-600 dark:text-amber-400 font-medium">
            ⚠️ ~{med.refillDaysRemaining} days of medication remaining
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <button
          onClick={toggleReminder}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            reminder
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400'
              : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-emerald-300'
          }`}
        >
          {reminder ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
          {reminder ? 'Reminder On' : 'Set Reminder'}
        </button>
        <button
          onClick={handleStop}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-red-300 hover:text-red-500 transition-colors"
        >
          <Square className="w-3.5 h-3.5" />
          Mark Stopped
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors">
          <Edit2 className="w-3.5 h-3.5" />
          Edit
        </button>
      </div>
    </div>
  );
}
