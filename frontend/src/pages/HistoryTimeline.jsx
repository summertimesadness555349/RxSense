import { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import TimelineEntry from '../components/history/TimelineEntry.jsx';
import AddEntryModal from '../components/history/AddEntryModal.jsx';
import { getTimeline } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const typeFilters = ['All', 'Report', 'Prescription', 'Symptom', 'Visit', 'Surgery', 'Note', 'Medication'];

export default function HistoryTimeline() {
  const { user, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const userId = user?.patient_id || user?.uuid || user?.id || null;

  const loadTimeline = async () => {
    if (!userId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const data = await getTimeline(userId);
      setEntries(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'Failed to load timeline.');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    loadTimeline();
  }, [authLoading, userId]);

  const filtered = entries.filter((e) => {
    const matchType = activeFilter === 'All' || e.type === activeFilter.toLowerCase();
    const titleText = String(e.title || '').toLowerCase();
    const summaryText = String(e.summary || '').toLowerCase();
    const q = search.toLowerCase();
    const matchSearch = !search || titleText.includes(q) || summaryText.includes(q);
    return matchType && matchSearch;
  });

  const handleAdd = () => {
    loadTimeline();
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search timeline..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {typeFilters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeFilter === f
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-emerald-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg mb-1">Loading timeline...</p>
          <p className="text-sm">Please wait a moment.</p>
        </div>
      ) : error ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg mb-1">Unable to load timeline</p>
          <p className="text-sm">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg mb-1">No entries found</p>
          <p className="text-sm">Try adjusting your filters or add a new entry.</p>
        </div>
      ) : (
        <div className="space-y-0 pl-2">
          {filtered.map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <TimelineEntry entry={entry} />
            </motion.div>
          ))}
        </div>
      )}

      {/* Floating Add Button */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-24 right-4 lg:bottom-8 lg:right-6 w-14 h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full shadow-lg shadow-emerald-500/30 flex items-center justify-center transition-all hover:scale-105 z-30"
        aria-label="Add timeline entry"
      >
        <Plus className="w-6 h-6" />
      </button>

      <AddEntryModal isOpen={showModal} onClose={() => setShowModal(false)} onAdd={handleAdd} />
    </div>
  );
}
