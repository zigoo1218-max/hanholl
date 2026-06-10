#!/bin/bash
# ==============================================================
#   [macOS] 한홀중학교 3D 전시관 개발/테스트 서버 원터치 구동기
# ==============================================================

# 1. 스크립트가 위치한 폴더의 상위(프로젝트 루트)로 디렉토리 이동
# (.command 파일은 더블 클릭 시 사용자 홈 디렉토리가 기본 Cwd가 되므로 반드시 경로를 교정해야 합니다)
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR/.."

echo "=============================================================="
echo "   [macOS] Next.js 3D 전시관 개발 및 테스트 서버를 시작합니다."
echo "   프로젝트 루트: $(pwd)"
echo "=============================================================="
echo ""

# 2. Node.js 및 npm 설치 확인
if ! command -v node &> /dev/null
then
    echo "[오류] Node.js를 찾을 수 없습니다!"
    echo "macOS용 Node.js를 먼저 설치해 주세요. (https://nodejs.org)"
    echo ""
    read -p "엔터 키를 누르면 종료합니다..."
    exit 1
fi

# 3. 종속성 패키지 누락 시 자동 설치
if [ ! -d "node_modules" ]; then
    echo "[안내] node_modules 폴더가 없습니다. npm install을 진행합니다..."
    npm install
fi

# 4. 포트 3003에서 Next.js 실시간 개발 서버(next dev) 기동
echo "[안내] 실시간 코드 반영 개발 서버를 포트 3003에서 시작합니다..."
echo "[안내] 브라우저가 열리면 http://localhost:3003 주소로 연결됩니다."
echo "[안내] 개발 서버를 종료하려면 터미널 창에서 [Ctrl + C]를 누르십시오."
echo ""

# 5. 브라우저로 전시관 즉시 자동 오픈
open "http://localhost:3003"

# 6. 실시간 갱신용 개발 서버 실행 (Turbopack 버그 우회를 위해 --webpack 옵션 강제 적용)
npx next dev --webpack -p 3003
