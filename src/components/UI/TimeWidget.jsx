import { useState, useEffect, useRef, useCallback } from 'react';
import * as Cesium from 'cesium';
import { Rewind, Play, Pause, FastForward, Radio } from 'lucide-react';
import useAppStore from '../../stores/appStore';

// Logarithmic mapping for speed slider (0.5x - 100x)
const MIN_SPEED = 0.5;
const MAX_SPEED = 100;
const LOG_MIN = Math.log(MIN_SPEED);
const LOG_MAX = Math.log(MAX_SPEED);

function speedToSlider(speed) {
  return ((Math.log(speed) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100;
}

function sliderToSpeed(val) {
  return Math.exp(LOG_MIN + (val / 100) * (LOG_MAX - LOG_MIN));
}

// Timeline range: -12h to +12h from wall-clock "now"
const TIMELINE_RANGE_MS = 12 * 60 * 60 * 1000;

function useDraggable(initialX, initialY) {
  const [pos, setPos] = useState({ x: initialX, y: initialY });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const onPointerDown = useCallback((e) => {
    dragging.current = true;
    dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.target.setPointerCapture(e.pointerId);
  }, [pos]);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    const maxX = window.innerWidth - 420;
    const maxY = window.innerHeight - 90;
    setPos({
      x: Math.max(0, Math.min(maxX, e.clientX - dragStart.current.x)),
      y: Math.max(0, Math.min(maxY, e.clientY - dragStart.current.y)),
    });
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return { pos, onPointerDown, onPointerMove, onPointerUp };
}

function formatUTC(date) {
  const h = String(date.getUTCHours()).padStart(2, '0');
  const m = String(date.getUTCMinutes()).padStart(2, '0');
  const s = String(date.getUTCSeconds()).padStart(2, '0');
  return `${h}:${m}:${s} UTC`;
}

function formatLocal(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop().replace(/_/g, ' ');
  return `${h}:${m}:${s} ${tz}`;
}

export default function TimeWidget() {
  const viewerRef = useAppStore((s) => s.viewerRef);
  const simPlaying = useAppStore((s) => s.simPlaying);
  const simSpeed = useAppStore((s) => s.simSpeed);
  const simDirection = useAppStore((s) => s.simDirection);
  const toggleSimPlaying = useAppStore((s) => s.toggleSimPlaying);
  const setSimSpeed = useAppStore((s) => s.setSimSpeed);
  const setSimDirection = useAppStore((s) => s.setSimDirection);

  const [utcStr, setUtcStr] = useState('--:--:-- UTC');
  const [localStr, setLocalStr] = useState('--:--:--');
  const [scrubberValue, setScrubberValue] = useState(50);
  const [isLive, setIsLive] = useState(true);

  const wallNowRef = useRef(Date.now());

  // Position: bottom-center
  const { pos, onPointerDown, onPointerMove, onPointerUp } = useDraggable(
    Math.max(0, (window.innerWidth - 420) / 2),
    window.innerHeight - 110
  );

  // Sync clock tick -> time display + scrubber
  useEffect(() => {
    if (!viewerRef) return;

    const clock = viewerRef.clock;

    function onTick() {
      const simDate = Cesium.JulianDate.toDate(clock.currentTime);
      setUtcStr(formatUTC(simDate));
      setLocalStr(formatLocal(simDate));

      // Update scrubber position
      const wallNow = Date.now();
      wallNowRef.current = wallNow;
      const diff = simDate.getTime() - wallNow;
      const pct = ((diff + TIMELINE_RANGE_MS) / (2 * TIMELINE_RANGE_MS)) * 100;
      setScrubberValue(Math.max(0, Math.min(100, pct)));

      // Live check: within 2 seconds of real time and speed ~1x forward
      const isNearLive = Math.abs(diff) < 2000 && Math.abs(clock.multiplier - 1) < 0.1;
      setIsLive(isNearLive);
    }

    const listener = clock.onTick.addEventListener(onTick);
    onTick(); // initial

    return () => {
      listener();
    };
  }, [viewerRef]);

  // Initialize clock on mount
  useEffect(() => {
    if (!viewerRef) return;
    const clock = viewerRef.clock;
    clock.shouldAnimate = true;
    clock.multiplier = 1;
    clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK_MULTIPLIER;
  }, [viewerRef]);

  const handlePlayPause = useCallback(() => {
    toggleSimPlaying();
  }, [toggleSimPlaying]);

  const handleRewind = useCallback(() => {
    if (!viewerRef) return;
    const newDir = -1;
    setSimDirection(newDir);
    viewerRef.clock.multiplier = -Math.abs(viewerRef.clock.multiplier);
    if (!viewerRef.clock.shouldAnimate) {
      toggleSimPlaying();
    }
  }, [viewerRef, setSimDirection, toggleSimPlaying]);

  const handleForward = useCallback(() => {
    if (!viewerRef) return;
    const newDir = 1;
    setSimDirection(newDir);
    viewerRef.clock.multiplier = Math.abs(viewerRef.clock.multiplier);
    if (!viewerRef.clock.shouldAnimate) {
      toggleSimPlaying();
    }
  }, [viewerRef, setSimDirection, toggleSimPlaying]);

  const handleLive = useCallback(() => {
    if (!viewerRef) return;
    const clock = viewerRef.clock;
    clock.currentTime = Cesium.JulianDate.now();
    clock.multiplier = 1;
    clock.shouldAnimate = true;
    setSimSpeed(1);
    setSimDirection(1);
    useAppStore.setState({ simPlaying: true });
  }, [viewerRef, setSimSpeed, setSimDirection]);

  const handleSpeedChange = useCallback((e) => {
    const val = parseFloat(e.target.value);
    const speed = sliderToSpeed(val);
    setSimSpeed(speed);
    if (viewerRef) {
      viewerRef.clock.multiplier = speed * simDirection;
    }
  }, [viewerRef, simDirection, setSimSpeed]);

  const handleScrub = useCallback((e) => {
    if (!viewerRef) return;
    const pct = parseFloat(e.target.value);
    const offsetMs = (pct / 100) * 2 * TIMELINE_RANGE_MS - TIMELINE_RANGE_MS;
    const targetMs = wallNowRef.current + offsetMs;
    viewerRef.clock.currentTime = Cesium.JulianDate.fromDate(new Date(targetMs));
  }, [viewerRef]);

  if (!viewerRef) return null;

  const speedSliderVal = speedToSlider(simSpeed);

  return (
    <div
      className="fixed z-30 glass rounded-lg select-none"
      style={{
        left: pos.x,
        top: pos.y,
        width: 420,
        userSelect: 'none',
      }}
    >
      {/* Drag handle */}
      <div
        className="w-full flex justify-center py-1 cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div className="w-10 h-1 rounded-full bg-white/20" />
      </div>

      {/* Row 1: Controls + Time */}
      <div className="flex items-center gap-1 px-3 pb-1">
        {/* Transport controls */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleRewind}
            className="p-1.5 rounded hover:bg-[var(--glass-hover)] transition-colors"
            title="Rewind"
          >
            <Rewind
              size={13}
              style={{ color: simDirection === -1 ? 'var(--accent)' : 'var(--text-secondary)' }}
            />
          </button>

          <button
            onClick={handlePlayPause}
            className="p-1.5 rounded hover:bg-[var(--glass-hover)] transition-colors"
            title={simPlaying ? 'Pause' : 'Play'}
          >
            {simPlaying ? (
              <Pause size={13} style={{ color: 'var(--accent)' }} />
            ) : (
              <Play size={13} style={{ color: 'var(--accent)' }} />
            )}
          </button>

          <button
            onClick={handleForward}
            className="p-1.5 rounded hover:bg-[var(--glass-hover)] transition-colors"
            title="Forward"
          >
            <FastForward
              size={13}
              style={{ color: simDirection === 1 ? 'var(--accent)' : 'var(--text-secondary)' }}
            />
          </button>
        </div>

        {/* Live button */}
        <button
          onClick={handleLive}
          className="px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wider uppercase transition-colors"
          style={{
            color: isLive ? '#080c15' : 'var(--text-secondary)',
            background: isLive ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
            border: '1px solid ' + (isLive ? 'var(--accent)' : 'rgba(255,255,255,0.1)'),
          }}
        >
          <Radio size={8} className="inline mr-1" style={{ verticalAlign: 'middle' }} />
          Live
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Time display */}
        <div className="text-right leading-tight">
          <div className="text-xs tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {utcStr}
          </div>
          <div className="text-[10px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>
            {localStr}
          </div>
        </div>
      </div>

      {/* Row 2: Scrubber + Speed */}
      <div className="flex items-center gap-2 px-3 pb-2">
        {/* Timeline scrubber */}
        <input
          type="range"
          min="0"
          max="100"
          step="0.1"
          value={scrubberValue}
          onChange={handleScrub}
          className="time-scrubber flex-1 h-1"
          title="Timeline (-12h to +12h)"
          style={{ accentColor: '#38f3bf' }}
        />

        {/* Speed slider */}
        <div className="flex items-center gap-1">
          <input
            type="range"
            min="0"
            max="100"
            step="0.5"
            value={speedSliderVal}
            onChange={handleSpeedChange}
            className="speed-slider w-16 h-1"
            title={`Speed: ${simSpeed.toFixed(1)}x`}
            style={{ accentColor: '#38f3bf' }}
          />
          <span
            className="text-[10px] tabular-nums w-9 text-right"
            style={{ color: 'var(--text-secondary)' }}
          >
            {simSpeed < 10 ? simSpeed.toFixed(1) : simSpeed.toFixed(0)}x
          </span>
        </div>
      </div>
    </div>
  );
}
