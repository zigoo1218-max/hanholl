# Project Status

## 현재 단계

`Phase 3. 구현`

## 완료된 작업

- 전용 신규 프로젝트 필요성 확인
- 관람객 직접 조작형 3D 갤러리 방향 확정
- 노트북과 프로젝터 기반 행사 운영 조건 확인
- 구현 PC와 전시 PC가 다른 상황을 고려한 로컬 우선 이관 정책 확정
- 초기 약 9~10개, 향후 최대 20개 작품 확장 요구사항 반영
- 팀 단위 작품 캡션 구조 확정
- 한홀중학교 공식 상징 정보 확인
- 사용자 제공 홍보영상의 대표 프레임 확인
- 홍보영상을 입장 화면 선택형 배경으로 활용하는 방향 결정
- 요구사항, 구현 계획, 태스크 원장 작성
- Next.js App Router 스캐폴드와 3D 렌더링 의존성 설치
- 기획안 기반 가칭 작품 9개와 확장 가능한 메타데이터 배열 구현
- 학교 홍보영상 기반 입장 화면 구현
- 복도형 3D 전시관, 키보드 이동, 마우스 시점 조작 구현
- 작품 상세 캡션 모달과 선택 시점 로컬 영상 로드 구현
- 2D 작품 목록과 WebGL 미지원 대체 경로 구현
- 전시 PC 이관 및 행사 운영 README 작성
- 촬영 중 기획안을 기준으로 9개 작품의 가칭, 대표 학생팀, 소재, 촬영 장소 등록
- `5A조`, `5B조`를 별도 작품으로 분리하고 로컬 영상 파일명도 `team-05a.mp4`, `team-05b.mp4`로 구분
- 전체 참여 학생 명단 확정 전 UI 표기를 `참여 학생`에서 `팀 정보`로 조정
- 전후면 안내 그래픽, 내부 벽 패턴, 바닥 타일을 절차적 캔버스 텍스처로 적용
- 실제 전시장 관행에 맞춰 작품 우측 벽면 캡션 카드에 팀 표기, 가칭 제목, 팀 정보 노출
- 전시관 내부 비주얼 리디자인(2026-10-08): 어두운 천장·트랙 조명·웜 플라스터 벽·반사 바닥, 황동 테두리 액자, 액자별 픽처 라이트와 벽면 조명 풀, 3D 캡션 플레이트, 하단 강조색 LED, 중앙 벤치, 고해상도 정면 타이틀 월
- 액자 비율을 썸네일 실측 비율로 자동 결정(세로 영상은 세로 액자, 가로 영상은 가로 액자). `orientation` 데이터 필드는 썸네일 로드 전 초기값으로만 사용
- HUD(상단 바·조작 안내·터치 패드)를 다크 글래스 스타일로 통일하고, 터치 패드를 포인터 이벤트 기반으로 재작성(손가락을 떼면 즉시 정지)
- 세로 화면(모바일)에서는 시야각을 80°로 넓혀 양쪽 벽이 함께 보이도록 조정, 저사양·터치 기기에서는 반사 바닥과 스포트라이트를 끄는 라이트 모드
- 작품 상세 대화상자를 다크 시네마 스타일로 재구성, 세로 영상은 세로 플레이어 박스로 표시, 터치 기기에서는 재생 컨트롤 상시 표시

## 진행 중인 작업

- 팀별 확정 제목, 전체 참여 학생 명단, 영상 파일 수급
- 전시용 PC 이관 및 프로젝터 현장 검증 준비

## 다음 단계

`Phase 3. 구현`

1. 팀별 확정 제목과 전체 참여 학생 이름 입력
2. 실제 작품 영상과 썸네일 등록
3. 전시용 PC 폴더 복사 및 프로젝터 환경 검증

## 현재 승인 게이트

2026-05-31 사용자가 아래 문구로 신규 앱 구현을 승인했다.

승인 문구:

```text
홍보영상 포함해서 최종안대로 구현 진행
```

## 검증 로그

### 2026-05-31

