// perf monitoring utility -- tracks FPS, memory, op timings, and generates perf reports

class PerformanceMonitor {
  constructor(options = {}) {
    this.enabled = options.enabled !== undefined ? options.enabled : true;
    this.logToConsole = options.logToConsole !== undefined ? options.logToConsole : false;
    this.sampleInterval = options.sampleInterval || 1000; // 1s

    // perf metrics storage
    this.metrics = {
      fps: [],
      frameTimes: [],
      memory: [],
      operationTimings: {},
      renderCounts: {},
      longTasks: [],
      customMetrics: {}
    };

    // FPS tracking
    this.frameCount = 0;
    this.lastFrameTime = performance.now();
    this.lastFpsCalculation = performance.now();
    this.currentFps = 60;

    // memory tracking
    this.memorySupported = performance.memory !== undefined;

    // active marks
    this.activeMarks = new Map();

    // start monitoring
    if (this.enabled) {
      this.startMonitoring();
    }
  }

  // start continuous monitoring
  startMonitoring() {
    // FPS monitoring via requestAnimationFrame
    this.monitorFps();

    // memory sampling
    this.memorySampleInterval = setInterval(() => {
      this.sampleMemory();
    }, this.sampleInterval);

    // long task detection
    if ('PerformanceObserver' in window) {
      try {
        this.longTaskObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.duration > 50) { // tasks >50ms are "long"
              this.metrics.longTasks.push({
                name: entry.name,
                duration: entry.duration,
                startTime: entry.startTime,
                timestamp: Date.now()
              });

              if (this.logToConsole) {
                console.warn(`[PERF] Long task detected: ${entry.name} (${entry.duration.toFixed(2)}ms)`);
              }
            }
          });
        });

        this.longTaskObserver.observe({ entryTypes: ['measure', 'longtask'] });
      } catch (e) {
        console.warn('PerformanceObserver not fully supported:', e);
      }
    }
  }

  // monitor FPS using requestAnimationFrame
  monitorFps() {
    const now = performance.now();
    const frameDelta = now - this.lastFrameTime;

    this.frameCount++;
    this.lastFrameTime = now;

    // store frame time
    this.metrics.frameTimes.push(frameDelta);
    if (this.metrics.frameTimes.length > 60) {
      this.metrics.frameTimes.shift(); // keep last 60 frames
    }

    // calc FPS every second
    const timeSinceLastFps = now - this.lastFpsCalculation;
    if (timeSinceLastFps >= 1000) {
      this.currentFps = Math.round((this.frameCount * 1000) / timeSinceLastFps);
      this.metrics.fps.push({
        fps: this.currentFps,
        timestamp: Date.now()
      });

      // keep last 60s of FPS data
      if (this.metrics.fps.length > 60) {
        this.metrics.fps.shift();
      }

      this.frameCount = 0;
      this.lastFpsCalculation = now;

      if (this.logToConsole && this.currentFps < 30) {
        console.warn(`[PERF] Low FPS detected: ${this.currentFps} FPS`);
      }
    }

    if (this.enabled) {
      requestAnimationFrame(() => this.monitorFps());
    }
  }

  // sample memory usage
  sampleMemory() {
    if (!this.memorySupported) return;

    const memoryInfo = {
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      timestamp: Date.now()
    };

    this.metrics.memory.push(memoryInfo);

    // keep last 5min of memory data (300 samples at 1s interval)
    if (this.metrics.memory.length > 300) {
      this.metrics.memory.shift();
    }

    // detect memory leaks (continuous growth)
    if (this.metrics.memory.length >= 60) {
      const recentMemory = this.metrics.memory.slice(-60);
      const firstSample = recentMemory[0].usedJSHeapSize;
      const lastSample = recentMemory[recentMemory.length - 1].usedJSHeapSize;
      const growth = lastSample - firstSample;
      const growthRate = (growth / firstSample) * 100;

      if (growthRate > 20 && this.logToConsole) {
        console.warn(`[PERF] Potential memory leak: ${growthRate.toFixed(1)}% growth in last 60s`);
      }
    }
  }

  // mark start of an op
  markStart(operationName) {
    if (!this.enabled) return;

    const markName = `${operationName}-start-${Date.now()}`;
    performance.mark(markName);
    this.activeMarks.set(operationName, markName);
  }

  // mark end of an op and measure duration
  markEnd(operationName) {
    if (!this.enabled) return;

    const startMark = this.activeMarks.get(operationName);
    if (!startMark) {
      console.warn(`[PERF] No start mark found for operation: ${operationName}`);
      return;
    }

    const endMark = `${operationName}-end-${Date.now()}`;
    performance.mark(endMark);

    const measureName = `${operationName}-measure`;
    performance.measure(measureName, startMark, endMark);

    // get the measurement
    const measures = performance.getEntriesByName(measureName);
    if (measures.length > 0) {
      const duration = measures[measures.length - 1].duration;

      // store timing
      if (!this.metrics.operationTimings[operationName]) {
        this.metrics.operationTimings[operationName] = [];
      }

      this.metrics.operationTimings[operationName].push({
        duration,
        timestamp: Date.now()
      });

      // keep last 100 measurements per op
      if (this.metrics.operationTimings[operationName].length > 100) {
        this.metrics.operationTimings[operationName].shift();
      }

      if (this.logToConsole) {
        console.log(`[PERF] ${operationName}: ${duration.toFixed(2)}ms`);
      }
    }

    // cleanup
    this.activeMarks.delete(operationName);
    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
    performance.clearMeasures(measureName);
  }

  // track a custom metric
  trackCustomMetric(name, value) {
    if (!this.enabled) return;

    if (!this.metrics.customMetrics[name]) {
      this.metrics.customMetrics[name] = [];
    }

    this.metrics.customMetrics[name].push({
      value,
      timestamp: Date.now()
    });

    // keep last 100 values
    if (this.metrics.customMetrics[name].length > 100) {
      this.metrics.customMetrics[name].shift();
    }
  }

  // track component render
  trackRender(componentName) {
    if (!this.enabled) return;

    if (!this.metrics.renderCounts[componentName]) {
      this.metrics.renderCounts[componentName] = 0;
    }

    this.metrics.renderCounts[componentName]++;
  }

  // get current FPS
  getCurrentFps() {
    return this.currentFps;
  }

  // get avg FPS over time period
  getAverageFps(secondsAgo = 10) {
    const cutoff = Date.now() - (secondsAgo * 1000);
    const recentFps = this.metrics.fps.filter(entry => entry.timestamp >= cutoff);

    if (recentFps.length === 0) return this.currentFps;

    const sum = recentFps.reduce((acc, entry) => acc + entry.fps, 0);
    return Math.round(sum / recentFps.length);
  }

  // get memory stats
  getMemoryStats() {
    if (!this.memorySupported || this.metrics.memory.length === 0) {
      return null;
    }

    const latest = this.metrics.memory[this.metrics.memory.length - 1];
    const usedMB = latest.usedJSHeapSize / (1024 * 1024);
    const totalMB = latest.totalJSHeapSize / (1024 * 1024);
    const limitMB = latest.jsHeapSizeLimit / (1024 * 1024);

    // calc growth rate
    let growthRate = 0;
    if (this.metrics.memory.length >= 60) {
      const firstSample = this.metrics.memory[this.metrics.memory.length - 60].usedJSHeapSize;
      growthRate = ((latest.usedJSHeapSize - firstSample) / firstSample) * 100;
    }

    return {
      usedMB: usedMB.toFixed(2),
      totalMB: totalMB.toFixed(2),
      limitMB: limitMB.toFixed(2),
      utilizationPercent: ((usedMB / limitMB) * 100).toFixed(1),
      growthRateLast60s: growthRate.toFixed(2)
    };
  }

  // get op timing stats
  getOperationStats(operationName) {
    const timings = this.metrics.operationTimings[operationName];
    if (!timings || timings.length === 0) {
      return null;
    }

    const durations = timings.map(t => t.duration);
    const sum = durations.reduce((a, b) => a + b, 0);
    const avg = sum / durations.length;
    const sorted = [...durations].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const median = sorted[Math.floor(sorted.length / 2)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];

    return {
      count: durations.length,
      average: avg.toFixed(2),
      median: median.toFixed(2),
      min: min.toFixed(2),
      max: max.toFixed(2),
      p95: p95.toFixed(2)
    };
  }

  // generate comprehensive perf report
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      sessionDuration: ((Date.now() - this.metrics.fps[0]?.timestamp) / 1000).toFixed(0) + 's',

      fps: {
        current: this.currentFps,
        average10s: this.getAverageFps(10),
        average60s: this.getAverageFps(60),
        min: Math.min(...this.metrics.fps.map(f => f.fps)),
        max: Math.max(...this.metrics.fps.map(f => f.fps))
      },

      memory: this.getMemoryStats(),

      operations: {},

      longTasks: {
        count: this.metrics.longTasks.length,
        tasks: this.metrics.longTasks.slice(-10) // last 10
      },

      renders: this.metrics.renderCounts,

      customMetrics: {}
    };

    // add op stats
    for (const opName in this.metrics.operationTimings) {
      report.operations[opName] = this.getOperationStats(opName);
    }

    // add custom metrics
    for (const metricName in this.metrics.customMetrics) {
      const values = this.metrics.customMetrics[metricName];
      if (values.length > 0) {
        const nums = values.map(v => v.value);
        const sum = nums.reduce((a, b) => a + b, 0);
        report.customMetrics[metricName] = {
          current: values[values.length - 1].value,
          average: (sum / nums.length).toFixed(2),
          min: Math.min(...nums),
          max: Math.max(...nums)
        };
      }
    }

    return report;
  }

  // print report to console
  printReport() {
    const report = this.generateReport();

    console.group('=== PERFORMANCE REPORT ===');
    console.log('Timestamp:', report.timestamp);
    console.log('Session Duration:', report.sessionDuration);

    console.group('FPS:');
    console.log('  Current:', report.fps.current);
    console.log('  Average (10s):', report.fps.average10s);
    console.log('  Average (60s):', report.fps.average60s);
    console.log('  Min:', report.fps.min);
    console.log('  Max:', report.fps.max);
    console.groupEnd();

    if (report.memory) {
      console.group('Memory:');
      console.log('  Used:', report.memory.usedMB + ' MB');
      console.log('  Total:', report.memory.totalMB + ' MB');
      console.log('  Limit:', report.memory.limitMB + ' MB');
      console.log('  Utilization:', report.memory.utilizationPercent + '%');
      console.log('  Growth (60s):', report.memory.growthRateLast60s + '%');
      console.groupEnd();
    }

    console.group('Operations:');
    for (const [name, stats] of Object.entries(report.operations)) {
      console.log(`  ${name}:`, stats);
    }
    console.groupEnd();

    console.group('Long Tasks:');
    console.log('  Count:', report.longTasks.count);
    report.longTasks.tasks.forEach((task, i) => {
      console.log(`  ${i + 1}. ${task.name}: ${task.duration.toFixed(2)}ms`);
    });
    console.groupEnd();

    console.group('Component Renders:');
    for (const [name, count] of Object.entries(report.renders)) {
      console.log(`  ${name}: ${count}`);
    }
    console.groupEnd();

    if (Object.keys(report.customMetrics).length > 0) {
      console.group('Custom Metrics:');
      for (const [name, stats] of Object.entries(report.customMetrics)) {
        console.log(`  ${name}:`, stats);
      }
      console.groupEnd();
    }

    console.groupEnd();

    return report;
  }

  // export metrics as JSON
  exportMetrics() {
    return JSON.stringify(this.generateReport(), null, 2);
  }

  // clear all metrics
  clear() {
    this.metrics = {
      fps: [],
      frameTimes: [],
      memory: [],
      operationTimings: {},
      renderCounts: {},
      longTasks: [],
      customMetrics: {}
    };
  }

  // stop monitoring
  stop() {
    this.enabled = false;

    if (this.memorySampleInterval) {
      clearInterval(this.memorySampleInterval);
    }

    if (this.longTaskObserver) {
      this.longTaskObserver.disconnect();
    }
  }
}

// create singleton instance
const performanceMonitor = new PerformanceMonitor({
  enabled: import.meta.env.DEV, // only in dev by default
  logToConsole: false // set to true for verbose logging
});

// expose to window for debugging
if (typeof window !== 'undefined') {
  window.performanceMonitor = performanceMonitor;
}

export default performanceMonitor;
