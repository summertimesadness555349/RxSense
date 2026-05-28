import { useState, useEffect } from 'react';
import { Grid3X3, List, Upload, HardDrive, FileText, Image, File, Loader2, Download, ExternalLink, X } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import Modal from '../components/ui/Modal.jsx';
import Badge from '../components/ui/Badge.jsx';
import { getPatientDocuments, getPrescriptionHistoryLocal, getReportHistoryLocal } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = ['All', 'Lab Reports', 'Prescriptions'];

const REPORT_TYPE_LABELS = {
  CBC:               'Complete Blood Count (CBC)',
  lipid_panel:       'Lipid Panel',
  metabolic_panel:   'Metabolic Panel',
  urine_analysis:    'Urine Analysis',
  thyroid:           'Thyroid Panel',
  other:             'Lab Report',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isImageUrl(url) {
  if (!url) return false;
  const u = url.toLowerCase();
  return /\.(jpg|jpeg|png|gif|webp|avif|bmp)(\?|$)/.test(u) || u.includes('/image/upload/');
}

function isPdfUrl(url) {
  if (!url) return false;
  const u = url.toLowerCase();
  return u.includes('.pdf') || u.includes('/raw/upload/');
}

function fmtDate(raw) {
  if (!raw) return '—';
  const d = new Date(raw);
  if (isNaN(d)) return String(raw);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function normaliseReports(apiReports, localReports) {
  const seen = new Set();
  const docs = [];

  // API-sourced reports (authoritative)
  for (const r of apiReports) {
    seen.add(String(r.id));
    docs.push({
      id:       String(r.id),
      source:   'report',
      title:    REPORT_TYPE_LABELS[r.doc_type] || r.doc_type || 'Lab Report',
      type:     'Lab Report',
      category: 'lab-report',
      date:     fmtDate(r.doc_date),
      rawDate:  r.created_at || r.doc_date,
      image_url: r.image_url || null,
      facility: r.facility  || null,
      doctor:   r.doctor    || null,
      aiSummary: null,
    });
  }

  // localStorage fallback — include only if not already in API results
  for (const r of localReports) {
    const id = String(r.id || r.savedAt);
    if (seen.has(id)) continue;
    seen.add(id);
    docs.push({
      id,
      source:    'report',
      title:     r.type || 'Lab Report',
      type:      'Lab Report',
      category:  'lab-report',
      date:      fmtDate(r.date || r.savedAt),
      rawDate:   r.savedAt,
      image_url: r.image_url || null,
      facility:  r.facility  || null,
      doctor:    r.ordering_doctor || null,
      aiSummary: r.overall_impression || null,
    });
  }

  return docs;
}

function normalisePrescriptions(apiPrescriptions, localPrescriptions) {
  const seen = new Set();
  const docs = [];

  for (const p of apiPrescriptions) {
    seen.add(String(p.id));
    docs.push({
      id:       String(p.id),
      source:   'prescription',
      title:    p.doctor ? `Prescription — ${p.doctor}` : 'Prescription',
      type:     'Prescription',
      category: 'prescription',
      date:     fmtDate(p.doc_date),
      rawDate:  p.created_at || p.doc_date,
      image_url: p.image_url || null,
      facility:  p.facility  || null,
      doctor:    p.doctor    || null,
      aiSummary: null,
    });
  }

  for (const p of localPrescriptions) {
    const id = String(p.scan_id || p.savedAt);
    if (seen.has(id)) continue;
    seen.add(id);
    const medNames = (p.medications || []).slice(0, 3).map((m) => m.name).filter(Boolean);
    docs.push({
      id,
      source:    'prescription',
      title:     p.doctor?.name ? `Prescription — ${p.doctor.name}` : 'Prescription',
      type:      'Prescription',
      category:  'prescription',
      date:      fmtDate(p.date || p.savedAt),
      rawDate:   p.savedAt,
      image_url: p.image_url || null,
      facility:  p.hospital?.name || null,
      doctor:    p.doctor?.name || null,
      aiSummary: medNames.length ? `Medications: ${medNames.join(', ')}` : null,
    });
  }

  return docs;
}

// ── Document thumbnail ────────────────────────────────────────────────────────

function DocThumb({ doc, size = 'md' }) {
  const dim = size === 'sm' ? 'w-10 h-10' : 'w-full h-28';
  const iconSize = size === 'sm' ? 'w-5 h-5' : 'w-8 h-8';

  if (doc.image_url && isImageUrl(doc.image_url)) {
    return (
      <img
        src={doc.image_url}
        alt={doc.title}
        className={`${dim} object-cover ${size === 'sm' ? 'rounded-lg' : ''}`}
      />
    );
  }

  const bg    = doc.type === 'Prescription' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-blue-100 dark:bg-blue-900/30';
  const Icon  = doc.type === 'Prescription' ? FileText : doc.type === 'Imaging' ? Image : File;
  const color = doc.type === 'Prescription' ? 'text-emerald-500' : doc.type === 'Imaging' ? 'text-amber-500' : 'text-blue-500';

  return (
    <div className={`${dim} ${bg} flex items-center justify-center ${size === 'sm' ? 'rounded-lg flex-shrink-0' : ''}`}>
      <Icon className={`${iconSize} ${color}`} />
    </div>
  );
}

// ── Document card ─────────────────────────────────────────────────────────────

const TYPE_BADGE = { 'Lab Report': 'blue', 'Prescription': 'emerald', 'Imaging': 'amber' };

function DocCard({ doc, onClick, view }) {
  if (view === 'list') {
    return (
      <div
        onClick={() => onClick(doc)}
        className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:border-emerald-400 dark:hover:border-emerald-700 cursor-pointer transition-colors"
      >
        <DocThumb doc={doc} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{doc.title}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">{doc.facility || doc.doctor || '—'}</p>
        </div>
        <div className="flex-shrink-0 text-right">
          <Badge variant={TYPE_BADGE[doc.type] || 'gray'}>{doc.type}</Badge>
          <p className="text-xs text-gray-400 mt-1">{doc.date}</p>
        </div>
        <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </div>
    );
  }

  return (
    <div
      onClick={() => onClick(doc)}
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden hover:border-emerald-400 dark:hover:border-emerald-700 cursor-pointer transition-all hover:shadow-md group"
    >
      <div className="overflow-hidden group-hover:opacity-90 transition-opacity">
        <DocThumb doc={doc} size="md" />
      </div>
      <div className="p-3 space-y-1.5">
        <Badge variant={TYPE_BADGE[doc.type] || 'gray'}>{doc.type}</Badge>
        <p className="text-sm font-medium text-gray-900 dark:text-white leading-snug line-clamp-2">{doc.title}</p>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{doc.date}</span>
          {doc.facility && <span className="truncate ml-1 text-right">{doc.facility}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Document viewer modal ─────────────────────────────────────────────────────

function DocViewer({ doc, onClose }) {
  if (!doc) return null;

  const hasImage = doc.image_url && isImageUrl(doc.image_url);
  const hasPdf   = doc.image_url && isPdfUrl(doc.image_url);
  const hasUrl   = doc.image_url;

  return (
    <Modal isOpen={!!doc} onClose={onClose} title={doc.title} size="xl">
      <div className="space-y-4">

        {/* ── Media viewer ── */}
        {hasImage && (
          <div className="rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center max-h-[60vh]">
            <img
              src={doc.image_url}
              alt={doc.title}
              className="max-w-full max-h-[60vh] object-contain"
            />
          </div>
        )}

        {hasPdf && (
          <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700" style={{ height: '60vh' }}>
            <iframe
              src={doc.image_url}
              title={doc.title}
              className="w-full h-full"
              frameBorder="0"
            />
          </div>
        )}

        {!hasUrl && (
          <div className="h-40 bg-gray-100 dark:bg-gray-800 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400">
            {doc.type === 'Prescription' ? <FileText className="w-10 h-10" /> : <File className="w-10 h-10" />}
            <span className="text-sm">No preview available</span>
          </div>
        )}

        {/* ── Metadata ── */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {[
            { label: 'Type',     value: doc.type   },
            { label: 'Date',     value: doc.date   },
            { label: 'Facility', value: doc.facility },
            { label: 'Doctor',   value: doc.doctor  },
          ].map(({ label, value }) => value ? (
            <div key={label} className="flex gap-2">
              <span className="text-gray-400 dark:text-gray-500 w-20 flex-shrink-0">{label}</span>
              <span className="text-gray-900 dark:text-white font-medium">{value}</span>
            </div>
          ) : null)}
        </div>

        {doc.aiSummary && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">AI Summary</p>
            <p className="text-sm text-blue-600 dark:text-blue-300 leading-relaxed">{doc.aiSummary}</p>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex gap-2 pt-1">
          {hasUrl && (
            <a
              href={doc.image_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" /> Download / Open
            </a>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════

export default function HistoryDocuments() {
  const { addToast } = useToast();

  const [loading,         setLoading]         = useState(true);
  const [documents,       setDocuments]        = useState([]);
  const [view,            setView]             = useState('grid');
  const [activeCategory,  setActiveCategory]   = useState('All');
  const [selectedDoc,     setSelectedDoc]      = useState(null);

  // Load documents: backend → merge with localStorage
  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const { reports: apiReports, prescriptions: apiPrescriptions } = await getPatientDocuments();
        const localReports        = getReportHistoryLocal();
        const localPrescriptions  = getPrescriptionHistoryLocal();

        const reportDocs      = normaliseReports(apiReports, localReports);
        const prescriptionDocs = normalisePrescriptions(apiPrescriptions, localPrescriptions);

        const all = [...reportDocs, ...prescriptionDocs].sort(
          (a, b) => new Date(b.rawDate || 0) - new Date(a.rawDate || 0)
        );

        if (mounted) setDocuments(all);
      } catch {
        // API unavailable — fall back to localStorage only
        const localReports       = getReportHistoryLocal();
        const localPrescriptions = getPrescriptionHistoryLocal();
        const reportDocs         = normaliseReports([], localReports);
        const prescriptionDocs   = normalisePrescriptions([], localPrescriptions);
        const all = [...reportDocs, ...prescriptionDocs].sort(
          (a, b) => new Date(b.rawDate || 0) - new Date(a.rawDate || 0)
        );
        if (mounted) setDocuments(all);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, []);

  const filtered = documents.filter((d) => {
    if (activeCategory === 'All')           return true;
    if (activeCategory === 'Lab Reports')   return d.category === 'lab-report';
    if (activeCategory === 'Prescriptions') return d.category === 'prescription';
    return true;
  });

  const totalDocs = documents.length;

  return (
    <div className="space-y-4">

      {/* Storage / count strip */}
      <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
        <HardDrive className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
            {loading ? 'Loading documents…' : `${totalDocs} document${totalDocs !== 1 ? 's' : ''} stored`}
          </p>
          <p className="text-xs text-gray-400">Reports and prescriptions from your scans</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCategory(c)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategory === c
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-emerald-400'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('grid')}
            className={`p-2 rounded-lg transition-colors ${view === 'grid' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView('list')}
            className={`p-2 rounded-lg transition-colors ${view === 'list' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Document grid / list */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <File className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-base font-medium">No documents yet</p>
          <p className="text-sm mt-1">Upload a report or scan a prescription to see it here.</p>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((doc) => (
            <DocCard key={doc.id} doc={doc} onClick={setSelectedDoc} view="grid" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((doc) => (
            <DocCard key={doc.id} doc={doc} onClick={setSelectedDoc} view="list" />
          ))}
        </div>
      )}

      {/* Document viewer modal */}
      <DocViewer doc={selectedDoc} onClose={() => setSelectedDoc(null)} />
    </div>
  );
}
