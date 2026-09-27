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
from lhbot.sources.applyhome_api import row_to_notice as applyhome_notice  # noqa: E402
from lhbot.sources.lh_api import row_to_notice  # noqa: E402
from lhbot.sources.myhome_api import item_to_notice as myhome_notice  # noqa: E402
from lhbot.sources.myhome_api import MyHomeApiError, parse_response  # noqa: E402
from lhbot.sources.lh_web import parse_list as parse_lh  # noqa: E402
from lhbot.sources.sh_web import parse_list as parse_sh  # noqa: E402
from lhbot.store import StateStore  # noqa: E402
from lhbot.telegram import format_message, to_plain  # noqa: E402
from monitor import drop_cross_source_duplicates  # noqa: E402

FIX = ROOT / "tests" / "fixtures"
SETTINGS = Settings()
REGIONS = SETTINGS.region_aliases()
RULES = SETTINGS.type_rules()
ADDRS = SETTINGS.address_aliases()


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
        self.assertEqual(n.match_note, "본문에서 지구명 확인")


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


class MyHomeAndApplyHomeTest(unittest.TestCase):
    """마이홈포털 · 청약홈 API 응답 처리 (공식 명세의 필드명 기준으로 만든 예시 응답)."""

    MYHOME_JSON = """{"response": {"header": {"resultCode": "00", "resultMsg": "NORMAL SERVICE."},
      "body": {"totalCount": "1", "numOfRows": "100", "pageNo": "1", "item": [
        {"pblancId": "20260901", "houseSn": 1, "sttusNm": "공고중",
         "pblancNm": "하남교산 A-3블록 통합공공임대주택 입주자 모집공고",
         "suplyInsttNm": "경기주택도시공사", "houseTyNm": "아파트", "suplyTyNm": "통합공공임대",
         "rcritPblancDe": "20260915", "beginDe": "20261001", "endDe": "20261010",
         "url": "https://apply.gh.or.kr/notice/1", "pcUrl": "https://www.myhome.go.kr/x",
         "hsmpNm": "하남교산 A-3", "brtcNm": "경기도", "signguNm": "하남시",
         "fullAdres": "경기도 하남시 천현동 산 1"}]}}}"""

    def test_myhome_parse(self):
        items = parse_response(self.MYHOME_JSON)
        n = myhome_notice(items[0], "rental")
        self.assertEqual(n.uid, "MYHOME:20260901")
        self.assertEqual(n.posted_date, "2026-09-15")
        self.assertEqual(n.close_date, "2026-10-10")
        self.assertEqual(n.url, "https://apply.gh.or.kr/notice/1")  # 공급기관 원문 링크 우선
        self.assertEqual(n.supplier, "경기주택도시공사")
        self.assertTrue(apply_filter(n, REGIONS, RULES, address_aliases=ADDRS))
        self.assertIn("공공임대", n.supply_types)

    def test_myhome_single_item_and_errors(self):
        one = '{"response":{"header":{"resultCode":"00"},"body":{"item":{"pblancId":"1","pblancNm":"x"}}}}'
        self.assertEqual(len(parse_response(one)), 1)
        self.assertEqual(parse_response('{"response":{"header":{"resultCode":"03"},"body":{}}}'), [])
        with self.assertRaises(MyHomeApiError):
            parse_response('{"OpenAPI_ServiceResponse":{"cmmMsgHeader":{"returnReasonCode":"30"}}}')
        with self.assertRaises(MyHomeApiError):
            parse_response("<OpenAPI_ServiceResponse><cmmMsgHeader><returnReasonCode>30"
                           "</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>")
        xml = ("<response><header><resultCode>00</resultCode></header><body><items>"
               "<item><pblancId>7</pblancId><pblancNm>t</pblancNm></item></items></body></response>")
        self.assertEqual(parse_response(xml)[0]["pblancId"], "7")

    def test_applyhome_private_apt_matched_by_address(self):
        n = applyhome_notice("getAPTLttotPblancDetail", {
            "HOUSE_MANAGE_NO": "2026000123", "PBLANC_NO": "2026000123",
            "HOUSE_NM": "힐스테이트 오정 더센트럴", "HOUSE_SECD": "01", "HOUSE_DTL_SECD": "01",
            "RENT_SECD": "0", "SUBSCRPT_AREA_CODE_NM": "경기",
            "HSSPLY_ADRES": "경기도 부천시 오정구 대장동 B5블록", "RCRIT_PBLANC_DE": "2026-09-20",
            "RCEPT_ENDDE": "2026-10-02", "BSNS_MBY_NM": "(주)오정개발",
            "PBLANC_URL": "https://www.applyhome.or.kr/ai/aia/selectAPTLttotPblancDetail.do?houseManageNo=2026000123",
        })
        self.assertEqual(n.category, "민간분양(민영주택)")
        self.assertFalse(n.public_housing)
        self.assertFalse(apply_filter(n, REGIONS, RULES))  # 제목만으로는 못 찾음
        self.assertTrue(apply_filter(n, REGIONS, RULES, address_aliases=ADDRS))
        self.assertEqual(n.regions, ["부천대장"])
        self.assertEqual(n.supply_types, ["민간분양"])
        self.assertEqual(n.match_note, "주소로 지구 추정")

    def test_applyhome_remainder(self):
        n = applyhome_notice("getRemndrLttotPblancDetail", {
            "HOUSE_MANAGE_NO": "1", "PBLANC_NO": "2", "HOUSE_NM": "계양 ○○아파트",
            "HOUSE_SECD": "04", "HSSPLY_ADRES": "인천광역시 계양구 박촌동 1",
            "RCRIT_PBLANC_DE": "2026-09-21", "SUBSCRPT_RCEPT_ENDDE": "2026-09-25",
        })
        self.assertEqual(n.uid, "APPLYHOME:1-2")
        self.assertEqual(n.close_date, "2026-09-25")
        self.assertTrue(apply_filter(n, REGIONS, RULES, address_aliases=ADDRS))
        self.assertEqual(n.supply_types, ["무순위(잔여세대)"])

    def test_cross_source_dedup(self):
        lh = Notice(uid="LH:1", source="LH", title="t", url="u")
        myhome_lh = Notice(uid="MYHOME:1", source="마이홈포털", title="t", url="u", supplier="LH")
        myhome_gh = Notice(uid="MYHOME:2", source="마이홈포털", title="t", url="u", supplier="경기주택도시공사")
        ah_public = Notice(uid="APPLYHOME:1", source="청약홈", title="t", url="u", public_housing=True)
        ah_private = Notice(uid="APPLYHOME:2", source="청약홈", title="t", url="u", supplier="(주)민간")
        items = [(None, x) for x in (lh, myhome_lh, myhome_gh, ah_public, ah_private)]

        kept = [n.uid for _, n in drop_cross_source_duplicates(items, lh_ok=True, myhome_ok=True)]
        self.assertEqual(kept, ["LH:1", "MYHOME:2", "APPLYHOME:2"])
        # LH·마이홈 조회가 실패했으면 다른 출처 것이라도 받는다
        kept = [n.uid for _, n in drop_cross_source_duplicates(items, lh_ok=False, myhome_ok=False)]
        self.assertEqual(len(kept), 5)


class RedactTest(unittest.TestCase):
    def test_secrets_hidden(self):
        from lhbot.sources import redact
        msg = redact("401 for url: https://x/y?serviceKey=ab%2Bc%3D%3D&page=1 "
                     "https://api.telegram.org/bot123456:AAE-x_yz/sendMessage")
        self.assertNotIn("ab%2Bc", msg)
        self.assertNotIn("AAE-x_yz", msg)
        self.assertIn("serviceKey=***&page=1", msg)


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
