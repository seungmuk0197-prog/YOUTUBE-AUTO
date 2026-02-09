"""공통 유틸리티
"""
import os
import time
import re
from pathlib import Path


def ensure_dir(p: str):
    pth = Path(p)
    pth.mkdir(parents=True, exist_ok=True)
    return str(pth)


def now_ts():
    return int(time.time())


def now_ms():
    return int(time.time() * 1000)


def slugify(text: str) -> str:
    if not text:
        return "untitled"
    s = re.sub(r"[^A-Za-z0-9]+", "_", text)
    return s.strip("_") or "untitled"
