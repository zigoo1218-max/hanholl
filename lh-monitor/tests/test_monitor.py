"""네트워크 없이 돌아가는 단위 테스트: python -m unittest discover -s tests"""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from lhbot.config import Settings  # noqa: E402
from lhbot.filters import apply_filter, classify_types, match_regions  # noqa: E402
from lhbot.models import Notice  # noqa: E402
from lhbot.sources.lh_api import row_to_notice  # noqa: E402
from lhbot.sources.lh_web import parse_list as parse_lh  # noqa: E402
from lhbot.sources.sh_web import parse_list as parse_sh  # noqa: E402
from lhbot.store import StateStore  # noqa: E402
from lhbot.telegram import format_message, to_plain  # noqa: E402

FIX = ROOT / "tests" / "fixtures"
SETTINGS = Settings()
REGIONS = SETTINGS.region_aliases()
RULES = SETTINGS.type_rules()


def _n(title: str, category: str = "", uid: str = "LH:1") -> Notice:
    return Notice(uid=uid, source="LH", title=title, url="https://example.com", category=category)


class FilterTest(unittest.TestCase):
    def test_region_aliases_and_spacing(self):
        self.assertEqual(match_regions("역곡지구 하우스토리(부천역곡 A-2블록)", REGIONS), ["부천역곡"])
        self.assertEqual(match_regions("하남 교산 A2블록", REGIONS), ["하남교산"])
        self.assertEqual(match_regions("성남 대장지구 공공분양", REGIONS), [])  # 성남 대장지구 오탐 방지

    def test_type_classification(self):
        self.assertEqual(classify_types("부천대장 A5 신혼희망타운 입주자모집", RULES), ["신혼희망타운"])
        self.assertIn("뉴:홈", classify_types("하남교산 뉴:홈 나눔형 입주자모집", RULES))
        self.assertEqual(classify_types("인천계양 A6 공공분양 잔여세대 추가 입주자모집", RULES),
                         ["무순위(잔여세대)", "공공분양"])

    def test_apply_filter_requires_region_and_type(self):
        self.assertTrue(apply_filter(_n("인천계양 A6블록 공공분양주택 입주자모집공고", "분양주택"), REGIONS, RULES))
        self.assertFalse(apply_filter(_n("양주회천 A-26BL 공공분양주택 입주자모집공고", "분양주택"), REGIONS, RULES))
        self.assertFalse(apply_filter(_n("인천계양 상가 입찰 공고", "임대상가"), REGIONS, RULES))

    def test_rental_toggle(self):
        rules = Settings(include_rental=False).type_rules()
        self.assertFalse(apply_filter(_n("하남교산 A3 행복주택 입주자모집", "행복주택"), REGIONS, rules))
        self.assertTrue(apply_filter(_n("하남교산 A3 행복주택 입주자모집", "행복주택"), REGIONS, RULES))

    def test_region_found_in_detail_text(self):
        n = _n("3기 신도시 공공분양 입주자모집공고", "분양주택")
        self.assertFalse(apply_filter(n, REGIONS, RULES))
        self.assertTrue(apply_filter(n, REGIONS, RULES, detail_text="공급위치: 부천대장 A-5블록"))
        self.assertEqual(n.regions, ["부천대장"])
        self.assertTrue(n.matched_in_detail)


class ParserTest(unittest.TestCase):
    def test_lh_list(self):
        rows = parse_lh((FIX / "lh_list.html").read_text(encoding="utf-8"))
        self.assertEqual(len(rows), 25)
        gy = next(r for r in rows if r.uid == "LH:0000061174")
        self.assertEqual(gy.title, "[정정공고]인천계양 A6블록 공공분양주택 입주자모집공고")
        self.assertEqual(gy.posted_date, "2026-09-14")
        self.assertEqual(gy.category, "분양주택")
        self.assertEqual(gy.area, "인천광역시")
        self.assertIn("panId=0000061174", gy.url)
        self.assertIn("mi=1027", gy.url)
        self.assertNotIn("일전", gy.title)  # "1일전" 배지 제거
        yg = [r for r in rows if "부천역곡" in r.title]
        self.assertTrue(yg and all(r.category == "공공분양(신혼희망)" for r in yg))

    def test_sh_list(self):
        rows = parse_sh((FIX / "sh_list.html").read_text(encoding="utf-8"))
        self.assertEqual(len(rows), 10)
        self.assertEqual(rows[0].uid, "SH:310673")
        self.assertEqual(rows[0].posted_date, "2026-09-23")
        self.assertTrue(rows[0].url.endswith("view.do?seq=310673"))

    def test_api_row(self):
        n = row_to_notice({
            "PAN_ID": "0000061200", "PAN_NM": "하남교산 A-1블록 신혼희망타운 입주자모집공고",
            "UPP_AIS_TP_CD": "39", "AIS_TP_CD": "39", "CCR_CNNT_SYS_DS_CD": "02",
            "AIS_TP_CD_NM": "공공분양(신혼희망)", "CNP_CD_NM": "경기도",
            "PAN_NT_ST_DT": "2026.10.01", "CLSG_DT": "2026.10.20", "PAN_SS": "공고중",
            "DTL_URL": "https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?panId=0000061200",
        })
        self.assertEqual(n.uid, "LH:0000061200")
        self.assertEqual(n.posted_date, "2026-10-01")
        self.assertTrue(apply_filter(n, REGIONS, RULES))


class StoreAndMessageTest(unittest.TestCase):
    def test_dedup_state(self):
        with tempfile.TemporaryDirectory() as d, StateStore(Path(d) / "s.db") as store:
            n = _n("인천계양 공공분양", uid="LH:9")
            self.assertFalse(store.is_checked(n.uid))
            store.mark_checked(n)
            self.assertTrue(store.is_checked(n.uid))
            self.assertFalse(store.is_notified(n.uid))
            store.mark_notified(n)
            store.mark_checked(n)  # 발송 기록은 되돌려지지 않아야 함
            self.assertTrue(store.is_notified(n.uid))
            self.assertEqual(store.count_notified(), 1)

    def test_message_format(self):
        n = _n("부천대장 <A5> 신혼희망타운", "공공분양(신혼희망)")
        n.regions, n.supply_types, n.posted_date = ["부천대장"], ["신혼희망타운"], "2026-10-01"
        msg = format_message(n)
        self.assertIn("&lt;A5&gt;", msg)  # HTML 이스케이프
        plain = to_plain(msg)
        for line in ("[신규 공고 알림]", "- 지구명: 부천대장", "- 공고명: 부천대장 <A5> 신혼희망타운",
                     "- 공급유형: 신혼희망타운", "- 공고일자: 2026-10-01",
                     "- 바로가기 링크: https://example.com"):
            self.assertIn(line, plain)


if __name__ == "__main__":
    unittest.main()
