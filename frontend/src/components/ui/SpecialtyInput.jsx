import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Award } from 'lucide-react';

const POPULAR_SPECIALTIES = [
  'General Medicine',
  'Cardiology',
  'Pediatrics',
  'Dermatology',
  'Neurology',
  'Gynecology',
  'Psychiatry',
  'Orthopedics',
  'Ophthalmology',
  'Gastroenterology'
];

export default function SpecialtyInput({
  value = [],
  onChange,
  error,
  label = "Specialties / Areas of Expertise"
}) {
  const [inputValue, setInputValue] = useState('');

  const addSpecialty = (specialtyName) => {
    const trimmed = specialtyName.trim();
    if (!trimmed) return;
    
    // Avoid duplicates (case-insensitive check)
    const exists = value.some(
      (s) => s.toLowerCase() === trimmed.toLowerCase()
    );
    
    if (!exists) {
      onChange([...value, trimmed]);
    }
    setInputValue('');
  };

  const removeSpecialty = (indexToRemove) => {
    onChange(value.filter((_, i) => i !== indexToRemove));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSpecialty(inputValue);
    }
  };

  // Filter out suggestions that are already selected
  const availableSuggestions = POPULAR_SPECIALTIES.filter(
    (spec) => !value.some((s) => s.toLowerCase() === spec.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
          <Award className="w-4 h-4 text-emerald-500" />
          {label}
        </label>
      )}

      {/* Input container & input */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-grow">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Cardiology, Pediatrics..."
              className={`
                w-full rounded-lg border px-3 py-2.5 text-sm
                bg-white dark:bg-gray-800
                border-gray-300 dark:border-gray-700
                text-gray-900 dark:text-gray-100
                placeholder-gray-400 dark:placeholder-gray-500
                focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                transition-colors duration-150
                ${error ? 'border-red-400 focus:ring-red-400' : ''}
              `}
            />
          </div>
          <button
            type="button"
            onClick={() => addSpecialty(inputValue)}
            className="flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-lg px-4 transition-colors duration-150"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Specialties Chips */}
        <div className="flex flex-wrap gap-1.5 min-h-[32px]">
          <AnimatePresence>
            {value.map((spec, index) => (
              <motion.span
                key={`${spec}-${index}`}
                initial={{ opacity: 0, scale: 0.8, y: 5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: -5 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/45 text-emerald-755 dark:text-emerald-305 border border-emerald-150 dark:border-emerald-900/50 rounded-full px-3 py-1 text-xs font-semibold shadow-sm"
              >
                {spec}
                <button
                  type="button"
                  onClick={() => removeSpecialty(index)}
                  className="hover:bg-emerald-200 dark:hover:bg-emerald-900/60 rounded-full p-0.5 transition-colors duration-150"
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
          {value.length === 0 && (
            <p className="text-xs text-gray-450 dark:text-gray-500 italic py-1">
              No specialties added yet. Add at least one.
            </p>
          )}
        </div>

        {/* Suggestions Panel */}
        {availableSuggestions.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Quick Add Suggestions:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {availableSuggestions.map((spec) => (
                <button
                  key={spec}
                  type="button"
                  onClick={() => addSpecialty(spec)}
                  className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors duration-150 flex items-center gap-0.5 border border-gray-200 dark:border-gray-750"
                >
                  <Plus className="w-2.5 h-2.5 text-gray-405" />
                  {spec}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}
