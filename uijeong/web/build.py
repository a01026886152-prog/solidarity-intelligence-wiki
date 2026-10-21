"""의정지원시스템 웹 페이지를 한 장의 HTML로 묶는다.

사용법:
    python3 uijeong/web/build.py

하는 일:
1. md2hwpx·md2docx로 서식 견본을 만들어 한글(HWPX)·워드(DOCX) 서식 틀과
   서식 번호표(HWPX의 charPr·paraPr id)를 뽑는다. 웹 페이지는 이 틀에 본문만 채운다.
2. 스킬 지침(.claude/skills/*/SKILL.md, template.md)과 기준자료(uijeong/knowledge/*.md)를
   그대로 페이지에 넣는다. 스킬을 고치면 이 스크립트를 다시 돌리기만 하면 된다.
3. src/index.html에 src/core.js·src/app.js·위 자료를 끼워 dist/uijeong-app.html을 만든다.
"""
import base64
import io
import json
import re
import sys
import tempfile
import zipfile
from pathlib import Path

WEB = Path(__file__).resolve().parent
ROOT = WEB.parent.parent
sys.path.insert(0, str(ROOT / "uijeong" / "scripts"))
import md2docx  # noqa: E402
import md2hwpx  # noqa: E402

SKILLS = ["audit-issue-report", "ordinance-draft", "project-plan", "floor-speech"]

# 서식 견본: 줄마다 표식 글자를 두고, 만들어진 HWPX에서 그 표식이 받은 서식 번호를 읽는다.
PALETTE_MD = """# H1 **H1B**

## H2

### H3

#### H4

P0 **PB**

- L0 **LB**
  - L1
    - L2
1. N0
  1. N1
- [ ] C0
> Q0 **QB**

---

| TH | TH2 |
|---|---|
| TD **TB** | TD2 |
"""


def _hwpx_palette(tmp):
    md = tmp / "palette.md"
    md.write_text(PALETTE_MD, encoding="utf-8")
    hwpx_path = tmp / "palette.hwpx"
    md2hwpx.convert(md, hwpx_path)
    with zipfile.ZipFile(hwpx_path) as z:
        files = {info.filename: z.read(info.filename) for info in z.infolist()}
        order = [info.filename for info in z.infolist()]
    section = files["Contents/section0.xml"].decode("utf-8")

    ids = {}
    for para_pr, body in re.findall(r'<hp:p [^>]*?paraPrIDRef="(\d+)"[^>]*>(.*?)</hp:p>', section, re.S):
        for char_pr, text in re.findall(r'<hp:run charPrIDRef="(\d+)"><hp:t>([^<]*)</hp:t>', body):
            marker = text.strip().split(" ")[-1].lstrip("•◦☐").strip()
            ids.setdefault(marker, {"para": int(para_pr), "char": int(char_pr)})
    rule = re.findall(r'<hp:p [^>]*?paraPrIDRef="(\d+)"[^>]*/>', section)
    cell_fills = re.findall(r'<hp:tc [^>]*borderFillIDRef="(\d+)"', section)
    table_fill = re.search(r'<hp:tbl [^>]*borderFillIDRef="(\d+)"', section).group(1)

    def pick(marker):
        if marker not in ids:
            raise SystemExit(f"서식 견본에서 '{marker}'를 찾지 못했다")
        return ids[marker]

    palette = {
        "heading": {lvl: {"para": pick(f"H{lvl}")["para"], "char": pick(f"H{lvl}")["char"]} for lvl in (1, 2, 3, 4)},
        "para": {"para": pick("P0")["para"], "char": pick("P0")["char"], "bold": pick("PB")["char"]},
        "list": [pick("L0")["para"], pick("L1")["para"], pick("L2")["para"]],
        "listChar": {"char": pick("L0")["char"], "bold": pick("LB")["char"]},
        "quote": {"para": pick("Q0")["para"], "char": pick("Q0")["char"], "bold": pick("QB")["char"]},
        "rule": int(rule[0]),
        "table": {
            "fill": int(table_fill),
            "headFill": int(cell_fills[0]),
            "cellFill": int(cell_fills[-1]),
            "head": pick("TH")["char"],
            "cell": pick("TD")["char"],
            "cellBold": pick("TB")["char"],
        },
    }

    # 본문은 구역 설정이 든 첫 문단만 남기고 비운다. 웹 페이지가 <!--BODY--> 자리를 채운다.
    first = re.search(r"<hp:p .*?</hp:p>", section, re.S).group(0)
    head = section[: section.index("<hp:p ")]
    files["Contents/section0.xml"] = (head + first + "<!--BODY--></hs:sec>").encode("utf-8")
    files["Preview/PrvText.txt"] = b""

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for name in order:
            kind = zipfile.ZIP_STORED if name == "mimetype" else zipfile.ZIP_DEFLATED
            z.writestr(zipfile.ZipInfo(name), files[name], compress_type=kind)
    return base64.b64encode(buf.getvalue()).decode(), palette


def _docx_template(tmp):
    md = tmp / "blank.md"
    md.write_text("본문\n", encoding="utf-8")
    docx_path = tmp / "blank.docx"
    md2docx.convert(md, docx_path)
    with zipfile.ZipFile(docx_path) as z:
        files = {info.filename: z.read(info.filename) for info in z.infolist()}
        order = [info.filename for info in z.infolist()]
    document = files["word/document.xml"].decode("utf-8")
    body_start = document.index("<w:body>") + len("<w:body>")
    sect = document.index("<w:sectPr")
    files["word/document.xml"] = (document[:body_start] + "<!--BODY-->" + document[sect:]).encode("utf-8")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for name in order:
            z.writestr(name, files[name])
    return base64.b64encode(buf.getvalue()).decode()


def _knowledge():
    skills = {}
    for name in SKILLS:
        folder = ROOT / ".claude" / "skills" / name
        skills[name] = {
            "skill": (folder / "SKILL.md").read_text(encoding="utf-8"),
            "template": (folder / "template.md").read_text(encoding="utf-8"),
        }
    knowledge_dir = ROOT / "uijeong" / "knowledge"
    return {
        "skills": skills,
        "committee": (knowledge_dir / "committee-2026.md").read_text(encoding="utf-8"),
        "legal": (knowledge_dir / "legal-basis.md").read_text(encoding="utf-8"),
    }


def main():
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        hwpx_b64, palette = _hwpx_palette(tmp)
        docx_b64 = _docx_template(tmp)
    data = {"hwpxTemplate": hwpx_b64, "hwpxPalette": palette, "docxTemplate": docx_b64, **_knowledge()}

    # </script>가 자료 안에 있어도 스크립트 태그가 닫히지 않게 한다
    data_json = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    html = (WEB / "src" / "index.html").read_text(encoding="utf-8")
    for key, value in {
        "/*{{DATA}}*/": "window.UIJEONG_DATA = " + data_json + ";",
        "/*{{CORE}}*/": (WEB / "src" / "core.js").read_text(encoding="utf-8"),
        "/*{{APP}}*/": (WEB / "src" / "app.js").read_text(encoding="utf-8"),
    }.items():
        if key not in html:
            raise SystemExit(f"index.html에 {key} 자리가 없다")
        html = html.replace(key, value)
    out = WEB / "dist" / "uijeong-app.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    # 노드 시험(test/test_core.js)이 읽는 사본. git에는 올리지 않는다.
    (WEB / "test" / "build-data.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    print(f"{out} ({out.stat().st_size / 1024:,.0f} KB)")
    print("HWPX 서식 번호:", json.dumps(palette, ensure_ascii=False))


if __name__ == "__main__":
    main()
