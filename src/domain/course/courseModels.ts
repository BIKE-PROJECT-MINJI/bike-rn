export type CourseCardUiModel = {
  readonly id: number;
  readonly title: string;
  readonly distanceKm: number;
  readonly estimatedDurationMin: number;
  readonly difficulty: CourseDifficultyUiModel | null;
  readonly featuredRank: number | null;
  readonly isRecorded: boolean;
};

export type CourseDifficultyUiModel = {
  readonly level: string;
  readonly label: string;
  readonly score: number;
  readonly summary: string;
};

export type CoursesPageUiModel = {
  readonly items: readonly CourseCardUiModel[];
  readonly hasNext: boolean;
  readonly nextCursor: string | null;
};

export type CourseRoutePointUiModel = {
  readonly pointOrder: number;
  readonly latitude: number;
  readonly longitude: number;
};
