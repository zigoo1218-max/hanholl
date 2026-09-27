"""지구명 / 공급유형 키워드 필터."""
from __future__ import annotations

import re

from .models import Notice

_WS = re.compile(r"\s+")


def _norm(text: str) -> str:
    # "부천 대장" / "부천대장" 을 같게 보기 위해 공백을 모두 제거
    return _WS.sub("", text or "")


def match_regions(text: str, region_aliases: dict[str, list[str]]) -> list[str]:
    body = _norm(text)
    return [region for region, aliases in region_aliases.items()
            if any(_norm(a) in body for a in aliases)]


def classify_types(text: str, type_rules: list[tuple[str, list[str]]]) -> list[str]:
    body = _norm(text)
    return [label for label, keywords in type_rules
            if any(_norm(k) in body for k in keywords)]


def apply_filter(notice: Notice, region_aliases: dict[str, list[str]],
                 type_rules: list[tuple[str, list[str]]], detail_text: str = "",
                 address_aliases: dict[str, list[str]] | None = None) -> bool:
    """지구명 1개 이상 + 공급유형 1개 이상이 모두 걸려야 통과.

    지구명은 제목 → 공급위치 주소(address_aliases) → 상세 본문(detail_text) 순서로 찾는다.
    공급유형은 제목과 사이트 유형 칸 기준으로 판단한다 (본문은 무관한 유형 언급이 많아 제외).
    """
    head = f"{notice.title} {notice.category}"
    regions = match_regions(head, region_aliases)
    note = ""
    if not regions and notice.address:
        regions = match_regions(notice.address, region_aliases)
        if not regions and address_aliases:
            regions = match_regions(notice.address, address_aliases)
            note = "주소로 지구 추정" if regions else ""
    if not regions and detail_text:
        regions = match_regions(detail_text, region_aliases)
        note = "본문에서 지구명 확인" if regions else ""

    types = classify_types(head, type_rules)
    if not regions or not types:
        return False

    notice.regions = regions
    notice.supply_types = types
    notice.match_note = note
    return True
