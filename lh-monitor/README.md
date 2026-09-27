# LH · SH 신규 공고 텔레그램 알림 봇

LH(한국토지주택공사)와 SH(서울주택도시개발공사)의 **분양 · 임대 · 무순위(잔여세대)** 공고를 주기적으로 확인해서,
관심 지구에 새 공고가 올라오면 텔레그램으로 알려주는 봇입니다.

- 관심 지구: **부천대장, 하남교산, 부천역곡, 인천계양** (`.env` 에서 바꿀 수 있음)
- 공급유형: **공공분양, 신혼희망타운, 뉴:홈(나눔형/선택형/일반형), 무순위(잔여세대)** (+ 공공임대, 끌 수 있음)
- 한 번 보낸 공고는 로컬 DB(SQLite)에 기록해서 **다시 보내지 않습니다.**

```
[신규 공고 알림]
- 지구명: 인천계양
- 공고명: [정정공고]인천계양 A6블록 공공분양주택 입주자모집공고
- 공급유형: 공공분양
- 공고일자: 2026-09-14
- 마감일자: 2026-10-02
- 진행상태: 접수중
- 출처: LH
- 바로가기 링크: https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?panId=0000061174&...
```

---

## 1. 동작 방식

```
 ┌───────────────────── 수집 ─────────────────────┐
 │ LH: 공공데이터포털 API (키가 있을 때)           │
 │      └ 실패하거나 키가 없으면 → LH청약플러스 웹 목록 │
 │ SH: 공고 및 공지 게시판 (지구명으로 제목+내용 검색) │
 └────────────────────────┬───────────────────────┘
                          ▼
   필터: 지구명(제목 → 없으면 상세 본문) + 공급유형(제목·유형칸) 둘 다 맞아야 통과
                          ▼
   중복 확인: data/state.db 에 이미 '발송 완료'인 공고는 제외
                          ▼
   텔레그램 발송 → 성공한 공고만 '발송 완료'로 기록 (실패분은 다음 실행에 재시도)
```

- **LH 웹 목록 조회**는 LH청약플러스의 공개 "공고문" 목록(분양주택 · 임대주택 메뉴)을 사이트 검색 폼과 같은 방식으로 읽습니다.
  로그인이 필요 없고, 요청 사이에 1초 간격을 둬서 사이트에 부담을 주지 않습니다.
- **상세 본문 확인**: 제목에 지구명이 없지만(예: "3기 신도시 공공분양…") 유형은 맞고 지역이 경기·인천·전국인 공고는
  상세 페이지 본문까지 열어 지구명을 찾습니다. 한 번 확인한 공고는 다시 열지 않고, 1회 실행당 최대 `MAX_DETAIL_FETCH`건만 엽니다.
- 중복 판단 키는 **공고번호**(`LH:panId`, `SH:seq`)입니다. API로 받든 웹으로 받든 LH 공고번호는 같아서 섞여도 중복 발송되지 않습니다.
  정정공고는 LH에서 새 공고번호를 받기 때문에 **새 공고로 한 번 더 알림**이 갑니다 (변경 사항을 놓치지 않도록 일부러 그렇게 둠).

## 2. 폴더 구조

```
lh-monitor/
├─ monitor.py            # 실행 진입점 (수집 → 필터 → 중복제거 → 발송)
├─ run_monitor.sh        # crontab 용 실행 스크립트 (가상환경 자동 생성)
├─ run_monitor.bat       # Windows 작업 스케줄러 용
├─ requirements.txt
├─ .env.example          # 환경 변수 예시 → .env 로 복사해서 사용
├─ lhbot/
│  ├─ config.py          # .env 로딩, 지구명 별칭 / 공급유형 키워드
│  ├─ filters.py         # 키워드 필터
│  ├─ store.py           # SQLite 발송 이력
│  ├─ telegram.py        # 메시지 포맷 / 발송
│  └─ sources/
│     ├─ lh_api.py       # 공공데이터포털 API
│     ├─ lh_web.py       # LH청약플러스 웹 목록
│     └─ sh_web.py       # SH 공고 게시판
├─ tests/                # 네트워크 없이 도는 단위 테스트
└─ data/state.db         # 발송 이력 (자동 생성, git 에 올라가지 않음)
```

## 3. 빠른 시작 (내 컴퓨터에서 한 번 돌려보기)

Python 3.10 이상이 필요합니다.

