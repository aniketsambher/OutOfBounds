import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LatLng } from '../data/types';
import { photoToBase64 } from '../lib/api';
import { CHECK_IN_RADIUS_M, placeById } from '../lib/game';
import { distanceM, formatDistance, getCurrentPosition } from '../lib/geo';
import { useGame } from '../store/game';

/**
 * Check-in flow shared by every screen: gets GPS (unless demo mode is on), optionally attaches a
 * photo for Gemini to verify, records the stamp, then opens the stamp screen.
 */
export function useCheckIn() {
  const navigate = useNavigate();
  const checkIn = useGame((s) => s.checkIn);
  const demoMode = useGame((s) => s.demoMode);
  const photoEnabled = useGame((s) => Boolean(s.server?.gemini && s.token));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(placeId: string, photoFile?: File) {
    setError(null);
    setBusyId(placeId);
    try {
      let pos: LatLng | undefined;
      if (!demoMode) {
        pos = await getCurrentPosition();
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

  return { run, busyId, error, clearError: () => setError(null), demoMode, photoEnabled };
}
