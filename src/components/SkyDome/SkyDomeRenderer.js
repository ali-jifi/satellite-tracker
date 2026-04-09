/**
 * SkyDomeRenderer - Canvas 2D drawing functions for the ground observer sky dome.
 * Uses polar azimuthal projection: azimuth/elevation -> canvas x/y.
 */

const PI = Math.PI;
const DEG2RAD = PI / 180;
const RAD2DEG = 180 / PI;

/**
 * Convert azimuth/elevation to canvas x/y using polar projection.
 * Zenith (el=90) maps to center, horizon (el=0) maps to edge.
 * North is up on the canvas.
 */
export function polarToCanvas(azDeg, elDeg, cx, cy, radius) {
  const r = radius * (1 - elDeg / 90);
  const azRad = (azDeg - 90) * DEG2RAD; // rotate so North (0) is up
  return {
    x: cx + r * Math.cos(azRad),
    y: cy + r * Math.sin(azRad),
  };
}

/**
 * Draw dark sky gradient background.
 */
export function drawBackground(ctx, width, height, cx, cy, radius) {
  // Fill entire canvas black first
  ctx.fillStyle = '#050510';
  ctx.fillRect(0, 0, width, height);

  // Radial gradient for sky dome circle
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grad.addColorStop(0, '#0a0a1a');   // zenith: darkest
  grad.addColorStop(0.7, '#0f0f28'); // mid-sky
  grad.addColorStop(1, '#1a1a3a');   // horizon: slightly lighter
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, PI * 2);
  ctx.fill();
}

/**
 * Draw elevation rings and cardinal direction labels.
 */
export function drawGrid(ctx, cx, cy, radius) {
  ctx.save();

  // Elevation rings at 30, 60 degrees (90 = zenith point, no ring needed)
  const elevations = [30, 60];
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 0.5;

  for (const el of elevations) {
    const r = radius * (1 - el / 90);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, PI * 2);
    ctx.stroke();
  }

  // Horizon ring (el = 0) slightly brighter
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, PI * 2);
  ctx.stroke();

  // Crosshair lines (N-S and E-W) very faint
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 0.5;
  // N-S line
  ctx.beginPath();
  ctx.moveTo(cx, cy - radius);
  ctx.lineTo(cx, cy + radius);
  ctx.stroke();
  // E-W line
  ctx.beginPath();
  ctx.moveTo(cx - radius, cy);
  ctx.lineTo(cx + radius, cy);
  ctx.stroke();

  // Elevation degree labels on the North axis
  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  for (const el of [30, 60]) {
    const r = radius * (1 - el / 90);
    ctx.fillText(`${el}`, cx, cy - r - 3);
  }
  // Zenith label
  ctx.fillText('90', cx + 12, cy - 2);

  // Cardinal direction labels outside the dome
  const cardinals = [
    { label: 'N', az: 0 },
    { label: 'E', az: 90 },
    { label: 'S', az: 180 },
    { label: 'W', az: 270 },
  ];

  ctx.font = '13px "JetBrains Mono", monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const { label, az } of cardinals) {
    const pos = polarToCanvas(az, -6, cx, cy, radius); // slightly outside dome
    ctx.fillText(label, pos.x, pos.y);
  }

  // Intercardinal labels (smaller, dimmer)
  const intercardinals = [
    { label: 'NE', az: 45 },
    { label: 'SE', az: 135 },
    { label: 'SW', az: 225 },
    { label: 'NW', az: 315 },
  ];

  ctx.font = '9px "JetBrains Mono", monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.25)';

  for (const { label, az } of intercardinals) {
    const pos = polarToCanvas(az, -6, cx, cy, radius);
    ctx.fillText(label, pos.x, pos.y);
  }

  ctx.restore();
}

/**
 * Compute Greenwich Mean Sidereal Time in degrees.
 */
function gmstDeg(date) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545.0) / 36525.0;
  let gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) +
    0.000387933 * T * T - T * T * T / 38710000;
  gmst = ((gmst % 360) + 360) % 360;
  return gmst;
}

/**
 * Convert RA/Dec (degrees) to Azimuth/Elevation for an observer.
 * @param {number} raDeg - Right ascension in degrees
 * @param {number} decDeg - Declination in degrees
 * @param {number} latDeg - Observer latitude in degrees
 * @param {number} lstDeg - Local sidereal time in degrees
 * @returns {{ az: number, el: number }} azimuth and elevation in degrees
 */
function raDecToAzEl(raDeg, decDeg, latDeg, lstDeg) {
  const ha = ((lstDeg - raDeg) % 360 + 360) % 360;
  const haRad = ha * DEG2RAD;
  const decRad = decDeg * DEG2RAD;
  const latRad = latDeg * DEG2RAD;

  const sinEl = Math.sin(decRad) * Math.sin(latRad) +
    Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
  const el = Math.asin(Math.max(-1, Math.min(1, sinEl)));

  const cosAz = (Math.sin(decRad) - Math.sin(el) * Math.sin(latRad)) /
    (Math.cos(el) * Math.cos(latRad));
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));

  if (Math.sin(haRad) > 0) {
    az = 2 * PI - az;
  }

  return {
    az: az * RAD2DEG,
    el: el * RAD2DEG,
  };
}

/**
 * Draw stars from catalog on the sky dome.
 * Stars are nearly static -- caller should cache results on an offscreen canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx - center x
 * @param {number} cy - center y
 * @param {number} radius - dome radius
 * @param {Array} stars - star catalog entries { ra, dec, mag }
 * @param {number} observerLat - degrees
 * @param {number} observerLon - degrees
 * @param {Date} simTime - current simulation time
 */
