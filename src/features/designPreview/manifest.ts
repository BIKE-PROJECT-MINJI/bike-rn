export type ScreenKey =
  | "login"
  | "signup"
  | "password-recovery"
  | "onboarding"
  | "location-permission"
  | "notification-permission"
  | "home"
  | "courses"
  | "course-detail"
  | "saved-courses-empty"
  | "pre-ride"
  | "free-ride"
  | "ai-route-create"
  | "records"
  | "record-detail"
  | "records-empty"
  | "party-list"
  | "party-detail"
  | "party-disconnected"
  | "profile"
  | "settings"
  | "offline"
  | "force-update"
  | "error-recovery";

export type StateKey =
  | "default"
  | "empty"
  | "loading"
  | "permission"
  | "disconnected"
  | "finalizing"
  | "error"
  | "update-required";
export type StyleId = "atlas" | "signal" | "calm" | "studio" | "night-ride";
export type ViewportId = "phone" | "tablet";

export type ScreenGroup =
  | "auth"
  | "home"
  | "courses"
  | "ride"
  | "records"
  | "party"
  | "profile"
  | "system";
export type LayoutFamily =
  | "sidebar-ledger"
  | "action-rail"
  | "quiet-flow"
  | "editorial-split"
  | "map-cockpit";
export type ScreenFixture = {
  key: ScreenKey;
  group: ScreenGroup;
  label: string;
  state: StateKey;
  allowedStates: StateKey[];
  eyebrow: string;
  title: string;
  body: string;
  action: string;
  icon: string;
};
export type StyleSystem = {
  id: StyleId;
  name: string;
  mood: string;
  layoutFamily: LayoutFamily;
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  accentInk: string;
  map: string;
  radius: number;
  screen: number;
  card: number;
  title: number;
  body: number;
  lineHeight: number;
  buttonHeight: number;
  icon: number;
  dark: boolean;
};

export const VIEWPORTS: Record<
  ViewportId,
  { width: number; height: number; label: string }
> = {
  phone: { width: 390, height: 844, label: "휴대폰 390 × 844" },
  tablet: { width: 834, height: 1194, label: "태블릿 834 × 1194" },
};

export const STYLES: StyleSystem[] = [
  {
    id: "atlas",
    name: "Atlas",
    mood: "정보 중심의 도시 라이딩",
    layoutFamily: "sidebar-ledger",
    bg: "#F4F3EF",
    surface: "#FFFFFF",
    ink: "#172028",
    muted: "#626E79",
    line: "#DCE0E3",
    accent: "#006E5A",
    accentInk: "#FFFFFF",
    map: "#DDE9DF",
    radius: 12,
    screen: 20,
    card: 16,
    title: 28,
    body: 15,
    lineHeight: 22,
    buttonHeight: 52,
    icon: 22,
    dark: false,
  },
  {
    id: "signal",
    name: "Signal",
    mood: "행동 우선의 선명한 경로",
    layoutFamily: "action-rail",
    bg: "#FFF8F0",
    surface: "#FFFFFF",
    ink: "#201A16",
    muted: "#6D5A4E",
    line: "#E8DCCF",
    accent: "#A92D12",
    accentInk: "#FFFFFF",
    map: "#F6DFC9",
    radius: 6,
    screen: 24,
    card: 18,
    title: 30,
    body: 15,
    lineHeight: 23,
    buttonHeight: 56,
    icon: 24,
    dark: false,
  },
  {
    id: "calm",
    name: "Calm",
    mood: "여백으로 읽는 일상 기록",
    layoutFamily: "quiet-flow",
    bg: "#F4F8F7",
    surface: "#FCFEFD",
    ink: "#1C2A2A",
    muted: "#5F706D",
    line: "#D9E6E2",
    accent: "#367B73",
    accentInk: "#FFFFFF",
    map: "#D9ECE8",
    radius: 20,
    screen: 24,
    card: 20,
    title: 27,
    body: 15,
    lineHeight: 24,
    buttonHeight: 50,
    icon: 21,
    dark: false,
  },
  {
    id: "studio",
    name: "Studio",
    mood: "편집 화면처럼 정돈된 비교",
    layoutFamily: "editorial-split",
    bg: "#F7F7FA",
    surface: "#FFFFFF",
    ink: "#1D1B25",
    muted: "#6C6A75",
    line: "#DEDEE6",
    accent: "#4B46B8",
    accentInk: "#FFFFFF",
    map: "#E3E5F5",
    radius: 2,
    screen: 28,
    card: 16,
    title: 29,
    body: 14,
    lineHeight: 21,
    buttonHeight: 48,
    icon: 20,
    dark: false,
  },
  {
    id: "night-ride",
    name: "Night Ride",
    mood: "야간 주행을 위한 높은 대비",
    layoutFamily: "map-cockpit",
    bg: "#11161B",
    surface: "#1A232B",
    ink: "#F3F7FA",
    muted: "#AAB7C2",
    line: "#2F3C46",
    accent: "#B8F34B",
    accentInk: "#16200B",
    map: "#263A42",
    radius: 10,
    screen: 20,
    card: 16,
    title: 29,
    body: 15,
    lineHeight: 23,
    buttonHeight: 54,
    icon: 23,
    dark: true,
  },
];

