"""공고 수집기 모음.

모든 수집기는 같은 인터페이스를 따른다.
    fetch_notices(since: date) -> list[Notice]   # 최근 목록
    fetch_detail_text(notice) -> str              # 상세 본문 텍스트 (지구명 본문 검색용)
"""
from __future__ import annotations

import time

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 lh-notice-monitor/1.0"
)


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
        finally:
            self._last = time.monotonic()
        resp.raise_for_status()
        return resp
