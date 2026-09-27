"""환경 변수(.env) 로딩과 모니터링 조건 정의."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
KST = ZoneInfo("Asia/Seoul")


def today_kst() -> date:
    """GitHub Actions 서버는 UTC 라서, 공고 날짜 비교는 항상 한국 날짜 기준으로 한다."""
    return datetime.now(KST).date()

# 지구명별 별칭. 공고 제목이 "역곡지구 하우스토리(부천역곡 A-2블록)" 처럼
# 지구명을 다르게 쓰는 경우를 잡기 위함. 다른 지역과 겹치는 짧은 단어
# (예: "대장지구"는 성남 대장지구와 겹침)는 일부러 넣지 않았다.
REGION_ALIASES: dict[str, list[str]] = {
    "부천대장": ["부천대장", "부천 대장", "대장신도시"],
    "하남교산": ["하남교산", "하남 교산", "교산지구", "교산신도시"],
    "부천역곡": ["부천역곡", "부천 역곡", "역곡지구"],
    "인천계양": ["인천계양", "인천 계양", "계양테크노밸리", "계양신도시"],
}

# 공급위치 주소로 지구를 추정할 때 쓰는 키워드 (마이홈·청약홈처럼 주소를 주는 출처 전용).
# 민간 아파트는 제목이 "○○힐스테이트" 처럼 지구명이 없는 경우가 많아 주소로 찾는다.
# 청약 공고는 신규 공급만 올라오므로 동 단위로 걸어도 기존 아파트가 섞이지 않는다.
# 다만 지구 밖 같은 동의 신규 단지(소규모 재개발 등)가 함께 걸릴 수는 있다.
ADDRESS_ALIASES: dict[str, list[str]] = {
    "부천대장": ["부천시 오정구 대장동", "부천시 대장동"],
    "하남교산": ["하남시 교산동", "하남시 천현동", "하남시 춘궁동", "하남시 상사창동", "하남시 하사창동"],
    "부천역곡": ["부천시 원미구 역곡동", "부천시 역곡동"],
    "인천계양": ["계양구 귤현동", "계양구 동양동", "계양구 박촌동", "계양구 병방동", "계양구 상야동"],
}

# 공급유형 분류 규칙: (표시명, 매칭 키워드). 제목 + 사이트의 "유형" 칸을 대상으로 검사한다.
# 한 공고가 여러 유형에 걸리면 모두 표시한다 (예: "공공분양 / 무순위(잔여세대)").
SALE_TYPE_RULES: list[tuple[str, list[str]]] = [
    ("신혼희망타운", ["신혼희망"]),
    ("뉴:홈", ["뉴:홈", "뉴홈", "나눔형", "선택형", "일반형", "이익공유형"]),
    ("무순위(잔여세대)", ["무순위", "잔여세대", "잔여 세대", "잔여주택", "추가입주자", "추가 입주자",
                      "해약세대", "해약분", "선착순", "일반매각"]),
    ("공공분양", ["공공분양", "분양주택"]),
    ("민간분양", ["민간분양", "민영주택"]),
]
RENTAL_TYPE_RULES: list[tuple[str, list[str]]] = [
    ("공공임대", ["통합공공임대", "공공임대", "국민임대", "행복주택", "영구임대",
               "장기전세", "매입임대", "전세임대", "임대주택", "민간임대", "분양전환"]),
]


def _bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in ("1", "true", "yes", "y", "on")


def _int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    return int(raw) if raw else default


@dataclass
class Settings:
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    data_go_kr_api_key: str = ""
    target_regions: list[str] = field(default_factory=lambda: list(REGION_ALIASES))
    include_rental: bool = True
    enable_sh: bool = True
    enable_myhome: bool = True
    enable_applyhome: bool = True
    myhome_api_key: str = ""
    applyhome_api_key: str = ""
    lookback_days: int = 30
    check_detail: bool = True
    max_detail_fetch: int = 30
    state_db_path: Path = BASE_DIR / "data" / "state.db"
    request_delay_sec: float = 1.0

    @property
    def telegram_ready(self) -> bool:
        return bool(self.telegram_bot_token and self.telegram_chat_id)

    def region_aliases(self) -> dict[str, list[str]]:
        """TARGET_REGIONS 에 적힌 지구만 별칭과 함께 돌려준다 (새 지구는 이름 자체가 키워드)."""
        return {r: REGION_ALIASES.get(r, [r]) for r in self.target_regions}

    def address_aliases(self) -> dict[str, list[str]]:
        return {r: ADDRESS_ALIASES.get(r, []) for r in self.target_regions}

    def type_rules(self) -> list[tuple[str, list[str]]]:
        return SALE_TYPE_RULES + (RENTAL_TYPE_RULES if self.include_rental else [])


def load_settings(env_file: str | None = None) -> Settings:
    load_dotenv(env_file or BASE_DIR / ".env", override=False)

    regions_raw = os.getenv("TARGET_REGIONS", "").strip()
    regions = [r.strip() for r in regions_raw.split(",") if r.strip()] if regions_raw else list(REGION_ALIASES)

    db_path = Path(os.getenv("STATE_DB_PATH", "").strip() or "data/state.db")
    if not db_path.is_absolute():
        db_path = BASE_DIR / db_path

    data_key = os.getenv("DATA_GO_KR_API_KEY", "").strip()
    return Settings(
        telegram_bot_token=os.getenv("TELEGRAM_BOT_TOKEN", "").strip(),
        telegram_chat_id=os.getenv("TELEGRAM_CHAT_ID", "").strip(),
        data_go_kr_api_key=data_key,
        # 공공데이터포털 인증키는 서비스마다 활용신청만 하면 같은 키를 쓴다. 따로 받았으면 덮어쓰기.
        myhome_api_key=os.getenv("MYHOME_API_KEY", "").strip() or data_key,
        applyhome_api_key=os.getenv("APPLYHOME_API_KEY", "").strip() or data_key,
        enable_myhome=_bool("ENABLE_MYHOME", True),
        enable_applyhome=_bool("ENABLE_APPLYHOME", True),
        target_regions=regions,
        include_rental=_bool("INCLUDE_RENTAL", True),
        enable_sh=_bool("ENABLE_SH", True),
        lookback_days=_int("LOOKBACK_DAYS", 30),
        check_detail=_bool("CHECK_DETAIL", True),
        max_detail_fetch=_int("MAX_DETAIL_FETCH", 30),
        state_db_path=db_path,
    )
