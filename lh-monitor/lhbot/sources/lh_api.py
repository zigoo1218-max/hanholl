"""공공데이터포털 "한국토지주택공사_분양임대공고문 조회 서비스" REST API 수집기.

- 신청: https://www.data.go.kr/data/15058530/openapi.do
- 엔드포인트: https://apis.data.go.kr/B552555/lhLeaseNoticeInfo1/lhLeaseNoticeInfo1
- 응답(JSON): [ {"dsSch": [...]}, {"dsList": [ {PAN_ID, PAN_NM, UPP_AIS_TP_NM, ...}, ... ],
                                   "resHeader": [...]} ]

API 필드명이 버전에 따라 조금씩 달라질 수 있어 여러 후보 키를 순서대로 확인한다.
공고번호(PAN_ID)는 웹 목록의 panId 와 같으므로 API/웹 어느 쪽으로 받아도 중복 판단 키가 같다.
"""
from __future__ import annotations

import logging
from datetime import date
from typing import Any, Iterable

from ..config import today_kst
from ..models import Notice
from . import PoliteClient
from .lh_web import BASE, _iso, detail_url, extract_detail_text

log = logging.getLogger(__name__)

API_URL = "https://apis.data.go.kr/B552555/lhLeaseNoticeInfo1/lhLeaseNoticeInfo1"

# 상위 공고유형 코드: 05 분양주택, 06 임대주택, 13 주거복지, 39 신혼희망타운
SALE_CODES = ["05", "39"]
RENTAL_CODES = ["06", "13"]


class LHApiError(RuntimeError):
    pass


def _pick(row: dict, *keys: str) -> str:
    for k in keys:
        v = row.get(k)
        if v not in (None, ""):
            return str(v).strip()
    return ""


def _iter_rows(payload: Any) -> Iterable[dict]:
    """응답 JSON 어디에 있든 dsList 배열을 찾아 행을 돌려준다."""
    if isinstance(payload, dict):
        if isinstance(payload.get("dsList"), list):
            yield from (r for r in payload["dsList"] if isinstance(r, dict))
        else:
            for v in payload.values():
                yield from _iter_rows(v)
    elif isinstance(payload, list):
        for item in payload:
            yield from _iter_rows(item)


def _check_header(payload: Any) -> None:
    """resHeader 의 SS_CODE 가 'N' 이면 오류로 처리 (인증키 오류 등)."""
    items = payload if isinstance(payload, list) else [payload]
    for item in items:
        if isinstance(item, dict) and isinstance(item.get("resHeader"), list):
            for h in item["resHeader"]:
                if isinstance(h, dict) and str(h.get("SS_CODE", "Y")).upper() == "N":
                    raise LHApiError(f"API 오류 응답: {h}")


def row_to_notice(row: dict) -> Notice | None:
    pan_id = _pick(row, "PAN_ID", "panId")
    title = _pick(row, "PAN_NM", "panNm")
    if not pan_id or not title:
        return None
    upp = _pick(row, "UPP_AIS_TP_CD", "uppAisTpCd")
    ais = _pick(row, "AIS_TP_CD", "aisTpCd")
    ccr = _pick(row, "CCR_CNNT_SYS_DS_CD", "ccrCnntSysDsCd")
    url = _pick(row, "DTL_URL", "dtlUrl")
    if not url and upp:
        url = detail_url(pan_id, ccr, upp, ais or upp)
    if url.startswith("/"):
        url = BASE + url
    return Notice(
        uid=f"LH:{pan_id}",
        source="LH",
        title=title,
        url=url,
        posted_date=_iso(_pick(row, "PAN_NT_ST_DT", "PAN_DT", "panNtStDt")) or _yyyymmdd(_pick(row, "PAN_DT")),
        close_date=_iso(_pick(row, "CLSG_DT", "clsgDt")),
        category=_pick(row, "AIS_TP_CD_NM", "UPP_AIS_TP_NM"),
        area=_pick(row, "CNP_CD_NM", "cnpCdNm"),
        status=_pick(row, "PAN_SS", "panSs"),
    )


def _yyyymmdd(v: str) -> str:
    return f"{v[:4]}-{v[4:6]}-{v[6:8]}" if len(v) == 8 and v.isdigit() else ""


class LHApiSource:
    name = "공공데이터포털 LH API"
    page_size = 100
    max_pages = 5

    def __init__(self, client: PoliteClient, api_key: str, include_rental: bool = True):
        self.client = client
        self.api_key = api_key
        self.codes = SALE_CODES + (RENTAL_CODES if include_rental else [])

    def _call(self, code: str, since: date, page: int) -> list[dict]:
        params = {
            "serviceKey": self.api_key,  # Decoding 키를 넣으면 requests 가 알아서 인코딩
            "PG_SZ": self.page_size,
            "PAGE": page,
            "UPP_AIS_TP_CD": code,
            "PAN_ST_DT": since.strftime("%Y.%m.%d"),
            "PAN_ED_DT": today_kst().strftime("%Y.%m.%d"),
        }
        resp = self.client.request("GET", API_URL, params=params)
        try:
            payload = resp.json()
        except ValueError as exc:  # 인증키 오류 시 XML 오류 문서가 오는 경우가 있음
            raise LHApiError(f"JSON 이 아닌 응답: {resp.text[:200]}") from exc
        _check_header(payload)
        return list(_iter_rows(payload))

    def fetch_notices(self, since: date) -> list[Notice]:
        seen: dict[str, Notice] = {}
        for code in self.codes:
            for page in range(1, self.max_pages + 1):
                rows = self._call(code, since, page)
                for row in rows:
                    n = row_to_notice(row)
                    if n:
                        seen.setdefault(n.uid, n)
                if len(rows) < self.page_size:
                    break
        # API 날짜 필터가 무시되는 경우를 대비해 한 번 더 거른다
        result = [n for n in seen.values() if not n.posted_date or n.posted_date >= since.isoformat()]
        log.info("[%s] 최근 공고 %d건 조회", self.name, len(result))
        return result

    def fetch_detail_text(self, notice: Notice) -> str:
        resp = self.client.request("GET", notice.url)
        return extract_detail_text(resp.text, (".bbs_ViewA", ".bbsV_cont"))
