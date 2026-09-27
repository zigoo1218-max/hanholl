"""한국부동산원 "청약홈 분양정보 조회 서비스" API 수집기.

LH청약플러스에 올라오지 않는 민간 건설사 아파트 분양(민영주택)과
민간 무순위·잔여세대(줍줍), 임의공급, 공공지원 민간임대 공고를 받는다.

- 신청: https://www.data.go.kr/data/15098547/openapi.do
- 엔드포인트: https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/{오퍼레이션}
- 요청: serviceKey, page, perPage, cond[RCRIT_PBLANC_DE::GTE]=YYYY-MM-DD
- 응답: {"page", "perPage", "totalCount", "currentCount", "matchCount", "data": [...]}

청약홈 웹사이트는 해외 서버(GitHub Actions 등)에서 접속이 막히는 경우가 있어
공공데이터포털 API 로만 조회한다 (API 서버는 해외에서도 응답함).
"""
from __future__ import annotations

import logging
from datetime import date

from ..models import Notice
from . import PoliteClient, to_iso

log = logging.getLogger(__name__)

BASE = "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1"
DETAIL_URL = "https://www.applyhome.or.kr/ai/aia/selectAPTLttotPblancDetail.do"

# (오퍼레이션, 임대 공고인지)
OPERATIONS = [
    ("getAPTLttotPblancDetail", False),  # APT 분양 (민영·국민·신혼희망타운)
    ("getRemndrLttotPblancDetail", False),  # APT 무순위·잔여세대, 불법행위 재공급
    ("getOPTLttotPblancDetail", False),  # 임의공급 (무순위 이후 남은 물량)
    ("getPblPvtRentLttotPblancDetail", True),  # 공공지원 민간임대
]


class ApplyHomeApiError(RuntimeError):
    pass


def _s(row: dict, key: str) -> str:
    v = row.get(key)
    return "" if v is None else str(v).strip()


def classify(op: str, row: dict) -> tuple[str, bool]:
    """(유형 칸에 넣을 이름, 공공기관 공급 여부)."""
    if op == "getAPTLttotPblancDetail":
        if _s(row, "HOUSE_SECD") == "10":
            return "신혼희망타운", True
        public = _s(row, "HOUSE_DTL_SECD") == "03"  # 03 = 국민주택(공공), 01 = 민영
        label = "공공분양(국민주택)" if public else "민간분양(민영주택)"
        if _s(row, "RENT_SECD") == "1":
            label += " 분양전환 가능임대"
        return label, public
    if op == "getRemndrLttotPblancDetail":
        return ("무순위(불법행위 재공급)" if _s(row, "HOUSE_SECD") == "06" else "무순위(잔여세대)"), False
    if op == "getOPTLttotPblancDetail":
        return "임의공급(잔여세대)", False
    return "공공지원 민간임대", False


def row_to_notice(op: str, row: dict) -> Notice | None:
    manage_no, pblanc_no = _s(row, "HOUSE_MANAGE_NO"), _s(row, "PBLANC_NO")
    title = _s(row, "HOUSE_NM")
    if not manage_no or not title:
        return None
    category, public = classify(op, row)
    url = _s(row, "PBLANC_URL") or f"{DETAIL_URL}?houseManageNo={manage_no}&pblancNo={pblanc_no}"
    close = (_s(row, "RCEPT_ENDDE") or _s(row, "SUBSCRPT_RCEPT_ENDDE")
             or _s(row, "GNRL_RCEPT_ENDDE"))
    return Notice(
        uid=f"APPLYHOME:{manage_no}-{pblanc_no}",
        source="청약홈",
        title=title,
        url=url,
        posted_date=to_iso(_s(row, "RCRIT_PBLANC_DE")),
        close_date=to_iso(close),
        category=category,
        area=_s(row, "SUBSCRPT_AREA_CODE_NM"),
        address=_s(row, "HSSPLY_ADRES"),
        supplier=_s(row, "BSNS_MBY_NM"),
        public_housing=public,
    )


class ApplyHomeApiSource:
    name = "청약홈 API"
    page_size = 200
    max_pages = 10

    def __init__(self, client: PoliteClient, api_key: str, include_rental: bool = True):
        self.client = client
        self.api_key = api_key
        self.operations = [op for op, rental in OPERATIONS if include_rental or not rental]

    def _fetch(self, op: str, since: date) -> list[dict]:
        rows: list[dict] = []
        for page in range(1, self.max_pages + 1):
            params = {
                "serviceKey": self.api_key,
                "page": page,
                "perPage": self.page_size,
                "cond[RCRIT_PBLANC_DE::GTE]": since.isoformat(),
            }
            resp = self.client.request("GET", f"{BASE}/{op}", params=params)
            try:
                payload = resp.json()
            except ValueError as exc:
                raise ApplyHomeApiError(f"JSON 이 아닌 응답: {resp.text[:200]}") from exc
            if not isinstance(payload, dict) or "data" not in payload:
                # 인증키 오류 등은 {"code": -4, "msg": "..."} 형태로 온다
                raise ApplyHomeApiError(f"API 오류 응답: {str(payload)[:200]}")
            batch = payload.get("data") or []
            rows.extend(r for r in batch if isinstance(r, dict))
            total = int(payload.get("matchCount") or payload.get("totalCount") or 0)
            if len(batch) < self.page_size or len(rows) >= total:
                break
        return rows

    def fetch_notices(self, since: date) -> list[Notice]:
        seen: dict[str, Notice] = {}
        for op in self.operations:
            for row in self._fetch(op, since):
                n = row_to_notice(op, row)
                if n:
                    seen.setdefault(n.uid, n)
        # 모집공고일 필터가 무시되는 경우를 대비해 한 번 더 거른다
        result = [n for n in seen.values() if not n.posted_date or n.posted_date >= since.isoformat()]
        log.info("[%s] 최근 공고 %d건 조회", self.name, len(result))
        return result

    def fetch_detail_text(self, notice: Notice) -> str:
        return ""  # 공급위치 주소를 API 가 주므로 상세 본문은 열지 않음
