#!/usr/bin/env python3
"""LH · 마이홈포털 · 청약홈 · SH 신규 분양·임대·무순위 공고 모니터링 → 텔레그램 알림.

사용 예)
    python monitor.py                  # 1회 실행 (신규 공고만 발송)
    python monitor.py --dry-run        # 발송/저장 없이 결과만 출력
    python monitor.py --init           # 현재 공고를 '이미 보냄'으로만 기록 (첫 실행 폭탄 방지)
    python monitor.py --test-telegram  # 텔레그램 연결 테스트 메시지 1건 발송
    python monitor.py --source web     # API 키가 있어도 웹 목록으로 조회
"""
from __future__ import annotations

import argparse
import logging
import sys
from datetime import timedelta

from lhbot.config import Settings, load_settings, today_kst
from lhbot.filters import apply_filter, classify_types, match_regions
from lhbot.models import Notice
from lhbot.sources import PoliteClient, is_lh_supplier
from lhbot.sources.applyhome_api import ApplyHomeApiSource
from lhbot.sources.lh_api import LHApiSource
from lhbot.sources.lh_web import LHWebSource
from lhbot.sources.myhome_api import MyHomeApiSource
from lhbot.sources.sh_web import SHWebSource
from lhbot.store import StateStore
from lhbot.telegram import TelegramClient, format_message, to_plain

log = logging.getLogger("monitor")

# 대상 지구(경기·인천)가 걸릴 수 있는 공고만 상세 본문을 연다
_DETAIL_AREA_HINTS = ("경기", "인천", "전국", "외")


def collect(settings: Settings, source_mode: str) -> list[tuple[object, Notice]]:
    """(수집기, 공고) 목록을 돌려준다. 한 수집기가 실패해도 나머지는 계속 진행."""
    client = PoliteClient(delay_sec=settings.request_delay_sec)
    since = today_kst() - timedelta(days=settings.lookback_days)
    results: list[tuple[object, Notice]] = []

    lh_sources = []
    if source_mode in ("auto", "api") and settings.data_go_kr_api_key:
        lh_sources.append(LHApiSource(client, settings.data_go_kr_api_key, settings.include_rental))
    elif source_mode == "api":
        log.error("DATA_GO_KR_API_KEY 가 없어 API 모드를 쓸 수 없습니다. 웹 조회로 진행합니다.")
    if source_mode in ("auto", "web") or not lh_sources:
        lh_sources.append(LHWebSource(client, settings.include_rental))

    # LH: API 우선, 실패하면 웹 목록으로 대체
    lh_ok = False
    for i, src in enumerate(lh_sources):
        try:
            results += [(src, n) for n in src.fetch_notices(since)]
            lh_ok = True
            break
        except Exception as exc:  # noqa: BLE001 - 수집 실패는 다음 수집기로 넘어감
            nxt = "웹 목록으로 대체합니다." if i + 1 < len(lh_sources) else ""
            log.error("[%s] 조회 실패: %s %s", src.name, exc, nxt)

    others = []
    if settings.enable_myhome:
        if settings.myhome_api_key:
            others.append(MyHomeApiSource(client, settings.myhome_api_key, settings.include_rental))
        else:
            log.info("마이홈포털은 공공데이터포털 인증키가 있어야 조회됩니다 (건너뜀).")
    if settings.enable_applyhome:
        if settings.applyhome_api_key:
            others.append(ApplyHomeApiSource(client, settings.applyhome_api_key, settings.include_rental))
        else:
            log.info("청약홈은 공공데이터포털 인증키가 있어야 조회됩니다 (건너뜀).")
    if settings.enable_sh:
        others.append(SHWebSource(client, settings.target_regions))

    myhome_ok = False
    for src in others:
        try:
            notices = src.fetch_notices(since)
        except Exception as exc:  # noqa: BLE001
            log.error("[%s] 조회 실패: %s", src.name, exc)
            continue
        myhome_ok = myhome_ok or isinstance(src, MyHomeApiSource)
        results += [(src, n) for n in notices]

    return drop_cross_source_duplicates(results, lh_ok, myhome_ok)


def drop_cross_source_duplicates(items: list[tuple[object, Notice]], lh_ok: bool,
                                 myhome_ok: bool) -> list[tuple[object, Notice]]:
    """같은 공고가 여러 출처에 올라오는 경우를 줄인다 (출처마다 공고번호가 달라 번호로는 못 거름).

    - LH 공고는 LH 수집기가 받으므로, 마이홈·청약홈에 있는 LH 공급 공고는 뺀다.
    - 공공기관 공급 분양(국민주택·신혼희망타운)은 마이홈이 받으므로 청약홈 쪽은 뺀다.
    각 규칙은 해당 출처 조회가 성공했을 때만 적용한다 (실패하면 다른 출처 것이라도 받도록).
    """
    kept = []
    for src, n in items:
        if lh_ok and n.source in ("마이홈포털", "청약홈") and is_lh_supplier(n.supplier):
            continue
        if myhome_ok and n.source == "청약홈" and n.public_housing:
            continue
        kept.append((src, n))
    return kept