- `/Users/z9/.gemini/antigravity/scratch`에서 기존 전용 3D 갤러리 앱이 없음을 확인
- 공식 학교 페이지 검색 결과로 비전, 교육목표, 교목, 교화, 교표 의미 확인
- 사용자 제공 홍보영상 파일 크기 약 4.2MB 확인
- Quick Look으로 홍보영상 대표 프레임 추출 및 시각 확인
- 현재 환경에는 `ffmpeg`, `ffprobe`가 설치되어 있지 않음을 확인
- `npm run lint` 성공
- `npm run build` 성공
- 샌드박스 내부 빌드는 Turbopack 내부 포트 바인딩 제한으로 실패하여 권한 승격 후 재검증
- Playwright로 입장 화면, 홍보영상, 3D 전시관, 작품 패널, 상세 모달, 영상 누락 안내, 2D 목록 전환 확인
- 키보드 이동과 마우스 드래그 전후의 작품 패널 좌표 변화를 측정하여 카메라 조작 확인
- 홍보영상 요청 차단 시 정적 배경으로 전환되고 입장 버튼이 유지되는지 확인
- WebGL 비활성 환경에서 캔버스 없이 2D 작품 목록 9개가 표시되는지 확인
- `npm run start` 프로덕션 서버에서 초기 외부 도메인 요청 0건 확인
- Three.js 의존성 내부에서 `THREE.Clock` deprecation 경고 1건 확인. 기능 오류는 아님
- React best-practices 체크리스트 검토 완료: 훅 정리, 타이머 해제, 의미 있는 버튼, 안정적인 목록 키, 클라이언트 전용 3D 지연 로딩 확인
- 임시 스캐폴드 폴더, QA 스크린샷, 사용하지 않는 Next.js 기본 자산 정리
- `package.json`과 `package-lock.json` 프로젝트명을 `school-showcase-gallery`로 통일
- 기획안 기반 가칭 데이터 반영 후 `npm run lint`, `npm run build` 재검증 성공
- SVG 텍스처 직접 로딩 방식은 초기 빈 화면 회귀가 있어 제거
- 절차적 캔버스 텍스처 적용 후 1초 이내 내부 전시관 렌더링 확인
- Playwright 시각 검증으로 내부 벽, 바닥, 후면 그래픽, 입구 전면 그래픽, 외부 캡션 플레이트 9개 표시 확인
- `/favicon.ico` 로컬 응답 200 확인
- 외부 캡션 첫 항목이 `1조 / [가제] 딱풀 / 김준혁팀`으로 노출되는지 확인
- Playwright 시각 검증으로 좌우 벽 작품의 우측 캡션 카드 배치 확인

### 2026-10-08

