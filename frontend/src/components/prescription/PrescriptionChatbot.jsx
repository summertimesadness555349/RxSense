import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, MessageSquare } from 'lucide-react';
import { chatWithPrescription } from '../../services/api.js';
import { useLanguage } from '../../context/LanguageContext.jsx';

const SUGGESTIONS = (rx, lang) => {
  const meds = rx?.medications || [];
  return lang === 'bn'
    ? [
        meds[0] ? `${meds[0].name} কিসের জন্য ব্যবহার করা হয়?` : null,
        meds.length > 1 ? `আমার ওষুধগুলোর মধ্যে কি কোনো ইন্টারঅ্যাকশন আছে?` : null,
        `কোন পার্শ্বপ্রতিক্রিয়াগুলো লক্ষ্য রাখতে হবে?`,
        `এই ওষুধগুলো কীভাবে ও কখন খেতে হবে?`,
      ].filter(Boolean)
    : [
        meds[0] ? `What is ${meds[0].name} used for?` : null,
        meds.length > 1 ? `Are there interactions between my medications?` : null,
        `What side effects should I watch for?`,
        `How and when should I take these medicines?`,
      ].filter(Boolean);
};

export default function PrescriptionChatbot({ prescription }) {
  const { lang } = useLanguage();
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const bottomRef                 = useRef(null);
  const inputRef                  = useRef(null);

  // Reset chat when the active prescription changes
  const scanKey = prescription?.scan_id || prescription?.savedAt || null;
  useEffect(() => { setMessages([]); setInput(''); }, [scanKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;

    const userMsg = { role: 'user', content: q };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const data = await chatWithPrescription({
        messages: messages.slice(-8),
        prescription,
        question: q,
      });
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.reply, drugsUsed: data.drugs_context || [] },
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Sorry, something went wrong. ${err.message}` },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!prescription) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center p-8 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
        <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
          <MessageSquare className="w-7 h-7 text-gray-400 dark:text-gray-500" />
        </div>
        <p className="font-semibold text-gray-600 dark:text-gray-400">No prescription selected</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 max-w-[220px]">
          Scan a prescription or pick one from history to start chatting.
        </p>
      </div>
    );
  }

  const contextLabel = prescription.doctor?.name
    ? `Dr. ${prescription.doctor.name} — ${prescription.date || ''}`
    : `Prescription — ${prescription.date || ''}`;

  const suggestions = SUGGESTIONS(prescription, lang);

  // ── Chat UI ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-800 flex-shrink-0">
        <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200 leading-tight">
            Prescription Assistant
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 truncate">{contextLabel}</p>
        </div>
        <span className="text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
          AI
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">

        {/* Welcome + suggestions when empty */}
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-xs text-center text-gray-400 dark:text-gray-500 py-2">
              {lang === 'bn'
                ? 'প্রেসক্রিপশন সম্পর্কে যেকোনো প্রশ্ন করুন — সহজ বাংলায় উত্তর পাবেন।'
                : 'Ask anything about this prescription — you will get the answer in Bangla.'}
            </p>
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(s); inputRef.current?.focus(); }}
                  className="w-full text-left text-xs px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-emerald-400 dark:hover:border-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
            )}
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-emerald-500 text-white rounded-tr-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-sm'
            }`}>
              {msg.content}
              {msg.drugsUsed?.length > 0 && (
                <p className="text-xs mt-2 opacity-50 font-medium">
                  Sources: {msg.drugsUsed.join(', ')}
                </p>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5 text-white" />
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex gap-2 items-center">
            <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
              <Bot className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 items-center">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-3 flex-shrink-0 bg-white dark:bg-gray-900">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={lang === 'bn' ? 'আপনার ওষুধ সম্পর্কে প্রশ্ন করুন...' : 'Ask about your medications...'}
            className="flex-1 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none leading-snug"
            style={{ maxHeight: '96px', overflowY: 'auto' }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors flex-shrink-0"
          >
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-600 mt-1.5 text-center">
          Not a substitute for professional medical advice.
        </p>
      </div>
    </div>
  );
}
