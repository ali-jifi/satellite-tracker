import { useState, useEffect, useRef, useCallback } from 'react';
import { X, LocateFixed, MapPin, Search, Loader2 } from 'lucide-react';
import useAppStore from '../../stores/appStore';
import { searchCity } from '../../services/geocodingService';

const TABS = ['GPS', 'Manual', 'Search'];

export default function ObserverLocation() {
  const locationPromptOpen = useAppStore((s) => s.locationPromptOpen);
  const closeLocationPrompt = useAppStore((s) => s.closeLocationPrompt);
  const setObserverLocation = useAppStore((s) => s.setObserverLocation);

  const [activeTab, setActiveTab] = useState(0);

  if (!locationPromptOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.4)' }}
        onClick={closeLocationPrompt}
      />

      {/* Modal */}
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 glass rounded-xl p-5 fade-in"
        style={{ width: 360, maxHeight: '80vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3
            className="text-[10px] tracking-[0.2em] uppercase"
            style={{ color: 'var(--accent)', fontWeight: 600 }}
          >
            Observer Location
          </h3>
          <button
            onClick={closeLocationPrompt}
            className="p-1 rounded-full hover:bg-[var(--glass-hover)] transition-colors"
            aria-label="Close"
          >
            <X size={16} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className="flex-1 py-1.5 text-[11px] rounded-md transition-all duration-150"
              style={{
                background: activeTab === i ? 'var(--accent-glow)' : 'transparent',
                color: activeTab === i ? 'var(--accent)' : 'var(--text-secondary)',
                border: activeTab === i ? '1px solid var(--glass-border)' : '1px solid transparent',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 0 && (
          <GPSTab setObserverLocation={setObserverLocation} />
        )}
        {activeTab === 1 && (
          <ManualTab setObserverLocation={setObserverLocation} />
        )}
        {activeTab === 2 && (
          <SearchTab setObserverLocation={setObserverLocation} />
        )}
      </div>
    </>
  );
}

function GPSTab({ setObserverLocation }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGPS = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLoading(false);
        setObserverLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          label: 'GPS Location',
        });
      },
      (err) => {
        setLoading(false);
        if (err.code === 1) {
          setError('Location permission denied. Please allow access in your browser settings.');
        } else if (err.code === 3) {
          setError('Location request timed out. Please try again.');
        } else {
          setError('Unable to retrieve your location.');
        }
      },
      { timeout: 10000 }
    );
  };

  return (
    <div className="text-center py-4">
      <button
        onClick={handleGPS}
        disabled={loading}
        className="glass rounded-lg px-5 py-3 text-xs inline-flex items-center gap-2 transition-all duration-200 hover:bg-[var(--glass-hover)]"
        style={{ color: 'var(--accent)' }}
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <LocateFixed size={16} />
        )}
        {loading ? 'Locating...' : 'Use My Location'}
      </button>
      {error && (
        <p className="mt-3 text-[11px]" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
    </div>
  );
}

function ManualTab({ setObserverLocation }) {
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);

    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      setError('Latitude must be between -90 and 90.');
      return;
    }
    if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
      setError('Longitude must be between -180 and 180.');
      return;
    }

    setError(null);
    setObserverLocation({
      lat: latNum,
      lon: lonNum,
      label: `${latNum.toFixed(4)}, ${lonNum.toFixed(4)}`,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-[10px] mb-1" style={{ color: 'var(--text-secondary)' }}>
          Latitude (-90 to 90)
        </label>
        <input
          type="number"
          step="any"
          min="-90"
          max="90"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          placeholder="0.0000"
          className="w-full px-3 py-2 rounded-md text-xs bg-black/40 border border-white/10 text-white outline-none focus:border-[var(--accent)] transition-colors"
        />
      </div>
      <div>
        <label className="block text-[10px] mb-1" style={{ color: 'var(--text-secondary)' }}>
          Longitude (-180 to 180)
        </label>
        <input
          type="number"
          step="any"
          min="-180"
          max="180"
          value={lon}
          onChange={(e) => setLon(e.target.value)}
          placeholder="0.0000"
          className="w-full px-3 py-2 rounded-md text-xs bg-black/40 border border-white/10 text-white outline-none focus:border-[var(--accent)] transition-colors"
        />
      </div>
      {error && (
        <p className="text-[11px]" style={{ color: 'var(--danger)' }}>{error}</p>
      )}
      <button
        type="submit"
        className="w-full py-2 rounded-md text-xs transition-all duration-200"
        style={{
          background: 'var(--accent-glow)',
          color: 'var(--accent)',
          border: '1px solid var(--glass-border)',
        }}
      >
        Set Location
      </button>
    </form>
  );
}

function SearchTab({ setObserverLocation }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const res = await searchCity(q);
    setResults(res);
    setSearching(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, doSearch]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--text-secondary)' }}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search city..."
          className="w-full pl-8 pr-3 py-2 rounded-md text-xs bg-black/40 border border-white/10 text-white outline-none focus:border-[var(--accent)] transition-colors"
        />
      </div>

      {searching && (
        <p className="text-[11px] text-center" style={{ color: 'var(--text-secondary)' }}>
          Searching...
        </p>
      )}

      {!searching && query.length >= 2 && results.length === 0 && (
        <p className="text-[11px] text-center" style={{ color: 'var(--text-secondary)' }}>
          No results found.
        </p>
      )}

      {results.length > 0 && (
        <ul className="space-y-1 max-h-48 overflow-y-auto custom-scroll">
          {results.map((result, i) => (
            <li key={i}>
              <button
                onClick={() => setObserverLocation(result)}
                className="w-full text-left px-3 py-2 rounded-md text-[11px] flex items-start gap-2 transition-all duration-150 hover:bg-[var(--glass-hover)]"
                style={{ color: 'var(--text-primary)' }}
              >
                <MapPin
                  size={12}
                  className="mt-0.5 flex-shrink-0"
                  style={{ color: 'var(--accent)' }}
                />
                <span className="line-clamp-2">{result.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