- 기준 저장소를 GitHub `zigoo1218-max/hanholl`(main, 2026-06-10 커밋)로 확정. `~/Projects/school-showcase-gallery` 로컬 폴더는 5월 31일 상태의 구버전이라 작업 기준에서 제외
- 브랜치 `feat/gallery-visual-redesign`에서 `npx tsc --noEmit` 통과, `npm run lint`는 원본에 있던 항목(`scripts/generate-thumbnails.js` require 구문 4건, `video-utils.ts`·`artwork-list-view.tsx` 경고 2건)만 남고 신규·수정 파일은 통과
- `NEXT_PUBLIC_BASE_PATH=/hanholl npx next build` 정적 export 성공
- 개발 서버에서 PC 화면: 입장 → 전진 → 드래그 시점 전환 → 작품 클릭 → 대화상자 → 영상 재생 → Esc 닫기 확인
- 모바일 뷰포트(375×812, coarse pointer)에서 터치 패드 1.2초 홀드 전진, 드래그 시점 전환, 조작 안내와 패드 비겹침 확인
- 세로 영상(5B조 1080×1920) 대화상자에서 세로 플레이어 박스로 표시되는지 확인
- 스크린샷: `dev_docs/screenshots/2026-10-08-*.jpg`
- 독립 코드 리뷰(code-reviewer 에이전트) 결과 SHIP, 치명·높음 0건. 중간 2건(전역 키 preventDefault로 대화상자 키보드 조작 차단, 구형 브라우저 `roundRect` 미지원 시 흰 화면)과 낮음 8건 중 9건 반영: 전역 preventDefault 제거, roundRect 가드 + 씬 에러 바운더리(실패 시 작품 목록으로 전환), 키 소문자 정규화·탭 숨김 시 입력 초기화, 터치 패드 언마운트 시 입력 초기화·버튼별 눌림 집계, 마우스 좌클릭만 시점 드래그, 프레임 델타 상한 0.1초, 벽 텍스처 반복 방향 교정, 바닥·벽 비등방성 필터, 공용 텍스처 공유·해제
- 반영 후 `npx tsc --noEmit`·린트(신규 파일 기준)·`next build` 재통과, 개발 서버에서 Shift+W 후 키를 떼면 정지하는지 확인
- 오너 지시로 커밋·푸시함. 브랜치 `feat/gallery-visual-redesign` → origin. 작성자는 zigoo1218-max 비공개 주소로 수정
- PR 생성: https://github.com/zigoo1218-max/hanholl/pull/2 (오너가 게이트 우회 플래그로 직접 생성). main 머지 시 GitHub Actions 가 Pages 로 자동 배포. 저장소 CI 는 main push 에만 걸려 있어 PR 자체에는 체크가 없음
- 2026-10-08 18:12 오너가 PR #2 머지(`gh pr merge --merge`, 머지 커밋 7da0386). GitHub Actions `Deploy to GitHub Pages` 실행 37754818336 성공
- 배포 확인: https://zigoo1218-max.github.io/hanholl/ 응답 200, 브라우저로 입장해 새 전시관(어두운 천장·트랙 조명·황동 액자·반사 바닥·다크 HUD) 렌더링 확인. 콘솔 404 는 3조·8조 미디어 누락(기존과 동일)
- 로컬 작업 브랜치 삭제, main 최신화. 원격 브랜치 `origin/feat/gallery-visual-redesign` 는 남아 있음(GitHub 에서 삭제 가능)

### 2026-10-08 (2차) — 1조 썸네일 · A실/B실

- 1조 썸네일이 검게 나온 원인: `scripts/generate-thumbnails.js` 가 모든 영상에서 1.5초 지점을 뽑았고 1조 영상은 처음 3초가 어두운 페이드인(밝기 17/255). 빌드마다 덮어쓰므로 파일 교체만으로는 재발. 스크립트를 "영상 길이의 15·25·35·50·65% 지점 밝기를 재서 정상 노출(45~215) 첫 장면 선택"으로 변경, 하위 폴더(`room-a/teamN`)까지 탐색. 7개 팀 재생성 후 한 장 모음으로 육안 확인
- 전시실 분리: 입구 → A실(2학기, 빈 액자 10개 "작품 준비 중") → 칸막이 문 → B실(기존 1~8조 9작품) → 타이틀 벽. 좌표 계산은 `src/components/gallery/layout.ts` 한 곳, 방 설정은 `src/data/rooms.ts`, 작품의 `room` 필드로 배치
- 상단 A실/B실 버튼으로 순간이동, 현재 방 표시. 칸막이는 문(폭 4m)으로만 통과
- 검증: 배치 계산을 실제 코드로 실행(A실 −26.2m까지, B실 −56.7m까지, A실 작품 12개면 자동 확장), 브라우저에서 B실 순간이동 → 벽 쪽 후진 차단 → 문 통과 시 A실 전환 확인, 목록 화면 방별 묶음 확인, tsc·lint(기존 경고 2건만)·build
- 성능: 방이 둘이라 천장 광원 수가 늘어 실광원은 한 줄 걸러 배치(조명 원반은 모든 줄 유지)
- 가정: 기존 작품을 "1학기 작품"으로 표기함(오너가 "지금 전시공간 = B실"로만 지정)

## Handoff (다음 에이전트용, 2026-10-08)

