"""발송 이력 / 확인 이력을 저장하는 SQLite 캐시.

- notified : 텔레그램 발송까지 끝난 공고 → 다시는 보내지 않음
- checked  : 상세 본문까지 열어봤지만 조건에 안 맞은 공고 → 다음 실행 때 상세를 다시 열지 않음
"""
from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from .models import Notice

_SCHEMA = """
CREATE TABLE IF NOT EXISTS notices (
    uid          TEXT PRIMARY KEY,
    source       TEXT NOT NULL,
    title        TEXT NOT NULL,
    url          TEXT,
    posted_date  TEXT,
    state        TEXT NOT NULL CHECK (state IN ('notified', 'checked')),
    updated_at   TEXT NOT NULL
);
"""


class StateStore:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(path)
        self.conn.execute(_SCHEMA)
        self.conn.commit()

    def close(self) -> None:
        self.conn.close()

    def __enter__(self) -> "StateStore":
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    def _state(self, uid: str) -> str | None:
        row = self.conn.execute("SELECT state FROM notices WHERE uid = ?", (uid,)).fetchone()
        return row[0] if row else None

    def is_notified(self, uid: str) -> bool:
        return self._state(uid) == "notified"

    def is_checked(self, uid: str) -> bool:
        return self._state(uid) is not None

    def count_notified(self) -> int:
        return self.conn.execute("SELECT COUNT(*) FROM notices WHERE state = 'notified'").fetchone()[0]

    def _upsert(self, n: Notice, state: str) -> None:
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        self.conn.execute(
            """INSERT INTO notices (uid, source, title, url, posted_date, state, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(uid) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at""",
            (n.uid, n.source, n.title, n.url, n.posted_date, state, now),
        )
        self.conn.commit()

    def mark_notified(self, n: Notice) -> None:
        self._upsert(n, "notified")

    def mark_checked(self, n: Notice) -> None:
        # 이미 발송된 공고를 'checked' 로 되돌리지 않도록 보호
        if not self.is_notified(n.uid):
            self._upsert(n, "checked")