export const SCREEN_FIXTURES: ScreenFixture[] = [
  [
    "login",
    "로그인",
    "default",
    "BIKE 시작하기",
    "오늘의 주행을 이어가세요",
    "이메일로 계속하거나 기존 계정으로 로그인할 수 있어요.",
    "이메일로 로그인",
    "log-in",
  ],
  [
    "signup",
    "회원가입",
    "default",
    "계정 만들기",
    "주행 기록을 안전하게 보관",
    "이름과 이메일을 입력하면 바로 시작할 수 있어요.",
    "가입 계속하기",
    "person-add",
  ],
  [
    "password-recovery",
    "비밀번호 복구",
    "default",
    "로그인 도움",
    "재설정 링크를 보낼게요",
    "가입한 이메일을 확인한 뒤 새 비밀번호를 설정합니다.",
    "재설정 링크 보내기",
    "key",
  ],
  [
    "onboarding",
    "온보딩",
    "default",
    "1 / 3",
    "내 페이스로, 더 멀리",
    "코스와 기록을 한 곳에서 보고 다음 라이딩을 준비하세요.",
    "다음",
    "bicycle",
  ],
  [
    "location-permission",
    "위치 권한",
    "permission",
    "주행 준비",
    "위치 접근을 허용해 주세요",
    "현재 위치는 코스 안내와 주행 기록에만 사용됩니다.",
    "위치 권한 허용",
    "location",
  ],
  [
    "notification-permission",
    "알림 권한",
    "permission",
    "놓치지 않기",
    "저장 완료를 알려드릴게요",
    "후처리가 끝나면 기록이 준비되었다고 알려드립니다.",
    "알림 허용",
    "notifications",
  ],
  [
    "home",
    "홈",
    "default",
    "화요일, 7월 22일",
    "지금 어디로 달릴까요?",
    "북악산 방향은 맑고, 바람은 약해요.",
    "자유주행 시작",
    "navigate",
  ],
  [
    "courses",
    "코스 목록",
    "default",
    "코스 탐색",
    "오늘 달리기 좋은 코스",
    "거리와 예상 시간을 비교해 나에게 맞는 코스를 고르세요.",
    "북악 스카이라인 18.4km",
    "map",
  ],
  [
    "course-detail",
    "코스 상세",
    "default",
    "추천 코스",
    "북악 스카이라인",
    "18.4km · 예상 1시간 24분 · 오르막 312m",
    "출발 확인",
    "flag",
  ],
  [
    "saved-courses-empty",
    "저장 코스 빈 상태",
    "empty",
    "저장한 코스",
    "아직 저장한 코스가 없어요",
    "마음에 드는 코스를 저장하면 다음 주행을 빠르게 준비할 수 있어요.",
    "코스 둘러보기",
    "bookmark",
  ],
  [
    "pre-ride",
    "주행 전",
    "default",
    "출발 전 확인",
    "북악 스카이라인",
    "GPS 신호 양호 · 배터리 84% · 날씨 24°",
    "코스 따라가기",
    "play",
  ],
  [
    "free-ride",
    "자유 주행",
    "default",
    "00:18:42",
    "12.6 km/h",
    "기록 중 · 위치 정확도 양호",
    "일시정지",
    "pause",
  ],
  [
    "ai-route-create",
    "AI 경로 생성",
    "default",
    "AI 코스 만들기",
    "오늘의 목적지를 알려주세요",
    "예: 한강을 지나 조용한 길로 1시간 정도 달리고 싶어요.",
    "코스 제안 받기",
    "sparkles",
  ],
  [
    "records",
    "기록 목록",
    "finalizing",
    "내 기록",
    "지난 라이딩을 다시 보기",
    "7월 20일 한강 라이딩은 경로를 보정하고 있어요.",
    "기록 상세 보기",
    "stats-chart",
  ],
  [
    "record-detail",
    "기록 상세",
    "default",
    "2026년 7월 19일",
    "한강 저녁 라이딩",
    "24.8km · 1시간 42분 · 평균 14.5km/h",
    "코스로 저장",
    "analytics",
  ],
  [
    "records-empty",
    "기록 빈 상태",
    "empty",
    "내 기록",
    "첫 라이딩을 기록해 보세요",
    "주행을 시작하면 거리와 시간, 경로를 여기서 다시 볼 수 있어요.",
    "자유주행 시작",
    "bicycle",
  ],
  [
    "party-list",
    "파티 목록",
    "default",
    "함께 달리기",
    "이번 주말의 라이딩",
    "참여 전에는 위치가 공유되지 않아요.",
    "성수 야간 3명",
    "people",
  ],
  [
    "party-detail",
    "파티 상세",
    "default",
    "토요일 19:30",
    "성수 야간 라이딩",
    "8.2km · 성수역 3번 출구 · 현재 3명 참여",
    "참여하기",
    "people-circle",
  ],
  [
    "party-disconnected",
    "파티 연결 끊김",
    "disconnected",
    "연결 상태",
    "실시간 위치 연결이 끊겼어요",
    "주행은 계속할 수 있고, 네트워크가 돌아오면 다시 확인합니다.",
    "다시 확인",
    "wifi",
  ],
  [
    "profile",
    "프로필",
    "default",
    "김민지",
    "이번 달 6회 주행",
    "총 124.6km · 가장 긴 주행 31.2km",
    "활동 요약 보기",
    "person",
  ],
  [
    "settings",
    "설정",
    "default",
    "설정",
    "주행과 알림 관리",
    "권한, 계정, 저장공간 상태를 한곳에서 확인합니다.",
    "알림 설정",
    "settings",
  ],
  [
    "offline",
    "오프라인",
    "error",
    "네트워크 없음",
    "인터넷 연결을 확인해 주세요",
    "기기에 있는 주행 기록은 안전하게 보관 중입니다.",
    "다시 시도",
    "cloud-offline",
  ],
  [
    "force-update",
    "강제 업데이트",
    "update-required",
    "새 버전 필요",
    "안전한 기록 복구를 위해 업데이트해 주세요",
    "기존 주행 기록을 지우지 않고 다음 단계에서 다시 이어갑니다.",
    "업데이트 확인",
    "download",
  ],
  [
    "error-recovery",
    "일반 오류 복구",
    "error",
    "문제를 확인 중이에요",
    "요청을 완료하지 못했어요",
    "입력과 연결 상태를 확인한 뒤 다시 시도해 주세요.",
    "다시 시도",
    "refresh",
  ],
].map(
  ([key, label, state, eyebrow, title, body, action, icon]) =>
    ({
      key,
      group: screenGroupFor(key as ScreenKey),
      label,
      state,
      allowedStates: stateVariantsFor(key as ScreenKey, state as StateKey),
      eyebrow,
      title,
      body,
      action,
      icon,
    }) as ScreenFixture,
);

