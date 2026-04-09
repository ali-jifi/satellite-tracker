/**
 * Estimate satellite visual magnitude (apparent brightness).
 *
 * Uses a standard intrinsic brightness model: a typical satellite has an
 * intrinsic magnitude of ~6.0 at 1000 km range with a 90-degree phase angle.
 * Range scaling follows the inverse-square law, and a rough phase-angle
 * correction accounts for specular reflection geometry.
 *
 * NOTE: Actual brightness varies greatly by satellite shape, orientation,
 * materials, and attitude. This estimate is useful for relative comparison
 * but should not be taken as precise.
 *
 * @param {number} rangeKm - Observer-to-satellite slant range in km
 * @param {number} [phaseAngleDeg=90] - Sun-satellite-observer angle in degrees
 * @returns {number} Estimated apparent visual magnitude (lower = brighter)
 */
export function estimateBrightness(rangeKm, phaseAngleDeg = 90) {
  if (rangeKm <= 0) return 99;

  const INTRINSIC_MAG = 6.0; // magnitude at 1000 km, 90-deg phase angle
  const REF_RANGE = 1000; // reference range in km

  // Range scaling (inverse-square law in magnitudes)
  const rangeMag = INTRINSIC_MAG + 5 * Math.log10(rangeKm / REF_RANGE);

  // Phase angle correction: brighter when Sun is behind observer (small phase angle)
  // At 0 deg (full illumination): correction ~ -1.7 mag
  // At 90 deg (half illumination): correction = 0
  // At 180 deg (backlit): correction ~ +infinity (not visible)
  const phaseRad = phaseAngleDeg * (Math.PI / 180);
  const phaseFactor = 1 + Math.cos(phaseRad);
  const correction = phaseFactor > 0
    ? -2.5 * Math.log10(phaseFactor)
    : 10; // effectively invisible when backlit

  return rangeMag + correction;
}
