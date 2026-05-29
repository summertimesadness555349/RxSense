import { useState, useRef, useEffect } from 'react';
import { Send, Mic, X, History, Plus, Stethoscope } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ChatBubble from '../components/symptoms/ChatBubble.jsx';
import NearMePanel from '../components/nearby/NearMePanel.jsx';
import DisclaimerBanner from '../components/ui/DisclaimerBanner.jsx';
import { quickSymptomChips } from '../data/mockConversations.js';
import { checkSymptoms } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { dayLabel, needsDaySeparator, relativeTime } from '../utils/timeUtils.js';

const SESSIONS_KEY = 'rxsense_symptom_sessions';
const MAX_SESSIONS = 20;

function loadSessions() {
  try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]'); }
  catch { return []; }
}

function saveSession(id, msgs) {
  try {
    const realMsgs = msgs.filter(m => m.id !== 'msg_welcome');
    if (realMsgs.length === 0) return;
    const all = loadSessions();
    const idx = all.findIndex(s => s.id === id);
    const preview = realMsgs.find(m => m.role === 'user')?.content?.slice(0, 80) || 'Chat session';
    const entry = { id, startedAt: realMsgs[0]?.timestamp || new Date().toISOString(), preview, messages: msgs };
    if (idx >= 0) all[idx] = entry;
    else all.push(entry);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(all.slice(-MAX_SESSIONS)));
  } catch {}
}

// ThinkingBubble is self-contained and reads its own language context
function ThinkingBubble() {
  const { t } = useLanguage();
  const phrases = [t('thinkingPhrase1'), t('thinkingPhrase2'), t('thinkingPhrase3')];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setIdx(i => (i + 1) % phrases.length), 1600);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="flex gap-2 items-end">
      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
        <Stethoscope className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <AnimatePresence mode="wait">
          <motion.span key={idx} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }} className="text-sm text-gray-500 dark:text-gray-400">
            {phrases[idx]}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function Symptoms() {
  const { t } = useLanguage();
  const { addToast } = useToast();

  // Welcome message computed using current language
  const makeWelcome = () => ({
    id:        'msg_welcome',
    role:      'ai',
    content:   t('symptomWelcome'),
    timestamp: new Date().toISOString(),
  });

  const [messages,  setMessages]  = useState([makeWelcome()]);
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [splitView, setSplitView] = useState(false);
  const [emergency, setEmergency] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [sessions,  setSessions]  = useState(() => loadSessions());
  const bottomRef                 = useRef();
  const sessionIdRef              = useRef(`sess_${Date.now()}`);

  // Restore the most recent session on first mount
  useEffect(() => {
    const saved = loadSessions();
    if (saved.length > 0) {
      const latest = saved[saved.length - 1];
      sessionIdRef.current = latest.id;
      setMessages(latest.messages);
      setSessions(saved);
    }
  }, []);

  // Auto-save after every message change
  useEffect(() => {
    saveSession(sessionIdRef.current, messages);
    setSessions(loadSessions());
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const startNewChat = () => {
    sessionIdRef.current = `sess_${Date.now()}`;
    setMessages([makeWelcome()]);
    setInput('');
    setActiveTab('chat');
    setSplitView(false);
    setEmergency(null);
  };

  const loadSession = (session) => {
    sessionIdRef.current = session.id;
    setMessages(session.messages);
    setActiveTab('chat');
  };

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
        content:   t('symptomError'),
        timestamp: new Date().toISOString(),
      }]);
      addToast(t('connectionError'), 'error');
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

  // ── Chat column ───────────────────────────────────────────────────────────────
  const chatColumn = (
    <div className="flex flex-col flex-1 min-h-0 gap-3">

      {/* Header */}
      <div className="flex-shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                {t('symptomCheckerTitle')}
              </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {t('symptomCheckerSubtitle')}
            </p>
          </div>
          {splitView && (
            <button onClick={closeSplitView} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <DisclaimerBanner message={t('symptomDisclaimer')} />
        {!splitView && activeTab === 'chat' && (
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

      {/* Chat card */}
      <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">

        {/* Tab bar */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'chat'
                ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500'
                : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t('chatTabLabel')}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'history'
                ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500'
                : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            {t('historyTabLabel')}
            {sessions.length > 0 && (
              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-semibold">
                {sessions.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'chat' ? (
          <>
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
                  placeholder={t('symptomInputPlaceholder')}
                  disabled={loading}
                  className="w-full rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                />
                <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" onClick={() => addToast(t('voiceComingSoon'), 'info')}>
                  <Mic className="w-4 h-4" />
                </button>
              </div>
              <button onClick={() => send()} disabled={loading || !input.trim()}
                className="w-11 h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          /* History tab */
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
            {/* New chat button */}
            <button
              onClick={startNewChat}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-emerald-400 dark:border-emerald-600 text-emerald-600 dark:text-emerald-400 text-sm font-medium hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('startNewChatBtn')}
            </button>

            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <History className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('noPastSessions')}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('noPastSessionsHelp')}</p>
              </div>
            ) : (
              [...sessions].reverse().map(s => {
                const isCurrent = s.id === sessionIdRef.current;
                const msgCount  = s.messages.filter(m => m.role === 'user').length;
                return (
                  <button
                    key={s.id}
                    onClick={() => loadSession(s)}
                    className={`w-full text-left p-3 rounded-xl border transition-colors ${
                      isCurrent
                        ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10'
                        : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-2 leading-snug">{s.preview}</p>
                      {isCurrent && (
                        <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">
                          {t('activeSessionBadge')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                      {msgCount} {t('questionsLabel')} · {relativeTime(s.startedAt)}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ── Layout: split or normal ────────────────────────────────────────────────
  return splitView ? (
    <div className="flex flex-1 min-h-0 gap-4">
      <div className="flex flex-col min-h-0 w-[38%] flex-shrink-0">
        {chatColumn}
      </div>
      <div className="flex-1 min-h-0 min-w-0 h-full overflow-hidden">
        <NearMePanel
          specialist={emergency?.specialist}
          condition={emergency?.condition}
          onClose={closeSplitView}
        />
      </div>
    </div>
  ) : (
    <div className="w-4/5 mx-auto flex flex-col flex-1 min-h-0">
      {chatColumn}
    </div>
  );
}
