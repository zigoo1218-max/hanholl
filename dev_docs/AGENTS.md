<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AI 작업 인수인계 규칙

이 프로젝트를 이어서 작업하는 AI 모델은 구현 전에 아래 문서를 순서대로 읽는다.

1. `dev_docs/PROJECT_REQUIREMENTS.md`
2. `dev_docs/IMPLEMENTATION_PLAN.md`
3. `dev_docs/TASKS.md`
4. `dev_docs/PROJECT_STATUS.md`

## 작업 규칙

- 일반 카드형 웹 갤러리로 범위를 축소하지 않는다.
- 3D 효과보다 작품 접근성, 행사 안정성, PC 간 이관성을 우선한다.
- 현재 태스크 하나를 완료하고 검증한 뒤 다음 태스크로 이동한다.
- 태스크 완료 시 `dev_docs/TASKS.md`의 체크박스를 갱신한다.
- 주요 진행 상황과 검증 결과는 `dev_docs/PROJECT_STATUS.md`에 기록한다.
- 실제 작품 파일과 학생 이름이 없을 때는 샘플 데이터로 구현하되, 샘플임을 명확히 표시한다.
- 영상은 선택 전까지 사전 로드하지 않는다.
- 인터넷이 없어도 전시 PC에서 동작하는 로컬 우선 구조를 유지한다.
- 사용자 승인 없이 관리자 업로드, CDN, 외부 데이터베이스를 추가하지 않는다.
