import { apiRequest } from '../../shared/api/apiClient';
import { mapCourseDetail, mapCourseList, mapCourseRoutePoints } from './courseMapper';
import type { CourseCardUiModel, CourseRoutePointUiModel, CoursesPageUiModel } from './courseModels';

export async function fetchFeaturedCourses(): Promise<CourseCardUiModel[]> {
  const payload = await apiRequest<unknown>('/api/v1/courses/featured');
  const root = payload as { data?: { courses?: unknown[] } };
  return (root.data?.courses ?? []).map((course) => mapCourseDetail({ data: course }));
}

export async function fetchCourses(limit = 20): Promise<CoursesPageUiModel> {
  const payload = await apiRequest<unknown>(`/api/v1/courses?limit=${limit}`);
  return mapCourseList(payload);
}

export async function fetchCourseDetail(courseId: number): Promise<CourseCardUiModel> {
  const payload = await apiRequest<unknown>(`/api/v1/courses/${courseId}`);
  return mapCourseDetail(payload);
}

export async function fetchCourseRoutePoints(courseId: number): Promise<readonly CourseRoutePointUiModel[]> {
  const payload = await apiRequest<unknown>(`/api/v1/courses/${courseId}/route-points`);
  return mapCourseRoutePoints(payload);
}
