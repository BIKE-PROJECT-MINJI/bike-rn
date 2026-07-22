# T-RN-E2E-01 local Android pre-AWS evidence

## 2026-07-23 remaining functional matrix

All observations use test ID `T-RN-E2E-01`, emulator `emulator-5554`, backend `/ready=200`, AI `/health=200`, and the local Metro bundle with reverse mappings for 8080/8081. Evidence is sanitized: no passwords, bearer tokens, backend IDs, precise coordinates, or route points are retained.

| Scenario | Result | User-visible assertion | Sanitized backend/API evidence |
|---|---|---|---|
| A. Login/profile | PASS | `로그인됨` and the authenticated account screen rendered after the clean login replay. | Fresh local registration and UI login were 200/PASS; sanitized replay remains under `login-replay/`. |
| B. Destination AI course/detail/query | FAIL | Authenticated route screen accepted a destination query but displayed `검색 결과에서 목적지를 선택하거나 입력을 지워 주세요.`; no selectable result appeared. | Backend and AI health were 200. This blocks candidate/course detail creation; filed [Issue #11](https://github.com/BIKE-PROJECT-MINJI/bike-rn/issues/11). |
| C. Free ride, GPS, save, finalization/restart | PARTIAL | HUD showed `주행 기록 중입니다. 화면을 잠가도 로컬에 계속 저장합니다.`; after stop/save it showed local preservation rather than finalization. | The app displayed `서버가 주행 데이터를 처리하지 못했습니다. 로컬 기록은 유지됩니다.` despite healthy backend; filed [Issue #12](https://github.com/BIKE-PROJECT-MINJI/bike-rn/issues/12). Separate real API replay observed `FINALIZING` then `READY`. |
| D. Same clientRideId | PASS | Covered by the same local-recording UI preservation path. | Two POSTs with one generated client ride ID returned 200 and the same backend record; `sameBackendRecord=true`. |
| E. Offline/reconnect/sync | PARTIAL | With emulator Wi-Fi/data disabled, Home retained `저장 대기 1건` and `원본은 기기에 안전하게 보관 중입니다.`. | Re-enable/restart was attempted; automatic remote sync remains blocked by the free-ride upload defect in Issue #12, so no false PASS is claimed. |
| F. Party create/join/location stop | PARTIAL | Party tab rendered `Local E2E Party`, `2/3명`, `주행 중`, and `호스트`. | Two fresh accounts created/joined/started a party (200/200/200; memberCount=2). The location-sharing switch is only reachable after a course-start path, which B currently blocks, so share/stop is UNVERIFIED. |

`ops/e2e/replay-local-api-matrix.mjs` is the replayable local-only API evidence harness. Its generated `api-matrix/status.json` records only HTTP/status/count outcomes; it verified save, dedupe, FINALIZING-to-READY polling, Party create/join/start, and member count.

Lenovo remains UNVERIFIED: `adb devices -l` listed only `emulator-5554`.

1. Environment: `emulator-5554` (`gaja_wsl_api35`), Android API 35; Lenovo is absent from `adb devices` and remains UNVERIFIED.
2. Backend main `a968addee6754a552273c63440262da84bd06956` `/ready`=200 and AI main `464ce4e0862e7ceafdeaf7633d663e80c57e46de` `/health`=200 were observed locally.
3. First native build failed as expected with `SDK location not found` because `ANDROID_HOME` was unset.
4. `ANDROID_HOME=/home/alstn/Android/Sdk ./gradlew -PreactNativeArchitectures=x86_64 app:assembleDebug app:installDebug`: PASS (APK installed on emulator).
5. Installed package: `com.bikeprojectminji.gaja`, version `1.0.0`/code `1`, updated `2026-07-23 04:40:19`.
6. APK: `android/app/build/outputs/apk/debug/app-debug.apk`, SHA-256 `7b694807dc560265cb2580083192f477a2fe51f30d2178eb2130d6ed43caa983`.
7. Metro remediation PASS: `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8080 npx expo start --dev-client --localhost --port 8081`, then `adb reverse tcp:8081 tcp:8081` and `tcp:8080`; canonical app loaded the JS bundle.
8. Maestro `2.7.0` is usable on API 35; Home assertions passed after the dev-client onboarding overlay was dismissed.
9. Three ephemeral local API accounts were created successfully; tokens were redacted and never stored in this report.
10. `npm run typecheck`: PASS; `npm test -- --runInBand`: PASS; `git diff --check`: PASS.
11. UI login PASS on `emulator-5554`: the clean-state Maestro replay injected a fresh local account with `--env`, tapped the submit control below `비밀번호`, and asserted `로그인됨`. The prior non-transition was test contamination: missing Maestro `--env` values became `undefined`, the indexed selector tapped the mode control, and subsequent attempts appended to uncleared React Native fields; direct local register/login responses were both 200.
12. Final matrix outcome: B is FAIL and tracked by Issue #11; C and E are PARTIAL and tracked by Issue #12; D is PASS; F is PARTIAL because Party create/join/start passed but the location-share stop path remains blocked by B.
13. No precise coordinate or credential is retained; the tracked Maestro and E2E sources retain only field names and sanitize bearer/token, password, high-precision coordinate, and ephemeral-account values in generated evidence.
14. Final verification: `npm run typecheck` PASS; `npm test -- --runInBand` PASS (61 suites, 252 tests); the local API replay PASS; and `git diff --check` PASS. The native UI matrix outcomes above are the final source of truth; no outcome is upgraded beyond its observed evidence.
15. Final delivery is Draft PR [#13](https://github.com/BIKE-PROJECT-MINJI/bike-rn/pull/13), linked to Issue #10; its exact current head SHA is maintained in the PR body and verified at handoff.
