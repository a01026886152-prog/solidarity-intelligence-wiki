"""의정지원 Markdown 문서를 DOCX로 바꾼다.

사용법:
    python3 uijeong/scripts/md2docx.py <입력.md> [출력.docx]

지원 문법은 mdparse.py를 따른다.
"""
import sys
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Mm, Pt, RGBColor

sys.path.insert(0, str(Path(__file__).resolve().parent))
from mdparse import inline_runs, parse  # noqa: E402

FONT = "맑은 고딕"
BODY_PT = 10.5
HEADING_PT = {1: 16, 2: 13.5, 3: 12, 4: 11}


def _set_font(run, size=None, bold=None):
    run.font.name = FONT
    run._element.get_or_add_rPr().get_or_add_rFonts().set(qn("w:eastAsia"), FONT)
    if size:
        run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold


def _add_inline(paragraph, text, size=BODY_PT, bold=False):
    for part, is_bold in inline_runs(text):
        _set_font(paragraph.add_run(part), size, bold=bold or is_bold)


def _base_style(document):
    section = document.sections[0]
    section.page_width, section.page_height = Mm(210), Mm(297)  # A4
    section.left_margin = section.right_margin = Mm(25)
    section.top_margin = section.bottom_margin = Mm(20)
    style = document.styles["Normal"]
    style.font.name = FONT
    style.font.size = Pt(BODY_PT)
    style.element.get_or_add_rPr().get_or_add_rFonts().set(qn("w:eastAsia"), FONT)
    for level in range(1, 5):
        heading = document.styles[f"Heading {level}"]
        heading.font.name = FONT
        heading.font.color.rgb = RGBColor(0, 0, 0)
        heading.element.get_or_add_rPr().get_or_add_rFonts().set(qn("w:eastAsia"), FONT)


def _add_table(document, rows):
    table = document.add_table(rows=len(rows), cols=len(rows[0]))
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, row in enumerate(rows):
        for j, text in enumerate(row):
            paragraph = table.cell(i, j).paragraphs[0]
            paragraph.text = ""
            _add_inline(paragraph, text, size=9.5, bold=(i == 0))
    document.add_paragraph()


def convert(md_path, docx_path):
    document = Document()
    _base_style(document)
    for block in parse(Path(md_path).read_text(encoding="utf-8")):
        kind = block[0]
        if kind == "heading":
            _, level, text = block
            p = document.add_heading(level=level)
            _add_inline(p, text, size=HEADING_PT[level])
            if level == 1:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        elif kind == "rule":
            document.add_paragraph("─" * 40).alignment = WD_ALIGN_PARAGRAPH.CENTER
        elif kind == "check":
            _, checked, text = block
            _add_inline(document.add_paragraph(style="List Bullet"), ("☑ " if checked else "☐ ") + text)
        elif kind == "bullet":
            _, depth, text = block
            _add_inline(document.add_paragraph(style="List Bullet 2" if depth else "List Bullet"), text)
        elif kind == "number":
            _, depth, number, text = block
            p = document.add_paragraph()
            p.paragraph_format.left_indent = Pt(12 + 12 * depth)
            _add_inline(p, f"{number}. {text}")
        elif kind == "quote":
            p = document.add_paragraph()
            p.paragraph_format.left_indent = Pt(18)
            _add_inline(p, block[1])
            for run in p.runs:
                run.italic = True
        elif kind == "table":
            _add_table(document, block[1])
        else:
            _add_inline(document.add_paragraph(), block[1])
    document.save(docx_path)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = Path(sys.argv[1])
    dest = Path(sys.argv[2]) if len(sys.argv) > 2 else src.with_suffix(".docx")
    convert(src, dest)
    print(dest)


if __name__ == "__main__":
    main()
