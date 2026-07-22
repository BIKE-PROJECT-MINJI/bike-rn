import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import { StyleFrame } from "./DesignPreview";
import {
  SCREEN_FIXTURES,
  STYLES,
  type ScreenFixture,
  type ScreenKey,
  type StateKey,
} from "./manifest";

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name, ...props }: { name: string }) =>
      React.createElement(Text, props, name),
  };
});

jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));

const fixture = (key: ScreenKey, state?: StateKey): ScreenFixture => ({
  ...SCREEN_FIXTURES.find((item) => item.key === key)!,
  state: state ?? SCREEN_FIXTURES.find((item) => item.key === key)!.state,
});
const atlas = STYLES.find((style) => style.id === "atlas")!;

describe("design preview rendered semantics", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders each quick action as a pressable container with its own children and preserves style/viewport", () => {
    const screen = render(
      <StyleFrame
        style={atlas}
        fixture={fixture("home")}
        viewport="tablet"
        capture
      />,
    );
    const ai = screen.getByTestId("quick-action-AI 코스");
    const free = screen.getByTestId("quick-action-자유주행");
    expect(ai.props.accessibilityRole).toBe("button");
    expect(ai.findByProps({ children: "AI 코스" })).toBeTruthy();
    expect(free.findByProps({ children: "바로 기록 시작하기" })).toBeTruthy();
    fireEvent.press(ai);
    expect(router.replace).toHaveBeenCalledWith({
      pathname: "/design-preview",
      params: {
        style: "atlas",
        screen: "ai-route-create",
        state: "default",
        viewport: "tablet",
      },
    });
    fireEvent.press(free);
    expect(router.replace).toHaveBeenLastCalledWith({
      pathname: "/design-preview",
      params: {
        style: "atlas",
        screen: "free-ride",
        state: "default",
        viewport: "tablet",
      },
    });
  });

  it("renders party members, meeting, facts, and schedule in sibling containers", () => {
    const screen = render(
      <StyleFrame
        style={atlas}
        fixture={fixture("party-detail")}
        viewport="phone"
        capture
      />,
    );
    const summary = screen.getByTestId("party-summary");
    expect(summary.findByProps({ testID: "party-members" })).toBeTruthy();
    expect(summary.findByProps({ testID: "party-meeting" })).toBeTruthy();
    expect(summary.findByProps({ testID: "party-facts" })).toBeTruthy();
    expect(screen.getByTestId("party-schedule")).toBeTruthy();
  });

  it("renders six distinct loading skeleton areas with their own block counts", () => {
    const cases: Array<[ScreenKey, StateKey, string, number]> = [
      ["login", "loading", "auth", 3],
      ["courses", "loading", "list", 4],
      ["course-detail", "loading", "detail", 3],
      ["free-ride", "loading", "ride", 2],
      ["profile", "loading", "profile-settings", 4],
      ["offline", "loading", "system", 2],
    ];
    cases.forEach(([key, state, area, count]) => {
      const screen = render(
        <StyleFrame
          style={atlas}
          fixture={fixture(key, state)}
          viewport="phone"
          capture
        />,
      );
      expect(screen.getByTestId(`loading-skeleton-${area}`)).toBeTruthy();
      expect(
        screen.getAllByTestId(new RegExp(`loading-${area}-block-`)),
      ).toHaveLength(count);
    });
  });

  it("renders tablet ScreenKey content rather than a group-only placeholder", () => {
    const ai = render(
      <StyleFrame
        style={atlas}
        fixture={fixture("ai-route-create")}
        viewport="tablet"
        capture
      />,
    );
    expect(ai.getByLabelText("AI 코스 요청")).toBeTruthy();
    const record = render(
      <StyleFrame
        style={atlas}
        fixture={fixture("record-detail")}
        viewport="tablet"
        capture
      />,
    );
    expect(record.getByText("24.8km")).toBeTruthy();
    const party = render(
      <StyleFrame
        style={atlas}
        fixture={fixture("party-detail")}
        viewport="tablet"
        capture
      />,
    );
    expect(party.getByTestId("party-meeting")).toBeTruthy();
    const settings = render(
      <StyleFrame
        style={atlas}
        fixture={fixture("settings")}
        viewport="tablet"
        capture
      />,
    );
    expect(settings.getByText("주행 기록 저장공간")).toBeTruthy();
  });

  it("changes the rendered information order for each layout family", () => {
    const renderedOrder = (styleId: typeof atlas.id) => {
      const style = STYLES.find((item) => item.id === styleId)!;
      const screen = render(
        <StyleFrame style={style} fixture={fixture("home")} viewport="phone" capture />,
      );
      return screen
        .getAllByTestId(/home-block-/)
        .map((node) => node.props.testID);
    };
    expect(renderedOrder("atlas")).toEqual([
      "home-block-head",
      "home-block-map",
      "home-block-actions",
      "home-block-list",
    ]);
    expect(renderedOrder("signal")).toEqual([
      "home-block-actions",
      "home-block-head",
      "home-block-list",
      "home-block-map",
    ]);
    expect(renderedOrder("calm")).toEqual([
      "home-block-head",
      "home-block-list",
      "home-block-actions",
      "home-block-map",
    ]);
  });

  it("keeps row destinations explicit while retaining the current style and viewport", () => {
    const screen = render(
      <StyleFrame style={atlas} fixture={fixture("profile")} viewport="tablet" capture />,
    );
    fireEvent.press(screen.getByLabelText("내 활동 상세 보기"));
    expect(router.replace).toHaveBeenCalledWith({
      pathname: "/design-preview",
      params: { style: "atlas", screen: "settings", state: "default", viewport: "tablet" },
    });
  });
});
