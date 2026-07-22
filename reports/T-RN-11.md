# T-RN-11 Issue #11 diagnosis

- Root cause: the failed Android runner was unauthenticated, so the screen intentionally disabled address search; this was not an address product defect.
- Local fake backend evidence: HTTP 200, `AMBIGUOUS`, 2 candidates, provider `FAKE`, fallback unused (sanitized; no address or coordinates recorded).
- Mapper evidence: `AMBIGUOUS` maps to success and preserves both candidates.
- Screen evidence: both candidate cards render with `목적지로 선택`; choosing one changes exactly one badge to `선택됨`.
- Changes: `addressMapper.test.ts`, `AiRouteCreateScreen.test.tsx`; no production source or E2E branch change.
- Focused Jest: 3 suites, 6 tests passed (2026-07-23).
- Typecheck: `tsc --noEmit` passed (2026-07-23).
- Full Jest: 62 suites, 254 tests passed (2026-07-23).
- Diff check: passed (2026-07-23).
- Android Maestro: current Metro bundle reached AI creation; unauthenticated runner displayed the login CTA, confirming the runner gate.
- Issue: #11 remains open pending independent exact-SHA review and merge.
- Draft PR/SHA: pending publication.
- Remaining risk: rerun candidate-card Maestro assertions with an authorized local session.
