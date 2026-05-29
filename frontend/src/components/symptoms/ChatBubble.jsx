import { Ambulance } from 'lucide-react';
import { relativeTime } from '../../utils/timeUtils.js';

export default function ChatBubble({ message, onEmergencyOpen }) {
  const time = relativeTime(message.timestamp);

  // ── User bubble ─────────────────────────────────────────────────────────────
  if (message.role === 'user') {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <div className="max-w-[78%] bg-emerald-500 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed">
          {message.content}
        </div>
        {time && <span className="text-xs text-gray-400 dark:text-gray-500 pr-1">{time}</span>}
      </div>
    );
  }

  // ── AI bubble ───────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-2 items-end">
      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0 text-sm">
        ⚕️
      </div>
      <div className="flex flex-col gap-0.5 max-w-[78%]">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap space-y-3">
          <p>{message.content}</p>

          {/* Emergency card — only shown when agent detects an emergency */}
          {message.emergency && onEmergencyOpen && (
            <div className="border-t border-red-200 dark:border-red-800 pt-3">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-red-700 dark:text-red-400 uppercase">
                  🚨 জরুরি অবস্থা — এখনই সাহায্য নিন
                </p>
                <p className="text-xs text-red-600 dark:text-red-400">
                  কাছের হাসপাতাল, {message.emergency.specialist && `${message.emergency.specialist} বিশেষজ্ঞ`} এবং অ্যাম্বুলেন্স নম্বর খুঁজুন।
                </p>
                <button
                  onClick={() => onEmergencyOpen(message.emergency)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors"
                >
                  <Ambulance className="w-4 h-4" />
                  অ্যাম্বুলেন্স ও ডাক্তার খুঁজুন
                </button>
              </div>
            </div>
          )}
        </div>
        {time && <span className="text-xs text-gray-400 dark:text-gray-500 pl-1">{time}</span>}
      </div>
    </div>
  );
}
