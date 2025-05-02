/**
 * Builds a Google Maps link.
 * @param {string} lat1
 * @param {string} lon1
 * @param {string} [lat2]
 * @param {string} [lon2]
 * @returns {string} - The Google Maps URL.
 */
export function buildGoogleMapsLink(lat1, lon1, lat2 = null, lon2 = null) {
  if (!lat2 || !lon2) {
    return `https://www.google.com/maps?q=${lat1},${lon1}`;
  }
  return `https://www.google.com/maps/dir/${lat1},${lon1}/${lat2},${lon2}`;
}
