"""SH(서울주택도시개발공사) '공고 및 공지' 게시판 수집기.

SH 는 게시판 자체 검색(제목+내용)이 있으므로 지구명 키워드마다 검색해서 가져온다.
본문 검색을 서버가 해주므로 상세 페이지를 열 필요가 거의 없다.
"""
from __future__ import annotations

import logging
import re
from datetime import date

from bs4 import BeautifulSoup

from ..models import Notice
from . import PoliteClient
from .lh_web import _iso, extract_detail_text

log = logging.getLogger(__name__)

BOARD = "https://www.i-sh.co.kr/main/lay2/program/S1T294C297/www/brd/m_247"
LIST_URL = f"{BOARD}/list.do"
VIEW_URL = f"{BOARD}/view.do"

_SEQ = re.compile(r"getDetailView\('(\d+)'\)")


def parse_list(html: str) -> list[Notice]:
    soup = BeautifulSoup(html, "html.parser")
    notices: list[Notice] = []
    for tr in soup.select("tbody tr"):
        a = tr.find("a", onclick=_SEQ)
        if not a:
            continue
        seq = _SEQ.search(a["onclick"]).group(1)
        title = " ".join(a.get_text(" ", strip=True).split())
        tds = tr.find_all("td")
        posted = next((_iso(td.get_text()) for td in tds if _iso(td.get_text())), "")
        dept = tds[2].get_text(strip=True) if len(tds) > 2 else ""
        notices.append(Notice(
            uid=f"SH:{seq}", source="SH", title=title,
            url=f"{VIEW_URL}?seq={seq}", posted_date=posted, category=dept,
        ))
    return notices


class SHWebSource:
    name = "SH 공고 및 공지(웹)"

    def __init__(self, client: PoliteClient, keywords: list[str]):
        self.client = client
        self.keywords = keywords

    def fetch_notices(self, since: date) -> list[Notice]:
        seen: dict[str, Notice] = {}
        for kw in self.keywords:
            form = {"page": "1", "multi_itm_seq": "0", "itm_seq_1": "0",
                    "srchTp": "10",  # 10 = 제목+내용 전체 검색
                    "srchWord": kw}
            resp = self.client.request("POST", LIST_URL, data=form)
            for n in parse_list(resp.text):
                if n.posted_date and n.posted_date < since.isoformat():
                    continue
                seen.setdefault(n.uid, n)
        log.info("[%s] 키워드 검색 결과 %d건", self.name, len(seen))
        return list(seen.values())

    def fetch_detail_text(self, notice: Notice) -> str:
        resp = self.client.request("GET", notice.url)
        return extract_detail_text(resp.text, (".contents",))
