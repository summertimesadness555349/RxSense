import React, { useEffect } from 'react';
import { AlertTriangle, CheckCircle, Info, ShieldAlert, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Badge from './Badge.jsx';

export default function InteractionCheckModal({ isOpen, onClose, report }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!report) return null;

  const { overallStatus, summary, findings } = report;

  const statusConfig = {
    safe: {
      label: 'Safe',
      icon: <CheckCircle className="w-5 h-5" />,
      className: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
      badge: 'emerald'
    },
    warning: {
      label: 'Warning',
      icon: <AlertTriangle className="w-5 h-5" />,
      className: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
      badge: 'amber'
    },
    danger: {
      label: 'Danger',
      icon: <ShieldAlert className="w-5 h-5" />,
      className: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
      badge: 'red'
    }
  };

  const currentStatus = statusConfig[overallStatus] || statusConfig.safe;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.96 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-800"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Medication Safety Check</h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
              {/* Overall Status Banner */}
              <div className={`flex items-center gap-3 p-4 rounded-2xl border ${currentStatus.className}`}>
                <div className="flex-shrink-0">
                  {currentStatus.icon}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold uppercase tracking-wider">{currentStatus.label} Profile</p>
                  <p className="text-sm opacity-90 mt-0.5 leading-relaxed">
                    {summary}
                  </p>
                </div>
              </div>

              {/* Detailed Findings */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Info className="w-4 h-4 text-gray-400" />
                  Detailed Analysis
                </h3>

                {findings && findings.length > 0 ? (
                  <div className="space-y-3">
                    {findings.map((finding, i) => (
                      <div key={i} className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
                            {finding.interaction}
                          </span>
                          <Badge variant={statusConfig[finding.severity]?.badge || 'gray'}>
                            {statusConfig[finding.severity]?.label || finding.severity}
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                            {finding.description}
                          </p>
                          {finding.recommendation && (
                            <div className="p-2.5 bg-white dark:bg-gray-900 rounded-lg border border-gray-200/60 dark:border-gray-700/60">
                              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 leading-relaxed">
                                <span className="font-bold mr-1">Recommendation:</span> {finding.recommendation}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 px-4 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                    <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      No critical interactions detected.
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Your current regimen appears safe based on your recorded history.
                    </p>
                  </div>
                )}
              </div>

              {/* Disclaimer */}
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    This is an AI-generated safety check. It is meant for informational purposes only and is <strong>not a substitute for professional medical advice</strong>. Always consult your doctor or pharmacist before making any changes to your medication.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
