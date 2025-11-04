import React, { useState, useEffect, useRef } from 'react';

const PerformanceMonitor = ({ isVisible = true }) => {
  const [metrics, setMetrics] = useState({
    fps: 0,
    memory: 0,
    renderTime: 0,
    renderCount: 0,
    updateCount: 0,
    avgRenderTime: 0
  });

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const renderTimesRef = useRef([]);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    if (!isVisible) return;

    //fps tracking
    const trackFPS = () => {
      frameCountRef.current++;
      const currentTime = performance.now();
      const elapsed = currentTime - lastTimeRef.current;

      if (elapsed >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / elapsed);

        //memory usage (if available)
        let memoryMB = 0;
        if (performance.memory) {
          memoryMB = Math.round(performance.memory.usedJSHeapSize / 1048576);
        }

        //avg render time
        const avgRender = renderTimesRef.current.length > 0
          ? renderTimesRef.current.reduce((a, b) => a + b, 0) / renderTimesRef.current.length
          : 0;

        setMetrics(prev => ({
          ...prev,
          fps,
          memory: memoryMB,
          avgRenderTime: avgRender.toFixed(2),
          updateCount: prev.updateCount + 1
        }));

        frameCountRef.current = 0;
        lastTimeRef.current = currentTime;
        renderTimesRef.current = [];
      }

      animationFrameRef.current = requestAnimationFrame(trackFPS);
    };

    trackFPS();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isVisible]);

  //track component render
  useEffect(() => {
    const renderStart = performance.now();

    return () => {
      const renderEnd = performance.now();
      const renderTime = renderEnd - renderStart;
      renderTimesRef.current.push(renderTime);

      setMetrics(prev => ({
        ...prev,
        renderTime: renderTime.toFixed(2),
        renderCount: prev.renderCount + 1
      }));
    };
  });

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 right-4 bg-black bg-opacity-80 text-white p-3 rounded-lg text-xs font-mono z-50 min-w-48">
      <div className="font-bold mb-2 text-green-400">perf monitor</div>

      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-400">fps:</span>
          <span className={metrics.fps < 30 ? 'text-red-400' : metrics.fps < 50 ? 'text-yellow-400' : 'text-green-400'}>
            {metrics.fps}
          </span>
        </div>

        {metrics.memory > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-400">memory:</span>
            <span className={metrics.memory > 500 ? 'text-yellow-400' : 'text-white'}>
              {metrics.memory} mb
            </span>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-gray-400">render:</span>
          <span className="text-white">{metrics.renderTime} ms</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">avg render:</span>
          <span className="text-white">{metrics.avgRenderTime} ms</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">renders:</span>
          <span className="text-white">{metrics.renderCount}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">updates:</span>
          <span className="text-white">{metrics.updateCount}/s</span>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-gray-700 text-[10px] text-gray-500">
        press p to toggle
      </div>
    </div>
  );
};

export default PerformanceMonitor;
