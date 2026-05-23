import { useState, useRef } from 'react';
import { Upload, Camera, File } from 'lucide-react';

export default function FileDropzone({ onFileSelect, accept = 'image/*', label, hint, showCamera = false }) {
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const inputRef = useRef();
  const cameraRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
    setSelectedFile(file);
    onFileSelect?.(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed cursor-pointer
          transition-all duration-200 min-h-[180px] text-center
          ${dragging
            ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10'
            : 'border-gray-300 dark:border-gray-700 hover:border-emerald-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'}
        `}
        role="button"
        tabIndex={0}
        aria-label={label || 'Upload file'}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />
        {selectedFile ? (
          <div className="flex flex-col items-center gap-2">
            <File className="w-10 h-10 text-emerald-500" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedFile.name}</p>
            <p className="text-xs text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">✓ File selected — click to change</span>
          </div>
        ) : (
          <>
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-3">
              <Upload className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {label || 'Drag & drop your file here, or click to browse'}
            </p>
            {hint && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{hint}</p>}
          </>
        )}
      </div>

      {showCamera && (
        <>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-emerald-400 hover:text-emerald-600 transition-colors"
          >
            <Camera className="w-4 h-4" />
            Take Photo
          </button>
        </>
      )}
    </div>
  );
}