def screen(settings: Settings, store: StateStore, items: list[tuple[object, Notice]],
           persist: bool) -> list[Notice]:
    regions = settings.region_aliases()
    addresses = settings.address_aliases()
    rules = settings.type_rules()
    detail_budget = settings.max_detail_fetch if settings.check_detail else 0
    matched: list[Notice] = []

    for src, n in items:
        if store.is_checked(n.uid):  # 이미 보냈거나, 본문까지 확인했는데 조건에 안 맞았던 공고
            continue
        if apply_filter(n, regions, rules, address_aliases=addresses):
            matched.append(n)
            continue

        # 제목엔 지구명이 없지만 유형은 맞는 경우 → 상세 본문에서 지구명을 찾아본다
        head = f"{n.title} {n.category}"
        title_has_region = bool(match_regions(head, regions))
        type_ok = bool(classify_types(head, rules))
        area_ok = (not n.area) or any(h in n.area for h in _DETAIL_AREA_HINTS)
        if title_has_region or not type_ok or not area_ok or detail_budget <= 0:
            continue

        detail_budget -= 1
        try:
            text = src.fetch_detail_text(n)
        except Exception as exc:  # noqa: BLE001
            log.warning("상세 조회 실패 %s: %s", n.uid, exc)
            continue
        if apply_filter(n, regions, rules, detail_text=text):
            matched.append(n)
        elif persist:
            store.mark_checked(n)

    matched.sort(key=lambda x: (x.posted_date, x.uid))
    return matched


def main() -> int:
    parser = argparse.ArgumentParser(description="LH·마이홈·청약홈·SH 공고 텔레그램 알림 봇")
    parser.add_argument("--dry-run", action="store_true", help="발송·저장 없이 콘솔 출력만")
    parser.add_argument("--init", action="store_true", help="발송 없이 현재 공고를 발송 완료로 기록")
    parser.add_argument("--test-telegram", action="store_true", help="텔레그램 테스트 메시지 발송")
    parser.add_argument("--source", choices=["auto", "api", "web"], default="auto",
                        help="LH 수집 방식 (기본: API 키가 있으면 API, 실패 시 웹)")
    parser.add_argument("--env", help=".env 파일 경로 (기본: lh-monitor/.env)")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s")
    settings = load_settings(args.env)

    telegram = TelegramClient(settings.telegram_bot_token, settings.telegram_chat_id) \
        if settings.telegram_ready else None

    if args.test_telegram:
        if not telegram:
            log.error("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 를 먼저 설정하세요.")
            return 2
        ok = telegram.send("✅ 주택 공고 알림 봇 연결 테스트 메시지입니다.")
        log.info("테스트 메시지 발송 %s", "성공" if ok else "실패")
        return 0 if ok else 1

    dry_run = args.dry_run
    if not telegram and not args.init and not dry_run:
        log.warning("텔레그램 설정이 없어 dry-run 으로 실행합니다 (발송·저장 안 함).")
        dry_run = True

    log.info("대상 지구: %s | 임대 포함: %s | 마이홈: %s | 청약홈: %s | SH: %s | 최근 %d일",
             ", ".join(settings.target_regions), settings.include_rental,
             settings.enable_myhome, settings.enable_applyhome, settings.enable_sh,
             settings.lookback_days)

    items = collect(settings, args.source)
    if not items:
        log.error("조회된 공고가 없습니다 (사이트 접속 실패 가능성).")
        return 1

    with StateStore(settings.state_db_path) as store:
        new = screen(settings, store, items, persist=not dry_run)
        log.info("조건에 맞는 신규 공고 %d건", len(new))

        failed = 0
        for n in new:
            if dry_run:
                print("-" * 60)
                print(to_plain(format_message(n)))
                continue
            if args.init:
                store.mark_notified(n)
                continue
            if telegram.send(format_message(n)):
                store.mark_notified(n)  # 발송 성공한 것만 기록 → 실패분은 다음 실행에 재시도
                log.info("발송: %s", n.title)
            else:
                failed += 1

        if args.init:
            log.info("초기화 완료: %d건을 발송 완료로 기록했습니다.", len(new))
        if failed:
            log.error("발송 실패 %d건 (다음 실행 때 다시 시도합니다)", failed)
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
