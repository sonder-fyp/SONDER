/** Limit drawing-buffer pixels while keeping CSS layout and interaction unchanged. */
export function pixelRatioForBudget(
  width: number,
  height: number,
  devicePixelRatio: number,
  maxPixels: number,
  maxRatio: number,
): number {
  const w = Math.max(width, 1), h = Math.max(height, 1);
  const deviceRatio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(deviceRatio, maxRatio, Math.sqrt(maxPixels / (w * h)));
}
