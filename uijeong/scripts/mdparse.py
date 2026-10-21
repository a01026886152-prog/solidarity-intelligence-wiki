"""의정지원 Markdown을 문서 블록으로 나눈다. md2docx·md2hwpx가 함께 쓴다.

지원 문법: 제목(#~####), 문단, 글머리표(-, *), 번호 목록(1.), 체크박스(- [ ]),
인용(>), 표(| a | b |), 구분선(---), 굵게(**...**).
"""
import re

_SEPARATOR_ROW = re.compile(r"\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?")


def clean_inline(text):
    """링크·코드 표시를 걷어내고 글자만 남긴다. 굵게(**)는 남긴다."""
    text = re.sub(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]", lambda m: m.group(2) or m.group(1), text)
    text = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", r"\1(\2)", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)  # 문서 내부·상대 링크는 글자만 남긴다
    return re.sub(r"`([^`]+)`", r"\1", text)


def inline_runs(text):
    """[(글자, 굵게여부), ...]"""
    parts = re.split(r"\*\*(.+?)\*\*", clean_inline(text))
    return [(part, i % 2 == 1) for i, part in enumerate(parts) if part]


def _table(rows):
    rows = [r for r in rows if not _SEPARATOR_ROW.fullmatch(r.strip())]
    cells = [[c.strip() for c in r.strip().strip("|").split("|")] for r in rows]
    width = max(len(r) for r in cells)
    return [r + [""] * (width - len(r)) for r in cells]


def parse(markdown):
    """블록 목록을 돌려준다. 각 블록은 (종류, 값...) 튜플이다.

    ("heading", 수준, 글) · ("rule",) · ("check", 체크여부, 글) · ("bullet", 깊이, 글)
    ("number", 깊이, 번호, 글) · ("quote", 글) · ("para", 글) · ("table", [[칸...], ...])
    """
    blocks, table_rows = [], []
    for raw in markdown.splitlines():
        line = raw.rstrip()
        if line.lstrip().startswith("|"):
            table_rows.append(line)
            continue
        if table_rows:
            blocks.append(("table", _table(table_rows)))
            table_rows = []
        stripped = line.strip()
        if not stripped or stripped.startswith("<!--"):
            continue
        if m := re.match(r"^(#{1,4})\s+(.*)", stripped):
            blocks.append(("heading", len(m.group(1)), m.group(2)))
        elif re.fullmatch(r"-{3,}|\*{3,}", stripped):
            blocks.append(("rule",))
        elif m := re.match(r"^\s*[-*]\s+\[( |x|X)\]\s+(.*)", line):
            blocks.append(("check", bool(m.group(1).strip()), m.group(2)))
        elif m := re.match(r"^(\s*)[-*]\s+(.*)", line):
            blocks.append(("bullet", len(m.group(1)) // 2, m.group(2)))
        elif m := re.match(r"^(\s*)(\d+)[.)]\s+(.*)", line):
            blocks.append(("number", len(m.group(1)) // 2, m.group(2), m.group(3)))
        elif stripped.startswith(">"):
            blocks.append(("quote", stripped.lstrip("> ").strip()))
        else:
            blocks.append(("para", stripped))
    if table_rows:
        blocks.append(("table", _table(table_rows)))
    return blocks
