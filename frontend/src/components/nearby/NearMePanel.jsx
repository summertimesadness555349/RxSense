import { useState, useEffect, useCallback } from 'react';
import { MapPin, Phone, Navigation, Search, Loader2, Star, X, ExternalLink, Sparkles, ChevronDown, ChevronUp, Building2, Stethoscope, Ambulance, Siren, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { searchNearby, geocodeAddress, inferSpecialty } from '../../services/api.js';
import { AMBULANCE_NUMBERS } from '../../data/ambulanceNumbers.js';
import { useLanguage } from '../../context/LanguageContext.jsx';

const EMBED_KEY = import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY || '';

const TAB_IDS   = ['hospitals',  'chambers',    'ambulances'];
const TAB_KEYS  = ['hospitalTab', 'chamberTab', 'ambulanceTab'];
const TAB_ICONS = [Building2,    Stethoscope,   Ambulance];

function sortPlaces(places) {
  return [...places].sort((a, b) => {
    if (a.isOpen === true && b.isOpen !== true) return -1;
    if (a.isOpen !== true && b.isOpen === true) return 1;
    return (a.distanceKm ?? 999) - (b.distanceKm ?? 999);
  });
}

// ── Inline direction map ──────────────────────────────────────────────────────
function DirectionMap({ place, userLocation }) {
  const { t } = useLanguage();
  const ext = `https://www.google.com/maps/dir/?api=1&origin=${userLocation?.lat},${userLocation?.lng}&destination=${place.lat},${place.lng}`;

  if (!EMBED_KEY || !userLocation) return (
    <div className="p-4 border-t border-gray-100 dark:border-gray-800">
      <a href={ext} target="_blank" rel="noreferrer"
        className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline">
        <ExternalLink className="w-4 h-4" /> {t('viewOnGoogleMaps')}
      </a>
    </div>
  );

  const src = `https://www.google.com/maps/embed/v1/directions?origin=${userLocation.lat},${userLocation.lng}&destination=${place.lat},${place.lng}&mode=driving&key=${EMBED_KEY}`;

  return (
    <div className="border-t border-blue-200 dark:border-blue-800">
      <div className="flex items-center justify-between px-4 py-2 bg-blue-50 dark:bg-blue-900/20">
        <span className="text-sm font-medium text-blue-700 dark:text-blue-300 truncate">
          {t('routeTo', { name: place.name })}
        </span>
        <a href={ext} target="_blank" rel="noreferrer"
          className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline flex-shrink-0 ml-3">
          <ExternalLink className="w-4 h-4" /> Google Maps
        </a>
      </div>
      <iframe key={src} src={src} className="w-full h-64 border-0"
        allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="directions" />
    </div>
  );
}

// ── Place card ────────────────────────────────────────────────────────────────
function PlaceCard({ place, userLocation, expandedId, onToggle }) {
  const { t } = useLanguage();
  const isExpanded = expandedId === place.id;

  return (
    <div className={`rounded-xl border overflow-hidden transition-colors ${
      isExpanded
        ? 'border-blue-300 dark:border-blue-700'
        : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'
    }`}>
      <div className="p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-base font-semibold text-gray-900 dark:text-white leading-snug">{place.name}</p>
          {place.isOpen !== null && (
            <span className={`text-sm font-semibold flex-shrink-0 ${place.isOpen ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
              ● {place.isOpen ? t('openStatus') : t('closedStatus')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
          {place.rating && (
            <span className="flex items-center gap-1 text-amber-500 font-semibold">
              <Star className="w-4 h-4 fill-amber-400 stroke-amber-400" />{place.rating.toFixed(1)}
            </span>
          )}
          {place.distanceKm != null && (
            <span className="flex items-center gap-1">
              <Navigation className="w-4 h-4" />{place.distanceKm} {t('kmAbbr')}
            </span>
          )}
        </div>

        {place.address && (
          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-start gap-1.5">
            <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />{place.address}
          </p>
        )}

        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
          <Phone className="w-4 h-4 flex-shrink-0" />
          {place.phone
            ? place.phone
            : <span className="text-gray-400 dark:text-gray-600">{t('phoneNotFound')}</span>
          }
        </p>

        <div className="flex gap-2 flex-wrap pt-1">
          {place.phone && (
            <a href={`tel:${place.phone}`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-sm font-medium hover:bg-emerald-100 transition-colors">
              <Phone className="w-4 h-4" /> {t('callBtn')}
            </a>
          )}
          <button onClick={() => onToggle(place.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isExpanded
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-100'
            }`}>
            <Navigation className="w-4 h-4" />
            {t('directionsBtn')}
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <a href={place.mapsUrl} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-200 transition-colors">
            <ExternalLink className="w-4 h-4" /> Maps
          </a>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <DirectionMap place={place} userLocation={userLocation} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function NearMePanel({
  specialist: initSpecialist = null,
  condition:  initCondition  = null,
  onClose                    = null,
}) {
  const { t } = useLanguage();

  const [location,   setLocation]   = useState(null);
  const [locText,    setLocText]    = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);

  const [condition,  setCondition]  = useState(initCondition || '');
  const [specialty,  setSpecialty]  = useState(initSpecialist || null);
  const [keyword,    setKeyword]    = useState(initSpecialist || '');
  const [inferring,  setInferring]  = useState(false);

  const [activeTab,  setActiveTab]  = useState('hospitals');
  const [results,    setResults]    = useState({ hospitals: [], chambers: [], ambulances: [] });
  const [searching,  setSearching]  = useState(false);
  const [searchErr,  setSearchErr]  = useState('');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => { requestGps(); }, []);
  useEffect(() => { if (location) fetchAll(location, keyword); }, [location]);
  useEffect(() => { if (location && keyword) fetchChambers(location, keyword); }, [keyword]);

  const requestGps = () => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setGpsLoading(false); setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: t('currentLocationLabel') }); },
      ()  => { setGpsLoading(false); },
      { timeout: 10000 }
    );
  };

  const handleLocText = async () => {
    if (!locText.trim()) return;
    setGpsLoading(true);
    try {
      const geo = await geocodeAddress(locText.trim());
      if (geo.success) setLocation({ lat: geo.lat, lng: geo.lng, label: geo.label });
      else setSearchErr(t('addressNotFound'));
    } catch { setSearchErr(t('addressSearchError')); }
    finally { setGpsLoading(false); }
  };

  const handleInfer = async () => {
    if (!condition.trim()) return;
    setInferring(true);
    try {
      const res = await inferSpecialty(condition);
      if (res.specialty) { setSpecialty(res.specialty); setKeyword(res.keyword); setActiveTab('chambers'); }
    } catch { /* silent */ }
    finally { setInferring(false); }
  };

  const fetchAll = useCallback(async (loc, kw) => {
    setSearching(true); setSearchErr(''); setExpandedId(null);
    try {
      const [hosp, cham, amb] = await Promise.all([
        searchNearby(loc.lat, loc.lng, { type: 'hospital', keyword: '',                  radius: 5000 }),
        searchNearby(loc.lat, loc.lng, { type: 'doctor',   keyword: kw || '',            radius: 5000 }),
        searchNearby(loc.lat, loc.lng, { type: '',         keyword: 'ambulance service', radius: 8000 }),
      ]);
      setResults({ hospitals: sortPlaces(hosp), chambers: sortPlaces(cham), ambulances: sortPlaces(amb) });
    } catch { setSearchErr(t('searchError')); }
    finally { setSearching(false); }
  }, []);

  const fetchChambers = async (loc, kw) => {
    try {
      const cham = await searchNearby(loc.lat, loc.lng, { type: 'doctor', keyword: kw || '', radius: 5000 });
      setResults(prev => ({ ...prev, chambers: sortPlaces(cham) }));
    } catch { /* silent */ }
  };

  const toggleDirection = (id) => setExpandedId(prev => prev === id ? null : id);
  const currentResults = results[activeTab] || [];

  const TABS = TAB_IDS.map((id, i) => ({ id, label: t(TAB_KEYS[i]), Icon: TAB_ICONS[i] }));

  const resultsHeader = !location
    ? t('locationPrompt')
    : searching
    ? t('searchingLabel')
    : t('resultsCount', { count: currentResults.length });

  return (
    <div className="w-[95%] mx-auto flex h-full gap-6 overflow-hidden">

      {/* ══ LEFT — fixed controls (35%) ══════════════════════════════════════ */}
      <div className="w-[35%] flex-shrink-0 flex flex-col gap-4 overflow-hidden">

        {onClose && (
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('nearbyServices')}</p>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Emergency numbers */}
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-sm font-bold text-red-700 dark:text-red-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Siren className="w-4 h-4" /> {t('emergencyNumbers')}
          </p>
          <div className="space-y-2">
            {AMBULANCE_NUMBERS.map(item => (
              <a key={item.number} href={`tel:${item.number}`}
                className="flex items-center justify-between py-1 text-sm hover:opacity-75 transition-opacity">
                <span className="text-gray-700 dark:text-gray-300">{item.icon} {item.name}</span>
                <span className="font-bold text-red-600 dark:text-red-400">{item.number}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Location */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
            <MapPin className="w-4 h-4" /> {t('locationLabel')}
          </p>
          {location && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3 py-2">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="truncate flex-1">{location.label}</span>
              <button onClick={requestGps} className="underline flex-shrink-0 text-emerald-600">↺</button>
            </div>
          )}
          <div className="flex gap-2">
            <input value={locText} onChange={e => setLocText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLocText()}
              placeholder={t('areaPlaceholder')}
              className="flex-1 min-w-0 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <button onClick={requestGps} title={t('gpsBtn')}
              className="px-3 py-2.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors flex-shrink-0">
              {gpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
            </button>
            <button onClick={handleLocText}
              className="px-3 py-2.5 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 transition-colors flex-shrink-0">
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Condition */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
            <Activity className="w-4 h-4" /> {t('healthConditionLabel')} <span className="font-normal normal-case text-gray-400">{t('optionalLabel')}</span>
          </p>
          {specialty && (
            <div className="flex items-center gap-2">
              <span className="text-sm px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium">
                ✓ {specialty}
              </span>
              <button onClick={() => { setSpecialty(null); setKeyword(''); }} className="text-sm text-gray-400 hover:text-gray-600">✕</button>
            </div>
          )}
          <div className="flex gap-2">
            <input value={condition} onChange={e => setCondition(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleInfer()}
              placeholder={t('conditionPlaceholder')}
              className="flex-1 min-w-0 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500" />
            <button onClick={handleInfer} disabled={!condition.trim() || inferring}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 transition-colors flex-shrink-0 text-sm font-medium">
              {inferring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {t('aiBtn')}
            </button>
          </div>
        </div>

        {/* Tab selector */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">{t('viewLabel')}</p>
          <div className="flex flex-col gap-1.5">
            {TABS.map(({ id, label, Icon }) => (
              <button key={id} onClick={() => { setActiveTab(id); setExpandedId(null); }}
                className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg font-medium transition-colors ${
                  activeTab === id
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
                {id === 'chambers' && specialty && (
                  <span className="ml-0.5 opacity-75 font-normal">({specialty})</span>
                )}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* ══ RIGHT — only this scrolls (60%) ══════════════════════════════════ */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
            {resultsHeader}
          </p>
          {searching && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
        </div>

        {/* Scrollable results */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {searchErr && <p className="text-sm text-red-500 py-2">{searchErr}</p>}

          {location && !searching && currentResults.length === 0 && !searchErr && (
            <p className="text-sm text-gray-400 dark:text-gray-600 py-2">{t('noResultsFound')}</p>
          )}

          {location && !searching && currentResults.map(place => (
            <PlaceCard
              key={place.id}
              place={place}
              userLocation={location}
              expandedId={expandedId}
              onToggle={toggleDirection}
            />
          ))}
        </div>

      </div>
    </div>
  );
}
