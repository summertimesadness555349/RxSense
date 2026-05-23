import { useState } from 'react';
import { Grid3X3, List, Upload, HardDrive } from 'lucide-react';
import DocumentCard from '../components/history/DocumentCard.jsx';
import Button from '../components/ui/Button.jsx';
import Modal from '../components/ui/Modal.jsx';
import { mockDocuments, storageUsedMB, storageTotalMB } from '../data/mockDocuments.js';
import { useToast } from '../context/ToastContext.jsx';

const categories = ['All', 'Lab Reports', 'Prescriptions', 'Discharge Summaries', 'Imaging', 'Insurance'];
const catMap = { 'Lab Reports': 'lab-report', 'Prescriptions': 'prescription', 'Discharge Summaries': 'discharge-summary', 'Imaging': 'imaging' };

export default function HistoryDocuments() {
  const [view, setView] = useState('grid');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const { addToast } = useToast();

  const filtered = mockDocuments.filter((d) => {
    if (activeCategory === 'All') return true;
    return d.category === catMap[activeCategory];
  });

  const storagePct = (storageUsedMB / storageTotalMB) * 100;

  return (
    <div className="space-y-4">
      {/* Storage indicator */}
      <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
        <HardDrive className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-600 dark:text-gray-400 font-medium">Storage Used</span>
            <span className="text-gray-900 dark:text-white font-semibold">{storageUsedMB} MB / {storageTotalMB} MB</span>
          </div>
          <div className="h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${storagePct}%` }} />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCategory(c)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeCategory === c ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setView('grid')} className={`p-2 rounded-lg transition-colors ${view === 'grid' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}>
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button onClick={() => setView('list')} className={`p-2 rounded-lg transition-colors ${view === 'list' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'text-gray-400 hover:text-gray-600'}`}>
            <List className="w-4 h-4" />
          </button>
          <Button size="sm" onClick={() => setShowUpload(true)}>
            <Upload className="w-4 h-4" /> Upload
          </Button>
        </div>
      </div>

      {/* Documents */}
      {view === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} onClick={setSelectedDoc} view="grid" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} onClick={setSelectedDoc} view="list" />
          ))}
        </div>
      )}

      {/* Document Detail Modal */}
      <Modal isOpen={!!selectedDoc} onClose={() => setSelectedDoc(null)} title={selectedDoc?.title} size="md">
        {selectedDoc && (
          <div className="space-y-4">
            <div className="h-40 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center text-5xl">
              {selectedDoc.type === 'Imaging' ? '🩻' : selectedDoc.type === 'Prescription' ? '📋' : '🔬'}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex gap-2"><span className="text-gray-500 dark:text-gray-400 w-28">File</span><span className="text-gray-900 dark:text-white font-medium">{selectedDoc.filename}</span></div>
              <div className="flex gap-2"><span className="text-gray-500 dark:text-gray-400 w-28">Type</span><span className="text-gray-900 dark:text-white">{selectedDoc.type}</span></div>
              <div className="flex gap-2"><span className="text-gray-500 dark:text-gray-400 w-28">Uploaded</span><span className="text-gray-900 dark:text-white">{selectedDoc.uploadDate}</span></div>
              <div className="flex gap-2"><span className="text-gray-500 dark:text-gray-400 w-28">Size</span><span className="text-gray-900 dark:text-white">{selectedDoc.size}</span></div>
            </div>
            {selectedDoc.aiSummary && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">AI Summary</p>
                <p className="text-sm text-blue-600 dark:text-blue-300">{selectedDoc.aiSummary}</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={() => { addToast('Re-analyzing...', 'info'); setSelectedDoc(null); }}>Re-analyze</Button>
              <Button variant="outline" onClick={() => { addToast('Downloading...', 'info'); }}>Download</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Upload Modal */}
      <Modal isOpen={showUpload} onClose={() => setShowUpload(false)} title="Upload Document" size="md">
        <div className="space-y-4">
          <div className="h-32 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 cursor-pointer hover:border-emerald-400 transition-colors">
            Click or drag a file here
          </div>
          <Button className="w-full" onClick={() => { addToast('Document uploaded!', 'success'); setShowUpload(false); }}>
            Upload Document
          </Button>
        </div>
      </Modal>
    </div>
  );
}
