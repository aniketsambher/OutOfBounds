import type { LatLng } from '../data/types';

export { distanceM, formatDistance, formatMiles } from '../../../shared/geo';

/** Resolves the browser's current position, or rejects with a readable message. */
export function getCurrentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error("This browser can't share your location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve([p.coords.latitude, p.coords.longitude]),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? 'Location permission was denied. Turn on demo mode in Profile to check in without GPS.'
              : "Couldn't get your location. Try again outside, or use demo mode.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  });
}
