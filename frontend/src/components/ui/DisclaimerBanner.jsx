import { ShieldAlert } from 'lucide-react';

export default function DisclaimerBanner({ message }) {
  return (
    <div className="flex items-start gap-2.5 px-4 py-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-800 dark:text-amber-400">
      <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <p>
        {message ||
          'This is NOT a medical diagnosis. RxSense does not replace professional medical advice. Always consult a qualified healthcare professional.'}
      </p>
    </div>
  );
}
