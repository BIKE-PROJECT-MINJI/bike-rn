# GAJA React Native / Expo Go 클라이언트

이 앱은 2026-06-24 현재 BIKE/GAJA의 **React Native + Expo Go 기준 모바일 검증 클라이언트**다.
기존 `dev/bike-front` Kotlin + Compose 앱은 과거 Android Native reference로 보관하고, 새 앱 테스트 gate는 이 RN 앱을 기준으로 판정한다.

## 목적

- 로컬 백엔드를 Ngrok으로 공개한다.
- 휴대폰 Expo Go에서 QR로 바로 실행한다.
- 홈, 코스 목록, 주소 검색, AI 경로 추천, pre-ride 경로 preview, foreground HUD 골격을 빠르게 확인한다.

## 실행

```bash
cd dev/bike-rn
cp .env.example .env
npm ci
npm start
```

로컬 백엔드를 터널로 열 때는 `.env.local`의 `EXPO_PUBLIC_API_BASE_URL`을 Ngrok 주소로 바꾼다.

```bash
printf 'EXPO_PUBLIC_API_BASE_URL=https://<your-ngrok-domain>\n' > .env.local
npx expo start --lan --port 8081
```

폰이 같은 LAN에서 WSL Metro에 접근하지 못하거나 외부 네트워크에서 테스트해야 하면, backend와 Metro를 하나의 ngrok URL 뒤에 묶는 개발 프록시를 사용한다.

```bash
# terminal 1: backend
cd /mnt/e/bike-work/worktrees/bike-back-course-publications-clean
set -a && source .env && set +a
./gradlew bootRun

# terminal 2: Expo Metro
cd /mnt/e/bike-work/bike/dev/bike-rn
EXPO_PUBLIC_API_BASE_URL=https://<your-ngrok-domain> npm run start:lan

# terminal 3: local proxy
cd /mnt/e/bike-work/bike/dev/bike-rn
npm run proxy:expo-go

# terminal 4: ngrok -> proxy
cd /mnt/e/bike-work/bike/dev/bike-rn
./.local/bin/ngrok http 18080 --config /tmp/bike-ngrok-20260624.yml
```

Expo Go에서 수동 URL을 입력할 때는 HTTPS 터널이므로 `exps://<your-ngrok-domain>` 형식을 사용한다.
2026-06-24 현재 실행 중인 예시는 `exps://rank-nonapplicative-fluidly.ngrok-free.dev`다.

## 백엔드 터널 예시

백엔드는 기본적으로 `dev/bike-back` 또는 백엔드 worktree에서 `PORT=8080`으로 실행한다고 가정한다.

```bash
cd /mnt/e/bike-work/worktrees/bike-back-course-publications-clean
./gradlew bootRun
```

Ngrok:

```bash
NGROK_BIN="/mnt/e/bike-work/bike/dev/bike-rn/.local/bin/ngrok" npm run c003:ngrok-preflight
```

`NGROK_AUTHTOKEN`이 비어 있으면 Expo Go 외부 URL smoke는 완료로 보지 않는다.
수동 실행은 로컬 또는 WSL 환경의 ngrok config에 authtoken이 이미 저장돼 있어야 한다.
`c003:ngrok-preflight`는 `.env`의 `NGROK_AUTHTOKEN`을 읽을 수 있지만, 실행 중 프로세스 인자에 토큰을 싣지 않고 임시 config를 만들어 사용한다.

현재 로컬 기준:

- ADB 기준 실행 파일은 WSL `/usr/bin/adb`다.
- Windows SDK `platform-tools/adb`는 `/usr/bin/adb`를 호출하는 래퍼이며, `adb.exe`는 현재 기준 경로에 없다.
- `adb devices -l`에 실기기가 없으면 Expo Go 실기기 smoke를 통과로 기록하지 않고 환경 차단으로 기록한다.
- `dev/bike-rn/node_modules/.bin/ngrok`와 Expo 전역 ngrok 후보는 v2 계열이므로 preflight 기준에 미달한다.
- ngrok v3 기준 경로는 `/mnt/e/bike-work/bike/dev/bike-rn/.local/bin/ngrok`다.
- Windows ngrok v3 후보 `/mnt/c/dev/bikeoasis-mobile/node_modules/ngrok/bin/ngrok.exe`는 fallback 후보지만, WSL 4040 API 접근이 불안정해 기본값으로 쓰지 않는다.
- 2026-06-04 G003 기준 `adb devices -l`에 device가 없어 실기기 smoke는 `BLOCKED`로 분리했고, 로컬 RN typecheck/Jest와 ngrok 원격 backend API smoke는 통과했다.
- 2026-06-24 프로토타입 기준 `dev/bike-rn`을 활성 경로로 복구했다. Expo CLI `--tunnel`은 ngrok 세션 제한으로 실패했으므로, `ops/prototype/expo-go-dev-proxy.js`로 backend `/api`와 Metro manifest/bundle을 하나의 ngrok URL 뒤에 묶는다. Expo Go에는 `exps://<ngrok-domain>`을 입력한다.

