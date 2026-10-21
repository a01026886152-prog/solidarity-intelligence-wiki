/* core.js 노드 시험.
 * 준비: python3 uijeong/web/build.py (build-data.json 생성), npm i jszip@3.10.1 pako@2.1.0 cfb@1.2.2
 * 사용법: node uijeong/web/test/test_core.js [HWP 파일 ...]
 * 결과 파일은 test/out/에 쓰고, 파이썬 검사(check_outputs.py)가 이어서 연다. */
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const C = require("../src/core.js");
const libs = { JSZip: require("jszip"), pako: require("pako"), CFB: require("cfb") };

const ROOT = path.resolve(__dirname, "../../..");
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, "build-data.json"), "utf8"));
const OUT = path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });

const toBuf = (file) => {
  const b = fs.readFileSync(file);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};

(async () => {
  // 1. 마크다운 파서: 파이썬 mdparse와 같은 블록을 만든다
  const blocks = C.parseMarkdown("# 제목\n\n- 가\n  - 나\n1. 셋\n> 인용\n---\n| a | b |\n|---|---|\n| 1 | 2 |\n본문 **굵게**");
  assert.deepStrictEqual(blocks.map((b) => b.kind), ["heading", "bullet", "bullet", "number", "quote", "rule", "table", "para"]);
  assert.deepStrictEqual(blocks[6].rows, [["a", "b"], ["1", "2"]]);
  assert.deepStrictEqual(C.inlineRuns("본문 **굵게** 끝"), [["본문 ", false], ["굵게", true], [" 끝", false]]);
  assert.ok(!C.markdownToHtml("<script>x</script> **a**").includes("<script>"));
  console.log("ok  마크다운 파서·미리보기 이스케이프");

  // 2. 업로드 자료 읽기 (HWP): 파이썬 추출 결과와 같아야 한다
  for (const file of process.argv.slice(2)) {
    const text = await C.extractText(file, toBuf(file), libs);
    fs.writeFileSync(path.join(OUT, path.basename(file) + ".txt"), text);
    console.log(`ok  ${path.basename(file)} → ${text.length.toLocaleString()}자`);
  }

  // 3. 자료 분량 맞추기
  const long = Array.from({ length: 3000 }, (_, i) => (i % 300 === 7 ? `청년안심주택 보증금 ${i}` : `무관한 줄 ${i}`)).join("\n");
  const fitted = C.selectRelevant(long, ["청년안심"], 5000);
  assert.ok(fitted.trimmed && fitted.text.length <= 5000 && fitted.text.includes("청년안심주택 보증금 7"));
  console.log("ok  긴 자료에서 관련 대목 추리기");

  // 4. 지시문 크기: 큰 자료 두 개로 한도 안에 맞는다
  const big = process.argv.slice(2).map((f) => ({ name: path.basename(f), kind: "공식", text: fs.readFileSync(path.join(OUT, path.basename(f) + ".txt"), "utf8") }));
  if (big.length) {
    const args = {
      type: "audit-issue-report", request: "주택실과 SH", profile: { stance: "의원실" }, sources: big, data: DATA,
      questions: [{ id: "q1", question: "대상 기관?" }], answers: { q1: { picked: ["주택실"] } }, today: "2026-10-21",
    };
    const kw = C.keywordsFor({ request: args.request, answersFlat: "주택실", committee: DATA.committee });
    for (const [name, build, budget] of [["질문", C.questionPrompt, 30000], ["작성", C.writePrompt, 60000]]) {
      const built = C.buildWithinLimit(build, args, budget, kw, 250 * 1024);
      console.log(`ok  ${name} 지시문 ${(C.utf8Bytes(built.prompt) / 1024).toFixed(0)}KB, 자료 ${built.sources.map((s) => s.text.length).join("+")}자`);
    }
  }

  // 5. 검수: 숫자 대조와 5분 발언 분량
  const md = fs.readFileSync(path.join(ROOT, "uijeong/outputs/speech/2026-10-21-youth-safe-housing.md"), "utf8");
  assert.strictEqual(C.speechLength(md), 1428);
  const missing = C.checkNumbers("가 3,166세대와 9,999호", ["3,166세대"]);
  assert.deepStrictEqual(missing.map((m) => m.number), ["9,999"]);
  console.log("ok  숫자 대조, 발언 분량 1,428자 (파이썬 셈과 같음)");

  // 6. 한글·워드 파일 만들기 → 파이썬 검사로 넘긴다
  for (const src of ["uijeong/outputs/audit/2026-10-21-housing-office-sh.md", "uijeong/outputs/speech/2026-10-21-youth-safe-housing.md"]) {
    const text = fs.readFileSync(path.join(ROOT, src), "utf8");
    const stem = path.basename(src, ".md");
    fs.writeFileSync(path.join(OUT, stem + ".hwpx"), await C.toHwpx(text, DATA, libs));
    fs.writeFileSync(path.join(OUT, stem + ".docx"), await C.toDocx(text, DATA, libs));
    const zipped = await C.hwpxInZip(stem + ".hwpx", await C.toHwpx(text, DATA, libs), libs);
    fs.writeFileSync(path.join(OUT, stem + ".zip"), zipped);
    console.log(`ok  ${stem}: .hwpx, .docx, .zip 생성`);
  }
  console.log("파일 이름:", C.fileStem(md, "2026-10-21", "floor-speech"));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
