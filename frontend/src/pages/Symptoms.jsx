import { useState, useRef, useEffect } from 'react';
import { Send, Mic } from 'lucide-react';
import { motion } from 'framer-motion';
import ChatBubble from '../components/symptoms/ChatBubble.jsx';
import DisclaimerBanner from '../components/ui/DisclaimerBanner.jsx';
import { mockConversation, quickSymptomChips } from '../data/mockConversations.js';
import { checkSymptoms } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';

export default function Symptoms() {
  const [messages, setMessages] = useState(mockConversation);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef();
  const { addToast } = useToast();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text) => {
    const txt = (text || input).trim();
    if (!txt || loading) return;
    setInput('');

    const userMsg = { id: `msg_${Date.now()}`, role: 'user', type: 'text', content: txt };
    setMessages((p) => [...p, userMsg]);
    setLoading(true);

    // TODO: Replace with actual API call
    const aiMsg = await checkSymptoms(txt);
    const newAiMsg = { ...aiMsg, id: `msg_${Date.now() + 1}` };
    setMessages((p) => [...p, newAiMsg]);
    setLoading(false);
    addToast('Symptom check saved to your timeline.', 'info');
  };

  return (
    // Fills the flex-col parent in MainLayout — takes all remaining window height
    <div className="flex flex-col flex-1 min-h-0 gap-3">

      {/* Fixed header area — title + disclaimer + chips */}
      <div className="flex-shrink-0 space-y-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">🩺 Symptom Checker</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Describe your symptoms and get an AI assessment.
          </p>
        </div>

        <DisclaimerBanner message="This is NOT a medical diagnosis. Always consult a qualified healthcare professional." />

        {/* Quick chips */}
        <div className="flex gap-2 flex-wrap">
          {quickSymptomChips.map((chip) => (
            <button
              key={chip}
              onClick={() => send(chip)}
              disabled={loading}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors disabled:opacity-50"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable chat messages — fills all remaining space */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
        {messages.map((msg) => (
          <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <ChatBubble message={msg} />
          </motion.div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-sm flex-shrink-0">
              ⚕️
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Fixed input bar — always anchored to bottom */}
      <div className="flex-shrink-0 flex gap-2 items-end pt-1 border-t border-gray-200 dark:border-gray-800">
        <div className="flex-1 relative">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Describe your symptoms (e.g., headache and fever for 2 days)..."
            disabled={loading}
            className="w-full rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            aria-label="Describe symptoms"
          />
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Voice input (coming soon)"
            onClick={() => addToast('Voice input coming soon!', 'info')}
          >
            <Mic className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          className="w-11 h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
