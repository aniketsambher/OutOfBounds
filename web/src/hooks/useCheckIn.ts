import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LatLng } from '../data/types';
import { photoToBase64 } from '../lib/api';
import { CHECK_IN_RADIUS_M, placeById } from '../lib/game';
import { distanceM, formatDistance, getCurrentPosition } from '../lib/geo';
import { canSkipGps, isVisitor, useGame } from '../store/game';

/**
 * Check-in flow shared by every screen: gets GPS (unless demo mode is on and allowed), optionally attaches a
 * photo for Gemini to verify, records the stamp, then opens the stamp screen.
 */
export function useCheckIn() {
  const navigate = useNavigate();
  const checkIn = useGame((s) => s.checkIn);
  // Demo mode only counts when this player is allowed to skip GPS (a server can turn it off for non-team players).
  const demoMode = useGame((s) => s.demoMode && canSkipGps(s));
  // Visitor without GPS: the stamp shows up only for this player.
  const visitor = useGame((s) => s.demoMode && canSkipGps(s) && isVisitor(s));
  const gpsOptional = useGame((s) => canSkipGps(s));
  const photoEnabled = useGame((s) => Boolean(s.server?.gemini && s.token));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(placeId: string, photoFile?: File) {
    setError(null);
    setBusyId(placeId);
    try {
      let pos: LatLng | undefined;
      if (!demoMode) {
        try {
          pos = await getCurrentPosition();
        } catch (e) {
          // Only point to demo mode when this player is actually allowed to use it.
          const hint = gpsOptional ? ' Or turn on demo mode in Profile to check in without GPS.' : '';
          setError(`${e instanceof Error ? e.message : "Couldn't get your location."}${hint}`);
          return;
        }
        const d = distanceM(pos, placeById[placeId].pos);
        if (d > CHECK_IN_RADIUS_M) {
          setError(`You're ${formatDistance(d)} away. Get within ${CHECK_IN_RADIUS_M} m to check in.`);
          return;
        }
      }
      const photo = photoFile ? await photoToBase64(photoFile) : undefined;
      const result = await checkIn(placeId, { pos, photo });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      navigate(`/stamp/${encodeURIComponent(result.checkIn.id)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Check-in failed. Try again.');
    } finally {
      setBusyId(null);
    }
  }

  return { run, busyId, error, clearError: () => setError(null), demoMode, visitor, photoEnabled };
}
