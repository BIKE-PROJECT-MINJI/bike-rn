import { z } from 'zod';

const envelopeSchema = z.object({ data: z.unknown().optional() }).passthrough();
const courseListDataSchema = z.object({
  items: z.array(z.object({ id: z.coerce.number() }).passthrough()).optional().default([]),
}).passthrough();

export function extractFirstCourseId(payload: unknown): number | null {
  const data = extractData(payload);
  const parsed = courseListDataSchema.safeParse(data);
  return parsed.success ? parsed.data.items[0]?.id ?? null : null;
}

export function extractRideRecordId(payload: unknown): number | null {
  return extractNumberField(payload, 'rideRecordId');
}

export function extractCourseId(payload: unknown): number | null {
  return extractNumberField(payload, 'courseId');
}

export function extractPartyId(payload: unknown): number | null {
  return extractNumberField(payload, 'id');
}

export function extractAiSessionId(payload: unknown): number | null {
  return extractNumberField(payload, 'sessionId');
}

export function extractAiCandidateId(payload: unknown): number | null {
  const data = extractData(payload);
  if (!isRecord(data) || !Array.isArray(data.candidates)) {
    return null;
  }
  const first = data.candidates[0];
  if (!isRecord(first)) {
    return null;
  }
  return typeof first.candidateId === 'number' ? first.candidateId : null;
}

export function normalizeNumber(value: string, fallback: number): number {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function extractData(payload: unknown): unknown {
  const root = envelopeSchema.safeParse(payload);
  return root.success ? root.data.data : null;
}

function extractNumberField(payload: unknown, fieldName: string): number | null {
  const data = extractData(payload);
  if (!isRecord(data)) {
    return null;
  }
  const value = data[fieldName];
  return typeof value === 'number' ? value : null;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}