```bash
cd lh-monitor
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env               # Windows: copy .env.example .env
# .env 를 열어 TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID 입력

python monitor.py --dry-run        # 1) 발송 없이 어떤 공고가 걸리는지 확인
python monitor.py --test-telegram  # 2) 텔레그램 연결 확인
python monitor.py                  # 3) 실제 실행 (신규 공고 발송)
```

> 텔레그램 값을 아직 안 넣었으면 자동으로 `--dry-run` 처럼 동작합니다 (발송·기록 안 함).

### 실행 옵션

| 옵션 | 설명 |
|---|---|
| (없음) | 신규 공고만 발송하고 발송 이력 저장 |
| `--dry-run` | 발송·저장 없이 콘솔에 메시지만 출력 |
| `--init` | 발송 없이 현재 걸리는 공고를 모두 "발송 완료"로 기록. **처음 설치할 때 지난 공고 알림을 받고 싶지 않으면** 먼저 한 번 실행 |
| `--test-telegram` | 텔레그램 테스트 메시지 1건 발송 |
| `--source api\|web\|auto` | LH 수집 방식 선택 (기본 `auto`: 키가 있으면 API, 실패 시 웹) |
| `--env 경로` | 다른 `.env` 파일 사용 |
| `-v` | 자세한 로그 |

## 4. 준비물

### 4-1. 텔레그램 봇 토큰 / chat_id

1. 텔레그램에서 **@BotFather** 와 대화 → `/newbot` → 이름 입력 → 받은 토큰을 `TELEGRAM_BOT_TOKEN` 에 입력
2. 만든 봇과의 대화방에서 아무 메시지나 한 번 보내기 (그룹이면 봇을 그룹에 초대 후 메시지 전송)
3. 브라우저에서 `https://api.telegram.org/bot<토큰>/getUpdates` 열기 →
   `"chat":{"id": 123456789 ...}` 의 숫자를 `TELEGRAM_CHAT_ID` 에 입력 (그룹은 `-100…` 처럼 음수)

### 4-2. 공공데이터포털 API 키 (선택)

키가 없어도 웹 목록으로 동작합니다. 키를 쓰면 사이트 화면 구조가 바뀌어도 영향을 덜 받습니다.

