"""공고 수집기 모음.

모든 수집기는 같은 인터페이스를 따른다.
    fetch_notices(since: date) -> list[Notice]   # 최근 목록
    fetch_detail_text(notice) -> str              # 상세 본문 텍스트 (지구명 본문 검색용)
"""
from __future__ import annotations

import re
import time

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 lh-notice-monitor/1.0"
)


_DATE = re.compile(r"(\d{4})[.\-/]?(\d{2})[.\-/]?(\d{2})")


def to_iso(text: str) -> str:
    """'2026.09.14' / '2026-09-14' / '20260914' → '2026-09-14' (못 찾으면 빈 문자열)."""
    m = _DATE.search(str(text or ""))
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else ""


def is_lh_supplier(name: str) -> bool:
    """공급기관/사업주체 이름이 LH 인지 (LH 공고는 LH 수집기가 이미 받으므로 다른 출처에서 제외)."""
    return "LH" in (name or "").upper() or "토지주택" in (name or "")


def make_session() -> requests.Session:
    """재시도(연결 끊김, 5xx)와 공통 헤더가 설정된 세션."""
    s = requests.Session()
    retry = Retry(total=3, connect=3, read=3, backoff_factor=2,
                  status_forcelist=(429, 500, 502, 503, 504),
                  allowed_methods=frozenset({"GET", "POST"}))
    s.mount("https://", HTTPAdapter(max_retries=retry))
    s.mount("http://", HTTPAdapter(max_retries=retry))
    s.headers.update({"User-Agent": USER_AGENT, "Accept-Language": "ko-KR,ko;q=0.9"})
    return s


_SECRET_PARAM = re.compile(r"((?:serviceKey|ServiceKey|api_key|token)=)[^&\s'\"]+")


_BOT_TOKEN = re.compile(r"bot\d+:[A-Za-z0-9_-]+")


def redact(text: str) -> str:
    """로그에 비밀값이 찍히지 않도록 URL 의 serviceKey 값과 텔레그램 봇 토큰을 가린다."""
    return _BOT_TOKEN.sub("bot***", _SECRET_PARAM.sub(r"\1***", text))


class FetchError(RuntimeError):
    """조회 실패 (메시지에서 인증키는 가려져 있음)."""


class PoliteClient:
    """요청 사이에 최소 간격을 두어 사이트에 부담을 주지 않도록 하는 래퍼."""

    def __init__(self, delay_sec: float = 1.0, timeout: int = 30):
        self.session = make_session()
        self.delay_sec = delay_sec
        self.timeout = timeout
        self._last = 0.0

    def request(self, method: str, url: str, **kwargs) -> requests.Response:
        gap = time.monotonic() - self._last
        if gap < self.delay_sec:
            time.sleep(self.delay_sec - gap)
        try:
            resp = self.session.request(method, url, timeout=self.timeout, **kwargs)
            resp.raise_for_status()
        except requests.RequestException as exc:
            # 오류 메시지에 요청 URL(인증키 포함)이 들어가므로 키를 가린 메시지로 바꿔서 던진다
            raise FetchError(redact(str(exc))) from None
        finally:
            self._last = time.monotonic()
        return resp
