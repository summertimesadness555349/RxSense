import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, FileText, FlaskConical, History, Stethoscope, Pill, Upload, Brain, Database, Share2, Shield } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';
import { Sun, Moon } from 'lucide-react';

const stats = [
  { n: '170M+', l: 'People We Can Help' },
  { n: '0.58', l: 'Doctors per 1,000 People' },
  { n: '~60%', l: "Can't Read Prescriptions" },
  { n: '#1', l: 'Cause: Miscommunication' },
];

const features = [
  { icon: FileText, label: 'Prescription Reader', desc: 'Understand handwritten prescriptions in plain language', to: '/prescription', color: 'emerald' },
  { icon: FlaskConical, label: 'Report Analyzer', desc: 'Know what your blood test results mean', to: '/report', color: 'blue' },
  { icon: History, label: 'Health Record', desc: 'Your lifelong smart medical history — all connected', to: '/history', color: 'purple', highlight: true },
  { icon: Stethoscope, label: 'Symptom Checker', desc: 'AI-powered symptom assessment with urgency triage', to: '/symptoms', color: 'amber' },
  { icon: Pill, label: 'Drug Interactions', desc: 'Check if your medications are safe together', to: '/drugs', color: 'red' },
];

const steps = [
  { icon: Upload, n: '01', title: 'Upload', desc: 'Snap a photo of your prescription or upload your lab report' },
  { icon: Brain, n: '02', title: 'AI Analyzes', desc: 'Our AI reads, interprets and risk-assesses your documents in seconds' },
  { icon: FileText, n: '03', title: 'Plain Language', desc: 'Get clear explanations in Bangla or English — no medical jargon' },
  { icon: Database, n: '04', title: 'Auto-Saved', desc: 'Every result feeds your smart health record. AI connects dots over time.' },
];

const whyCards = [
  { icon: '📋', title: 'Understand Your Documents', desc: "Can't read your prescription? Don't know what HbA1c means? RxSense explains everything in simple language, in your language." },
  { icon: '📈', title: 'Build Your Health Story', desc: 'Every scan feeds your lifelong health record. AI spots patterns, flags rising risks, and tracks your progress over time.' },
  { icon: Share2, title: 'Share with Confidence', desc: 'Generate doctor summaries, shareable emergency cards, and family risk profiles — all in one tap.' },
];

const colorMap = {
  emerald: 'from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-900/10 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400',
  blue: 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400',
  purple: 'from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/10 border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400',
  amber: 'from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-900/10 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400',
  red: 'from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/10 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400',
};

export default function Landing() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0f1a] text-gray-900 dark:text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#0a0f1a]/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚕️</span>
            <span className="font-bold text-xl">RxSense</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Link to="/login" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-emerald-600 px-3 py-2">
              Login
            </Link>
            <Link
              to="/register"
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-blue-500/5 to-transparent animate-gradient-x" />
        <div className="max-w-5xl mx-auto px-4 py-20 sm:py-28 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <span className="inline-block bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold px-3 py-1 rounded-full mb-4">
              🏆 Infinity AI Buildfest 2026 — HealthTech Track
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-5 tracking-tight">
              RxSense —{' '}
              <span className="text-emerald-500">Your Medical Documents,</span>
              <br className="hidden sm:block" />
              Finally Understood.
              <br />
              <span className="text-blue-500">Your Health History,</span>
              <br className="hidden sm:block" />
              Finally Connected.
            </h1>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8 leading-relaxed">
              Upload prescriptions and blood reports. Get clear explanations in Bangla and English. Every result builds your smart health record — so you and your doctor always see the full picture.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-7 py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/40"
              >
                Start For Free <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-emerald-400 font-medium px-7 py-3.5 rounded-xl text-sm transition-all"
              >
                Log In
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40">
        <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {stats.map((s) => (
            <div key={s.l}>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-500">{s.n}</div>
              <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">Everything You Need in One Place</h2>
          <p className="text-gray-500 dark:text-gray-400">Five powerful tools that work together to protect your health</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(({ icon: Icon, label, desc, to, color, highlight }) => (
            <Link
              key={to}
              to={to}
              onClick={(e) => { if (to !== '/') { window.location.href = '/login'; e.preventDefault(); }}}
              className={`group bg-gradient-to-br ${colorMap[color]} border rounded-2xl p-5 transition-all hover:scale-[1.02] hover:shadow-lg ${highlight ? 'lg:col-span-1 ring-2 ring-emerald-400 ring-offset-2 dark:ring-offset-gray-900' : ''}`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-gray-900 flex items-center justify-center shadow-sm">
                  <Icon className={`w-5 h-5 ${colorMap[color].split(' ').pop()}`} />
                </div>
                {highlight && (
                  <span className="text-xs font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full">CORE FEATURE</span>
                )}
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{label}</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{desc}</p>
              <div className="mt-3 flex items-center gap-1 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                Try it <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 dark:bg-gray-900/40 py-16">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">How It Works</h2>
            <p className="text-gray-500 dark:text-gray-400">From confused patient to fully informed — in seconds</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map(({ icon: Icon, n, title, desc }) => (
              <div key={n} className="relative text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30">
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold flex items-center justify-center">
                  {n}
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why RxSense */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">Why RxSense?</h2>
          <p className="text-gray-500 dark:text-gray-400">More than an analyzer — a lifelong health companion</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {whyCards.map(({ icon, title, desc }) => (
            <div key={title} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 hover:border-emerald-400 dark:hover:border-emerald-700 transition-all hover:shadow-md">
              <div className="text-4xl mb-4">{typeof icon === 'string' ? icon : <icon.render />}</div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-r from-emerald-600 to-emerald-700">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Start Your Health Journey Today</h2>
          <p className="text-emerald-100 mb-6">Free to use. No medical knowledge needed. Works in Bangla and English.</p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-white text-emerald-700 font-semibold px-8 py-3.5 rounded-xl text-sm hover:bg-emerald-50 transition-all shadow-lg"
          >
            Create Free Account <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 dark:bg-gray-950 text-gray-400 py-8">
        <div className="max-w-5xl mx-auto px-4 text-center space-y-3">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-xl">⚕️</span>
            <span className="font-bold text-white">RxSense</span>
          </div>
          <div className="flex items-center justify-center gap-1.5 text-xs text-amber-400 bg-amber-900/20 border border-amber-800 rounded-xl px-4 py-2 max-w-2xl mx-auto">
            <Shield className="w-4 h-4 flex-shrink-0" />
            <span>RxSense does not replace professional medical advice. Always consult a qualified doctor before making any medical decisions.</span>
          </div>
          <p className="text-xs mt-4">© 2026 RxSense • Built for Infinity AI Buildfest 2026 • Bangladesh</p>
        </div>
      </footer>
    </div>
  );
}
