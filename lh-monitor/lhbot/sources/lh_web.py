"""LH청약플러스(apply.lh.or.kr) 공고문 목록 조회 (API 키 없이 사용 가능).

사이트의 "공고문" 검색 폼과 같은 파라미터로 목록 HTML 을 받아 표를 파싱한다.
로그인/개인정보가 필요 없는 공개 목록만 조회하며, 요청 사이에 간격을 둔다.
"""
from __future__ import annotations

import logging
import re
from datetime import date
from urllib.parse import urlencode

from bs4 import BeautifulSoup

from ..config import today_kst
from ..models import Notice
from . import PoliteClient

log = logging.getLogger(__name__)

BASE = "https://apply.lh.or.kr"
LIST_URL = f"{BASE}/lhapply/apply/wt/wrtanc/selectWrtancList.do"
DETAIL_URL = f"{BASE}/lhapply/apply/wt/wrtanc/selectWrtancInfo.do"

# 사이트 검색 폼의 "유형 = 전체" 코드
BOARDS = {
    # 분양주택 메뉴: 분양주택(05) + 공공분양 신혼희망(39) + 이익공유형(뉴:홈 나눔형, 54)
    "sale": {"mi": "1027", "srchUppAisTpCd": "053954", "uppAisTpCd": "05"},
    # 임대주택 메뉴: 공공임대(06) + 주거복지(13) + 신혼희망 임대(39)
    "rental": {"mi": "1026", "srchUppAisTpCd": "061339", "uppAisTpCd": "06"},
}

_DATE = re.compile(r"(\d{4})[.\-](\d{2})[.\-](\d{2})")


def _iso(text: str) -> str:
    m = _DATE.search(text or "")
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else ""


def detail_url(pan_id: str, ccr: str, upp: str, ais: str) -> str:
    # 사이트 JS(formSubmit) 규칙: 분양(05, 54, 39/39)은 mi=1027, 나머지는 1026
    mi = "1027" if upp in ("05", "54") or (upp == "39" and ais == "39") else "1026"
    return f"{DETAIL_URL}?" + urlencode({
        "panId": pan_id, "ccrCnntSysDsCd": ccr, "uppAisTpCd": upp, "aisTpCd": ais, "mi": mi,
    })


def parse_list(html: str) -> list[Notice]:
    soup = BeautifulSoup(html, "html.parser")
    notices: list[Notice] = []
    for tr in soup.select("div.bbs_ListA table tbody tr"):
        a = tr.select_one("a.wrtancInfoBtn")
        if not a or not a.get("data-id1"):
            continue
        span = a.find("span")
        if span:
            for em in span.find_all("em"):  # "1일전", "new" 배지 제거
                em.decompose()
        title = " ".join((span or a).get_text(" ", strip=True).split())
        pan_id = a["data-id1"]
        ccr, upp, ais = a.get("data-id2", ""), a.get("data-id3", ""), a.get("data-id4", "")

        tds = tr.find_all("td")
        dates = [_iso(td.get_text()) for td in tds if _DATE.search(td.get_text())]
        cate = tr.select_one("td.cate.col1")
        area = tr.select_one("td.cate.col2")
        stt = tr.select_one("td.stt")

        notices.append(Notice(
            uid=f"LH:{pan_id}",
            source="LH",
            title=title,
            url=detail_url(pan_id, ccr, upp, ais),
            posted_date=dates[0] if dates else "",
            close_date=dates[1] if len(dates) > 1 else "",
            category=cate.get_text(strip=True) if cate else "",
            area=area.get_text(strip=True) if area else "",
            status=stt.get_text(strip=True) if stt else "",
        ))
    return notices


class LHWebSource:
    name = "LH청약플러스(웹)"
    page_size = 100
    max_pages = 5

    def __init__(self, client: PoliteClient, include_rental: bool = True):
        self.client = client
        self.boards = ["sale", "rental"] if include_rental else ["sale"]

    def _fetch_board(self, board: str, since: date) -> list[Notice]:
        out: list[Notice] = []
        for page in range(1, self.max_pages + 1):
            form = {
                **BOARDS[board],
                "aisTpCd": "", "srchAisTpCd": "", "cnpCd": "",
                "panSs": "",  # 상태 전체 (공고중/접수중/마감 모두)
                "schTy": "0",  # 게시일 기준
                "startDt": since.isoformat(), "endDt": today_kst().isoformat(),
                "panNm": "", "listCo": str(self.page_size), "currPage": str(page),
                "srchY": "Y", "indVal": "N",
            }
            resp = self.client.request("POST", LIST_URL, data=form)
            rows = parse_list(resp.text)
            out.extend(rows)
            if len(rows) < self.page_size:
                break
        return out

    def fetch_notices(self, since: date) -> list[Notice]:
        seen: dict[str, Notice] = {}
        for board in self.boards:
            for n in self._fetch_board(board, since):
                seen.setdefault(n.uid, n)
        log.info("[%s] 최근 공고 %d건 조회", self.name, len(seen))
        return list(seen.values())

    def fetch_detail_text(self, notice: Notice) -> str:
        resp = self.client.request("GET", notice.url)
        return extract_detail_text(resp.text, (".bbs_ViewA", ".bbsV_cont"))


def extract_detail_text(html: str, selectors: tuple[str, ...]) -> str:
    """상세 페이지에서 공고 본문 영역만 텍스트로 뽑는다.

    메뉴/푸터까지 포함하면 다른 지구명이 섞여 오탐이 생길 수 있으므로
    본문 영역을 못 찾으면 빈 문자열을 돌려준다.
    """
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    for sel in selectors:
        el = soup.select_one(sel)
        if el:
            return " ".join(el.get_text(" ", strip=True).split())
    return ""