export function screenGroupFor(key: ScreenKey): ScreenGroup {
  if (
    [
      "login",
      "signup",
      "password-recovery",
      "onboarding",
      "location-permission",
      "notification-permission",
    ].includes(key)
  )
    return "auth";
  if (key === "home") return "home";
  if (
    [
      "courses",
      "course-detail",
      "saved-courses-empty",
      "ai-route-create",
    ].includes(key)
  )
    return "courses";
  if (["pre-ride", "free-ride"].includes(key)) return "ride";
  if (["records", "record-detail", "records-empty"].includes(key))
    return "records";
  if (["party-list", "party-detail", "party-disconnected"].includes(key))
    return "party";
  if (["profile", "settings"].includes(key)) return "profile";
  return "system";
}

export function stateVariantsFor(
  key: ScreenKey,
  canonical: StateKey,
): StateKey[] {
  if (
    [
      "home",
      "courses",
      "course-detail",
      "ai-route-create",
      "records",
      "record-detail",
      "party-list",
      "party-detail",
      "profile",
      "settings",
    ].includes(key)
  )
    return [...new Set<StateKey>([canonical, "loading", "error"])];
  if (["saved-courses-empty", "records-empty"].includes(key))
    return [...new Set<StateKey>([canonical, "loading"])];
  if (["pre-ride", "free-ride"].includes(key))
    return [...new Set<StateKey>([canonical, "loading", "error"])];
  if (key === "party-disconnected") return ["disconnected", "loading"];
  if (["offline", "force-update", "error-recovery"].includes(key))
    return [...new Set<StateKey>([canonical, "loading"])];
  return [canonical];
}