export function drawStars(ctx, cx, cy, radius, stars, observerLat, observerLon, simTime) {
  const gmst = gmstDeg(simTime);
  const lst = ((gmst + observerLon) % 360 + 360) % 360;

  ctx.save();

  for (const star of stars) {
    const { az, el } = raDecToAzEl(star.ra, star.dec, observerLat, lst);
    if (el <= 0) continue;

    const pos = polarToCanvas(az, el, cx, cy, radius);

    // Size based on magnitude: brighter (lower mag) = larger
    // Range: mag -1.5 -> radius 2.5px, mag 4.5 -> radius 0.4px
    const starRadius = Math.max(0.4, 2.5 - (star.mag + 1.5) * (2.1 / 6));

    // Alpha based on magnitude: brighter = more opaque
    const alpha = Math.max(0.15, Math.min(0.9, 1.0 - (star.mag + 1.5) * 0.12));

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, starRadius, 0, PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draw satellite dots on the sky dome.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx
 * @param {number} cy
 * @param {number} radius
 * @param {Array} satellites - array of { id, name, azimuth, elevation, color }
 * @param {number|null} highlightedId - hovered satellite id
 * @param {number|null} selectedId - selected (detail panel) satellite id
 */
export function drawSatellites(ctx, cx, cy, radius, satellites, highlightedId, selectedId) {
  ctx.save();
  ctx.font = '10px "JetBrains Mono", monospace';

  for (const sat of satellites) {
    if (sat.elevation <= 0) continue;

    const pos = polarToCanvas(sat.azimuth, sat.elevation, cx, cy, radius);
    const isHighlighted = sat.id === highlightedId;
    const isSelected = sat.id === selectedId;
    const dotRadius = isSelected ? 4.5 : isHighlighted ? 4 : 3;

    // Draw dot
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, dotRadius, 0, PI * 2);
    ctx.fillStyle = sat.color;
    ctx.fill();

    // Glow effect for highlighted/selected
    if (isHighlighted || isSelected) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, dotRadius + 3, 0, PI * 2);
      ctx.strokeStyle = sat.color;
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = 0.4;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Name label for highlighted or selected
    if (isHighlighted || isSelected) {
      const labelX = pos.x + dotRadius + 6;
      const labelY = pos.y - 2;

      // Background for readability
      const textWidth = ctx.measureText(sat.name).width;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(labelX - 2, labelY - 9, textWidth + 4, 13);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(sat.name, labelX, labelY);
    }
  }

  ctx.restore();
}

/**
 * Draw predicted pass arcs as dashed lines.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx
 * @param {number} cy
 * @param {number} radius
 * @param {Array} passes - array of { color, points: [{ azimuth, elevation }] }
 */
export function drawPassArcs(ctx, cx, cy, radius, passes) {
  ctx.save();

  for (const pass of passes) {
    if (!pass.points || pass.points.length < 2) continue;

    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = pass.color || 'rgba(255,255,255,0.5)';
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.2;

    let started = false;
    for (const pt of pass.points) {
      if (pt.elevation <= 0) continue;
      const pos = polarToCanvas(pt.azimuth, pt.elevation, cx, cy, radius);
      if (!started) {
        ctx.moveTo(pos.x, pos.y);
        started = true;
      } else {
        ctx.lineTo(pos.x, pos.y);
      }
    }
    ctx.stroke();

    // Arrowhead at end point
    if (pass.points.length >= 2) {
      const last = pass.points[pass.points.length - 1];
      const prev = pass.points[pass.points.length - 2];
      if (last.elevation > 0 && prev.elevation > 0) {
        const pEnd = polarToCanvas(last.azimuth, last.elevation, cx, cy, radius);
        const pPrev = polarToCanvas(prev.azimuth, prev.elevation, cx, cy, radius);
        const angle = Math.atan2(pEnd.y - pPrev.y, pEnd.x - pPrev.x);
        const arrowLen = 6;

        ctx.beginPath();
        ctx.setLineDash([]);
        ctx.moveTo(pEnd.x, pEnd.y);
        ctx.lineTo(
          pEnd.x - arrowLen * Math.cos(angle - 0.4),
          pEnd.y - arrowLen * Math.sin(angle - 0.4)
        );
        ctx.moveTo(pEnd.x, pEnd.y);
        ctx.lineTo(
          pEnd.x - arrowLen * Math.cos(angle + 0.4),
          pEnd.y - arrowLen * Math.sin(angle + 0.4)
        );
        ctx.stroke();
      }
    }
  }

  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * Hit-test: find satellite at a given canvas coordinate.
 * @param {number} x - mouse x
 * @param {number} y - mouse y
 * @param {Array} satellites - array of { id, azimuth, elevation, ... }
 * @param {number} cx
 * @param {number} cy
 * @param {number} radius
 * @returns {number|null} satellite id or null
 */
export function hitTest(x, y, satellites, cx, cy, radius) {
  const threshold = 8;
  let closest = null;
  let closestDist = threshold + 1;

  for (const sat of satellites) {
    if (sat.elevation <= 0) continue;
    const pos = polarToCanvas(sat.azimuth, sat.elevation, cx, cy, radius);
    const dx = x - pos.x;
    const dy = y - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < closestDist) {
      closestDist = dist;
      closest = sat.id;
    }
  }

  return closestDist <= threshold ? closest : null;
}
