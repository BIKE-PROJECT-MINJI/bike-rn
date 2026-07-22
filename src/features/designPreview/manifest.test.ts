import {
  canonicalCaptureTargets,
  captureTargets,
  contrastRatio,
  DOMAIN_FIXTURES,
  ERROR_RECOVERY,
  INTERACTION_CONTRACT,
  LOADING_AREAS,
  MIN_TOUCH_TARGET,
  NORMAL_FLOW_CONTRACT,
  PHONE_READABILITY_CONTRACT,
  SCREEN_FIXTURES,
  SCREEN_RENDERERS,
  SEMANTIC_BLOCKS,
  STYLES,
  STYLE_COMPOSITIONS,
  TABLET_CANVAS_HEIGHT,
  TAB_BY_GROUP,
  VIEWPORTS,
  fixtureRegistry,
  isScreenKey,
  isStateKey,
  isStyleId,
  isViewportId,
  parsePreviewRequest,
} from "./manifest";

describe("design preview manifest", () => {
  it("defines exactly five distinct visual systems and layout families", () => {
    expect(STYLES).toHaveLength(5);
    expect(new Set(STYLES.map((style) => style.id)).size).toBe(5);
    expect(new Set(STYLES.map((style) => style.layoutFamily)).size).toBe(5);
    expect(new Set(Object.values(STYLE_COMPOSITIONS)).size).toBe(5);
    expect(
      new Set(
        STYLES.map(
          (style) =>
            `${style.radius}/${style.screen}/${style.title}/${style.buttonHeight}`,
        ),
      ).size,
    ).toBe(5);
  });

  it("covers every launch and current route screen with deterministic Korean fixtures", () => {
    const keys = SCREEN_FIXTURES.map((fixture) => fixture.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "login",
        "signup",
        "password-recovery",
        "onboarding",
        "location-permission",
        "notification-permission",
        "home",
        "courses",
        "course-detail",
        "saved-courses-empty",
        "pre-ride",
        "free-ride",
        "ai-route-create",
        "records",
        "record-detail",
        "records-empty",
        "party-list",
        "party-detail",
        "party-disconnected",
        "profile",
        "settings",
        "offline",
        "force-update",
        "error-recovery",
      ]),
    );
    expect(Object.keys(fixtureRegistry)).toHaveLength(SCREEN_FIXTURES.length);
    expect(
      SCREEN_FIXTURES.every(
        (fixture) => fixture.title.length > 1 && fixture.body.length > 4,
      ),
    ).toBe(true);
    expect(new Set(SCREEN_FIXTURES.map((fixture) => fixture.group))).toEqual(
      new Set([
        "auth",
        "home",
        "courses",
        "ride",
        "records",
        "party",
        "profile",
        "system",
      ]),
    );
    expect(Object.keys(SCREEN_RENDERERS)).toHaveLength(8);
    expect(
      SCREEN_FIXTURES.every((fixture) =>
        SCREEN_RENDERERS[fixture.group].endsWith("Presentation"),
      ),
    ).toBe(true);
  });

  it("assigns screen-key semantic blocks before style composition", () => {
    expect(Object.keys(SEMANTIC_BLOCKS)).toHaveLength(SCREEN_FIXTURES.length);
    expect(
      SCREEN_FIXTURES.every(
        (fixture) => SEMANTIC_BLOCKS[fixture.key].length > 0,
      ),
    ).toBe(true);
    expect(SEMANTIC_BLOCKS["ai-route-create"]).toContain("ai-request");
    expect(SEMANTIC_BLOCKS["free-ride"]).toEqual(["ride-hud"]);
    expect(SEMANTIC_BLOCKS["free-ride"]).not.toContain("course-summary");
    expect(SEMANTIC_BLOCKS["course-detail"]).toEqual(
      expect.arrayContaining(["course-summary", "departure-check"]),
    );
    expect(SEMANTIC_BLOCKS["record-detail"]).toContain("record-summary");
    expect(SEMANTIC_BLOCKS["party-detail"]).toContain("party-summary");
  });

  it("keeps the five-style phone readability contract for semantic home and detail screens", () => {
    expect(PHONE_READABILITY_CONTRACT.width).toBe(390);
    expect(PHONE_READABILITY_CONTRACT.styles).toEqual(
      STYLES.map((style) => style.id),
    );
    expect(PHONE_READABILITY_CONTRACT.screens).toEqual([
      "home",
      "course-detail",
      "party-detail",
    ]);
    expect(PHONE_READABILITY_CONTRACT.homeActionLayout).toBe(
      "stacked-full-width",
    );
    expect(PHONE_READABILITY_CONTRACT.textOverlap).toBe(0);
    expect(PHONE_READABILITY_CONTRACT.clipping).toBe(0);
  });

  it("keeps quick actions and party facts in distinct normal-flow containers", () => {
    expect(NORMAL_FLOW_CONTRACT.quickActionCard).toEqual([
      "icon",
      "title",
      "description",
    ]);
    expect(NORMAL_FLOW_CONTRACT.partyDetailBlocks).toEqual([
      "members",
      "meeting",
      "facts",
      "schedule",
    ]);
    expect(NORMAL_FLOW_CONTRACT.forbids).toEqual([
      "absolute",
      "negative-margin",
    ]);
  });

  it("keeps all 240 canonical URLs and adds meaningful allowed state variants without duplicates", () => {
    expect(canonicalCaptureTargets).toHaveLength(
      STYLES.length * SCREEN_FIXTURES.length * Object.keys(VIEWPORTS).length,
    );
    expect(captureTargets.length).toBeGreaterThan(
      canonicalCaptureTargets.length,
    );
    expect(
      new Set(
        captureTargets.map(
          (target) =>
            `${target.style}/${target.screen}/${target.state}/${target.viewport}`,
        ),
      ).size,
    ).toBe(captureTargets.length);
    expect(
      SCREEN_FIXTURES.find((fixture) => fixture.key === "home")?.allowedStates,
    ).toEqual(expect.arrayContaining(["default", "loading", "error"]));
    expect(
      SCREEN_FIXTURES.find((fixture) => fixture.key === "records")
        ?.allowedStates,
    ).toEqual(expect.arrayContaining(["finalizing", "loading", "error"]));
  });

  it("guards URL values and exposes phone and tablet fixtures", () => {
    expect(isStyleId("atlas")).toBe(true);
    expect(isStyleId("nope")).toBe(false);
    expect(isScreenKey("home")).toBe(true);
    expect(isScreenKey("unknown")).toBe(false);
    expect(isStateKey("finalizing")).toBe(true);
    expect(isStateKey("wrong")).toBe(false);
    expect(isViewportId("phone")).toBe(true);
    expect(isViewportId("tablet")).toBe(true);
    expect(isViewportId("desktop")).toBe(false);
    expect(VIEWPORTS.phone.width).toBe(390);
    expect(VIEWPORTS.tablet.width).toBe(834);
    expect(
      parsePreviewRequest({
        style: "atlas",
        screen: "home",
        state: "default",
        viewport: "phone",
      }).valid,
    ).toBe(true);
    expect(
      parsePreviewRequest({
        style: "atlas",
        screen: "home",
        state: "loading",
        viewport: "phone",
      }).state,
    ).toBe("loading");
    expect(
      parsePreviewRequest({
        style: "atlas",
        screen: "login",
        state: "loading",
        viewport: "phone",
      }).valid,
    ).toBe(false);
    expect(
      parsePreviewRequest({
        style: "wrong",
        screen: "home",
        state: "default",
        viewport: "phone",
      }).valid,
    ).toBe(false);
    expect(MIN_TOUCH_TARGET).toBeGreaterThanOrEqual(48);
    expect(VIEWPORTS.phone.height).toBeGreaterThanOrEqual(844);
    expect(VIEWPORTS.tablet.height).toBeGreaterThanOrEqual(1194);
    expect(TABLET_CANVAS_HEIGHT).toBe(1194);
    expect(INTERACTION_CONTRACT).toEqual({
      input: "TextInput",
      action: "Pressable",
      row: "Pressable",
      tab: "Pressable",
      minTarget: 48,
    });
    expect(TAB_BY_GROUP).toEqual({
      auth: null,
      home: 0,
      courses: 1,
      ride: null,
      records: 2,
      party: 3,
      profile: 4,
      system: null,
    });
    expect(LOADING_AREAS).toHaveLength(6);
    expect(ERROR_RECOVERY.records.action).toBe("다시 시도");
    expect(DOMAIN_FIXTURES.settings[0]).toBe("알림과 권한");
  });

  it("keeps semantic text and button foreground contrast at WCAG AA", () => {
    STYLES.forEach((style) => {
      const assertContrast = (
        token: string,
        foreground: string,
        background: string,
      ) => {
        const ratio = contrastRatio(foreground, background);
        if (ratio < 4.6)
          throw new Error(
            `contrast failure style=${style.id} token=${token} foreground=${foreground} background=${background} ratio=${ratio}`,
          );
      };
      assertContrast("ink", style.ink, style.bg);
      assertContrast("muted", style.muted, style.bg);
      assertContrast("accent", style.accent, style.bg);
      assertContrast("accentInk", style.accentInk, style.accent);
    });
  });
});
