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

## 3. 작품 정보 교체

작품 메타데이터는 아래 파일에서 관리한다.

```text
src/data/showcase-videos.ts
```

샘플 데이터를 실제 값으로 교체한다.

```ts
{
  id: "team-01",
  teamLabel: "1조",
  studentNames: ["대표 학생 이름팀"],
  title: "[가제] 작품 소재",
  caption: "촬영 중인 기획안 기반 소개 문구",
  thumbnailUrl: "/media/thumbnails/team-01.jpg",
  videoUrl: "/media/videos/team-01.mp4",
  accent: "pine",
}
```

지원하는 강조색:

- `pine`: 교목 소나무를 반영한 녹색
- `hydrangea`: 교화 수국을 반영한 보라색
- `navy`: 공공기관형 네이비

작품을 추가할 때 배열 항목만 추가하면 3D 전시관과 2D 작품 목록에 함께 표시된다. 최대 20개까지 같은 구조를 유지한다.

## 4. 영상 및 썸네일 교체

작품 영상:

```text
public/media/videos/team-01.mp4
public/media/videos/team-02.mp4
public/media/videos/team-05a.mp4
public/media/videos/team-05b.mp4
...
```

작품 썸네일:

```text
public/media/thumbnails/team-01.jpg
public/media/thumbnails/team-02.jpg
...
```

실제 썸네일이 준비되지 않았다면 아래 기본 이미지를 계속 사용할 수 있다.

```text
public/media/thumbnails/default-artwork.svg
```

영상은 작품 상세 화면에서 관람객이 재생 버튼을 누르기 전까지 로드하지 않는다.

## 5. 학교 홍보영상 교체

입장 화면 배경 홍보영상:

```text
public/media/school-promo.mp4
```

같은 파일명으로 교체하면 된다. 홍보영상이 없거나 재생되지 않아도 `3D 전시관 입장`과 `영상 건너뛰고 입장` 버튼은 계속 동작한다.

## 6. 행사 전 체크리스트

- [ ] 실제 팀별 제목, 학생 이름, 캡션을 입력했는가?
- [ ] 모든 작품 영상 파일을 `public/media/videos`에 넣었는가?
- [ ] 각 작품을 클릭하고 재생되는지 확인했는가?
- [ ] 홍보영상이 입장 화면에서 음소거 상태로 재생되는가?
- [ ] 키보드 방향키 또는 `W A S D`로 전시관을 이동할 수 있는가?
- [ ] 마우스 드래그로 시점을 바꿀 수 있는가?
- [ ] `작품 목록` 버튼으로 2D 목록에 진입할 수 있는가?
- [ ] 프로젝터 연결 후 제목과 캡션을 읽을 수 있는가?
- [ ] 인터넷 연결을 끊은 상태에서도 실행되는가?

## 7. 프로젝트 문서

- 요구사항: [PROJECT_REQUIREMENTS.md](dev_docs/PROJECT_REQUIREMENTS.md)
- 구현 계획: [IMPLEMENTATION_PLAN.md](dev_docs/IMPLEMENTATION_PLAN.md)
- 태스크 원장: [TASKS.md](dev_docs/TASKS.md)
- 현재 상태: [PROJECT_STATUS.md](dev_docs/PROJECT_STATUS.md)
- AI 인수인계 규칙: [AGENTS.md](dev_docs/AGENTS.md)
