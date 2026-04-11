import { CATEGORY_COLORS } from '../../utils/colorModes.js';

const CATEGORY_DISPLAY = {
  'starlink': 'Starlink',
  'oneweb': 'OneWeb',
  'active': 'Active',
  'stations': 'Station',
  'visual': 'Visual',
  'gps-ops': 'GPS',
  'glonass-ops': 'GLONASS',
  'galileo': 'Galileo',
  'beidou': 'BeiDou',
  'weather': 'Weather',
  'noaa': 'NOAA',
  'goes': 'GOES',
  'science': 'Science',
  'geodetic': 'Geodetic',
  'engineering': 'Eng',
  'education': 'Edu',
  'military': 'Military',
  'radar': 'Radar',
  'amateur': 'Amateur',
  'satnogs': 'SatNOGS',
  'iridium': 'Iridium',
  'iridium-NEXT': 'Iridium-N',
  'orbcomm': 'ORBCOMM',
  'globalstar': 'Globalstar',
  'swarm': 'Swarm',
  'intelsat': 'Intelsat',
  'ses': 'SES',
  'other-comm': 'Comm',
  'x-comm': 'X-Comm',
  'geo': 'GEO',
  'resource': 'Resource',
  'sarsat': 'SARSAT',
  'dmc': 'DMC',
  'tdrss': 'TDRSS',
  'argos': 'ARGOS',
  'gnss': 'GNSS',
  'cubesat': 'CubeSat',
  'other': 'Other',
};

export default function SatelliteCard({ satellite, onSelect, isSelected, showAltitude, altitude }) {
  const categoryColor = CATEGORY_COLORS[satellite.category] || '#cccccc';
  const categoryLabel = CATEGORY_DISPLAY[satellite.category] || satellite.category || 'Unknown';

  return (
    <button
      onClick={() => onSelect(satellite.id)}
      className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded transition-colors duration-100 ${
        isSelected
          ? 'bg-[var(--accent-glow)] border-l-2 border-l-[var(--accent)]'
          : 'hover:bg-[var(--glass-hover)] border-l-2 border-l-transparent'
      }`}
    >
      {/* color dot */}
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: categoryColor }}
      />

      {/* center: name + meta */}
      <div className="flex-1 min-w-0">
        <div
          className="text-[11px] truncate"
          style={{ color: 'var(--text-primary)' }}
        >
          {satellite.name}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className="text-[9px]"
            style={{ color: 'var(--text-secondary)' }}
          >
            {satellite.id}
          </span>
          <span
            className="text-[8px] px-1 py-px rounded-sm leading-tight"
            style={{
              backgroundColor: categoryColor + '22',
              color: categoryColor,
            }}
          >
            {categoryLabel}
          </span>
        </div>
      </div>

      {/* right: altitude */}
      {showAltitude && altitude != null && (
        <span
          className="text-[9px] flex-shrink-0 tabular-nums"
          style={{ color: 'var(--text-secondary)' }}
        >
          {Math.round(altitude)} km
        </span>
      )}
    </button>
  );
}
