"""텔레그램 메시지 포맷 / 발송."""
from __future__ import annotations

import html
import logging
import re
import time

import requests

from .models import Notice

log = logging.getLogger(__name__)


def format_message(n: Notice) -> str:
    e = html.escape
    lines = [
        "<b>[신규 공고 알림]</b>",
        f"- 지구명: {e(' / '.join(n.regions))}",
        f"- 공고명: {e(n.title)}",
        f"- 공급유형: {e(' / '.join(n.supply_types))}",
        f"- 공고일자: {e(n.posted_date or '-')}",
    ]
    if n.close_date:
        lines.append(f"- 마감일자: {e(n.close_date)}")
    if n.status:
        lines.append(f"- 진행상태: {e(n.status)}")
    lines.append(f"- 출처: {e(n.source)}{' (본문에서 지구명 확인)' if n.matched_in_detail else ''}")
    lines.append(f'- 바로가기 링크: <a href="{e(n.url, quote=True)}">{e(n.url)}</a>')
    return "\n".join(lines)


def to_plain(message: str) -> str:
    """콘솔(dry-run) 출력용: HTML 태그를 걷어낸 텍스트."""
    text = re.sub(r'<a href="[^"]*">(.*?)</a>', r"\1", message)
    return html.unescape(re.sub(r"</?b>", "", text))


class TelegramClient:
    def __init__(self, token: str, chat_id: str, timeout: int = 20):
        self.url = f"https://api.telegram.org/bot{token}/sendMessage"
        self.chat_id = chat_id
        self.timeout = timeout

    def send(self, text: str, retries: int = 3) -> bool:
        payload = {
            "chat_id": self.chat_id,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }
        for attempt in range(1, retries + 1):
            try:
                resp = requests.post(self.url, json=payload, timeout=self.timeout)
            except requests.RequestException as exc:
                log.warning("텔레그램 전송 실패 (%d/%d): %s", attempt, retries, exc)
                time.sleep(2 * attempt)
                continue
            if resp.status_code == 429:  # 전송 속도 제한 → 안내된 시간만큼 대기
                wait = resp.json().get("parameters", {}).get("retry_after", 5)
                log.warning("텔레그램 속도 제한, %s초 대기", wait)
                time.sleep(wait + 1)
                continue
            if resp.ok and resp.json().get("ok"):
                return True
            # 토큰/채팅ID 오류 등은 재시도해도 소용 없음
            log.error("텔레그램 응답 오류 %s: %s", resp.status_code, resp.text[:300])
            return False
        return False
