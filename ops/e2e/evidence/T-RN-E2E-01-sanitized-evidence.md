# T-RN-E2E-01 tracked sanitized evidence

This directory intentionally contains only replayable source hashes and sanitized, machine-readable run manifests. Raw Maestro output, logcat, screenshots, XML dumps, Metro logs, account JSON, and credential-entry/codepoint captures are ignored and deleted by the runner after status extraction.

The runner uses one unique `ops/e2e/artifacts/T-RN-E2E-01/<run-id>` directory per invocation, writes `final-status.json` by atomic rename, and always returns nonzero for the currently known `FAIL`/`PARTIAL` matrix. Local test accounts are backend-local only and are removed from `/tmp` after a run; no account values, tokens, IDs, routes, or precise coordinates belong in this repository.

The following SHA-256 values pin the reviewed E2E sources, rather than volatile or secret-bearing raw output:

```
df1a0681eaadd50c2980400a9cf6d129df1063a07c841883d9893b39d94835b1  ops/e2e/run-local-android-e2e.sh
66bad9e08f9dafcb000c2f0e678be186a1020f48f6ae572b6798210e0c443553  ops/e2e/replay-local-api-matrix.mjs
e9e99f43c482f143c2b26910e8d3b09c86eb5d5fdc5162726dd7cae29c128a1c  .maestro/local-login-repro.yaml
e106a252dd519204c37c60bc6eacc326ef5a7ca0252e56cf0f9dad88e51eb850  .maestro/local-ai-route-e2e.yaml
45b6a23f2cbaef271ce00b501269facfc4e04807a64241664c72433e6f6e83c9  .maestro/local-ride-offline-e2e.yaml
4bf8e1fe00331d10f5b8c952f04bc6afbd34b2466c01219379502a90b8afe31e  .maestro/local-party-e2e.yaml
```
