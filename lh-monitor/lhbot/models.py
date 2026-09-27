from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Notice:
    """수집 출처(API/웹)와 무관한 공통 공고 모델."""

    uid: str  # 중복 판단용 고유키. 예: "LH:0000061174", "SH:310673"
    source: str  # "LH" | "SH"
    title: str
    url: str
    posted_date: str = ""  # YYYY-MM-DD
    close_date: str = ""  # YYYY-MM-DD
    category: str = ""  # 사이트가 붙인 유형명 (예: "분양주택", "공공분양(신혼희망)")
    area: str = ""  # 사이트가 붙인 지역명 (예: "경기도")
    status: str = ""  # 공고중 / 접수중 / 접수마감 ...
    # 필터 통과 후 채워지는 값
    regions: list[str] = field(default_factory=list)
    supply_types: list[str] = field(default_factory=list)
    matched_in_detail: bool = False
