import { useState, useRef, useEffect } from 'react';
import { Send, Mic, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ChatBubble from '../components/symptoms/ChatBubble.jsx';
import NearMePanel from '../components/nearby/NearMePanel.jsx';
import DisclaimerBanner from '../components/ui/DisclaimerBanner.jsx';
import { quickSymptomChips } from '../data/mockConversations.js';
import { checkSymptoms } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { dayLabel, needsDaySeparator } from '../utils/timeUtils.js';

const WELCOME = {
  id:        'msg_welcome',
  role:      'ai',
  content:   'আসসালামু আলাইকুম! আমি RxSense AI। আপনার শারীরিক সমস্যার কথা বলুন — আমি সাহায্য করার চেষ্টা করব। মনে রাখবেন, এটি একজন বিশেষজ্ঞ চিকিৎসকের বিকল্প নয়।',
  timestamp: new Date().toISOString(),
};

const THINKING_PHRASES = ['ভাবছি...', 'তথ্য দেখছি...', 'উত্তর তৈরি করছি...'];

function ThinkingBubble() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % THINKING_PHRASES.length), 1600);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex gap-2 items-end">
      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0 text-sm">⚕️</div>
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <AnimatePresence mode="wait">
          <motion.span key={idx} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }} className="text-sm text-gray-500 dark:text-gray-400">
            {THINKING_PHRASES[idx]}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function Symptoms() {
  const [messages,  setMessages]  = useState([WELCOME]);
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [splitView, setSplitView] = useState(false);
  const [emergency, setEmergency] = useState(null);  // { specialist, condition }
  const bottomRef                 = useRef();
  const { addToast }              = useToast();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text) => {
    const txt = (text || input).trim();
    if (!txt || loading) return;
    setInput('');

    const userMsg = { id: `msg_u_${Date.now()}`, role: 'user', content: txt, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = messages
        .filter(m => m.id !== 'msg_welcome')
        .map(m => ({ role: m.role, content: m.content }));

      const { reply, emergency: em } = await checkSymptoms(txt, history);

      setMessages(prev => [...prev, {
        id:        `msg_a_${Date.now()}`,
        role:      'ai',
        content:   reply,
        emergency: em || null,
        timestamp: new Date().toISOString(),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id:        `msg_e_${Date.now()}`,
        role:      'ai',
        content:   'দুঃখিত, কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।',
        timestamp: new Date().toISOString(),
      }]);
      addToast('সংযোগে সমস্যা হয়েছে', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openEmergencyPanel = (emergencyData) => {
    setEmergency(emergencyData);
    setSplitView(true);
  };

  const closeSplitView = () => {
    setSplitView(false);
    setEmergency(null);
  };

  // ── Chat column (shared between normal and split layouts) ──────────────────
  const chatColumn = (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      {/* Header */}
      <div className="flex-shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">🩺 Symptom Checker</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Harrison's Principles-এর উপর ভিত্তি করে AI বিশ্লেষণ।
            </p>
          </div>
          {splitView && (
            <button onClick={closeSplitView} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <DisclaimerBanner message="এটি চিকিৎসা পরামর্শ নয়। সর্বদা একজন যোগ্য চিকিৎসকের সাথে পরামর্শ করুন।" />
        {!splitView && (
          <div className="flex gap-2 flex-wrap">
            {quickSymptomChips.map(chip => (
              <button key={chip} onClick={() => send(chip)} disabled={loading}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors disabled:opacity-50">
                {chip}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chat card — messages + input wrapped together */}
      <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">

        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <div key={msg.id}>
              {needsDaySeparator(msg.timestamp, messages[i - 1]?.timestamp) && (
                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">{dayLabel(msg.timestamp)}</span>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                </div>
              )}
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                <ChatBubble message={msg} onEmergencyOpen={openEmergencyPanel} />
              </motion.div>
            </div>
          ))}
          {loading && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <ThinkingBubble />
            </motion.div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="flex-shrink-0 flex gap-2 items-end p-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
          <div className="flex-1 relative">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="আপনার উপসর্গ বলুন..."
              disabled={loading}
              className="w-full rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            />
            <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" onClick={() => addToast('Voice input coming soon!', 'info')}>
              <Mic className="w-4 h-4" />
            </button>
          </div>
          <button onClick={() => send()} disabled={loading || !input.trim()}
            className="w-11 h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0">
            <Send className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );

  // ── Layout: split or normal ────────────────────────────────────────────────
  return splitView ? (
    // Split: full width, chat left + panel right
    <div className="flex flex-1 min-h-0 gap-4">
      <div className="flex flex-col min-h-0 w-[38%] flex-shrink-0">
        {chatColumn}
      </div>
      <div className="flex-1 min-h-0 min-w-0">
        <NearMePanel
          specialist={emergency?.specialist}
          condition={emergency?.condition}
          onClose={closeSplitView}
        />
      </div>
    </div>
  ) : (
    // Normal: 80% width centered
    <div className="w-4/5 mx-auto flex flex-col flex-1 min-h-0">
      {chatColumn}
    </div>
  );
}
