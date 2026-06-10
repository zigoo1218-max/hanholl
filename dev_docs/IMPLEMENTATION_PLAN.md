# 구현 계획서

## 1. 현재 단계

현재 단계는 `Phase 2. 설계`다.
루트 작업 규약에 따라 코드 구현은 사용자의 최종 승인 이후 시작한다.

승인 문구 예시:

```text
홍보영상 포함해서 최종안대로 구현 진행
```

## 2. 기술 스택

- 프레임워크: Next.js App Router, TypeScript
- 스타일: Tailwind CSS
- 3D 렌더링: `three`, `@react-three/fiber`, `@react-three/drei`
- 아이콘: 필요할 경우 `lucide-react`
- 데이터 저장: 코드 기반 정적 메타데이터
- 영상 저장: `public/media/videos`
- 썸네일 저장: `public/media/thumbnails`

관리자 업로드 기능은 1차 구현에서 제외한다. 행사 전 미리 파일을 등록하고 폴더 전체를 전시 PC로 복사하는 방식이 현재 운영 조건에 가장 단순하고 안정적이다.

## 3. 아키텍처

```text
src/app/page.tsx
  -> ExhibitionApp
    -> EntranceScreen
    -> ExhibitionScene
      -> GalleryHall
      -> ArtworkPanel[]
      -> VisitorControls
    -> ArtworkDialog
      -> LocalVideoPlayer
    -> ArtworkListView

src/data/showcase-videos.ts
  -> ShowcaseVideo[]

public/media/
  -> school-promo.mp4
  -> videos/
  -> thumbnails/
```

### 렌더링 경계

- `page.tsx`는 가능한 한 단순한 서버 컴포넌트로 유지한다.
- WebGL, 상태 관리, 키보드 입력이 필요한 전시 앱은 클라이언트 컴포넌트로 분리한다.
- 3D 씬은 동적 import를 사용해 브라우저에서만 로드한다.
- WebGL 로드 실패 시 2D 목록 보기로 전환한다.

## 4. 핵심 데이터 모델

```ts
export type ShowcaseVideo = {
  id: string
  teamLabel: string
  studentNames: string[]
  title: string
  caption: string
  thumbnailUrl: string
  videoUrl: string
  durationSeconds?: number
}
```

데이터는 배열 기반으로 관리한다. 작품을 추가할 때 컴포넌트 코드를 수정하지 않고 배열 항목과 로컬 파일만 추가하는 구조를 유지한다.

## 5. 데이터 흐름

```text
showcase-videos.ts
  -> 작품 메타데이터 배열
  -> 전시관 패널과 2D 목록에서 공통 사용
  -> 관람객이 작품 선택
  -> 선택 작품 상태 갱신
  -> 캡션 모달 표시
  -> 재생 버튼 선택 시 로컬 영상만 로드
```

홍보영상 흐름:

```text
public/media/school-promo.mp4
  -> 입장 화면 배경에서 muted autoplay
  -> 재생 실패 또는 건너뛰기
  -> 전시관 입장에는 영향 없음
```

## 6. 예외 처리

- WebGL 초기화 실패:
  - 2D 작품 목록으로 자동 전환하거나 명확한 전환 버튼 표시
- 작품 영상 누락:
  - 캡션은 유지하고 영상 준비 중 안내 표시
- 홍보영상 재생 실패:
  - 정적 배경과 입장 버튼 유지
- 썸네일 누락:
  - 학교 상징을 활용한 기본 패널 배경 표시
- 키보드 입력이 익숙하지 않은 사용자:
  - 화면 고정형 조작 안내와 2D 목록 버튼 제공

## 7. 성능 전략

- 작품 영상에 `preload="none"` 적용
- 홍보영상만 입장 화면에서 로드
- 전시관 진입 후 홍보영상 컴포넌트 제거
- 3D 공간은 단순 기하 도형과 제한된 조명으로 구성
- 썸네일은 프로젝터 환경에 충분한 해상도로 최적화
- 작품 수가 늘어나면 구역 단위 배치 규칙으로 자동 확장

## 8. Task 단위 분할

한 번에 하나의 검증 가능한 기능 단위로 진행한다.

1. 신규 앱 스캐폴드 및 기본 문서
2. 작품 데이터 모델과 샘플 데이터
3. 공공기관형 입장 화면과 홍보영상
4. 복도형 3D 전시관과 관람객 조작
5. 작품 패널과 캡션 모달
6. 로컬 영상 플레이어
7. 2D 목록 및 WebGL 대체 경로
8. 이관 및 운영 문서
9. 빌드, 브라우저, 전시 시나리오 검증

각 단계 완료 후 `TASKS.md`와 `PROJECT_STATUS.md`를 갱신한다.

## 9. 문서화 규칙

- 주요 컴포넌트와 복잡한 헬퍼에는 필요한 범위의 JSDoc을 작성한다.
- 자명한 렌더링 코드에 반복적인 주석을 추가하지 않는다.
- 다른 AI 모델이 작업을 이어받을 수 있도록 다음 사항을 항상 갱신한다.
  - 현재 단계
  - 완료한 태스크
  - 남은 태스크
  - 검증한 명령어
  - 검증하지 못한 항목
  - 사용자 결정을 기다리는 항목

## 10. 자기 검토 기준

각 구현 단위 후 아래를 확인한다.

- 구현이 일반 카드형 갤러리로 퇴행하지 않았는가?
- 작품 접근성이 3D 효과보다 우선되어 있는가?
- 인터넷 없이 전시 PC에서 실행 가능한가?
- 작품 수를 20개로 늘릴 때 컴포넌트 수정이 필요한가?
- 영상이 누락되어도 앱 전체가 중단되지 않는가?
- 프로젝터에서 조작 안내와 캡션을 읽을 수 있는가?

