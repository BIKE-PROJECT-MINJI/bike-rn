import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { createContext, useContext, useState, type ReactNode } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  DOMAIN_FIXTURES,
  ERROR_RECOVERY,
  MIN_TOUCH_TARGET,
  SCREEN_FIXTURES,
  SEMANTIC_BLOCKS,
  STYLES,
  STYLE_COMPOSITIONS,
  TABLET_CANVAS_HEIGHT,
  TAB_BY_GROUP,
  VIEWPORTS,
  parsePreviewRequest,
  type ScreenFixture,
  type ScreenKey,
  type StyleSystem,
  type ViewportId,
} from "./manifest";

type Params = {
  style?: string;
  screen?: string;
  state?: string;
  viewport?: string;
  capture?: string;
};
const tabNames = ["홈", "코스", "기록", "파티", "프로필"];
const courseRows = [...DOMAIN_FIXTURES.courses, "성수 골목길 · 7.6km"];
const PreviewNavigationContext = createContext<{
  style: StyleSystem["id"];
  viewport: ViewportId;
}>({ style: "atlas", viewport: "phone" });

function choose(params: Params) {
  return { ...parsePreviewRequest(params), capture: params.capture === "1" };
}
function Card({
  style,
  children,
  tight,
}: {
  style: StyleSystem;
  children: ReactNode;
  tight?: boolean;
}) {
  return (
    <View
      style={[
        s.card,
        phone.card,
        {
          minWidth: 0,
          width: "100%",
          alignSelf: "stretch",
          backgroundColor: style.surface,
          borderColor: style.line,
          borderRadius: style.radius,
          padding: tight ? 12 : style.card,
        },
      ]}
    >
      {children}
    </View>
  );
}
function QuickActionCard({
  style,
  icon,
  title,
  description,
}: {
  style: StyleSystem;
  icon: "sparkles" | "bicycle";
  title: string;
  description: string;
}) {
  const current = useContext(PreviewNavigationContext);
  return (
    <Pressable
      testID={`quick-action-${title}`}
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() =>
        previewNavigate(
          title === "AI 코스" ? "ai-route-create" : "free-ride",
          current,
        )
      }
      style={[
        flow.quickActionCard,
        {
          backgroundColor: style.surface,
          borderColor: style.line,
          borderRadius: style.radius,
        },
      ]}
    >
      <Ionicons name={icon} size={22} color={style.accent} />
      <Text style={[flow.quickActionTitle, { color: style.ink }]}>{title}</Text>
      <Text style={[flow.quickActionDescription, { color: style.muted }]}>
        {description}
      </Text>
    </Pressable>
  );
}
function previewNavigate(
  screen: ScreenKey,
  current: { style: StyleSystem["id"]; viewport: ViewportId },
) {
  router.replace({
    pathname: "/design-preview",
    params: {
      style: current.style,
      screen,
      state: "default",
      viewport: current.viewport,
    },
  });
}
function Action({
  style,
  label,
  disabled,
  target,
}: {
  style: StyleSystem;
  label: string;
  disabled?: boolean;
  target: ScreenKey;
}) {
  const current = useContext(PreviewNavigationContext);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => previewNavigate(target, current)}
      style={[
        s.action,
        {
          minHeight: style.buttonHeight,
          backgroundColor: disabled ? style.line : style.accent,
          borderRadius: Math.min(style.radius, 12),
        },
      ]}
    >
      <Text
        style={[
          s.actionText,
          { color: disabled ? style.muted : style.accentInk },
        ]}
      >
        {label}
      </Text>
      <Ionicons
        name="arrow-forward"
        size={18}
        color={disabled ? style.muted : style.accentInk}
      />
    </Pressable>
  );
}
function Head({
  style,
  fixture,
}: {
  style: StyleSystem;
  fixture: ScreenFixture;
}) {
  const current = useContext(PreviewNavigationContext);
  return (
    <View style={s.head}>
      <View style={s.headCopy}>
        <Text style={[s.eyebrow, { color: style.accent }]}>
          {fixture.eyebrow}
        </Text>
        <Text
          style={[
            s.title,
            {
              color: style.ink,
              fontSize: style.title,
              lineHeight: style.title + 7,
            },
          ]}
        >
          {headlineFor390(fixture.title)}
        </Text>
      </View>
      <View
        style={[
          s.headIcon,
          { backgroundColor: style.map, borderRadius: style.radius },
        ]}
      >
        <Ionicons
          name={fixture.icon as never}
          size={style.icon}
          color={style.accent}
        />
      </View>
    </View>
  );
}
/** Keep the long Korean capture headlines on phrase boundaries, never mid-word. */
function headlineFor390(title: string) {
  const phrases: Record<string, string> = {
    "오늘의 주행을 이어가세요": "오늘의 주행을\n이어가세요",
    "지금 어디로 달릴까요?": "지금 어디로\n달릴까요?",
    "주행 기록을 안전하게 보관": "주행 기록을\n안전하게 보관",
    "위치 접근을 허용해 주세요": "위치 접근을\n허용해 주세요",
    "아직 저장한 코스가 없어요": "아직 저장한 코스가\n없어요",
  };
  return phrases[title] ?? title;
}
function FamilyFlow({
  style,
  blocks,
}: {
  style: StyleSystem;
  blocks: ReactNode[];
}) {
  const orders: Record<StyleSystem["id"], number[]> = {
    atlas: [0, 1, 2, 3],
    signal: [2, 0, 3, 1],
    calm: [0, 3, 2, 1],
    studio: [3, 0, 1, 2],
    "night-ride": [1, 2, 0, 3],
  };
  return <>{orders[style.id].map((index) => blocks[index])}</>;
}
function Map({ style, label }: { style: StyleSystem; label: string }) {
  return (
    <View
      style={[
        s.map,
        {
          backgroundColor: style.map,
          borderColor: style.line,
          borderRadius: style.radius,
        },
      ]}
    >
      <View style={[s.routeA, { borderColor: style.accent }]} />
      <View style={[s.routeB, { borderColor: style.ink }]} />
      <View
        style={[
          s.mapLabel,
          {
            backgroundColor: style.surface,
            borderColor: style.line,
            borderRadius: Math.min(style.radius, 8),
          },
        ]}
      >
        <Ionicons name="location" size={13} color={style.accent} />
        <Text numberOfLines={1} style={[s.mapLabelText, { color: style.ink }]}>
          {label}
        </Text>
      </View>
    </View>
  );
}
function Rows({
  style,
  rows = courseRows,
  target = "course-detail",
}: {
  style: StyleSystem;
  rows?: string[];
  target?: ScreenKey;
}) {
  const current = useContext(PreviewNavigationContext);
  return (
    <View>
      {rows.map((row, index) => (
        <Pressable
          key={row}
          accessibilityRole="button"
          accessibilityLabel={`${row} 상세 보기`}
          onPress={() => previewNavigate(target, current)}
          style={[
            s.row,
            phone.row,
            {
              borderBottomColor:
                index === rows.length - 1 ? "transparent" : style.line,
            },
          ]}
        >
          <View
            style={[
              s.rowMark,
              phone.rowMark,
              { backgroundColor: index === 0 ? style.accent : style.map },
            ]}
          />
          <View style={[s.rowCopy, phone.rowCopy]}>
            <Text style={[s.rowTitle, phone.rowTitle, { color: style.ink }]}>
              {row}
            </Text>
            <Text style={[s.rowMeta, phone.rowMeta, { color: style.muted }]}>
              {index === 0 ? "예상 1시간 24분 · 보통" : "저장한 코스에서 확인"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={style.muted} />
        </Pressable>
      ))}
    </View>
  );
}

function AuthPresentation({
  style,
  fixture,
  capture = false,
}: {
  style: StyleSystem;
  fixture: ScreenFixture;
  capture?: boolean;
}) {
  const [email, setEmail] = useState("minji@example.com");
  const [name, setName] = useState("김민지");
  if (fixture.key === "onboarding")
    return (
      <View style={s.stack}>
        <View
          style={[
            s.authMark,
            { backgroundColor: style.accent, borderRadius: style.radius },
          ]}
        >
          <Ionicons name="bicycle" size={34} color={style.accentInk} />
        </View>
        <Head style={style} fixture={fixture} />
        <Text style={[s.body, { color: style.muted }]}>{fixture.body}</Text>
        <Action style={style} label="다음" target="location-permission" />
      </View>
    );
  return (
    <View style={s.stack}>
      <View
        style={[
          s.authMark,
          { backgroundColor: style.accent, borderRadius: style.radius },
        ]}
      >
        <Ionicons
          name={fixture.icon as never}
          size={34}
          color={style.accentInk}
        />
      </View>
      <Head style={style} fixture={fixture} />
      <Text
        style={[s.body, { color: style.muted, lineHeight: style.lineHeight }]}
      >
        {fixture.body}
      </Text>
      <TextInput
        accessibilityLabel="이메일"
        editable={!capture}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        style={[
          responsive.textInput,
          { color: style.ink, borderBottomColor: style.line },
        ]}
      />
      {fixture.key === "signup" ? (
        <TextInput
          accessibilityLabel="이름"
          editable={!capture}
          value={name}
          onChangeText={setName}
          style={[
            responsive.textInput,
            { color: style.ink, borderBottomColor: style.line },
          ]}
        />
      ) : null}
      <Action style={style} label={fixture.action} target="home" />
    </View>
  );
}
function HomePresentation({
  style,
  fixture,
}: {
  style: StyleSystem;
  fixture: ScreenFixture;
}) {
  const blocks = [
    <View key="home-head" testID="home-block-head"><Head style={style} fixture={fixture} /></View>,
    <View key="home-map" testID="home-block-map"><Map style={style} label="한강 방향 · 바람 2.1m/s" /></View>,
    <View key="home-actions" testID="home-block-actions" style={flow.quickActionList}>
      <QuickActionCard style={style} icon="sparkles" title="AI 코스" description="목적지와 시간으로 만들기" />
      <QuickActionCard style={style} icon="bicycle" title="자유주행" description="바로 기록 시작하기" />
    </View>,
    <View key="home-list" testID="home-block-list" style={s.stack}>
      <Text style={[s.sectionTitle, { color: style.ink }]}>오늘의 추천</Text>
      <Rows style={style} rows={courseRows.slice(0, 2)} target="course-detail" />
    </View>,
  ];
  return (
    <View style={s.stack}>
      <FamilyFlow style={style} blocks={blocks} />
    </View>
  );
}
function CoursePresentation({
  style,
  fixture,
  capture = false,
}: {
  style: StyleSystem;
  fixture: ScreenFixture;
  capture?: boolean;
}) {
  const [request, setRequest] = useState("한강을 지나 조용한 길로 1시간");
  if (fixture.state === "empty")
    return (
      <View style={s.empty}>
        <Ionicons name="bookmark-outline" size={40} color={style.accent} />
        <Head style={style} fixture={fixture} />
        <Text style={[s.body, { color: style.muted }]}>{fixture.body}</Text>
        <Action style={style} label={fixture.action} target="courses" />
      </View>
    );
  const primary = fixture.key === "ai-route-create" ? (
          <View key="course-request" testID="course-block-request" style={s.promptBox}>
            <Text style={[s.inputLabel, { color: style.muted }]}>
              어디를 달리고 싶나요?
            </Text>
            <TextInput
              accessibilityLabel="AI 코스 요청"
              editable={!capture}
              value={request}
              onChangeText={setRequest}
              multiline
              style={[s.inputValue, { color: style.ink }]}
            />
          </View>
  ) : (
          <View key="course-map" testID="course-block-map"><Map
            style={style}
            label={fixture.key === "course-detail" ? "출발: 북악산길 입구" : "내 주변 코스"}
          /></View>
  );
  const context = fixture.key === "ai-route-create" ? (
          <View key="course-tags" testID="course-block-tags" style={s.tagRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="왕복 선택"
              onPress={() => setRequest(`${request} · 왕복`)}
            >
              <Text
                style={[
                  s.tag,
                  { color: style.accent, borderColor: style.accent },
                ]}
              >
                왕복
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="완만한 길 선택"
              onPress={() => setRequest(`${request} · 완만한 길`)}
            >
              <Text
                style={[
                  s.tag,
                  { color: style.accent, borderColor: style.accent },
                ]}
              >
                완만한 길
              </Text>
            </Pressable>
          </View>
  ) : fixture.key === "course-detail" ? (
            <View key="course-metrics" testID="course-block-metrics"><Card style={style}>
              <View style={phone.courseMetricRow}>
                <Text style={[phone.courseDistance, { color: style.ink }]}>
                  18.4km
                </Text>
                <Text style={[phone.courseTime, { color: style.muted }]}>
                  예상 1시간 24분
                </Text>
              </View>
              <Text style={[phone.courseMeta, { color: style.muted }]}>
                오르막 312m · 신호등 14개 · 난이도 보통
              </Text>
            </Card></View>
  ) : <View key="course-list" testID="course-block-list"><Rows style={style} target="course-detail" /></View>;
  const blocks = [
    <View key="course-head" testID="course-block-head"><Head style={style} fixture={fixture} /></View>,
    primary,
    context,
    <View key="course-action" testID="course-block-action"><Action style={style} label={fixture.action} target={fixture.key === "course-detail" ? "pre-ride" : "course-detail"} /></View>,
  ];
  return <View style={s.stack}><FamilyFlow style={style} blocks={blocks} /></View>;
}
function RidePresentation({
  style,
  fixture,
}: {
  style: StyleSystem;
  fixture: ScreenFixture;
}) {
  const blocks = [
    <View key="ride-map" testID="ride-block-map"><Map style={style} label={fixture.key === "free-ride" ? "기록 중 · GPS 양호" : "다음 안내: 북악터널 방면"} /></View>,
    <View key="ride-metric" testID="ride-block-metric" style={s.rideMetric}>
      <Text style={[s.rideNumber, { color: style.ink }]}>{fixture.key === "free-ride" ? "12.6" : "18.4"}<Text style={[s.rideUnit, { color: style.muted }]}>{fixture.key === "free-ride" ? " km/h" : " km"}</Text></Text>
      <Text style={[s.eyebrow, { color: style.accent }]}>{fixture.key === "free-ride" ? "00:18:42 경과" : "출발 전 확인"}</Text>
    </View>,
    <View key="ride-card" testID="ride-block-card"><Card style={style}><Text style={[s.cardTitle, { color: style.ink }]}>{fixture.key === "free-ride" ? "기록은 기기에 보관 중이에요" : "GPS 신호 양호 · 배터리 84%"}</Text><Text style={[s.cardMeta, { color: style.muted }]}>{fixture.body}</Text></Card></View>,
    <View key="ride-action" testID="ride-block-action"><Action style={style} label={fixture.action} target={fixture.key === "free-ride" ? "records" : "free-ride"} /></View>,
  ];
  return (
    <View style={s.stack}>
      <FamilyFlow style={style} blocks={blocks} />
    </View>
  );
}
function RecordsPresentation({
  style,
  fixture,
}: {
  style: StyleSystem;
  fixture: ScreenFixture;
}) {
  if (fixture.state === "empty")
    return (
      <View style={s.empty}>
        <Ionicons name="analytics-outline" size={40} color={style.accent} />
        <Head style={style} fixture={fixture} />
        <Text style={[s.body, { color: style.muted }]}>{fixture.body}</Text>
        <Action style={style} label={fixture.action} target="free-ride" />
      </View>
    );
  return (
    <View style={s.stack}>
      <Head style={style} fixture={fixture} />
      {fixture.key === "record-detail" ? (
        <>
          <Map style={style} label="한강 자전거길 · 24.8km" />
          <View style={s.statStrip}>
            <Text style={[s.stat, { color: style.ink }]}>24.8km</Text>
            <Text style={[s.stat, { color: style.ink }]}>1:42</Text>
            <Text style={[s.stat, { color: style.ink }]}>14.5</Text>
          </View>
        </>
      ) : (
        <Rows
          style={style}
          rows={[
            "한강 저녁 라이딩 · 24.8km",
            "북악 오르막 · 16.2km",
            "7월 20일 · 경로 보정 중",
          ]}
        />
      )}
      <Action style={style} label={fixture.action} target={fixture.key === "record-detail" ? "course-detail" : "record-detail"} />
    </View>
  );
}
function PartyPresentation({
  style,
  fixture,
}: {
  style: StyleSystem;
  fixture: ScreenFixture;
}) {
  if (fixture.state === "disconnected")
    return (
      <View style={s.empty}>
        <Ionicons name="wifi-outline" size={40} color={style.accent} />
        <Head style={style} fixture={fixture} />
        <Text style={[s.body, { color: style.muted }]}>{fixture.body}</Text>
        <Action style={style} label={fixture.action} target="party-list" />
      </View>
    );
  const detail = fixture.key === "party-detail";
  const blocks = [
    <View key="party-head" testID="party-block-head"><Head style={style} fixture={fixture} /></View>,
    <View
      key="party-summary"
      testID="party-summary"
      style={[
        flow.partySummary,
        {
          backgroundColor: style.surface,
          borderColor: style.line,
          borderRadius: style.radius,
        },
      ]}
    >
      <View testID="party-members" style={flow.partyMembers}>
        {["민", "서", "준"].map((name, i) => (
          <View key={name} style={[flow.partyAvatar, { backgroundColor: i === 0 ? style.accent : style.map }]}>
            <Text style={{ color: i === 0 ? style.accentInk : style.ink, fontWeight: "800" }}>{name}</Text>
          </View>
        ))}
      </View>
      <View testID="party-meeting" style={flow.partyMeeting}>
        <Text style={[flow.partyTitle, { color: style.ink }]}>{detail ? "성수역 3번 출구에서 만나요" : "이번 주말에 함께 달릴 파티"}</Text>
      </View>
      <View testID="party-facts" style={flow.partyFacts}>
        <Text style={[flow.partyMeta, { color: style.muted }]}>{detail ? "8.2km · 성수역 3번 출구 · 현재 3명 참여" : fixture.body}</Text>
      </View>
    </View>,
    <View key="party-schedule" testID="party-schedule" style={flow.partySchedule}>
      <Rows style={style} rows={["성수 야간 · 오늘 19:30", "한강 아침 · 토요일 07:00"]} target="party-detail" />
    </View>,
    <View key="party-action" testID="party-block-action"><Action style={style} label={fixture.action} target={detail ? "party-list" : "party-detail"} /></View>,
  ];
  return (
    <View style={s.stack}>
      <FamilyFlow style={style} blocks={blocks} />
    </View>
  );
}
function ProfilePresentation({
  style,
  fixture,
}: {
  style: StyleSystem;
  fixture: ScreenFixture;
}) {
  return (
    <View style={s.stack}>
      <Head style={style} fixture={fixture} />
      {fixture.key === "profile" ? (
        <View style={s.profileSummary}>
          <View style={[s.largeAvatar, { backgroundColor: style.map }]}>
            <Ionicons name="person" size={34} color={style.accent} />
          </View>
          <Text style={[s.cardTitle, { color: style.ink }]}>김민지</Text>
          <Text style={[s.cardMeta, { color: style.muted }]}>
            이번 달 124.6km
          </Text>
        </View>
      ) : null}
      <Rows
        style={style}
        target="settings"
        rows={
          fixture.key === "settings"
            ? ["알림과 권한", "주행 기록 저장공간", "계정 및 로그인"]
            : ["내 활동", "저장한 코스", "계정 설정"]
        }
      />
      <Action style={style} label={fixture.action} target={fixture.key === "settings" ? "profile" : "settings"} />
    </View>
  );
}
function SystemPresentation({
  style,
  fixture,
}: {
  style: StyleSystem;
  fixture: ScreenFixture;
}) {
  return (
    <View style={s.empty}>
      <View style={[s.systemSign, { borderColor: style.accent }]}>
        <Ionicons name={fixture.icon as never} size={42} color={style.accent} />
      </View>
      <Head style={style} fixture={fixture} />
      <Text style={[s.body, { color: style.muted, textAlign: "center" }]}>
        {fixture.body}
      </Text>
      <Card style={style} tight>
        <Text style={[s.cardMeta, { color: style.muted }]}>
          주행 원본은 삭제하지 않고, 연결 또는 업데이트가 완료된 후 다시
          이어갑니다.
        </Text>
      </Card>
      <Action style={style} label={fixture.action} target="home" />
    </View>
  );
}
const PRESENTATIONS = {
  auth: AuthPresentation,
  home: HomePresentation,
  courses: CoursePresentation,
  ride: RidePresentation,
  records: RecordsPresentation,
  party: PartyPresentation,
  profile: ProfilePresentation,
  system: SystemPresentation,
};
function LoadingSkeleton({
  style,
  area,
}: {
  style: StyleSystem;
  area: "auth" | "list" | "detail" | "ride" | "profile-settings" | "system";
}) {
  const blocks =
    area === "auth"
      ? [responsive.skeletonShort, responsive.skeleton, responsive.skeleton]
      : area === "list"
        ? [
            responsive.skeleton,
            responsive.skeleton,
            responsive.skeletonShort,
            responsive.skeleton,
          ]
        : area === "detail"
          ? [
              responsive.skeletonMap,
              responsive.skeleton,
              responsive.skeletonShort,
            ]
          : area === "ride"
            ? [responsive.skeletonMap, responsive.skeletonShort]
            : area === "profile-settings"
              ? [
                  responsive.skeleton,
                  responsive.skeleton,
                  responsive.skeleton,
                  responsive.skeletonShort,
                ]
              : [responsive.skeletonShort, responsive.skeletonMap];
  return (
    <View testID={`loading-skeleton-${area}`} style={responsive.skeletonGroup}>
      {blocks.map((shape, index) => (
        <View
          key={`${area}-${index}`}
          testID={`loading-${area}-block-${index}`}
          style={[
            responsive.skeleton,
            shape,
            {
              backgroundColor:
                index === 0 &&
                (area === "detail" || area === "ride" || area === "system")
                  ? style.map
                  : style.line,
            },
          ]}
        />
      ))}
    </View>
  );
}
function StateBody({
  style,
  fixture,
}: {
  style: StyleSystem;
  fixture: ScreenFixture;
}) {
  const loading = fixture.state === "loading";
  const recovery = ERROR_RECOVERY[fixture.group];
  const area:
    | "auth"
    | "list"
    | "detail"
    | "ride"
    | "profile-settings"
    | "system" =
    fixture.group === "auth"
      ? "auth"
      : fixture.group === "ride"
        ? "ride"
        : fixture.group === "profile"
          ? "profile-settings"
          : fixture.group === "system"
            ? "system"
            : fixture.group === "courses"
              ? fixture.key === "courses"
                ? "list"
                : "detail"
              : fixture.group === "records"
                ? fixture.key === "records"
                  ? "list"
                  : "detail"
                : "list";
  const title = loading
    ? "정보를 준비하고 있어요"
    : fixture.state === "error"
      ? recovery.title
      : fixture.state === "finalizing"
        ? "라이딩 경로를 보정하고 있어요"
        : fixture.state === "disconnected"
          ? "실시간 연결이 끊겼어요"
          : fixture.title;
  const copy = loading
    ? "잠시만 기다려 주세요."
    : fixture.state === "error"
      ? recovery.body
      : fixture.state === "finalizing"
        ? "원본 기록은 기기에 보관되며, 완료되면 상세 정보를 확인할 수 있어요."
        : fixture.state === "disconnected"
          ? "주행은 계속할 수 있고, 연결을 다시 확인할 수 있어요."
          : fixture.body;
  return (
    <View testID={`state-body-${fixture.state}`} style={responsive.stateBody}>
      {loading ? (
        <LoadingSkeleton style={style} area={area} />
      ) : (
        <View style={[s.systemSign, { borderColor: style.accent }]}>
          <Ionicons
            name={
              fixture.state === "error" ? "refresh" : (fixture.icon as never)
            }
            size={42}
            color={style.accent}
          />
        </View>
      )}
      <Text
        style={[
          s.title,
          { color: style.ink, textAlign: "center", fontSize: style.title },
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          s.body,
          {
            color: style.muted,
            textAlign: "center",
            lineHeight: style.lineHeight,
          },
        ]}
      >
        {copy}
      </Text>
      {!loading ? (
        <Action
          style={style}
          label={
            fixture.state === "error"
              ? recovery.action
              : fixture.state === "finalizing"
                ? "기록 목록으로 돌아가기"
                : fixture.action
          }
          target={fixture.group === "auth" ? "home" : fixture.group === "ride" ? "records" : fixture.group === "records" ? "records" : fixture.group === "party" ? "party-list" : fixture.group === "profile" ? "profile" : fixture.group === "courses" ? "courses" : "home"}
        />
      ) : null}
    </View>
  );
}
/** Product semantics are keyed by ScreenKey; styles only compose the same semantic blocks. */
function SemanticScreen({
  style,
  fixture,
  capture = false,
}: {
  style: StyleSystem;
  fixture: ScreenFixture;
  capture?: boolean;
}) {
  const Presentation = PRESENTATIONS[fixture.group];
  const composition =
    style.id === "signal"
      ? responsive.signalComposition
      : style.id === "calm"
        ? responsive.calmComposition
        : style.id === "studio"
          ? responsive.studioComposition
          : style.id === "night-ride"
            ? responsive.nightComposition
            : responsive.atlasComposition;
  const content = (
    <Presentation style={style} fixture={fixture} capture={capture} />
  );
  const composed =
    style.id === "atlas" ? (
      <View testID="layout-atlas-sidebar" style={layout.atlas}>
        <View style={[layout.sidebar, { backgroundColor: style.line }]} />
        <View style={layout.content}>{content}</View>
      </View>
    ) : style.id === "signal" ? (
      <View testID="layout-signal-action-rail" style={layout.signal}>
        <View style={[layout.actionRail, { backgroundColor: style.accent }]} />
        <View style={layout.content}>{content}</View>
      </View>
    ) : style.id === "calm" ? (
      <View testID="layout-calm-quiet-flow" style={layout.calm}>
        {content}
      </View>
    ) : style.id === "studio" ? (
      <View testID="layout-studio-editorial" style={layout.studio}>
        <Text style={[layout.editorialIndex, { color: style.accent }]}>01</Text>
        <View style={layout.content}>{content}</View>
      </View>
    ) : (
      <View testID="layout-night-cockpit" style={layout.night}>
        <View style={[layout.cockpitBar, { borderColor: style.line }]}>
          <Text style={{ color: style.accent }}>LIVE</Text>
          <Text style={{ color: style.muted }}>GPS</Text>
        </View>
        {content}
      </View>
    );
  return (
    <View
      testID={`semantic-${fixture.key}-${SEMANTIC_BLOCKS[fixture.key].join("-")}-${STYLE_COMPOSITIONS[style.id]}`}
      style={[responsive.familyStack, composition]}
    >
      {composed}
    </View>
  );
}
function TabletFacts({
  style,
  group,
}: {
  style: StyleSystem;
  group: ScreenFixture["group"];
}) {
  const facts =
    group === "courses"
      ? [
          ["18.4km", "거리"],
          ["1:24", "예상 시간"],
          ["312m", "오르막"],
          ["보통", "난이도"],
        ]
      : group === "records"
        ? [
            ["24.8km", "거리"],
            ["1:42", "시간"],
            ["14.5", "평균"],
            ["+412m", "상승"],
          ]
        : group === "party"
          ? [
              ["3명", "참여"],
              ["19:30", "출발"],
              ["8.2km", "거리"],
              ["성수역", "집결"],
            ]
          : [
              ["84%", "저장공간"],
              ["켜짐", "알림"],
              ["허용", "위치"],
              ["6회", "이번 달"],
            ];
  return (
    <View style={tablet.facts}>
      {facts.map(([value, label]) => (
        <View
          key={label}
          style={[
            tablet.fact,
            {
              backgroundColor: style.map,
              borderColor: style.line,
              borderRadius: style.radius,
            },
          ]}
        >
          <Text style={[tablet.factValue, { color: style.ink }]}>{value}</Text>
          <Text style={[tablet.factLabel, { color: style.muted }]}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}
function TabletMasterDetail({
  style,
  fixture,
}: {
  style: StyleSystem;
  fixture: ScreenFixture;
}) {
  const groupLabel =
    fixture.group === "courses"
      ? "내 주변 코스"
      : fixture.group === "records"
        ? "최근 라이딩"
        : fixture.group === "party"
          ? "참여 가능한 파티"
          : "설정 항목";
  const rows =
    fixture.group === "courses"
      ? courseRows
      : fixture.group === "records"
        ? [
            "한강 저녁 라이딩 · 24.8km",
            "북악 오르막 · 16.2km",
            "성수 야간 라이딩 · 8.2km",
          ]
        : fixture.group === "party"
          ? [
              "성수 야간 · 오늘 19:30",
              "한강 아침 · 토요일 07:00",
              "북악 완주 · 일요일 08:00",
            ]
          : ["알림과 권한", "주행 기록 저장공간", "계정 및 로그인"];
  const tabletComposition =
    style.id === "signal"
      ? tablet.detailReverse
      : style.id === "calm"
        ? tablet.detailCalm
        : style.id === "studio"
          ? tablet.detailStudio
          : style.id === "night-ride"
            ? tablet.detailNight
            : undefined;
  return (
    <View
      testID={`tablet-master-detail-${fixture.group}-${style.id}`}
      style={[tablet.detail, tabletComposition]}
    >
      <View
        style={[
          tablet.masterPanel,
          {
            backgroundColor: style.surface,
            borderColor: style.line,
            borderRadius: style.radius,
          },
        ]}
      >
        <Text style={[tablet.panelKicker, { color: style.accent }]}>
          {groupLabel}
        </Text>
        {fixture.group !== "profile" ? (
          <Map
            style={style}
            label={
              fixture.group === "records"
                ? "한강 자전거길 · 최근 주행"
                : fixture.group === "party"
                  ? "성수역 · 오늘 출발"
                  : "북악산길 · 선택한 코스"
            }
          />
        ) : (
          <View
            style={[
              tablet.settingBanner,
              { backgroundColor: style.map, borderRadius: style.radius },
            ]}
          >
            <Ionicons name="settings" size={34} color={style.accent} />
            <Text style={[s.cardTitle, { color: style.ink }]}>내 앱 환경</Text>
            <Text style={[s.cardMeta, { color: style.muted }]}>
              권한과 보관 상태를 한눈에 관리합니다.
            </Text>
          </View>
        )}
        <Rows style={style} rows={rows} target={fixture.group === "records" ? "record-detail" : fixture.group === "party" ? "party-detail" : fixture.group === "profile" ? "settings" : "course-detail"} />
        <Card style={style} tight>
          <Text style={[s.cardMeta, { color: style.muted }]}>
            선택한 항목의 세부 정보가 오른쪽에 표시됩니다.
          </Text>
        </Card>
      </View>
      <View
        style={[
          tablet.detailPanel,
          {
            backgroundColor: style.surface,
            borderColor: style.line,
            borderRadius: style.radius,
          },
        ]}
      >
        <Head style={style} fixture={fixture} />
        <Text
          style={[s.body, { color: style.muted, lineHeight: style.lineHeight }]}
        >
          {fixture.body}
        </Text>
        <TabletFacts style={style} group={fixture.group} />
        <Card style={style}>
          <Text style={[s.cardTitle, { color: style.ink }]}>
            {fixture.group === "courses"
              ? "경로 안내와 출발 정보"
              : fixture.group === "records"
                ? "라이딩 품질과 경로 요약"
                : fixture.group === "party"
                  ? "참여 전 확인 사항"
                  : "선택한 설정의 현재 상태"}
          </Text>
          <Text style={[s.cardMeta, { color: style.muted }]}>
            {fixture.group === "courses"
              ? "신호등 14개 · 휴식 지점 2곳 · 출발 전 GPS를 확인하세요."
              : fixture.group === "records"
                ? "경로 품질 양호 · 원본 기록 보관 · 코스로 저장할 수 있어요."
                : fixture.group === "party"
                  ? "참여만으로 위치가 공유되지는 않으며, 주행 시작 전 다시 확인합니다."
                  : "변경 내용은 이 기기에 바로 반영되며, 주행 기록은 삭제하지 않습니다."}
          </Text>
        </Card>
        <View style={[tablet.timeline, { borderColor: style.line }]}>
          <Text style={[tablet.timelineTitle, { color: style.ink }]}>
            다음 단계
          </Text>
          <Text style={[tablet.timelineCopy, { color: style.muted }]}>
            1. 세부 정보 확인
          </Text>
          <Text style={[tablet.timelineCopy, { color: style.muted }]}>
            2. 조건 검토
          </Text>
          <Text style={[tablet.timelineCopy, { color: style.muted }]}>
            3. 행동 선택
          </Text>
        </View>
        <Action style={style} label={fixture.action} target={fixture.group === "records" ? "record-detail" : fixture.group === "party" ? "party-detail" : fixture.group === "profile" ? "settings" : "course-detail"} />
      </View>
    </View>
  );
}
function TabletHome({
  style,
  fixture,
}: {
  style: StyleSystem;
  fixture: ScreenFixture;
}) {
  return (
    <View testID="tablet-home-dashboard" style={tablet.home}>
      <View style={tablet.homeMain}>
        <Head style={style} fixture={fixture} />
        <Map style={style} label="한강 방향 · 바람 2.1m/s" />
        <TabletFacts style={style} group="courses" />
        <Text style={[s.sectionTitle, { color: style.ink }]}>오늘의 추천</Text>
        <Rows style={style} rows={courseRows} target="course-detail" />
      </View>
      <View
        style={[
          tablet.homeAside,
          {
            backgroundColor: style.surface,
            borderColor: style.line,
            borderRadius: style.radius,
          },
        ]}
      >
        <Text style={[tablet.panelKicker, { color: style.accent }]}>
          빠른 시작
        </Text>
        <QuickActionCard style={style} icon="sparkles" title="AI 코스" description="목적지와 시간을 입력해 새 경로를 만들어요." />
        <QuickActionCard style={style} icon="bicycle" title="자유주행" description="바로 기록 시작하기" />
        <Action style={style} label={fixture.action} target="free-ride" />
      </View>
    </View>
  );
}

function StyleFrame({
  style,
  fixture,
  viewport,
  capture,
}: {
  style: StyleSystem;
  fixture: ScreenFixture;
  viewport: ViewportId;
  capture: boolean;
}) {
  const isTablet = viewport === "tablet";
  const selectedTab = TAB_BY_GROUP[fixture.group];
  const success = fixture.state === "default";
  const content = success ? (
    isTablet &&
    ["courses", "records", "party", "profile"].includes(fixture.group) &&
    ![
      "ai-route-create",
      "record-detail",
      "party-detail",
      "profile",
      "settings",
    ].includes(fixture.key) ? (
      <TabletMasterDetail style={style} fixture={fixture} />
    ) : isTablet && fixture.group === "home" ? (
      <TabletHome style={style} fixture={fixture} />
    ) : (
      <SemanticScreen style={style} fixture={fixture} capture={capture} />
    )
  ) : (
    <StateBody style={style} fixture={fixture} />
  );
  const Root = capture ? View : SafeAreaView;
  const tabTargets: ScreenKey[] = [
    "home",
    "courses",
    "records",
    "party-list",
    "profile",
  ];
  return (
    <PreviewNavigationContext.Provider value={{ style: style.id, viewport }}>
      <Root
        testID={`preview-${style.layoutFamily}-${fixture.group}-${fixture.state}`}
        style={[
          s.canvas,
          {
            width: capture ? VIEWPORTS[viewport].width : "100%",
            height: capture
              ? isTablet
                ? TABLET_CANVAS_HEIGHT
                : VIEWPORTS.phone.height
              : undefined,
            overflow: capture ? "hidden" : "visible",
            backgroundColor: style.bg,
            padding: style.screen,
          },
        ]}
      >
        {capture ? (
          <View testID="capture-status-chrome" style={s.status}>
            <Text style={[s.statusText, { color: style.ink }]}>9:41</Text>
            <Text style={[s.statusText, { color: style.ink }]}>● ● ◖</Text>
          </View>
        ) : null}
        <ScrollView
          style={responsive.mainContent}
          contentContainerStyle={responsive.scrollContent}
        >
          {content}
        </ScrollView>
        {selectedTab !== null ? (
          <View
            style={[
              responsive.tabbar,
              { backgroundColor: style.surface, borderColor: style.line },
            ]}
          >
            {tabNames.map((name, index) => (
              <Pressable
                key={name}
                accessibilityRole="tab"
                accessibilityLabel={`${name} 탭`}
                accessibilityState={{ selected: index === selectedTab }}
                onPress={() =>
                  previewNavigate(tabTargets[index], {
                    style: style.id,
                    viewport,
                  })
                }
                style={responsive.tab}
              >
                <Ionicons
                  name={
                    (index === 0
                      ? "home"
                      : index === 1
                        ? "map"
                        : index === 2
                          ? "stats-chart"
                          : index === 3
                            ? "people"
                            : "person") as never
                  }
                  size={18}
                  color={index === selectedTab ? style.accent : style.muted}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    s.tabLabel,
                    {
                      color: index === selectedTab ? style.accent : style.muted,
                    },
                  ]}
                >
                  {name}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Root>
    </PreviewNavigationContext.Provider>
  );
}

function Explorer({ selected }: { selected: ReturnType<typeof choose> }) {
  const navigate = (
    next: Partial<{
      style: string;
      screen: string;
      state: string;
      viewport: string;
    }>,
  ) =>
    router.replace({
      pathname: "/design-preview",
      params: {
        style: selected.style.id,
        screen: selected.screen.key,
        state: selected.screen.state,
        viewport: selected.viewport,
        ...next,
      },
    });
  return (
    <View style={s.explorer}>
      <Text style={s.explorerTitle}>BIKE 디자인 초안</Text>
      <Text style={s.explorerBody}>
        {selected.style.layoutFamily} · {selected.style.mood}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chips}
      >
        {STYLES.map((style) => (
          <Pressable
            key={style.id}
            accessibilityRole="button"
            accessibilityLabel={`${style.name} 스타일`}
            onPress={() => navigate({ style: style.id })}
            style={[s.chip, selected.style.id === style.id && s.chipSelected]}
          >
            <Text
              style={[
                s.chipText,
                selected.style.id === style.id && s.chipTextSelected,
              ]}
            >
              {style.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chips}
      >
        {SCREEN_FIXTURES.map((fixture) => (
          <Pressable
            key={fixture.key}
            accessibilityRole="button"
            accessibilityLabel={`${fixture.label} 화면`}
            onPress={() =>
              navigate({ screen: fixture.key, state: fixture.state })
            }
            style={[
              s.chip,
              selected.screen.key === fixture.key && s.chipSelected,
            ]}
          >
            <Text
              style={[
                s.chipText,
                selected.screen.key === fixture.key && s.chipTextSelected,
              ]}
            >
              {fixture.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={s.viewportRow}>
        {(Object.keys(VIEWPORTS) as ViewportId[]).map((viewport) => (
          <Pressable
            key={viewport}
            accessibilityRole="button"
            accessibilityLabel={VIEWPORTS[viewport].label}
            onPress={() => navigate({ viewport })}
            style={[
              s.viewport,
              selected.viewport === viewport && s.viewportSelected,
            ]}
          >
            <Text
              style={
                selected.viewport === viewport
                  ? s.viewportTextSelected
                  : s.viewportText
              }
            >
              {VIEWPORTS[viewport].label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function DesignPreview() {
  const params = useLocalSearchParams<Params>();
  const selected = choose(params);
  if (!selected.valid)
    return (
      <View testID="invalid-preview" style={s.invalid}>
        <Text style={s.invalidTitle}>미리보기 주소를 확인해 주세요</Text>
        <Text style={s.invalidBody}>
          style: {STYLES.map((style) => style.id).join(", ")}
          {`\n`}screen:{" "}
          {SCREEN_FIXTURES.map((fixture) => fixture.key).join(", ")}
          {`\n`}state: 화면별 허용 variant를 확인해 주세요{`\n`}viewport: phone,
          tablet
        </Text>
      </View>
    );
  const fixture = { ...selected.screen, state: selected.state };
  if (selected.capture)
    return (
      <StyleFrame
        style={selected.style}
        fixture={fixture}
        viewport={selected.viewport}
        capture
      />
    );
  return (
    <ScrollView style={s.page} contentContainerStyle={s.pageContent}>
      <Explorer selected={selected} />
      <View style={s.center}>
        <StyleFrame
          style={selected.style}
          fixture={fixture}
          viewport={selected.viewport}
          capture={false}
        />
      </View>
    </ScrollView>
  );
}
export { choose, PRESENTATIONS, StyleFrame };
const tablet = StyleSheet.create({
  content: { paddingTop: 14 },
  detail: { flexDirection: "row", gap: 16, alignItems: "stretch" },
  detailReverse: { flexDirection: "row-reverse" },
  detailCalm: { gap: 24 },
  detailStudio: { gap: 10 },
  detailNight: { gap: 20 },
  masterPanel: {
    width: "42%",
    minHeight: 760,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  detailPanel: {
    flex: 1,
    minHeight: 760,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  panelKicker: { fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  settingBanner: {
    minHeight: 180,
    padding: 18,
    justifyContent: "center",
    gap: 9,
  },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  fact: {
    width: "47%",
    minHeight: 82,
    borderWidth: 1,
    padding: 12,
    justifyContent: "center",
    gap: 4,
  },
  factValue: { fontSize: 20, fontWeight: "800" },
  factLabel: { fontSize: 12, fontWeight: "700" },
  timeline: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingTop: 14,
    paddingBottom: 18,
    gap: 7,
  },
  timelineTitle: { fontSize: 14, fontWeight: "800" },
  timelineCopy: { fontSize: 13, lineHeight: 21, paddingBottom: 3 },
  home: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  homeMain: { flex: 1, gap: 14 },
  homeAside: {
    width: "34%",
    minHeight: 720,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
});
const responsive = StyleSheet.create({
  mainContent: { flex: 1, minHeight: 0, overflow: "hidden" },
  scrollContent: { paddingBottom: 8 },
  textInput: {
    minHeight: MIN_TOUCH_TARGET,
    borderBottomWidth: 1,
    fontSize: 15,
    fontWeight: "600",
    paddingHorizontal: 0,
  },
  stateBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    paddingHorizontal: 20,
  },
  skeletonGroup: { width: "100%", gap: 12 },
  skeleton: { height: 18, width: "86%", borderRadius: 8 },
  skeletonShort: { width: "54%" },
  skeletonMap: { width: "100%", height: 180, marginTop: 10 },
  familyStack: { gap: 14, paddingTop: 14 },
  atlasComposition: {
    borderTopWidth: 3,
    borderTopColor: "#006E5A",
    paddingTop: 12,
  },
  signalComposition: {
    borderLeftWidth: 4,
    borderLeftColor: "#A92D12",
    paddingLeft: 12,
  },
  calmComposition: { paddingVertical: 8 },
  studioComposition: {
    borderTopWidth: 1,
    borderTopColor: "#4B46B8",
    paddingTop: 18,
  },
  nightComposition: {
    borderBottomWidth: 2,
    borderBottomColor: "#B8F34B",
    paddingBottom: 14,
  },
  studioCopy: { flex: 1, gap: 14 },
  studioVisual: { flex: 1, gap: 10 },
  tabbar: {
    minHeight: 64,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  tab: {
    width: 52,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: "center",
    alignItems: "center",
    gap: 3,
  },
});
const phone = StyleSheet.create({
  actionGrid: { flexDirection: "column", gap: 10, width: "100%", minWidth: 0 },
  card: { minWidth: 0 },
  cardTitle: { flexShrink: 1, lineHeight: 23 },
  cardMeta: { flexShrink: 1, lineHeight: 20 },
  row: { minWidth: 0 },
  rowMark: { flexShrink: 0 },
  rowCopy: { minWidth: 0 },
  rowTitle: { lineHeight: 20 },
  rowMeta: { lineHeight: 18 },
  courseMetricRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    columnGap: 10,
    rowGap: 4,
    minWidth: 0,
  },
  courseDistance: { fontSize: 22, fontWeight: "800", lineHeight: 28 },
  courseTime: { fontSize: 14, fontWeight: "700", lineHeight: 21 },
  courseMeta: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
    flexShrink: 1,
  },
  partyTitle: {
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 25,
    flexShrink: 1,
  },
  partyMeta: { fontSize: 14, fontWeight: "600", lineHeight: 22, flexShrink: 1 },
});
const flow = StyleSheet.create({
  quickActionList: { width: "100%", minWidth: 0, gap: 10 },
  quickActionCard: {
    width: "100%",
    minWidth: 0,
    minHeight: 124,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    justifyContent: "flex-start",
    alignSelf: "stretch",
  },
  quickActionTitle: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "800",
    flexShrink: 1,
  },
  quickActionDescription: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
    flexShrink: 1,
  },
  partySummary: {
    width: "100%",
    minWidth: 0,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  partyMembers: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  partyAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  partyMeeting: { width: "100%", minWidth: 0 },
  partyFacts: { width: "100%", minWidth: 0, paddingTop: 2 },
  partySchedule: { width: "100%", minWidth: 0 },
  partyTitle: {
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 25,
    flexShrink: 1,
  },
  partyMeta: { fontSize: 14, fontWeight: "600", lineHeight: 22, flexShrink: 1 },
});
const layout = StyleSheet.create({
  atlas: { flexDirection: "row", minWidth: 0 },
  sidebar: { width: 10, alignSelf: "stretch", marginRight: 12 },
  signal: { flexDirection: "row", minWidth: 0 },
  actionRail: { width: 6, alignSelf: "stretch", marginRight: 12 },
  calm: { width: "100%", minWidth: 0, paddingVertical: 8 },
  studio: { width: "100%", minWidth: 0, gap: 10 },
  editorialIndex: { fontSize: 13, fontWeight: "900", letterSpacing: 2 },
  night: { width: "100%", minWidth: 0, gap: 12 },
  cockpitBar: {
    minHeight: 34,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  content: { flex: 1, minWidth: 0 },
});
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#EEF0F3" },
  pageContent: { paddingBottom: 40 },
  center: { alignItems: "center", padding: 20 },
  explorer: {
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderColor: "#D9DEE4",
    padding: 18,
    gap: 9,
  },
  explorerTitle: { fontSize: 19, fontWeight: "800", color: "#15202B" },
  explorerBody: { fontSize: 13, color: "#576574" },
  chips: { gap: 8 },
  chip: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "#F0F2F5",
  },
  chipSelected: { backgroundColor: "#172A3A" },
  chipText: { fontSize: 13, color: "#415161", fontWeight: "700" },
  chipTextSelected: { color: "#FFF" },
  viewportRow: { flexDirection: "row", gap: 8 },
  viewport: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#CBD3DC",
    borderRadius: 8,
  },
  viewportSelected: { borderColor: "#172A3A", backgroundColor: "#E8EEF3" },
  viewportText: { color: "#526170", fontSize: 12, fontWeight: "700" },
  viewportTextSelected: { color: "#172A3A", fontSize: 12, fontWeight: "800" },
  canvas: { overflow: "hidden" },
  status: {
    height: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusText: { fontSize: 12, fontWeight: "800" },
  ledger: { flexDirection: "row", flex: 1 },
  sidebar: {
    width: 68,
    borderRightWidth: 1,
    paddingTop: 28,
    gap: 24,
    alignItems: "center",
  },
  sideItem: { fontSize: 10, fontWeight: "800", writingDirection: "ltr" },
  signal: { flexDirection: "row", flex: 1 },
  signalRail: { width: 46, paddingTop: 26, alignItems: "center" },
  railText: {
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 14,
    transform: [{ rotate: "-90deg" }],
    width: 86,
    textAlign: "center",
  },
  quiet: { flex: 1 },
  editorial: { flex: 1 },
  editorialTablet: { flexDirection: "row" },
  editorialIndex: { borderBottomWidth: 1, paddingBottom: 12, marginBottom: 14 },
  indexNo: { fontSize: 42, fontWeight: "900" },
  indexCopy: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  cockpit: { flex: 1 },
  cockpitTop: {
    minHeight: 44,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  frameContent: { flex: 1, paddingLeft: 12 },
  stack: { flex: 1, gap: 14, paddingTop: 14 },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 18,
    paddingHorizontal: 12,
  },
  head: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  headCopy: { flex: 1, gap: 5 },
  headIcon: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  eyebrow: { fontSize: 12, fontWeight: "800", letterSpacing: 0.3 },
  title: { fontWeight: "800", letterSpacing: -0.6 },
  body: { fontSize: 15, fontWeight: "500" },
  authMark: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    minHeight: MIN_TOUCH_TARGET,
    borderBottomWidth: 1,
    borderColor: "#C7CDD4",
    justifyContent: "center",
    gap: 4,
  },
  inputLabel: { fontSize: 11, fontWeight: "700" },
  inputValue: { fontSize: 15, fontWeight: "600" },
  helper: { fontSize: 11, textAlign: "center", lineHeight: 16 },
  action: {
    minWidth: MIN_TOUCH_TARGET,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  actionText: { fontSize: 16, fontWeight: "800" },
  map: {
    height: 176,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  routeA: {
    position: "absolute",
    width: "78%",
    height: "52%",
    left: "7%",
    top: "25%",
    borderWidth: 5,
    borderRadius: 100,
    transform: [{ rotate: "-16deg" }],
  },
  routeB: {
    position: "absolute",
    width: "40%",
    height: "28%",
    right: "8%",
    bottom: "14%",
    borderWidth: 3,
    borderRadius: 100,
    transform: [{ rotate: "22deg" }],
  },
  mapLabel: {
    position: "absolute",
    bottom: 10,
    left: 10,
    right: 10,
    minHeight: 32,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
  },
  mapLabelText: { flex: 1, fontSize: 12, fontWeight: "800" },
  actionGrid: { flexDirection: "row", gap: 10 },
  card: { flex: 1, gap: 8, borderWidth: 1 },
  cardTitle: { fontSize: 16, fontWeight: "800", lineHeight: 22 },
  cardMeta: { fontSize: 13, lineHeight: 19, fontWeight: "500" },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
  },
  rowMark: { width: 8, height: 32, borderRadius: 4 },
  rowCopy: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 14, fontWeight: "800" },
  rowMeta: { fontSize: 12 },
  promptBox: {
    minHeight: 108,
    padding: 14,
    borderWidth: 1,
    borderColor: "#C7CDD4",
    gap: 9,
  },
  tagRow: { flexDirection: "row", gap: 8 },
  tag: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    fontWeight: "700",
  },
  rideMetric: { alignItems: "center", gap: 4 },
  rideNumber: { fontSize: 50, fontWeight: "300", letterSpacing: -2 },
  rideUnit: { fontSize: 16, fontWeight: "700" },
  statStrip: { flexDirection: "row", justifyContent: "space-between" },
  stat: { fontSize: 17, fontWeight: "800" },
  memberRow: { flexDirection: "row" },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -7,
    borderWidth: 2,
    borderColor: "#FFF",
  },
  profileSummary: { alignItems: "center", gap: 6, paddingVertical: 12 },
  largeAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  systemSign: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  stateNotice: {
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  stateNoticeText: { flex: 1, fontSize: 13, fontWeight: "700", lineHeight: 18 },
  tabbar: {
    height: 64,
    marginTop: 14,
    marginHorizontal: -20,
    marginBottom: -20,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  tab: {
    width: 52,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: "center",
    alignItems: "center",
    gap: 3,
  },
  tabLabel: {
    maxWidth: 52,
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
  },
  invalid: {
    flex: 1,
    backgroundColor: "#F5F7F9",
    justifyContent: "center",
    padding: 28,
    gap: 14,
  },
  invalidTitle: {
    fontSize: 25,
    lineHeight: 32,
    fontWeight: "800",
    color: "#1B2630",
  },
  invalidBody: { fontSize: 14, lineHeight: 22, color: "#50606F" },
});
