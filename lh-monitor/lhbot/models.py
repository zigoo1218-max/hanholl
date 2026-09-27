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
    address: str = ""  # 공급위치 주소 (마이홈·청약홈 API 가 제공)
    supplier: str = ""  # 공급기관 / 사업주체 (예: "경기주택도시공사")
    public_housing: bool = False  # 공공기관이 공급하는 공공주택인지 (출처 간 중복 제거용)
    # 필터 통과 후 채워지는 값
    regions: list[str] = field(default_factory=list)
    supply_types: list[str] = field(default_factory=list)
    match_note: str = ""  # 지구명을 제목이 아닌 곳에서 찾았을 때 표시 (예: "주소로 지구 추정")
