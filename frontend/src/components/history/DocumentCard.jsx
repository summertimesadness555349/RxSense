import { FileText, Image, File, ExternalLink } from 'lucide-react';
import Badge from '../ui/Badge.jsx';

const typeColors = {
  'Lab Report': 'blue',
  'Prescription': 'emerald',
  'Discharge Summary': 'purple',
  'Imaging': 'amber',
  'Insurance': 'gray',
};

const TypeIcon = ({ type }) => {
  if (type === 'Prescription') return <FileText className="w-8 h-8 text-emerald-500" />;
  if (type === 'Imaging') return <Image className="w-8 h-8 text-amber-500" />;
  return <File className="w-8 h-8 text-blue-500" />;
};

export default function DocumentCard({ doc, onClick, view = 'grid' }) {
  if (view === 'list') {
    return (
      <div
        onClick={() => onClick?.(doc)}
        className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:border-emerald-400 dark:hover:border-emerald-700 cursor-pointer transition-colors"
      >
        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
          <TypeIcon type={doc.type} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{doc.title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{doc.filename}</p>
        </div>
        <div className="flex-shrink-0 text-right">
          <Badge variant={typeColors[doc.type] || 'gray'}>{doc.type}</Badge>
          <p className="text-xs text-gray-400 mt-1">{doc.uploadDate}</p>
        </div>
        <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </div>
    );
  }

  return (
    <div
      onClick={() => onClick?.(doc)}
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden hover:border-emerald-400 dark:hover:border-emerald-700 cursor-pointer transition-all hover:shadow-md group"
    >
      <div className="h-28 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center group-hover:from-emerald-50 group-hover:to-emerald-100 dark:group-hover:from-emerald-900/20 dark:group-hover:to-emerald-900/10 transition-all">
        <TypeIcon type={doc.type} />
      </div>
      <div className="p-3 space-y-2">
        <Badge variant={typeColors[doc.type] || 'gray'}>{doc.type}</Badge>
        <p className="text-sm font-medium text-gray-900 dark:text-white leading-snug line-clamp-2">{doc.title}</p>
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{doc.uploadDate}</span>
          <span>{doc.size}</span>
        </div>
      </div>
    </div>
  );
}
