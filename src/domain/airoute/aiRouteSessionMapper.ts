import { z } from 'zod';
import type { AiRoutePromoteResult, AiRouteSessionUiModel } from './aiRouteSessionModels';

const pointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  label: z.string().optional().default('경유지'),
});

const scoreBreakdownSchema = z.object({
  total: z.number().int(),
  scenery: z.number().int(),
  bikePath: z.number().int(),
  safety: z.number().int(),
  condition: z.number().int(),
  elevation: z.number().int(),
  preferenceFit: z.number().int(),
  distancePenalty: z.number().int(),
  unknownPenalty: z.number().int(),
});

const evidenceBadgeSchema = z.object({
  source: z.string().min(1),
  label: z.string().min(1),
  status: z.string().min(1),
  severity: z.string().min(1),
  summary: z.string().min(1),
});

const routingMetadataSchema = z.object({
  provider: z.string().min(1),
  fallbackUsed: z.boolean(),
}).passthrough();

const candidateSchema = z.object({
  candidateId: z.number().int().positive(),
  title: z.string().min(1),
  summary: z.string().optional().default('조건을 반영한 경로입니다.'),
  distanceKm: z.number().nonnegative(),
  estimatedDurationMin: z.number().int().nonnegative(),
  recommendationScore: z.number().int().min(0).max(100),
  scoreBreakdown: scoreBreakdownSchema.nullable().optional().default(null),
  evidenceBadges: z.array(evidenceBadgeSchema).optional().default([]),
  elevationSummary: z.object({ totalAscentM: z.number().nonnegative().nullable().optional() }).nullable().optional(),
  routingMetadata: routingMetadataSchema.nullable().optional().default(null),
  preferenceSummary: z.string().nullable().optional().default(null),
  elevationStatus: z.string().nullable().optional().default(null),
  sceneryEvidenceStatus: z.string().nullable().optional().default(null),
  routePoints: z.array(pointSchema).min(2),
  routePointCount: z.number().int().positive(),
  promotedCourseId: z.number().int().positive().nullable(),
});

const sessionSchema = z.object({
  data: z.object({
    sessionId: z.number().int().positive(),
    status: z.enum(['READY', 'PARTIAL', 'FALLBACK_READY']),
    fallbackUsed: z.boolean(),
    provider: z.string(),
    fallbackReason: z.string().nullable(),
    candidates: z.array(candidateSchema).min(1).max(3),
  }),
});

const promoteSchema = z.object({
  data: z.object({
    courseId: z.number().int().positive(),
    routePointCount: z.number().int().positive(),
  }),
});

export function mapAiRouteSession(payload: unknown): AiRouteSessionUiModel {
  const session = sessionSchema.parse(payload).data;
  return {
    ...session,
    candidates: session.candidates.map((candidate) => ({
      ...candidate,
      totalAscentM: candidate.elevationSummary?.totalAscentM ?? null,
      routingProvider: candidate.routingMetadata?.provider ?? null,
      routingFallbackUsed: candidate.routingMetadata?.fallbackUsed ?? false,
    })),
  };
}

export function mapAiRoutePromoteResult(payload: unknown): AiRoutePromoteResult {
  return promoteSchema.parse(payload).data;
}