export const SCREEN_RENDERERS: Record<ScreenGroup, string> = {
  auth: "AuthPresentation",
  home: "HomePresentation",
  courses: "CoursePresentation",
  ride: "RidePresentation",
  records: "RecordsPresentation",
  party: "PartyPresentation",
  profile: "ProfilePresentation",
  system: "SystemPresentation",
};
export const STYLE_COMPOSITIONS: Record<StyleId, string> = {
  atlas: "brief-map-list-action",
  signal: "action-list-map",
  calm: "list-action-map",
  studio: "editorial-detail-map",
  "night-ride": "map-metric-action",
};
export const TABLET_CANVAS_HEIGHT = 1194;
export const INTERACTION_CONTRACT = {
  input: "TextInput",
  action: "Pressable",
  row: "Pressable",
  tab: "Pressable",
  minTarget: 48,
};
export const TAB_BY_GROUP: Record<ScreenGroup, number | null> = {
  auth: null,
  home: 0,
  courses: 1,
  ride: null,
  records: 2,
  party: 3,
  profile: 4,
  system: null,
};
export const ERROR_RECOVERY: Record<
  ScreenGroup,
  { title: string; body: string; action: string }
> = {
  auth: {
    title: "로그인을 완료하지 못했어요",
    body: "이메일과 네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
    action: "다시 시도",
  },
  home: {
    title: "홈 정보를 불러오지 못했어요",
    body: "저장된 주행 기록은 그대로 유지됩니다.",
    action: "다시 시도",
  },
  courses: {
    title: "코스를 불러오지 못했어요",
    body: "목록을 새로 고치거나 이전 화면으로 돌아갈 수 있어요.",
    action: "다시 시도",
  },
  ride: {
    title: "주행 정보를 확인하지 못했어요",
    body: "기록은 기기에 보관되며 안전하게 나갈 수 있어요.",
    action: "주행 나가기",
  },
  records: {
    title: "기록을 불러오지 못했어요",
    body: "원본 기록을 삭제하지 않고 다시 확인할 수 있어요.",
    action: "다시 시도",
  },
  party: {
    title: "파티 정보를 불러오지 못했어요",
    body: "위치 공유는 시작되지 않았습니다.",
    action: "파티 목록으로",
  },
  profile: {
    title: "프로필을 불러오지 못했어요",
    body: "계정 설정은 변경되지 않았습니다.",
    action: "다시 시도",
  },
  system: {
    title: "복구가 필요해요",
    body: "기록을 지우지 않고 안전한 다음 단계를 안내합니다.",
    action: "나가기",
  },
};
export const DOMAIN_FIXTURES = {
  courses: ["북악 스카이라인 · 18.4km", "한강 노을길 · 12.1km"],
  records: ["한강 저녁 라이딩 · 24.8km", "북악 오르막 · 16.2km"],
  parties: ["성수 야간 · 오늘 19:30", "한강 아침 · 토요일 07:00"],
  settings: ["알림과 권한", "주행 기록 저장공간", "계정 및 로그인"],
  profile: ["내 활동", "저장한 코스", "계정 설정"],
} as const;
export const LOADING_AREAS = [
  "auth",
  "list",
  "detail",
  "ride",
  "profile-settings",
  "system",
] as const;
export const PHONE_READABILITY_CONTRACT = {
  width: VIEWPORTS.phone.width,
  screens: ["home", "course-detail", "party-detail"],
  styles: STYLES.map((style) => style.id),
  homeActionLayout: "stacked-full-width",
  textOverlap: 0,
  clipping: 0,
} as const;
export const NORMAL_FLOW_CONTRACT = {
  quickActionCard: ["icon", "title", "description"],
  partyDetailBlocks: ["members", "meeting", "facts", "schedule"],
  forbids: ["absolute", "negative-margin"],
} as const;
export type SemanticBlock =
  | "auth-form"
  | "onboarding"
  | "permission"
  | "home-actions"
  | "course-filter"
  | "course-summary"
  | "departure-check"
  | "ride-hud"
  | "ai-request"
  | "record-list"
  | "record-summary"
  | "party-list"
  | "party-summary"
  | "profile-summary"
  | "settings-list"
  | "recovery";