## Expo Go v1 범위

포함:

- REST API 호출
- 홈 / 코스 / pre-ride / 내 정보 / 자유 주행 HUD 골격
- 주소 검색
- AI route REST plan 요청
- foreground 위치 권한과 위치 sample
- `react-native-maps` 기반 지도 preview
- pre-ride 코스 경로와 AI route를 서로 다른 source label/color로 표시

제외:

- Kakao native SDK 로그인
- MapLibre Native 1:1 재현
- release AAB / Play Console 검증
- 백그라운드 위치
- 커스텀 Kotlin/Java native module
- Expo CLI tunnel 자동 생성. 현재 환경에서는 ngrok 세션 제한으로 실패했으므로 개발 프록시 + 직접 ngrok 실행을 우선한다.

## 검증

```bash
npm test
npm run typecheck
npm run check:prototype
npm run check:native
npm run c003:ngrok-preflight
```

현재 테스트는 mapper, 상태 reducer, API base URL/WebSocket URL 변환을 빠르게 검증한다.
`check:prototype`은 현재 public ngrok URL 기준 backend/Metro/proxy 포트, ngrok tunnel mapping, public `/health`, Expo Android manifest rewrite, Android JS bundle marker, public `/prototype-dashboard`, dashboard trailing slash, public dashboard live status marker, public QR/기록지/감사표/상세 안내 링크, Expo Go URL/QR/테스트 문서 산출물 존재를 한 번에 확인한다.
`check:native`는 ADB 연결 기기, AVD `gaja_wsl_api35`, `/dev/kvm` 권한을 확인한다. 기본값은 차단 상태를 보고만 하고 성공 종료하며, `REQUIRE_NATIVE_DEVICE=1 npm run check:native`로 실행하면 ADB/KVM 차단을 실패로 처리한다.
`c003:ngrok-preflight`는 `NGROK_AUTHTOKEN` 또는 기존 ngrok config와 로컬 백엔드가 준비됐을 때 public backend URL을 확인하고, Expo Go route source 스크린샷 전 evidence를 갱신한다.

2026-06-04 G003에서 확인한 최소 통과선:

- `npm run typecheck` PASS
- `npm test -- --runInBand` PASS, 5 suites / 16 tests
- ngrok public backend smoke PASS
- Expo Go 실기기 smoke는 ADB device 없음으로 `BLOCKED`

2026-06-24 프로토타입 smoke:

- `npm run typecheck` PASS
- `npm run check:prototype` PASS
- `npm run check:native` BLOCKED, ADB 연결 기기 없음, AVD 있음, `/dev/kvm` 권한 없음
- `npm test -- --runInBand` PASS, 11 suites / 25 tests
- Android Metro bundle compile PASS
- local backend `/health`, `/api/v1/courses`, `/api/v1/auth/register` PASS
- ngrok proxy `/health`, `/api/v1/courses`, Android Expo manifest, Android bundle fetch PASS
- public browser 서버 연결 카드 `백엔드 연결 정상 / bike-back` PASS
- public browser 회원가입 후 `테스트 계정 상태`, 이메일, 사용자 ID, 토큰 남은 시간 표시 PASS
- public browser 코스 목록 -> pre-ride -> 주행 화면 `코스 주행 · <코스명>` 전달, 로그아웃 reset PASS
- public browser 로그인 후 홈 주소 검색 후보 표시 PASS
- public browser 위치 권한 없음 안내 PASS
- public browser 테스트 좌표 AI route 결과 카드와 route preview PASS
- public API 주소 검색 + AI route plan bearer token 호출 PASS
- public Android launch asset에 서버 연결 health service와 profile session summary 포함 확인 PASS
- public phone dashboard `/prototype-dashboard` PASS
- public phone dashboard live status PASS, browser에서 backend health, Android manifest, QR asset 3개가 모두 `PASS`로 갱신됨
- QR PNG는 `ARTIFACTS/expo-go-prototype-2026-06-24/expo-go-qr.png`
- AVD `gaja_wsl_api35`는 존재하지만 `/dev/kvm` 권한 제한으로 x86_64 emulator 부팅이 차단됨
- Expo Go 실기기 smoke는 ADB device 없음으로 `BLOCKED`

폰 수동 확인은 `내 정보 > 새 테스트 계정`으로 세션 상태를 먼저 확인한 뒤, `홈 > 주소 검색 > 후보 선택 > 현재 위치로 추천`에서 위치 권한 허용 흐름을 본다.
권한이나 GPS가 불안정하면 `테스트 좌표로 추천`으로 AI route 결과 카드와 지도 preview를 먼저 확인한다.
