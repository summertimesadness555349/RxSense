import { Trash2 } from 'lucide-react';

export default function DrugInputRow({ drug, onChange, onRemove, canRemove }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={drug.name}
        onChange={(e) => onChange({ ...drug, name: e.target.value })}
        placeholder="Drug name (e.g., Metformin)"
        className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        aria-label="Drug name"
      />
      <input
        type="text"
        value={drug.dosage}
        onChange={(e) => onChange({ ...drug, dosage: e.target.value })}
        placeholder="Dosage"
        className="w-28 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        aria-label="Dosage"
      />
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
          aria-label="Remove drug"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
