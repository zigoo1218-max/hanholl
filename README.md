# 한홀중학교 3D 학생 영상 작품전

학생 영상 작품을 노트북과 프로젝터로 전시하기 위한 로컬 우선 3D 갤러리다.
관람객은 키보드와 마우스로 복도형 전시관을 직접 이동하고, 작품 패널을 선택해 팀 캡션과 영상을 볼 수 있다.

전시관의 전후면 안내 그래픽, 내부 벽 패턴, 바닥 타일은 브라우저에서 즉시 생성되는 로컬 절차적 텍스처다. 외부 이미지 서버 없이 동작한다.

## 1. 전시용 PC 준비

권장 환경:

- Node.js 20 이상
- Chrome 또는 Edge 최신 버전
- 노트북과 프로젝터
- 키보드와 마우스

프로젝트 폴더 전체를 전시용 PC로 복사한다. 인터넷 연결 없이 행사장에서 실행하려면 개발 PC에서 준비가 끝난 전체 폴더를 복사하고 `node_modules`도 함께 이관한다.

전시용 PC에서 아래 명령을 실행한다.

```bash
npm run build
npm run start
```

브라우저에서 `http://localhost:3000`을 연다.

인터넷을 사용할 수 있고 전시용 PC에서 패키지를 다시 설치할 수 있다면 `node_modules` 없이 복사한 뒤 먼저 아래 명령을 실행해도 된다.

```bash
npm install
```

## 2. 개발 중 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 연다.

정적 검증:

```bash
npm run lint
npm run build
```

## 3. 전시실 구성 (A실 · B실)

전시관은 한 건물 안에 두 방이 이어진 구조다. 입구에서 들어오면 **A실(2학기 작품)**, 안쪽 문을 지나면 **B실(1학기 작품)** 이다. 상단의 `A실` / `B실` 버튼을 누르면 해당 방 입구로 바로 이동한다.

- 방 이름·부제·색·빈 액자 개수는 `src/data/rooms.ts` 에서 바꾼다.
- A실은 작품이 없어도 빈 액자 10개에 "작품 준비 중"을 표시한다(`reservedSlots`). 작품을 올리면 앞자리부터 실제 작품으로 바뀌고, 10개를 넘으면 방이 자동으로 길어진다.

## 4. 작품 추가·교체

작품 한 개 = 미디어 폴더 하나 + `src/data/showcase-videos.ts` 항목 하나.

| 전시실 | 미디어 폴더 | 데이터의 `room` |
|---|---|---|
| A실 (2학기) | `public/media/room-a/team1/`, `room-a/team2/` … | `"A"` |
| B실 (1학기) | `public/media/team1/`, `team2/` … | `"B"` |

폴더 안에는 아래 파일을 둔다.

```text
video.mp4     작품 영상 (mp4 권장)
info.json     제목·소개·학생 이름 (선택, 있으면 데이터 값을 덮어씀)
thumbnail.jpg 자동 생성됨 — 직접 넣지 않아도 된다
```

`info.json` 예시:

```json
{
  "title": "작품 제목",
  "caption": "작품 소개 한두 문장",
  "studentNames": ["홍길동", "김철수"]
}
```

A실 작품 데이터 예시 (`src/data/showcase-videos.ts` 배열에 추가):

```ts
{
  id: "a-team-01",
  teamLabel: "1조",
  studentNames: ["홍길동"],
  title: "작품 제목",
  caption: "작품 소개",
  thumbnailUrl: `${bp}/media/room-a/team1/thumbnail.jpg`,
  videoUrl: `${bp}/media/room-a/team1/video.mp4`,
  accent: "hydrangea",
  room: "A",
}
```

- `id` 는 전체에서 겹치지 않게 한다(A실은 `a-` 로 시작 권장).
- 강조색 `accent`: `pine`(교목 소나무 녹색) · `hydrangea`(교화 수국 보라) · `navy`(네이비).
- 썸네일은 `npm run dev` / `npm run build` / `npm run start` 때 영상에서 자동으로 뽑는다. 영상 앞부분이 어두운 페이드인이어도 밝기를 재서 정상 노출 장면을 고른다.
- 영상은 관람객이 재생 버튼을 누르기 전까지 로드하지 않는다.

## 5. 학교 홍보영상 교체

입장 화면 배경 홍보영상:

```text
public/media/school-promo.mp4
```

같은 파일명으로 교체하면 된다. 홍보영상이 없거나 재생되지 않아도 `3D 전시관 입장`과 `영상 건너뛰고 입장` 버튼은 계속 동작한다.

## 6. 행사 전 체크리스트

- [ ] 실제 팀별 제목, 학생 이름, 캡션을 입력했는가?
- [ ] 모든 작품 영상을 정해진 폴더(B실 `public/media/teamN/`, A실 `public/media/room-a/teamN/`)에 `video.mp4` 로 넣었는가?
- [ ] 각 작품을 클릭하고 재생되는지 확인했는가?
- [ ] 홍보영상이 입장 화면에서 음소거 상태로 재생되는가?
- [ ] 키보드 방향키 또는 `W A S D`로 전시관을 이동할 수 있는가?
- [ ] 마우스 드래그로 시점을 바꿀 수 있는가?
- [ ] 상단 `A실` / `B실` 버튼으로 각 방 입구로 바로 이동하는가?
- [ ] A실 작품 수와 "작품 준비 중" 빈 액자 수가 의도와 맞는가?
- [ ] 휴대폰에서 화면을 끌어 둘러보고 오른쪽 아래 방향 패드로 이동할 수 있는가?
- [ ] 세로로 촬영한 영상이 세로 액자와 세로 플레이어로 표시되는가?
- [ ] `작품 목록` 버튼으로 2D 목록에 진입할 수 있는가?
- [ ] 프로젝터 연결 후 제목과 캡션을 읽을 수 있는가?
- [ ] 인터넷 연결을 끊은 상태에서도 실행되는가?

## 7. 프로젝트 문서

- 요구사항: [PROJECT_REQUIREMENTS.md](dev_docs/PROJECT_REQUIREMENTS.md)
- 구현 계획: [IMPLEMENTATION_PLAN.md](dev_docs/IMPLEMENTATION_PLAN.md)
- 태스크 원장: [TASKS.md](dev_docs/TASKS.md)
- 현재 상태: [PROJECT_STATUS.md](dev_docs/PROJECT_STATUS.md)
- AI 인수인계 규칙: [AGENTS.md](dev_docs/AGENTS.md)
