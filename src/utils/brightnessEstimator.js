// estimate satellite visual mag (apparent brightness)
// uses standard intrinsic brightness model: typical sat has ~6.0 mag at 1000km range w/ 90deg phase angle
// range scaling follows inverse-square law, rough phase-angle correction for specular reflection geometry
// actual brightness varies by sat shape, orientation, materials, and attitude -- useful for relative comparison only
export function estimateBrightness(rangeKm, phaseAngleDeg = 90) {
  if (rangeKm <= 0) return 99;

  const INTRINSIC_MAG = 6.0; // mag at 1000km, 90deg phase angle
  const REF_RANGE = 1000; // ref range in km

  // range scaling (inverse-square law in mags)
  const rangeMag = INTRINSIC_MAG + 5 * Math.log10(rangeKm / REF_RANGE);

  // phase angle correction: brighter when sun is behind observer (small phase angle)
  // 0deg (full illumination): correction ~-1.7 mag
  // 90deg (half illumination): correction = 0
  // 180deg (backlit): correction ~+infinity (not visible)
  const phaseRad = phaseAngleDeg * (Math.PI / 180);
  const phaseFactor = 1 + Math.cos(phaseRad);
  const correction = phaseFactor > 0
    ? -2.5 * Math.log10(phaseFactor)
    : 10; // effectively invisible when backlit

  return rangeMag + correction;
}
