# T-RN-E2E-01 local Android pre-AWS evidence

## Current result (2026-07-23)

The full local matrix was run against the pre-amendment candidate `6318984a114e0da669249241315c43956933e392` with `emulator-5554`, local `/ready=200`, a validated `http://127.0.0.1:8080` endpoint, and Maestro `2.7.0`. It correctly returned nonzero and its atomic machine-readable outcome was `FAIL`: native `FAIL`, login `FAIL`, AI `FAIL`, ride/offline `PARTIAL`, Party `PARTIAL`, and strict API matrix `PASS`.

The strict API replay observed `/ready=200`, two different local-only accounts, two `200` ride saves converging on one record, `FINALIZING` then `READY`, and Party create/join/start `200/200/200` with `memberCount=2`. The native/login failures and AI failure remain blockers; ride/offline and Party user journeys remain partial and are not represented as successful merely because their API preconditions passed (known issues [#11](https://github.com/BIKE-PROJECT-MINJI/bike-rn/issues/11) and [#12](https://github.com/BIKE-PROJECT-MINJI/bike-rn/issues/12) remain open).

## Reproducibility and privacy controls

`npm run e2e:local-android` validates the API URL before reading its account file or making a request. It accepts only `http://127.0.0.1:<port>` or `http://localhost:<port>`, clears app state, starts and verifies local Metro with `EXPO_PUBLIC_API_BASE_URL` set to that exact URL, configures `adb reverse` for Metro and API ports, then executes login, AI, free-ride/offline, Party, and API replay attempts.

Each invocation uses a new run-ID directory and atomically publishes `final-status.json`; it deliberately exits nonzero while any scenario is `FAIL` or `PARTIAL`. API replay is fail-closed unless readiness, account distinctness, ride idempotency, `READY`, Party `200/200/200`, and two members all hold.

Only [sanitized source-hash evidence](evidence/T-RN-E2E-01-sanitized-evidence.md) is tracked. Raw logcat, Maestro input output, screenshots, XML, Metro output, account JSON, and `/tmp` credential/log files were deleted after extracting the result; the bounded `npm run e2e:scan-evidence` scan checks tracked E2E evidence for email, plaintext password, JWT/bearer, high-precision coordinate, and long decimal codepoint-sequence leakage.

## Final local verification

- `npm run e2e:local-android:selftest`: PASS.
- `npm run e2e:scan-evidence`: PASS.
- Full local E2E matrix: expected nonzero / `FAIL`, as stated above; no false green.
- `npm run typecheck`: PASS.
- `npm test -- --runInBand`: PASS (61 suites, 252 tests).
- `git diff --check`: PASS at final handoff.
