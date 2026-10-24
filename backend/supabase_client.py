"""Supabase REST API client wrapper.

Uses the same anon-key approach as the frontend so the Flask backend
shares the same credentials and access level.
"""

import os
from pathlib import Path
from typing import Any

import requests


def _load_env_files() -> None:
    """Load KEY=VALUE pairs from .env files into os.environ (without overriding).

    Looks in the backend folder and in the project root (where the Vite
    frontend keeps its .env), so VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
    are found automatically when you run `python app.py`.
    """
    here = Path(__file__).resolve().parent
    for env_path in (here / ".env", here.parent / ".env"):
        if not env_path.is_file():
            continue
        for line in env_path.read_text(encoding="utf-8-sig").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


_load_env_files()

SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY", "")

_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}


def _check(resp: requests.Response) -> None:
    """raise_for_status, but include Supabase's error message."""
    if not resp.ok:
        raise RuntimeError(f"Supabase error {resp.status_code}: {resp.text[:300]}")


def _url(path: str) -> str:
    return f"{SUPABASE_URL.rstrip('/')}/rest/v1/{path}"


def select(table: str, query: str = "*", order: str | None = None) -> list[dict[str, Any]]:
    params = {"select": query}
    if order:
        params["order"] = order
    resp = requests.get(_url(table), headers=_HEADERS, params=params, timeout=10)
    _check(resp)
    return resp.json()


def select_filtered(table: str, filter_str: str, query: str = "*", order: str | None = None) -> list[dict[str, Any]]:
    path = f"{table}?{filter_str}" if filter_str else table
    params = {"select": query}
    if order:
        params["order"] = order
    resp = requests.get(_url(path), headers=_HEADERS, params=params, timeout=10)
    _check(resp)
    return resp.json()


def insert(table: str, data: dict[str, Any]) -> dict[str, Any]:
    headers = {**_HEADERS, "Prefer": "return=representation"}
    resp = requests.post(_url(table), headers=headers, json=data, timeout=10)
    _check(resp)
    rows = resp.json()
    return rows[0] if rows else {}


def is_configured() -> bool:
    return bool(SUPABASE_URL and SUPABASE_KEY)