export const SEMANTIC_BLOCKS: Record<ScreenKey, readonly SemanticBlock[]> = {
  login: ["auth-form"],
  signup: ["auth-form"],
  "password-recovery": ["auth-form"],
  onboarding: ["onboarding"],
  "location-permission": ["permission"],
  "notification-permission": ["permission"],
  home: ["home-actions", "course-summary"],
  courses: ["course-filter", "course-summary"],
  "course-detail": ["course-summary", "departure-check"],
  "saved-courses-empty": ["recovery"],
  "pre-ride": ["departure-check"],
  "free-ride": ["ride-hud"],
  "ai-route-create": ["ai-request"],
  records: ["record-list"],
  "record-detail": ["record-summary"],
  "records-empty": ["recovery"],
  "party-list": ["party-list"],
  "party-detail": ["party-summary"],
  "party-disconnected": ["recovery"],
  profile: ["profile-summary"],
  settings: ["settings-list"],
  offline: ["recovery"],
  "force-update": ["recovery"],
  "error-recovery": ["recovery"],
};

export const fixtureRegistry = Object.fromEntries(
  SCREEN_FIXTURES.map((fixture) => [fixture.key, fixture]),
) as Record<ScreenKey, ScreenFixture>;
export const canonicalCaptureTargets = STYLES.flatMap((style) =>
  SCREEN_FIXTURES.flatMap((screen) =>
    (Object.keys(VIEWPORTS) as ViewportId[]).map((viewport) => ({
      style: style.id,
      screen: screen.key,
      state: screen.state,
      viewport,
    })),
  ),
);
export const captureTargets = STYLES.flatMap((style) =>
  SCREEN_FIXTURES.flatMap((screen) =>
    screen.allowedStates.flatMap((state) =>
      (Object.keys(VIEWPORTS) as ViewportId[]).map((viewport) => ({
        style: style.id,
        screen: screen.key,
        state,
        viewport,
      })),
    ),
  ),
);
export const MIN_TOUCH_TARGET = 48;

export function isStyleId(value: unknown): value is StyleId {
  return (
    typeof value === "string" && STYLES.some((style) => style.id === value)
  );
}
export function isScreenKey(value: unknown): value is ScreenKey {
  return typeof value === "string" && value in fixtureRegistry;
}
export function isViewportId(value: unknown): value is ViewportId {
  return value === "phone" || value === "tablet";
}
export function isStateKey(value: unknown): value is StateKey {
  return (
    typeof value === "string" &&
    [
      "default",
      "empty",
      "loading",
      "permission",
      "disconnected",
      "finalizing",
      "error",
      "update-required",
    ].includes(value)
  );
}

export function parsePreviewRequest(params: {
  style?: string;
  screen?: string;
  state?: string;
  viewport?: string;
}) {
  const screen = isScreenKey(params.screen)
    ? fixtureRegistry[params.screen]
    : fixtureRegistry.home;
  const valid =
    isStyleId(params.style) &&
    isScreenKey(params.screen) &&
    isStateKey(params.state) &&
    isViewportId(params.viewport) &&
    screen.allowedStates.includes(params.state as StateKey);
  return {
    valid,
    style: STYLES.find(
      (item) => item.id === (isStyleId(params.style) ? params.style : "atlas"),
    )!,
    screen,
    state: valid ? (params.state as StateKey) : screen.state,
    viewport: isViewportId(params.viewport)
      ? params.viewport
      : ("phone" as ViewportId),
  };
}

function hexLuminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((value) => parseInt(value, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
export function contrastRatio(first: string, second: string) {
  const [light, dark] = [hexLuminance(first), hexLuminance(second)].sort(
    (a, b) => b - a,
  );
  return (light + 0.05) / (dark + 0.05);
}
