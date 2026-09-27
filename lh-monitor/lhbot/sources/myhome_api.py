"""국토교통부 마이홈포털 "공공주택 모집공고 조회 서비스" API 수집기.

LH 뿐 아니라 GH(경기주택도시공사), iH(인천도시공사), 부천도시공사 등 지방공사의
공공분양·공공임대 모집공고를 한곳에서 받을 수 있다.

- 신청: https://www.data.go.kr/data/15108420/openapi.do
- 공공임대: https://apis.data.go.kr/1613000/HWSPR02/rsdtRcritNtcList
- 공공분양: https://apis.data.go.kr/1613000/HWSPR02/ltRsdtRcritNtcList
- 요청: serviceKey, brtcCode(광역시도), pageNo, numOfRows, yearMtBegin/yearMtEnd(YYYYMM)
- 응답: response.header.resultCode, response.body.item[] (pblancId, pblancNm, suplyInsttNm,
        suplyTyNm, rcritPblancDe, beginDe, endDe, url, pcUrl, hsmpNm, fullAdres ...)

마이홈포털 웹사이트는 해외 서버(GitHub Actions 등)에서 접속이 막히는 경우가 있어
공공데이터포털 API 로만 조회한다 (API 서버는 해외에서도 응답함).
"""
from __future__ import annotations

import json
import logging
import xml.etree.ElementTree as ET
from datetime import date
from typing import Any, Iterable

from ..config import today_kst
from ..models import Notice
from . import PoliteClient, to_iso

log = logging.getLogger(__name__)

BASE = "https://apis.data.go.kr/1613000/HWSPR02"
ENDPOINTS = {
    "sale": ("ltRsdtRcritNtcList", "공공분양"),
    "rental": ("rsdtRcritNtcList", "공공임대"),
}
# 대상 지구가 있는 광역시도: 경기(부천·하남), 인천(계양)
DEFAULT_BRTC_CODES = ["41", "28"]


class MyHomeApiError(RuntimeError):
    pass


def _items_from_json(payload: Any) -> tuple[str, list[dict]]:
    """JSON 응답에서 (결과코드, item 목록)을 꺼낸다. response 래퍼 유무 모두 처리."""
    if isinstance(payload, dict) and "OpenAPI_ServiceResponse" in payload:  # 공공데이터포털 게이트웨이 오류
        header = payload["OpenAPI_ServiceResponse"].get("cmmMsgHeader") or {}
        return str(header.get("returnReasonCode") or "99"), []
    root = payload.get("response", payload) if isinstance(payload, dict) else {}
    header = root.get("header") or {}
    body = root.get("body") or {}
    items = body.get("item")
    if items is None and isinstance(body.get("items"), dict):  # {"items": {"item": [...]}} 형태
        items = body["items"].get("item")
    if isinstance(items, dict):
        items = [items]
    return str(header.get("resultCode", "")), [i for i in (items or []) if isinstance(i, dict)]


def _items_from_xml(text: str) -> tuple[str, list[dict]]:
    root = ET.fromstring(text)
    code = root.findtext(".//resultCode") or root.findtext(".//returnReasonCode") or ""
    items = [{child.tag: (child.text or "") for child in item} for item in root.iter("item")]
    return code, items


def parse_response(text: str) -> list[dict]:
    text = text.strip()
    if text.startswith("{"):
        code, items = _items_from_json(json.loads(text))
    else:
        code, items = _items_from_xml(text)
    # 00(또는 0, 000) = 정상, 03 = 데이터 없음
    if code and code.strip("0") and code.lstrip("0") != "3":
        raise MyHomeApiError(f"API 오류 응답(resultCode={code}): {text[:200]}")
    return items


def item_to_notice(item: dict, kind: str) -> Notice | None:
    pblanc_id = str(item.get("pblancId") or "").strip()
    title = str(item.get("pblancNm") or "").strip()
    if not pblanc_id or not title:
        return None
    label = ENDPOINTS[kind][1]
    supply_ty = str(item.get("suplyTyNm") or "").strip()
    return Notice(
        uid=f"MYHOME:{pblanc_id}",
        source="마이홈포털",
        title=title,
        url=str(item.get("url") or item.get("pcUrl") or "").strip(),
        posted_date=to_iso(item.get("rcritPblancDe")),
        close_date=to_iso(item.get("endDe")),
        # 유형 칸: 임대는 공급유형(행복주택·국민임대 등), 분양은 "공공분양"
        category=f"{label} {supply_ty}".strip(),
        area=str(item.get("brtcNm") or "").strip(),
        status=str(item.get("sttusNm") or "").strip(),
        address=" ".join(str(item.get(k) or "") for k in ("fullAdres", "hsmpNm")).strip(),
        supplier=str(item.get("suplyInsttNm") or "").strip(),
        public_housing=True,
    )


class MyHomeApiSource:
    name = "마이홈포털 API"
    page_size = 100
    max_pages = 10

    def __init__(self, client: PoliteClient, api_key: str, include_rental: bool = True,
                 brtc_codes: Iterable[str] = DEFAULT_BRTC_CODES):
        self.client = client
        self.api_key = api_key
        self.kinds = ["sale", "rental"] if include_rental else ["sale"]
        self.brtc_codes = list(brtc_codes)

    def _fetch(self, kind: str, brtc: str, since: date) -> list[dict]:
        rows: list[dict] = []
        for page in range(1, self.max_pages + 1):
            params = {
                "serviceKey": self.api_key,
                "brtcCode": brtc,
                "pageNo": page,
                "numOfRows": self.page_size,
                "yearMtBegin": since.strftime("%Y%m"),
                "yearMtEnd": today_kst().strftime("%Y%m"),
            }
            resp = self.client.request("GET", f"{BASE}/{ENDPOINTS[kind][0]}", params=params)
            batch = parse_response(resp.text)
            rows.extend(batch)
            if len(batch) < self.page_size:
                break
        return rows

    def fetch_notices(self, since: date) -> list[Notice]:
        seen: dict[str, Notice] = {}
        for kind in self.kinds:
            for brtc in self.brtc_codes:
                for item in self._fetch(kind, brtc, since):
                    n = item_to_notice(item, kind)
                    # 한 공고에 여러 단지가 있으면 item 이 여러 개 → 공고ID 기준으로 합침
                    if n and n.uid not in seen:
                        seen[n.uid] = n
                    elif n:
                        prev = seen[n.uid]
                        if n.address and n.address not in prev.address:
                            prev.address = f"{prev.address} / {n.address}"
        result = [n for n in seen.values() if not n.posted_date or n.posted_date >= since.isoformat()]
        log.info("[%s] 최근 공고 %d건 조회", self.name, len(result))
        return result

    def fetch_detail_text(self, notice: Notice) -> str:
        return ""  # 주소·단지명을 API 가 주므로 상세 본문은 열지 않음
