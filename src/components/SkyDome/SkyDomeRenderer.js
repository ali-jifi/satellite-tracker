// canvas 2D drawing fns for sky dome, polar azimuthal projection (az/el -> x/y)

const PI = Math.PI;
const DEG2RAD = PI / 180;
const RAD2DEG = 180 / PI;

// az/el -> canvas x/y polar projection; zenith=center, horizon=edge, north=up
export function polarToCanvas(azDeg, elDeg, cx, cy, radius) {
  const r = radius * (1 - elDeg / 90);
  const azRad = (azDeg - 90) * DEG2RAD; // rotate so north is up
  return {
    x: cx + r * Math.cos(azRad),
    y: cy + r * Math.sin(azRad),
  };
}

// draw dark sky gradient bg
export function drawBackground(ctx, width, height, cx, cy, radius) {
  // fill canvas black
  ctx.fillStyle = '#050510';
  ctx.fillRect(0, 0, width, height);

  // radial gradient for dome circle
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grad.addColorStop(0, '#0a0a1a');   // zenith
  grad.addColorStop(0.7, '#0f0f28'); // mid
  grad.addColorStop(1, '#1a1a3a');   // horizon
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, PI * 2);
  ctx.fill();
}

// draw elevation rings and cardinal labels
export function drawGrid(ctx, cx, cy, radius) {
  ctx.save();

  // elevation rings at 30, 60 deg (90=zenith, no ring needed)
  const elevations = [30, 60];
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 0.5;

  for (const el of elevations) {
    const r = radius * (1 - el / 90);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, PI * 2);
    ctx.stroke();
  }

  // horizon ring (el=0) slightly brighter
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, PI * 2);
  ctx.stroke();

  // crosshair lines (N-S, E-W) very faint
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 0.5;
  // n-s line
  ctx.beginPath();
  ctx.moveTo(cx, cy - radius);
  ctx.lineTo(cx, cy + radius);
  ctx.stroke();
  // e-w line
  ctx.beginPath();
  ctx.moveTo(cx - radius, cy);
  ctx.lineTo(cx + radius, cy);
  ctx.stroke();

  // elevation deg labels on north axis
  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  for (const el of [30, 60]) {
    const r = radius * (1 - el / 90);
    ctx.fillText(`${el}`, cx, cy - r - 3);
  }
  // zenith label
  ctx.fillText('90', cx + 12, cy - 2);

  // cardinal labels outside dome
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
    const pos = polarToCanvas(az, -6, cx, cy, radius); // slightly outside
    ctx.fillText(label, pos.x, pos.y);
  }

  // intercardinal labels (smaller, dimmer)
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

// compute GMST in degrees
function gmstDeg(date) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545.0) / 36525.0;
  let gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) +
    0.000387933 * T * T - T * T * T / 38710000;
  gmst = ((gmst % 360) + 360) % 360;
  return gmst;
}

// convert RA/Dec (deg) to az/el for observer
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

// draw stars on dome; nearly static, caller should cache on offscreen canvas
export function drawStars(ctx, cx, cy, radius, stars, observerLat, observerLon, simTime) {
  const gmst = gmstDeg(simTime);
  const lst = ((gmst + observerLon) % 360 + 360) % 360;

  ctx.save();

  for (const star of stars) {
    const { az, el } = raDecToAzEl(star.ra, star.dec, observerLat, lst);
    if (el <= 0) continue;

    const pos = polarToCanvas(az, el, cx, cy, radius);

    // size from mag: brighter=larger, range mag -1.5->2.5px to 4.5->0.4px
    const starRadius = Math.max(0.4, 2.5 - (star.mag + 1.5) * (2.1 / 6));

    // alpha from mag: brighter=more opaque
    const alpha = Math.max(0.15, Math.min(0.9, 1.0 - (star.mag + 1.5) * 0.12));

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, starRadius, 0, PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.fill();
  }

  ctx.restore();
}

// draw satellite dots on dome
export function drawSatellites(ctx, cx, cy, radius, satellites, highlightedId, selectedId) {
  ctx.save();
  ctx.font = '10px "JetBrains Mono", monospace';

  for (const sat of satellites) {
    if (sat.elevation <= 0) continue;

    const pos = polarToCanvas(sat.azimuth, sat.elevation, cx, cy, radius);
    const isHighlighted = sat.id === highlightedId;
    const isSelected = sat.id === selectedId;
    const dotRadius = isSelected ? 4.5 : isHighlighted ? 4 : 3;

    // dot
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, dotRadius, 0, PI * 2);
    ctx.fillStyle = sat.color;
    ctx.fill();

    // glow for highlighted/selected
    if (isHighlighted || isSelected) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, dotRadius + 3, 0, PI * 2);
      ctx.strokeStyle = sat.color;
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = 0.4;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // name label for highlighted/selected
    if (isHighlighted || isSelected) {
      const labelX = pos.x + dotRadius + 6;
      const labelY = pos.y - 2;

      // bg for readability
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

// draw predicted pass arcs as dashed lines
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

    // arrowhead at end
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

// hit-test: find sat at canvas coord, returns id or null
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
