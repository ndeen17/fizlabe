export type LimitStatus = 'On Track' | 'Warning' | 'Exceeded';

/**
 * Map a usage percentage (0..n) to a status label.
 * Thresholds:
 *   < 80          -> On Track
 *   >= 80 && <=100 -> Warning
 *   > 100         -> Exceeded
 */
export function computeStatus(percentage: number): LimitStatus {
  if (!Number.isFinite(percentage) || percentage < 80) return 'On Track';
  if (percentage <= 100) return 'Warning';
  return 'Exceeded';
}