1. [공공데이터포털](https://www.data.go.kr) 로그인 → **"한국토지주택공사_분양임대공고문 조회 서비스"** 검색 → 활용신청
2. 마이페이지 > 개발계정에서 **일반 인증키(Decoding)** 를 복사해서 `DATA_GO_KR_API_KEY` 에 입력
   (승인 직후에는 키가 동작하기까지 1~2시간 걸릴 수 있음. 그동안 봇은 자동으로 웹 조회로 대체)
3. `python monitor.py --source api --dry-run` 으로 API 조회 확인

### 4-3. 환경 변수

| 이름 | 기본값 | 설명 |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | (필수) | 봇 토큰 |
| `TELEGRAM_CHAT_ID` | (필수) | 받을 채팅 ID |
| `DATA_GO_KR_API_KEY` | 없음 | 공공데이터포털 인증키 |
| `TARGET_REGIONS` | `부천대장,하남교산,부천역곡,인천계양` | 관심 지구 (쉼표 구분) |
| `INCLUDE_RENTAL` | `true` | 행복주택 · 통합공공임대 등 임대 공고도 알림 |
| `ENABLE_SH` | `true` | SH 공고도 확인 |
| `LOOKBACK_DAYS` | `30` | 최근 며칠 이내 게시 공고를 볼지 |
| `CHECK_DETAIL` | `true` | 제목에 지구명이 없으면 상세 본문까지 확인 |
| `MAX_DETAIL_FETCH` | `30` | 1회 실행당 상세 페이지 최대 조회 수 |
| `STATE_DB_PATH` | `data/state.db` | 발송 이력 DB 경로 |

지구명 별칭(예: `역곡지구` → 부천역곡)과 공급유형 키워드는 `lhbot/config.py` 의
`REGION_ALIASES`, `SALE_TYPE_RULES`, `RENTAL_TYPE_RULES` 에서 고칠 수 있습니다.
`TARGET_REGIONS` 에 새 지구(예: `고양창릉`)를 넣으면 그 이름 자체가 키워드로 쓰입니다.

## 5. 주기 실행 (1~2시간마다)

### A. GitHub Actions (PC를 켜둘 필요 없음)

워크플로 파일: [`.github/workflows/lh-monitor.yml`](../.github/workflows/lh-monitor.yml) — 매시 17분 실행

1. 저장소 **Settings > Secrets and variables > Actions > New repository secret** 에 등록
   - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, (선택) `DATA_GO_KR_API_KEY`
   - 조건을 바꾸고 싶으면 같은 화면의 **Variables** 탭에 `TARGET_REGIONS`, `INCLUDE_RENTAL`, `ENABLE_SH`, `LOOKBACK_DAYS` 등록
2. 이 워크플로 파일이 **기본 브랜치(main)에 병합돼 있어야** 스케줄이 동작합니다.
3. **Actions 탭 > "LH/SH 공고 모니터링" > Run workflow** 로 수동 실행 가능
   - `test-telegram` → 연결 확인
   - `init` → 지난 공고 알림 없이 시작하고 싶을 때 처음 한 번
   - `run` → 일반 실행
4. 2시간 주기로 바꾸려면 cron 을 `'17 */2 * * *'` 로 수정

참고
- 발송 이력(`data/state.db`)은 **Actions 캐시**로 실행 사이에 이어집니다. 캐시는 7일간 안 쓰면 삭제되는데,
  매시간 돌기 때문에 유지됩니다. 혹시 캐시가 사라지면 최근 `LOOKBACK_DAYS` 이내 공고가 한 번 더 올 수 있습니다.
- GitHub 스케줄은 수 분~수십 분 늦게 시작될 수 있습니다.
- 공개 저장소는 60일간 커밋이 없으면 스케줄 워크플로가 자동으로 꺼집니다. Actions 탭에서 다시 켜면 됩니다.
- GitHub 서버는 해외에 있어서, 혹시 LH/SH 사이트가 해외 접속을 막으면 조회가 실패할 수 있습니다.
  이때는 API 키를 넣거나 아래 B/C 처럼 국내 PC에서 돌리세요.

### B. Linux / macOS crontab

```bash
chmod +x /경로/hanholl/lh-monitor/run_monitor.sh
crontab -e
```

아래 한 줄 추가 (매시 17분, 로그는 `lh-monitor/data/monitor.log`):

```cron
17 * * * * /경로/hanholl/lh-monitor/run_monitor.sh
```

2시간마다: `17 */2 * * *`  /  낮 시간(07~23시)만: `17 7-23 * * *`

`run_monitor.sh` 는 처음 실행될 때 `.venv` 를 만들고 패키지를 설치합니다. 등록 전에 한 번 직접 실행해보는 걸 권장합니다.

```bash
/경로/hanholl/lh-monitor/run_monitor.sh --test-telegram && tail data/monitor.log
```

### C. Windows 작업 스케줄러

관리자 권한이 필요 없는 명령 프롬프트(cmd)에서:

```bat
schtasks /Create /SC HOURLY /MO 1 /TN "LH공고알림" /TR "\"C:\경로\hanholl\lh-monitor\run_monitor.bat\""
```

- 2시간마다: `/MO 2`
- 바로 한 번 실행: `schtasks /Run /TN "LH공고알림"`
- 삭제: `schtasks /Delete /TN "LH공고알림" /F`
- 로그: `lh-monitor\data\monitor.log`

PC가 꺼져 있거나 절전 중이면 실행되지 않으니, 계속 받으려면 A(GitHub Actions)를 권장합니다.

## 6. 테스트

```bash
cd lh-monitor
python -m unittest discover -s tests -v
```

실제 사이트에서 저장한 목록 HTML(`tests/fixtures`)로 파서와 필터, 중복 방지, 메시지 포맷을 검사합니다.

## 7. 알아두면 좋은 점

- **사이트 구조 변경**: LH/SH 가 화면을 개편하면 웹 조회 파서가 공고를 못 읽을 수 있습니다.
  이때 로그에 `조회된 공고가 없습니다` 가 찍히고 GitHub Actions 는 실패(빨간불)로 표시됩니다. API 키를 함께 쓰면 안전합니다.
- **이용 예절**: 공개 목록만 읽고, 요청 간격 1초 + 1~2시간 주기로 부담이 거의 없습니다. 주기를 너무 짧게(예: 1분) 바꾸지 마세요.
- **알림 기준**: 공고일자·내용은 요약이므로 청약 자격/일정은 반드시 링크의 원문 공고문으로 확인하세요.
