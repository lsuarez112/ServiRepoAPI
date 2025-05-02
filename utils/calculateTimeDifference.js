/**
 * Calculates time difference between two Date objects.
 * @param {Date} start - The start time.
 * @param {Date} end - The end time.
 * @returns {Object} - { decimal, hms }
 */
export function calculateTimeDifference(start, end) {
  const diffMs = end - start;
  const totalSeconds = diffMs / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const decimal = totalSeconds / 3600;
  const hms = `${hours}:${String(minutes).padStart(2, '0')}:${String(
    seconds
  ).padStart(2, '0')}`;
  return { decimal, hms };
}
