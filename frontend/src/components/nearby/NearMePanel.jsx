import { useState, useEffect, useCallback } from 'react';
import { MapPin, Phone, Navigation, Search, Loader2, Star, X, ExternalLink, Sparkles, ChevronDown, ArrowLeft } from 'lucide-react';
import { searchNearby, geocodeAddress, inferSpecialty } from '../../services/api.js';
import { AMBULANCE_NUMBERS } from '../../data/ambulanceNumbers.js';

const EMBED_KEY = import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY || '';

const TABS = [
  { id: 'hospitals',   label: '🏥 হাসপাতাল' },
  { id: 'chambers',    label: '👨‍⚕️ চেম্বার' },
  { id: 'ambulances',  label: '🚑 অ্যাম্বুলেন্স' },
];

// ── Map iframe URL ──────────────────────────────────────────────────────────
function mapUrl(location, tab, keyword, dirTarget) {
  if (!EMBED_KEY || !location) return '';
  if (dirTarget) {
    return `https://www.google.com/maps/embed/v1/directions?origin=${location.lat},${location.lng}&destination=${dirTarget.lat},${dirTarget.lng}&mode=driving&key=${EMBED_KEY}`;
  }
  if (tab === 'ambulances') {
    return `https://www.google.com/maps/embed/v1/view?center=${location.lat},${location.lng}&zoom=13&key=${EMBED_KEY}`;
  }
  const q = tab === 'chambers' && keyword ? keyword : 'hospital';
  return `https://www.google.com/maps/embed/v1/search?q=${encodeURIComponent(q + ' near ' + location.lat + ',' + location.lng)}&key=${EMBED_KEY}`;
}