- 정본 저장소: GitHub `zigoo1218-max/hanholl` (이 클론 `~/Projects/hanholl`). `~/Projects/school-showcase-gallery` 는 5월 31일 구버전 복사본이라 쓰지 않는다.
- 로컬 실행: `NEXT_PUBLIC_BASE_PATH=/hanholl npx next dev --webpack -p 3003` 후 `http://localhost:3003/hanholl`. 빌드 검증은 `NEXT_PUBLIC_BASE_PATH=/hanholl npx next build` (npm run build 는 ffmpeg 썸네일 재생성이 먼저 돌아 썸네일 파일이 바뀔 수 있음).
- 린트는 원본부터 실패 상태(`scripts/generate-thumbnails.js` require 구문 4건, `video-utils.ts`·`artwork-list-view.tsx` 경고) — 신규 오류만 본다.
- GitHub 인증: 이 Mac 의 gh 에 `zigoo1218-max` 와 `indexzigu` 두 계정이 있고 활성은 zigoo1218-max. 저장소 로컬 git 작성자는 zigoo1218-max 비공개 주소로 설정돼 있음. 푸시는 `git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push …` 로 gh 토큰을 쓴다(키체인에 indexzigu 토큰이 남아 있어 그냥 push 하면 403).
- 미결(오너 결정): ① 요구사항 §3 톤(네이비·흰색·중립 회색, 절제)과 현재 다크 갤러리 톤 확정 — `dev_docs/TASKS.md` 추가 태스크 참조 ② 프로젝터 현장 가독성 확인 ③ 1조 검은 썸네일 교체(`public/media/team1/thumbnail.jpg`, ffmpeg 추출 시각 조정 또는 수동 이미지), 3조·8조 영상·썸네일 파일 등록.
- 필독: `src/components/gallery/*`(씬 구성 요소) · `src/components/gallery-scene.tsx`(홀 조립·품질 모드) · `src/data/accents.ts`(강조색) · 이 문서 2026-10-08 검증 로그.
- PR 게이트 리뷰(표준 축·스펙 축) 반영: 캡션 플레이트가 다음 액자와 0.1m 겹치던 것 교정, 학생 이름 2줄, 플레이트 클릭 가능, 3D 화면용 스크린리더 작품 내비 추가, 작품 12개 초과 시 액자별 스포트라이트 생략, 강조색 상수 단일 모듈화(`src/data/accents.ts`), 캔버스 실패 경고, 재생 중 키보드 포커스 시 컨트롤 표시, 미사용 코드·CSS 제거
- 리뷰에서 오너 결정으로 남긴 것: 요구사항 §3 톤(네이비·흰색·중립 회색, 절제)과 현재 다크 갤러리 톤의 불일치, 프로젝터에서 어두운 톤 가독성, 캡션 플레이트가 보행 거리에서 작게 보임(상세는 대화상자에서 확인)
- 발견 사항(코드 외): 1조 썸네일(`public/media/team1/thumbnail.jpg`)은 ffmpeg가 1.5초 지점에서 뽑은 검은 프레임이라 액자가 검게 보임. 3조·8조는 영상·썸네일 파일이 저장소에 없어 자리표시 액자로 표시됨. 데이터의 `orientation` 값이 실제 영상과 어긋난 팀(1조·2조·5A·5B·6조)이 있으나 액자는 실측 비율을 쓰므로 화면 영향 없음
- 개발 서버 특유의 현상: 코드 즉시반영이 여러 번 겹치면 WebGL 컨텍스트가 끊겨 흰 화면이 나올 수 있음(콘솔 `Context Lost`). 새로고침으로 해소되며 정적 빌드에는 해당 없음

## 참고 파일

- 요구사항: [PROJECT_REQUIREMENTS.md](dev_docs/PROJECT_REQUIREMENTS.md)
- 구현 계획: [IMPLEMENTATION_PLAN.md](dev_docs/IMPLEMENTATION_PLAN.md)
- 태스크 원장: [TASKS.md](dev_docs/TASKS.md)
- 홍보영상 원본:
  - `/Users/z9/Downloads/학교_전경_이미지인데_드론뷰로_학교_주변을_돌면서_보여.mp4`
