import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, MessageSquare, Trash2, History } from 'lucide-react';
import { chatWithReport } from '../../services/api.js';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { relativeTime } from '../../utils/timeUtils.js';

const REPORT_CHATS_KEY = 'rxsense_report_chats';

function loadReportChats() {
  try { return JSON.parse(localStorage.getItem(REPORT_CHATS_KEY) || '{}'); }
  catch { return {}; }
}

function saveReportChat(key, msgs, label = 'Report') {
  try {
    const all = loadReportChats();
    if (msgs.length === 0) {
      delete all[key];
    } else {
      const prev = all[key];
      all[key] = {
        messages: msgs,
        label,
        savedAt: prev?.savedAt || new Date().toISOString(),
      };
    }
    localStorage.setItem(REPORT_CHATS_KEY, JSON.stringify(all));
  } catch {}
}

const SUGGESTIONS = (report, lang) => {
  if (!report) return [];
  const abnormals = (report.sections || [])
    .flatMap(s => s.entries || [])
    .filter(e => e.status && e.status !== 'normal' || e.flag)
    .slice(0, 2)
    .map(e => lang === 'bn'
      ? `${e.label} ${e.value}${e.unit ? ' ' + e.unit : ''} মানে কী?`
      : `What does ${e.label} ${e.value}${e.unit ? ' ' + e.unit : ''} mean?`
    );

  return lang === 'bn'
    ? [...abnormals, 'আমার রিপোর্টে কি কোনো সমস্যা আছে?', 'এরপর আমার কী করা উচিত?'].filter(Boolean).slice(0, 4)
    : [...abnormals, 'Are there any problems in my report?', 'What should I do next?'].filter(Boolean).slice(0, 4);
};

export default function ReportChatbot({ report }) {
  const { lang } = useLanguage();
  const [messages,  setMessages]  = useState([]);
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [allChats,  setAllChats]  = useState({});
  const bottomRef                 = useRef(null);
  const inputRef                  = useRef(null);

  const reportKey  = report?.id || report?.savedAt || null;
  const skipSaveRef = useRef(false);

  // Restore saved chat when the active report changes
  useEffect(() => {
    skipSaveRef.current = true;
    if (!reportKey) { setMessages([]); return; }
    const all = loadReportChats();
    const entry = all[reportKey];
    setMessages(Array.isArray(entry) ? entry : (entry?.messages || []));
    setInput('');
  }, [reportKey]);

  // Auto-save after every message change (skip the initial restore)
  useEffect(() => {
    if (skipSaveRef.current) { skipSaveRef.current = false; return; }
    if (!reportKey) return;
    const label = report?.type?.replace(/\s*\(.*?\)\s*/g, '').trim() || report?.facility || 'Report';
    saveReportChat(reportKey, messages, label);
    setAllChats(loadReportChats());
  }, [messages, reportKey]);

  // Refresh history list when switching to history tab
  useEffect(() => {
    if (activeTab === 'history') setAllChats(loadReportChats());
  }, [activeTab]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const clearChat = () => setMessages([]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;

    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setInput('');
    setLoading(true);

    try {
      const data = await chatWithReport({
        messages: messages.slice(-8),
        report,
        question: q,
      });
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, something went wrong. ${err.message}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  if (!report) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center p-8 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
        <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
          <MessageSquare className="w-7 h-7 text-gray-400 dark:text-gray-500" />
        </div>
        <p className="font-semibold text-gray-600 dark:text-gray-400">No report selected</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 max-w-[220px]">
          Upload a report or pick one from history to start chatting.
        </p>
      </div>
    );
  }

  const contextLabel = report.facility
    ? `${report.type || 'Report'} — ${report.facility}`
    : `${report.type || 'Medical Report'} — ${report.date || ''}`;

  const suggestions = SUGGESTIONS(report, lang);
  const historyEntries = Object.entries(allChats);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">

      {/* Colored header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 flex-shrink-0">
        <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 leading-tight">Report Assistant</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 truncate">{contextLabel}</p>
        </div>
        <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium flex-shrink-0">AI</span>
        {activeTab === 'chat' && messages.length > 0 && (
          <button onClick={clearChat} title="Clear chat"
            className="p-1.5 rounded-lg text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors flex-shrink-0">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        {['chat', 'history'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 ${
              activeTab === tab
                ? 'text-blue-600 dark:text-blue-400 border-blue-500'
                : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab === 'history' && <History className="w-3.5 h-3.5" />}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'history' && historyEntries.length > 0 && (
              <span className="ml-0.5 text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-semibold">
                {historyEntries.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'chat' ? (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-xs text-center text-gray-400 dark:text-gray-500 py-2">
                  {lang === 'bn'
                    ? 'রিপোর্ট সম্পর্কে যেকোনো প্রশ্ন করুন — সহজ বাংলায় উত্তর পাবেন।'
                    : 'Ask anything about this report — you will get the answer in Bangla.'}
                </p>
                <div className="space-y-2">
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => { setInput(s); inputRef.current?.focus(); }}
                      className="w-full text-left text-xs px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-600 hover:text-blue-700 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white rounded-tr-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-sm'
                }`}>
                  {msg.content}
                </div>
                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2 items-center">
                <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
                placeholder={lang === 'bn' ? 'রিপোর্ট সম্পর্কে প্রশ্ন করুন...' : 'Ask about your report...'}
                className="flex-1 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-snug"
                style={{ maxHeight: '96px', overflowY: 'auto' }}
              />
              <button onClick={send} disabled={!input.trim() || loading}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors flex-shrink-0">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-1.5 text-center">
              Not a substitute for professional medical advice.
            </p>
          </div>
        </>
      ) : (
        /* History tab */
        <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
          {historyEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-10">
              <History className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No chat history yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Your conversations will appear here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {historyEntries.map(([key, entry]) => {
                const msgs    = Array.isArray(entry) ? entry : (entry?.messages || []);
                const label   = entry?.label || 'Report';
                const savedAt = entry?.savedAt;
                const preview = msgs.find(m => m.role === 'user')?.content?.slice(0, 70) || '—';
                const count   = msgs.filter(m => m.role === 'user').length;
                const isCurrent = key === reportKey;
                return (
                  <div key={key} className={`p-3 rounded-xl border transition-colors ${
                    isCurrent
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/10'
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
                  }`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-tight">{label}</p>
                      {isCurrent && (
                        <span className="text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">Active</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">"{preview}"</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">
                      {count} question{count !== 1 ? 's' : ''}
                      {savedAt ? ` · ${relativeTime(savedAt)}` : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