function googleMapsUrl(location, dirTarget) {
  if (dirTarget) return `https://www.google.com/maps/dir/?api=1&origin=${location.lat},${location.lng}&destination=${dirTarget.lat},${dirTarget.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function sortPlaces(places) {
  return [...places].sort((a, b) => {
    if (a.isOpen === true && b.isOpen !== true) return -1;
    if (a.isOpen !== true && b.isOpen === true) return 1;
    return (a.distanceKm ?? 999) - (b.distanceKm ?? 999);
  });
}

// ── Place card ────────────────────────────────────────────────────────────────
function PlaceCard({ place, userLocation, onDirection, isActive }) {
  return (
    <div className={`rounded-xl p-3 space-y-2 border transition-colors ${
      isActive
        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
        : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">{place.name}</p>
        {place.isOpen !== null && (
          <span className={`text-xs font-medium flex-shrink-0 ${place.isOpen ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
            {place.isOpen ? '● খোলা' : '● বন্ধ'}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
        {place.rating && (
          <span className="flex items-center gap-0.5 text-amber-500 font-medium">
            <Star className="w-3 h-3 fill-amber-400 stroke-amber-400" />{place.rating.toFixed(1)}
          </span>
        )}
        {place.distanceKm != null && (
          <span className="flex items-center gap-1">
            <Navigation className="w-3 h-3" />{place.distanceKm} কিমি
          </span>
        )}
      </div>

      {place.address && (
        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-start gap-1">
          <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" />{place.address}
        </p>
      )}

      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
        <Phone className="w-3 h-3" />
        {place.phone ? place.phone : <span className="text-gray-400">নম্বর নেই</span>}
      </p>

      <div className="flex gap-1.5 flex-wrap pt-0.5">
        {place.phone && (
          <a href={`tel:${place.phone}`}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors">
            <Phone className="w-3 h-3" /> কল
          </a>
        )}
        <button onClick={() => onDirection(place)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            isActive
              ? 'bg-blue-600 text-white'
              : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50'
          }`}>
          <Navigation className="w-3 h-3" /> দিকনির্দেশনা
        </button>
        <a href={place.mapsUrl} target="_blank" rel="noreferrer"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
          <ExternalLink className="w-3 h-3" /> Google Maps
        </a>
      </div>
    </div>
  );
}

// ── Ambulance card ────────────────────────────────────────────────────────────
function AmbulanceCard({ item }) {
  return (
    <div className="rounded-xl p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.icon} {item.name}</p>
        <p className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1 mt-0.5">
          <Phone className="w-3 h-3" />{item.number}
        </p>
      </div>
      <a href={`tel:${item.number}`}
        className="flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-semibold hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">
        <Phone className="w-3.5 h-3.5" /> কল
      </a>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function NearMePanel({ specialist: initSpecialist = null, condition: initCondition = null, onClose = null }) {
  const [location,   setLocation]   = useState(null);
  const [locText,    setLocText]    = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError,   setGpsError]   = useState(false);

  const [condition,  setCondition]  = useState(initCondition || '');
  const [specialty,  setSpecialty]  = useState(initSpecialist || null);
  const [keyword,    setKeyword]    = useState(initSpecialist || '');
  const [inferring,  setInferring]  = useState(false);

  const [activeTab,  setActiveTab]  = useState('hospitals');
  const [results,    setResults]    = useState({ hospitals: [], chambers: [] });
  const [searching,  setSearching]  = useState(false);
  const [searchErr,  setSearchErr]  = useState('');

  const [dirTarget,  setDirTarget]  = useState(null); // { lat, lng, name }

  // Auto-request GPS on mount
  useEffect(() => { requestGps(); }, []);

  // Fetch when location changes
  useEffect(() => { if (location) fetchAll(location, keyword); }, [location]);

  // Re-fetch chambers when keyword changes (after AI inference)
  useEffect(() => { if (location && keyword) fetchChambers(location, keyword); }, [keyword]);

  const requestGps = () => {
    if (!navigator.geolocation) { setGpsError(true); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setGpsLoading(false); setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'বর্তমান অবস্থান' }); },
      ()  => { setGpsLoading(false); setGpsError(true); },
      { timeout: 10000 }
    );
  };

  const handleLocText = async () => {
    if (!locText.trim()) return;
    setGpsLoading(true);
    try {
      const geo = await geocodeAddress(locText.trim());
      if (geo.success) { setLocation({ lat: geo.lat, lng: geo.lng, label: geo.label }); setGpsError(false); }
      else setSearchErr('এই ঠিকানা খুঁজে পাওয়া যায়নি।');
    } catch { setSearchErr('ঠিকানা অনুসন্ধানে সমস্যা হয়েছে।'); }
    finally { setGpsLoading(false); }
  };

  const handleInfer = async () => {
    if (!condition.trim()) return;
    setInferring(true);
    try {
      const res = await inferSpecialty(condition);
      if (res.specialty) {
        setSpecialty(res.specialty);
        setKeyword(res.keyword);
        setActiveTab('chambers');
      }
    } catch { /* silent */ }
    finally { setInferring(false); }
  };

  const fetchAll = useCallback(async (loc, kw) => {
    setSearching(true); setSearchErr('');
    try {
      const [hosp, cham] = await Promise.all([
        searchNearby(loc.lat, loc.lng, { type: 'hospital', keyword: '', radius: 5000 }),
        kw ? searchNearby(loc.lat, loc.lng, { type: 'doctor', keyword: kw, radius: 5000 }) : Promise.resolve([]),
      ]);
      setResults({ hospitals: sortPlaces(hosp), chambers: sortPlaces(cham) });
    } catch { setSearchErr('অনুসন্ধানে সমস্যা হয়েছে।'); }
    finally { setSearching(false); }
  }, []);

  const fetchChambers = async (loc, kw) => {
    try {
      const cham = await searchNearby(loc.lat, loc.lng, { type: 'doctor', keyword: kw, radius: 5000 });
      setResults(prev => ({ ...prev, chambers: sortPlaces(cham) }));
    } catch { /* silent */ }
  };

  const handleDirection = (place) => {
    setDirTarget(prev => prev?.id === place.id ? null : { id: place.id, lat: place.lat, lng: place.lng, name: place.name });
  };

  const currentResults = activeTab === 'hospitals' ? results.hospitals
    : activeTab === 'chambers'   ? results.chambers
    : AMBULANCE_NUMBERS;

  const embedSrc = mapUrl(location, activeTab, keyword, dirTarget);
  const extUrl   = location ? googleMapsUrl(location, dirTarget) : '#';

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">

      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <p className="text-sm font-bold text-gray-900 dark:text-white">🏥 কাছের ডাক্তার ও হাসপাতাল</p>
        {onClose && (
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Two-column body */}
      <div className="flex-1 min-h-0 grid grid-cols-[2fr_3fr] overflow-hidden">

        {/* ── LEFT COLUMN ────────────────────────────────────────────────── */}
        <div className="flex flex-col overflow-y-auto border-r border-gray-200 dark:border-gray-800 p-3 space-y-3">

          {/* Ambulance numbers — clean, no inner borders */}
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
            <p className="text-xs font-bold text-red-700 dark:text-red-400 uppercase mb-2">🚨 জরুরি নম্বর</p>
            <div className="space-y-1.5">
              {AMBULANCE_NUMBERS.map(item => (
                <a key={item.number} href={`tel:${item.number}`}
                  className="flex items-center justify-between py-1 text-xs hover:opacity-80 transition-opacity">
                  <span className="text-gray-700 dark:text-gray-300">{item.icon} {item.name}</span>
                  <span className="font-bold text-red-600 dark:text-red-400 underline">{item.number}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">📍 অবস্থান</p>
            {location && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-2.5 py-1.5">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate flex-1">{location.label}</span>
                <button onClick={requestGps} className="underline flex-shrink-0">↺</button>
              </div>
            )}
            <div className="flex gap-1.5">
              <input value={locText} onChange={e => setLocText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLocText()}
                placeholder="এলাকার নাম লিখুন..."
                className="flex-1 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
              <button onClick={gpsLoading ? undefined : requestGps}
                className="px-2.5 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors text-xs flex-shrink-0"
                title="GPS থেকে নিন">
                {gpsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
              </button>
              <button onClick={handleLocText}
                className="px-2.5 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex-shrink-0">
                <Search className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Condition (optional) */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">🩺 স্বাস্থ্য অবস্থা <span className="font-normal normal-case">(ঐচ্ছিক)</span></p>
            {specialty && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium">
                  ✓ {specialty}
                </span>
                <button onClick={() => { setSpecialty(null); setKeyword(''); }} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
              </div>
            )}
            <div className="flex gap-1.5">
              <input value={condition} onChange={e => setCondition(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleInfer()}
                placeholder="যেমন: পেট ব্যথা, মাথাব্যথা..."
                className="flex-1 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500" />
              <button onClick={handleInfer} disabled={!condition.trim() || inferring}
                className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 transition-colors text-xs flex-shrink-0 whitespace-nowrap">
                {inferring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                AI
              </button>
            </div>
          </div>

          {/* Tab dropdown */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">দেখুন</p>
            <div className="flex flex-col gap-1">
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`text-left text-xs px-3 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}>
                  {tab.label}
                  {tab.id === 'chambers' && specialty && (
                    <span className="ml-1 opacity-75">({specialty})</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          <div className="space-y-2">
            {searching && (
              <div className="flex items-center gap-2 text-xs text-gray-500 py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> খোঁজা হচ্ছে...
              </div>
            )}
            {searchErr && <p className="text-xs text-red-500">{searchErr}</p>}
            {!location && !searching && (
              <p className="text-xs text-gray-400 py-1">অবস্থান দিন, তারপর ফলাফল দেখাবে।</p>
            )}
            {location && !searching && activeTab === 'ambulances' &&
              AMBULANCE_NUMBERS.map(item => <AmbulanceCard key={item.number} item={item} />)
            }
            {location && !searching && activeTab !== 'ambulances' && currentResults.length === 0 && !searchErr && (
              <p className="text-xs text-gray-400 py-1">এই এলাকায় কোনো ফলাফল পাওয়া যায়নি।</p>
            )}
            {location && !searching && activeTab !== 'ambulances' && currentResults.map(place => (
              <PlaceCard key={place.id} place={place} userLocation={location}
                onDirection={handleDirection} isActive={dirTarget?.id === place.id} />
            ))}
          </div>
        </div>

        {/* ── RIGHT COLUMN — Map ─────────────────────────────────────────── */}
        <div className="flex flex-col overflow-hidden">

          {/* Map header */}
          <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
            {dirTarget ? (
              <div className="flex items-center gap-2 min-w-0">
                <button onClick={() => setDirTarget(null)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{dirTarget.name}</p>
              </div>
            ) : (
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {activeTab === 'hospitals' ? '🏥 কাছের হাসপাতাল'
                  : activeTab === 'chambers' ? `👨‍⚕️ ${specialty || 'ডাক্তার'} চেম্বার`
                  : '🗺 আপনার এলাকা'}
              </p>
            )}
            {location && (
              <a href={extUrl} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline flex-shrink-0">
                <ExternalLink className="w-3 h-3" /> Google Maps
              </a>
            )}
          </div>

          {/* Iframe */}
          <div className="flex-1 relative bg-gray-100 dark:bg-gray-800">
            {!location && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 gap-2">
                <MapPin className="w-8 h-8 opacity-30" />
                <p className="text-xs text-center px-4">অবস্থান দিলে এখানে মানচিত্র দেখাবে</p>
              </div>
            )}
            {location && !EMBED_KEY && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 gap-2 p-4">
                <MapPin className="w-8 h-8 opacity-30" />
                <p className="text-xs text-center">VITE_GOOGLE_MAPS_EMBED_KEY সেট করুন</p>
                <a href={extUrl} target="_blank" rel="noreferrer"
                  className="text-xs text-blue-600 underline">Google Maps-এ দেখুন</a>
              </div>
            )}
            {location && EMBED_KEY && (
              <iframe key={embedSrc} src={embedSrc} className="w-full h-full border-0" allowFullScreen loading="lazy"
                referrerPolicy="no-referrer-when-downgrade" title="Map" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
