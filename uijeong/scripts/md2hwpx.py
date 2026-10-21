"""의정지원 Markdown 문서를 한글(HWPX) 문서로 바꾼다. 한글 프로그램 없이 동작한다.

사용법:
    python3 uijeong/scripts/md2hwpx.py <입력.md> [출력.hwpx]

지원 문법은 mdparse.py를 따른다. 한글 2014 이상에서 열린다.
"""
import sys
import warnings
from pathlib import Path

from hwpx import HwpxDocument

sys.path.insert(0, str(Path(__file__).resolve().parent))
from mdparse import inline_runs, parse  # noqa: E402

warnings.filterwarnings("ignore", category=DeprecationWarning, module="hwpx")

BODY_PT = 10
HEADING_PT = {1: 16, 2: 13, 3: 11.5, 4: 10.5}


def _add_inline(paragraph, text, size=BODY_PT, bold=False, italic=False):
    for part, is_bold in inline_runs(text):
        paragraph.add_run(part, bold=bold or is_bold, italic=italic, size=size)


def _new_paragraph(document):
    # 앞 문단 서식을 물려받으면 제목의 가운데 정렬이 다음 문단으로 번진다
    return document.add_paragraph("", include_run=False, inherit_style=False)


def _format(document, paragraph, alignment="justify", **fmt):
    document.styles.apply_paragraph_format(paragraphs=[paragraph], alignment=alignment, **fmt)


def _add_table(document, rows):
    table = document.add_table(len(rows), len(rows[0]))
    for i, row in enumerate(rows):
        for j, text in enumerate(row):
            cell = table.cell(i, j)
            cell.set_text("")
            _add_inline(cell.paragraphs[0], text, size=9, bold=(i == 0))
            if i == 0:
                table.set_cell_shading(i, j, "#F2F2F2")
    _new_paragraph(document)


def convert(md_path, hwpx_path):
    document = HwpxDocument.new()
    for block in parse(Path(md_path).read_text(encoding="utf-8")):
        kind = block[0]
        if kind == "heading":
            _, level, text = block
            p = _new_paragraph(document)
            _add_inline(p, text, size=HEADING_PT[level], bold=True)
            _format(
                document,
                p,
                alignment="center" if level == 1 else "left",
                spacing_before_pt=10 if level <= 2 else 6,
                spacing_after_pt=4,
                keep_with_next=True,
            )
        elif kind == "rule":
            _format(document, _new_paragraph(document), bottom_border=True)
        elif kind == "check":
            _, checked, text = block
            p = _new_paragraph(document)
            _add_inline(p, ("☑ " if checked else "☐ ") + text)
            _format(document, p, indent_left_mm=4)
        elif kind == "bullet":
            _, depth, text = block
            p = _new_paragraph(document)
            _add_inline(p, ("◦ " if depth else "• ") + text)
            _format(document, p, indent_left_mm=4 + 5 * depth)
        elif kind == "number":
            _, depth, number, text = block
            p = _new_paragraph(document)
            _add_inline(p, f"{number}. {text}")
            _format(document, p, indent_left_mm=4 + 5 * depth)
        elif kind == "quote":
            p = _new_paragraph(document)
            _add_inline(p, block[1], italic=True)
            _format(document, p, indent_left_mm=6)
        elif kind == "table":
            _add_table(document, block[1])
        else:
            p = _new_paragraph(document)
            _add_inline(p, block[1])
            _format(document, p, spacing_after_pt=4)
    document.save_to_path(hwpx_path)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = Path(sys.argv[1])
    dest = Path(sys.argv[2]) if len(sys.argv) > 2 else src.with_suffix(".hwpx")
    convert(src, dest)
    print(dest)


if __name__ == "__main__":
    main()
