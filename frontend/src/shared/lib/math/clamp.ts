/** Ограничивает число диапазоном от min до max включительно. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}
