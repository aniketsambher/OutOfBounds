import type { Neighborhood, Place } from '../../shared/types';
import { typeMeta } from '../../shared/game';
import { env } from './env';

export const geminiEnabled = () => Boolean(env.geminiKey);

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

/** Thrown when the server has used up today's Gemini budget (GEMINI_DAILY_LIMIT). */
export class GeminiLimitError extends Error {}

let budgetDay = '';
let budgetUsed = 0;

function takeBudget() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== budgetDay) {
    budgetDay = today;
    budgetUsed = 0;
  }
  if (budgetUsed >= env.geminiDailyLimit) throw new GeminiLimitError('Daily Gemini limit reached');
  budgetUsed += 1;
}

/** Calls the Gemini REST API and parses a JSON reply. */
async function generateJson<T>(parts: Part[]): Promise<T> {
  takeBudget();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.geminiModel)}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': env.geminiKey! },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
      }),
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  return JSON.parse(text) as T;
}

export interface PhotoVerdict {
  match: boolean;
  confidence: number;
  reason: string;
}

/** Checks that a check-in photo plausibly shows the place (or its food). */
export async function verifyPhoto(place: Place, imageBase64: string, mimeType: string): Promise<PhotoVerdict> {
  const prompt = [
    'You verify check-ins for a Boston city-exploration game.',
    `The player says they are at "${place.name}", a ${typeMeta[place.type].label.toLowerCase()} spot. ${place.blurb}`,
    'Look at the photo and decide if it plausibly shows this place, its food, or its surroundings',
    '(for example a bowl of phở for a phở restaurant, the landmark itself, trees and paths for a park).',
    'Be lenient with low light or odd angles. Reject photos that clearly show something unrelated, like a dorm room, a screenshot, or a different kind of place.',
    'Reply with JSON only: {"match": boolean, "confidence": number between 0 and 1, "reason": "under 20 words, friendly"}.',
  ].join(' ');
  const verdict = await generateJson<PhotoVerdict>([{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageBase64 } }]);
  return { match: Boolean(verdict.match), confidence: Number(verdict.confidence) || 0, reason: String(verdict.reason ?? '') };
}

export interface QuestTip {
  neighborhoodId: string;
  title: string;
  pitch: string;
}

/** Suggests which neighborhood to explore next and why, in one friendly line. */
export async function questTip(campusName: string, stamped: Neighborhood[], candidates: Neighborhood[]): Promise<QuestTip> {
  const prompt = [
    `You are a Boston local helping a ${campusName} student leave their campus bubble.`,
    `They have already stamped: ${stamped.map((n) => n.name).join(', ') || 'nothing yet'}.`,
    'Pick ONE neighborhood from this list for their next trip, mixing food with a landmark or park:',
    candidates.map((n) => `${n.id}: ${n.name} (${n.tagline}; ${n.tLine}, ${n.travel})`).join('; '),
    'Reply with JSON only: {"neighborhoodId": one id from the list, "title": "max 6 words", "pitch": "max 30 words, concrete and warm, no emojis"}.',
  ].join(' ');
  const tip = await generateJson<QuestTip>([{ text: prompt }]);
  const valid = candidates.find((n) => n.id === tip.neighborhoodId) ?? candidates[0];
  return { neighborhoodId: valid.id, title: String(tip.title ?? valid.name), pitch: String(tip.pitch ?? valid.tagline) };
}
