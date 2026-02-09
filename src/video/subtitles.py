"""Subtitles helper: generate simple SRT and render overlays for moviepy

This module provides:
- generate_srt(script, audio_duration, out_path): create SRT with equal division
- parse_srt_entries(path): simple SRT parser to list entries
"""
from pathlib import Path
from typing import List, Dict


def _format_time(seconds: float) -> str:
    ms = int(round(seconds * 1000))
    h = ms // 3600000
    m = (ms % 3600000) // 60000
    s = (ms % 60000) // 1000
    ms_rem = ms % 1000
    return f"{h:02d}:{m:02d}:{s:02d},{ms_rem:03d}"


def generate_srt(script: dict, audio_duration: float, out_path: str) -> str:
    """Generate a simple SRT file by splitting audio_duration across sections.

    Returns path to SRT file.
    """
    sections = script.get("sections") or []
    n = max(1, len(sections))
    seg = audio_duration / n

    p = Path(out_path)
    p.parent.mkdir(parents=True, exist_ok=True)

    with open(p, "w", encoding="utf-8") as f:
        for i in range(n):
            start = i * seg
            end = min(audio_duration, (i + 1) * seg)
            heading = sections[i].get("heading") if i < len(sections) and isinstance(sections[i], dict) else ""
            text = sections[i].get("narration", "") if i < len(sections) and isinstance(sections[i], dict) else ""
            content = (heading + "\n" if heading else "") + text
            f.write(f"{i+1}\n")
            f.write(f"{_format_time(start)} --> {_format_time(end)}\n")
            f.write(content.strip() + "\n\n")

    return str(p)


def parse_srt_entries(srt_path: str) -> List[Dict]:
    entries = []
    text = Path(srt_path).read_text(encoding="utf-8")
    chunks = [c.strip() for c in text.split('\n\n') if c.strip()]
    for ch in chunks:
        lines = ch.splitlines()
        if len(lines) >= 3:
            idx = lines[0].strip()
            times = lines[1].split('-->')
            start = times[0].strip()
            end = times[1].strip()
            content = '\n'.join(lines[2:]).strip()
            entries.append({"start": start, "end": end, "content": content})
    return entries
