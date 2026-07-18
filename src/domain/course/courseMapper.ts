import { z } from 'zod';
import type { CourseCardUiModel, CourseRoutePointUiModel, CoursesPageUiModel } from './courseModels';

const apiResponseSchema = z.object({
  status: z.number().optional(),
  message: z.string().optional(),
  data: z.unknown().optional(),
});

const courseItemSchema = z.object({
  id: z.coerce.number().default(0),
  title: z.string().optional().default(''),
  distanceKm: z.coerce.number().optional().default(0),
  estimatedDurationMin: z.coerce.number().optional().default(0),
  difficulty: z
    .object({
      level: z.string().optional().default('UNKNOWN'),
      label: z.string().optional().default('난이도 미정'),
      score: z.coerce.number().optional().default(0),
      summary: z.string().optional().default(''),
    })
    .nullable()
    .optional(),
  featuredRank: z.coerce.number().nullable().optional(),
  recorded: z.boolean().optional().default(false),
});

const courseListDataSchema = z.object({
  items: z.array(courseItemSchema).optional().default([]),
  hasNext: z.boolean().optional().default(false),
  nextCursor: z.string().nullable().optional(),
});

const routePointSchema = z.object({
  pointOrder: z.number().int().positive(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const courseRoutePointsDataSchema = z.object({
  points: z.array(routePointSchema).optional().default([]),
}).superRefine((value, context) => {
  const orders = new Set<number>();
  for (const point of value.points) {
    if (orders.has(point.pointOrder)) {
      context.addIssue({ code: 'custom', message: 'route point 순번은 중복될 수 없습니다.' });
      return;
    }
    orders.add(point.pointOrder);
  }
});

export function mapCourseList(payload: unknown): CoursesPageUiModel {
  const root = apiResponseSchema.parse(payload);
  const data = courseListDataSchema.parse(root.data ?? {});
  return {
    items: data.items.map(mapCourseItem),
    hasNext: data.hasNext,
    nextCursor: data.nextCursor && data.nextCursor !== 'null' ? data.nextCursor : null,
  };
}

export function mapCourseDetail(payload: unknown): CourseCardUiModel {
  const root = apiResponseSchema.parse(payload);
  return mapCourseItem(courseItemSchema.parse(root.data ?? {}));
}

export function mapCourseRoutePoints(payload: unknown): readonly CourseRoutePointUiModel[] {
  const root = apiResponseSchema.parse(payload);
  const data = courseRoutePointsDataSchema.parse(root.data ?? {});
  return data.points
    .map((point) => ({
      pointOrder: point.pointOrder,
      latitude: point.latitude,
      longitude: point.longitude,
    }))
    .sort((left, right) => left.pointOrder - right.pointOrder);
}

export function mergeRecordedCourses(items: CourseCardUiModel[], recordedCourseIds: number[]): CourseCardUiModel[] {
  const recordedIds = new Set(recordedCourseIds);
  return items.map((item) => (recordedIds.has(item.id) ? { ...item, isRecorded: true } : item));
}

function mapCourseItem(item: z.infer<typeof courseItemSchema>): CourseCardUiModel {
  return {
    id: item.id,
    title: item.title,
    distanceKm: item.distanceKm,
    estimatedDurationMin: item.estimatedDurationMin,
    difficulty: item.difficulty ?? null,
    featuredRank: item.featuredRank ?? null,
    isRecorded: item.recorded,
  };
}
