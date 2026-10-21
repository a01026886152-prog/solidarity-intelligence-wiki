/* 의정지원시스템 핵심 기능. 화면과 상관없는 순수 함수만 둔다.
 * 브라우저에서는 window.UijeongCore, 노드 시험에서는 module.exports로 쓴다.
 * 라이브러리(JSZip, CFB, pako, pdfjsLib)는 인자로 받는다. */
(function (root) {
  "use strict";

  /* ───────────── Markdown 블록 파서 (uijeong/scripts/mdparse.py와 같은 규칙) ───────────── */

  const SEPARATOR_ROW = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/;

  function cleanInline(text) {
    return text
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b || a)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1($2)")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/`([^`]+)`/g, "$1");
  }

  /** [[글, 굵게여부], ...] */
  function inlineRuns(text) {
    return cleanInline(text)
      .split(/\*\*(.+?)\*\*/)
      .map((part, i) => [part, i % 2 === 1])
      .filter(([part]) => part);
  }

  function tableRows(rows) {
    const cells = rows
      .filter((r) => !SEPARATOR_ROW.test(r.trim()))
      .map((r) => r.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()));
    const width = Math.max(...cells.map((r) => r.length));
    return cells.map((r) => r.concat(Array(width - r.length).fill("")));
  }

  /** 블록 목록: {kind:"heading",level,text} | {kind:"rule"} | {kind:"check",checked,text}
   *  | {kind:"bullet",depth,text} | {kind:"number",depth,number,text} | {kind:"quote",text}
   *  | {kind:"para",text} | {kind:"table",rows} */
  function parseMarkdown(markdown) {
    const blocks = [];
    let table = [];
    let m;
    for (const raw of markdown.split(/\r?\n/)) {
      const line = raw.replace(/\s+$/, "");
      if (line.trimStart().startsWith("|")) {
        table.push(line);
        continue;
      }
      if (table.length) {
        blocks.push({ kind: "table", rows: tableRows(table) });
        table = [];
      }
      const s = line.trim();
      if (!s || s.startsWith("<!--")) continue;
      if ((m = s.match(/^(#{1,4})\s+(.*)$/))) blocks.push({ kind: "heading", level: m[1].length, text: m[2] });
      else if (/^(-{3,}|\*{3,})$/.test(s)) blocks.push({ kind: "rule" });
      else if ((m = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/)))
        blocks.push({ kind: "check", checked: m[1].trim() !== "", text: m[2] });
      else if ((m = line.match(/^(\s*)[-*]\s+(.*)$/)))
        blocks.push({ kind: "bullet", depth: Math.floor(m[1].length / 2), text: m[2] });
      else if ((m = line.match(/^(\s*)(\d+)[.)]\s+(.*)$/)))
        blocks.push({ kind: "number", depth: Math.floor(m[1].length / 2), number: m[2], text: m[3] });
      else if (s.startsWith(">")) blocks.push({ kind: "quote", text: s.replace(/^>\s*/, "") });
      else blocks.push({ kind: "para", text: s });
    }
    if (table.length) blocks.push({ kind: "table", rows: tableRows(table) });
    return blocks;
  }

  function escapeXml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      // XML 1.0에 넣을 수 없는 제어문자를 걷어낸다
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "");
  }

  /** 미리보기용 HTML. 모든 글자를 이스케이프한 뒤 굵게만 살린다. */
  function markdownToHtml(markdown) {
    const inline = (text) =>
      inlineRuns(text)
        .map(([t, bold]) => (bold ? `<strong>${escapeXml(t)}</strong>` : escapeXml(t)))
        .join("")
        .replace(/\[(공식자료 확인 필요|확인 필요|조문 확인 필요|단가 근거 필요|편목 확인 필요|기준 확인 필요|규정 확인 필요|차수 확인 필요)\]/g,
          '<mark class="flag">[$1]</mark>');
    const out = [];
    let list = null;
    const closeList = () => {
      if (list) out.push(`</${list}>`);
      list = null;
    };
    for (const b of parseMarkdown(markdown)) {
      const listKind = b.kind === "bullet" || b.kind === "check" ? "ul" : b.kind === "number" ? "ol" : null;
      if (listKind !== list) {
        closeList();
        if (listKind) {
          out.push(`<${listKind}>`);
          list = listKind;
        }
      }
      if (b.kind === "heading") out.push(`<h${b.level + 1}>${inline(b.text)}</h${b.level + 1}>`);
      else if (b.kind === "rule") out.push("<hr>");
      else if (b.kind === "check") out.push(`<li class="check">${b.checked ? "☑" : "☐"} ${inline(b.text)}</li>`);
      else if (b.kind === "bullet") out.push(`<li class="d${b.depth}">${inline(b.text)}</li>`);
      else if (b.kind === "number") out.push(`<li class="d${b.depth}" value="${Number(b.number)}">${inline(b.text)}</li>`);
      else if (b.kind === "quote") out.push(`<blockquote>${inline(b.text)}</blockquote>`);
      else if (b.kind === "table") {
        const [head, ...body] = b.rows;
        out.push(
          '<div class="table-wrap"><table><thead><tr>' +
            head.map((c) => `<th>${inline(c)}</th>`).join("") +
            "</tr></thead><tbody>" +
            body.map((r) => "<tr>" + r.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>").join("") +
            "</tbody></table></div>"
        );
      } else out.push(`<p>${inline(b.text)}</p>`);
    }
    closeList();
    return out.join("\n");
  }

  /* ───────────── 자료 읽기 ───────────── */

  // HWP 5.0 PARA_TEXT 안에서 16바이트를 차지하는 확장·인라인 제어문자
  const HWP_WIDE_CTRL = new Set([1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);
  const HWPTAG_PARA_TEXT = 67;

  function hwpParaText(bytes, start, end) {
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    let out = "";
    for (let j = start; j + 2 <= end; ) {
      const c = view.getUint16(j, true);
      if (HWP_WIDE_CTRL.has(c)) j += 16;
      else if (c === 9) {
        out += "\t";
        j += 16;
      } else if (c === 10 || c === 13) {
        out += "\n";
        j += 2;
      } else if (c < 32) j += 2;
      else {
        out += String.fromCharCode(c);
        j += 2;
      }
    }
    return out.replace(/\n+$/, "");
  }

  function extractHwp(arrayBuffer, { CFB, pako }) {
    const cfb = CFB.read(new Uint8Array(arrayBuffer), { type: "array" });
    const header = CFB.find(cfb, "FileHeader");
    if (!header) throw new Error("HWP 파일 머리를 읽지 못했습니다.");
    const head = Uint8Array.from(header.content);
    const flags = new DataView(head.buffer).getUint32(36, true);
    if (flags & 0x04) throw new Error("배포용(암호화) HWP입니다. 한글에서 PDF로 저장해 올려 주세요.");
    const compressed = flags & 0x01;
    const sections = cfb.FullPaths.map((path, i) => [path, cfb.FileIndex[i]])
      .filter(([path]) => /BodyText\/Section\d+$/.test(path))
      .sort((a, b) => Number(a[0].match(/(\d+)$/)[1]) - Number(b[0].match(/(\d+)$/)[1]));
    const paragraphs = [];
    for (const [, entry] of sections) {
      let data = Uint8Array.from(entry.content);
      if (compressed) data = pako.inflateRaw(data);
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      for (let i = 0; i + 4 <= data.length; ) {
        const h = view.getUint32(i, true);
        i += 4;
        const tag = h & 0x3ff;
        let size = (h >>> 20) & 0xfff;
        if (size === 0xfff) {
          size = view.getUint32(i, true);
          i += 4;
        }
        if (tag === HWPTAG_PARA_TEXT) paragraphs.push(hwpParaText(data, i, i + size));
        i += size;
      }
    }
    return paragraphs.join("\n");
  }

  async function extractHwpx(arrayBuffer, { JSZip }) {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const names = Object.keys(zip.files)
      .filter((n) => /^Contents\/section\d+\.xml$/.test(n))
      .sort((a, b) => Number(a.match(/(\d+)\.xml$/)[1]) - Number(b.match(/(\d+)\.xml$/)[1]));
    const out = [];
    for (const name of names) {
      const xml = await zip.file(name).async("string");
      for (const p of xml.match(/<hp:p[ >][\s\S]*?<\/hp:p>/g) || []) {
        const text = (p.match(/<hp:t>([^<]*)<\/hp:t>/g) || []).map((t) => t.slice(6, -7)).join("");
        if (text) out.push(decodeXml(text));
      }
    }
    return out.join("\n");
  }

  async function extractDocx(arrayBuffer, { JSZip }) {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const xml = await zip.file("word/document.xml").async("string");
    return (xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [])
      .map((p) => decodeXml((p.match(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, "")).join("")))
      .join("\n");
  }

  async function extractPdf(arrayBuffer, { pdfjsLib }) {
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    const pages = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const content = await (await pdf.getPage(n)).getTextContent();
      pages.push(content.items.map((item) => item.str + (item.hasEOL ? "\n" : "")).join(""));
    }
    return pages.join("\n");
  }

  function decodeXml(text) {
    return text
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&amp;/g, "&");
  }

  /** 파일 하나를 글자로. 짝 없는 서로게이트는 정리한다. */
  async function extractText(name, arrayBuffer, libs) {
    const ext = (name.match(/\.([^.]+)$/) || [, ""])[1].toLowerCase();
    let text;
    if (ext === "hwp") text = extractHwp(arrayBuffer, libs);
    else if (ext === "hwpx") text = await extractHwpx(arrayBuffer, libs);
    else if (ext === "docx") text = await extractDocx(arrayBuffer, libs);
    else if (ext === "pdf") text = await extractPdf(arrayBuffer, libs);
    else if (ext === "txt" || ext === "md") text = new TextDecoder("utf-8").decode(arrayBuffer);
    else throw new Error("HWP, HWPX, PDF, DOCX, TXT, MD 파일만 읽을 수 있습니다.");
    return text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
  }

  /** 파일 이름과 첫머리로 자료 성격을 짐작한다. 사용자가 화면에서 고칠 수 있다. */
  function guessKind(name, text) {
    const head = name + " " + text.slice(0, 1500);
    if (/더불어민주당|국민의힘|조국혁신당|진보당|정의당|교섭단체|핵심과제/.test(head)) return "정당·단체";
    if (/기자|보도자료|뉴스|일보|신문|언론/.test(head)) return "언론";
    if (/계획서|업무보고|예산서|결산|요구자료|답변|서울특별시|조례|규칙|위원회/.test(head)) return "공식";
    return "기타";
  }

  /* ───────────── 자료 분량 맞추기 ───────────── */

  /** 긴 자료에서 열쇠말이 많이 나오는 대목을 골라 budget 글자 안에 맞춘다. 원래 순서는 지킨다. */
  function selectRelevant(text, keywords, budget) {
    if (text.length <= budget) return { text, trimmed: false };
    const lines = text.split("\n");
    const WINDOW = 30;
    const windows = [];
    for (let i = 0; i < lines.length; i += WINDOW) {
      const chunk = lines.slice(i, i + WINDOW).join("\n");
      let score = 0;
      for (const k of keywords) if (k) score += chunk.split(k).length - 1;
      windows.push({ i, chunk, score });
    }
    const chosen = new Set([0]); // 표지·목차가 든 첫머리는 늘 넣는다
    let used = windows[0].chunk.length;
    for (const w of windows.slice(1).sort((a, b) => b.score - a.score)) {
      if (w.score === 0) break;
      if (used + w.chunk.length > budget) continue;
      chosen.add(w.i);
      used += w.chunk.length;
    }
    const parts = [];
    let last = -WINDOW;
    for (const w of windows) {
      if (!chosen.has(w.i)) continue;
      if (w.i !== last + WINDOW) parts.push("…(중략)…");
      parts.push(w.chunk);
      last = w.i;
    }
    return { text: parts.join("\n"), trimmed: true };
  }

  /** 여러 자료에 글자 예산을 나눈다. 짧은 자료는 통째로, 긴 자료는 남은 몫 안에서 추린다. */
  function fitSources(sources, keywords, budget) {
    const order = sources.map((s, i) => i).sort((a, b) => sources[a].text.length - sources[b].text.length);
    const out = new Array(sources.length);
    let remaining = budget;
    order.forEach((idx, n) => {
      const share = Math.floor(remaining / (order.length - n));
      const fitted = selectRelevant(sources[idx].text, keywords, share);
      out[idx] = { ...sources[idx], text: fitted.text, trimmed: fitted.trimmed };
      remaining -= fitted.text.length;
    });
    return out;
  }

  /* ───────────── Claude에게 보낼 지시문 ───────────── */

  const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";
  const label = (i) => CIRCLED[i] || `(${i + 1})`;

  const DOC_TYPES = {
    "audit-issue-report": { name: "행정사무감사 쟁점보고서", folder: "audit", legal: false },
    "ordinance-draft": { name: "법적 검토서와 조례안", folder: "ordinance", legal: true },
    "project-plan": { name: "사업계획서(안)", folder: "project-plan", legal: true },
    "floor-speech": { name: "5분 자유발언·시정질문 원고", folder: "speech", legal: false },
  };

  function profileText(p) {
    const lines = [
      `관점: ${p.stance || "의원실"}`,
      `의원명: ${p.member || "○○○"}`,
      p.party && `소속 정당: ${p.party}`,
      p.district && `지역구: ${p.district}`,
      p.org && `단체명: ${p.org}`,
      `위원회: ${p.committee || "서울특별시의회 주택공간위원회"}`,
      `어조: ${p.tone || "단호하되 근거 중심"}`,
    ];
    return lines.filter(Boolean).join("\n");
  }

  function sourcesText(sources) {
    return sources
      .map(
        (s, i) =>
          `<자료 번호="${label(i)}" 파일="${s.name}" 성격="${s.kind}"${s.trimmed ? ' 비고="길어서 관련 대목만 추림"' : ""}>\n${s.text}\n</자료>`
      )
      .join("\n\n");
  }

  const TOOL_NOTE =
    "아래 '작업 지침'은 Claude Code에서 쓰려고 만든 것이다. 파일 저장, 명령 실행, 도구 호출, 파일 전송 같은 단계는 이 화면이 대신하니 무시하고, 분석·작성·검수의 내용 기준만 따른다.";

  function questionPrompt({ type, request, profile, sources, data }) {
    const skill = data.skills[type];
    return [
      "너는 서울특별시의회 의원실의 의정지원 보좌진이다. 한국어로 일한다.",
      TOOL_NOTE,
      `지금 만들 문서: ${DOC_TYPES[type].name}`,
      "지금 할 일은 작업 지침의 '범위 묻기' 단계 하나뿐이다. 자료를 읽고, 문서를 쓰기 전에 사용자에게 물어볼 질문을 2~4개 만든다.",
      "- 자료나 요청에서 답이 분명한 것은 묻지 않는다.",
      "- 질문마다 선택지를 2~4개 둔다. 선택지에는 한 줄 설명을 붙인다. 추천하는 선택지를 맨 앞에 두고 recommended를 true로 한다.",
      "- 여러 개를 고를 수 있는 질문만 multiple을 true로 한다.",
      "- 선택지는 자료에 실제로 나온 기관·사업·쟁점으로 구체적으로 쓴다.",
      '답은 JSON 하나로만 한다. 형식: {"summary":"자료가 무엇이고 무엇을 다루는지 두세 문장","questions":[{"id":"q1","header":"12자 이내 꼬리표","question":"물음표로 끝나는 질문","multiple":false,"options":[{"label":"짧은 선택지","description":"한 줄 설명","recommended":true}]}]}',
      `\n[사용자 설정]\n${profileText(profile)}`,
      `\n[사용자 요청]\n${request || "(따로 없음)"}`,
      `\n[작업 지침]\n${skill.skill}`,
      `\n[위원회 기준자료]\n${data.committee}`,
      `\n[자료]\n${sourcesText(sources)}`,
    ].join("\n");
  }

  function answersText(questions, answers) {
    return questions
      .map((q) => {
        const a = answers[q.id] || {};
        const picked = [...(a.picked || []), a.other && `기타: ${a.other}`].filter(Boolean);
        return `- ${q.question} → ${picked.length ? picked.join(", ") : "(답 없음: 추천안으로 진행)"}`;
      })
      .join("\n");
  }

  function writePrompt({ type, request, profile, sources, data, questions, answers, today }) {
    const skill = data.skills[type];
    const parts = [
      "너는 서울특별시의회 의원실의 의정지원 보좌진이다. 한국어로 쓴다.",
      TOOL_NOTE,
      `지금 만들 문서: ${DOC_TYPES[type].name}. 작업 지침의 분석·작성·자체 검수 단계를 따라 문서를 완성한다. 범위 묻기는 끝났고 답은 [범위 답변]에 있다.`,
      "출력 규칙:",
      "- 문서 본문만 Markdown으로 쓴다. 앞뒤에 설명이나 인사말을 붙이지 않는다. 첫 줄은 '# '로 시작하는 제목이다.",
      "- [문서 템플릿]의 구조를 따른다. 중괄호 자리표시는 모두 실제 내용으로 바꾼다.",
      "- 표는 | 로 쓰는 Markdown 표, 강조는 **굵게**만 쓴다. 다른 서식(HTML, 각주 문법, 이미지)은 쓰지 않는다.",
      "- 수치와 사실은 [자료]에 있는 것만 쓰고, 어느 자료(①②…)에서 왔는지 밝힌다. 자료에 없는 숫자·사례·인용은 만들지 않는다.",
      "- 정당·단체·언론 자료의 수치로 공식 확인이 안 된 것은 [공식자료 확인 필요], 확인하지 못한 법령 조문은 [조문 확인 필요]를 붙인다.",
      "- 자료 원문이 서로 어긋나면 고르지 말고 두 값을 모두 적고 [확인 필요]를 붙인다.",
      `- 작성일은 ${today}이다.`,
      `\n[사용자 설정]\n${profileText(profile)}`,
      `\n[사용자 요청]\n${request || "(따로 없음)"}`,
      `\n[범위 답변]\n${answersText(questions, answers)}`,
      `\n[작업 지침]\n${skill.skill}`,
      `\n[문서 템플릿]\n${skill.template}`,
      `\n[위원회 기준자료]\n${data.committee}`,
    ];
    if (DOC_TYPES[type].legal) parts.push(`\n[법적 근거 참고표]\n${data.legal}`);
    parts.push(`\n[자료]\n${sourcesText(sources)}`);
    return parts.join("\n");
  }

  const CONTINUE_PROMPT = "답이 길이 제한으로 끊겼다. 끊긴 바로 그 글자부터 이어서 쓴다. 이미 쓴 부분은 되풀이하지 않고, 앞말도 붙이지 않는다.";

  function utf8Bytes(text) {
    return new TextEncoder().encode(text).length;
  }

  /** 지시문이 한도(바이트)를 넘으면 자료 몫을 줄여 다시 만든다. */
  function buildWithinLimit(build, args, sourceBudget, keywords, maxBytes) {
    let budget = sourceBudget;
    for (let attempt = 0; attempt < 6; attempt++) {
      const sources = fitSources(args.sources, keywords, budget);
      const prompt = build({ ...args, sources });
      if (utf8Bytes(prompt) <= maxBytes) return { prompt, sources };
      budget = Math.floor(budget * 0.8);
    }
    throw new Error("자료가 너무 많습니다. 파일 수를 줄여 주세요.");
  }

  /** 열쇠말: 위원회 소관 기관·분야 + 사용자 요청·답변의 낱말 */
  function keywordsFor({ request, answersFlat, committee }) {
    const base = ["주택", "임대", "SH", "정비", "재개발", "재건축", "모아", "신속통합", "공공", "전세", "보증금", "청년안심", "매입",
      "미래공간", "디지털", "AI재단", "예산", "실적", "조례", "감사", "개선", "지적", "문제", "쟁점"];
    const extra = `${request || ""} ${answersFlat || ""}`
      .split(/[\s,·()]+/)
      .filter((w) => w.length >= 2 && w.length <= 12);
    const fromCommittee = (committee.match(/\| ([^|`]+?) \| `/g) || []).map((s) => s.replace(/[|`\s]/g, ""));
    return [...new Set([...base, ...extra, ...fromCommittee])];
  }

  /* ───────────── 자체 검수 ───────────── */

  /** 결과물의 숫자 중 자료(와 기준자료·작성일)에서 찾지 못한 것. 공백을 무시하고 찾는다. */
  function checkNumbers(markdown, haystacks) {
    const hay = haystacks.join("\n").replace(/\s+/g, "");
    const seen = new Map();
    const re = /\d[\d,.]*\d/g;
    let m;
    while ((m = re.exec(markdown))) {
      const n = m[0].replace(/[.,]+$/, "");
      if (n.length < 2 || seen.has(n) || hay.includes(n)) continue;
      const lineStart = markdown.lastIndexOf("\n", m.index) + 1;
      const lineEnd = markdown.indexOf("\n", m.index);
      const line = markdown.slice(lineStart, lineEnd < 0 ? undefined : lineEnd);
      seen.set(n, line.replace(/[#*|>`]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120));
    }
    return [...seen].map(([number, context]) => ({ number, context }));
  }

  function countFlags(markdown) {
    return (markdown.match(/\[[^\]\n]*확인 필요\]|\[[^\]\n]*근거 필요\]/g) || []).length;
  }

  /** 5분 발언 원고 본문 글자 수(공백 포함, 줄바꿈은 공백 하나로). 원고 부분이 없으면 null. */
  function speechLength(markdown) {
    const start = markdown.search(/^##\s*원고\s*$/m);
    if (start < 0) return null;
    const after = markdown.slice(start).replace(/^##\s*원고\s*$/m, "");
    const end = after.search(/^(---|##\s)/m);
    const body = end < 0 ? after : after.slice(0, end);
    return body.replace(/\s+/g, " ").trim().length;
  }

  /* ───────────── 한글(HWPX)·워드(DOCX) 만들기 ───────────── */

  function base64ToBytes(b64) {
    if (typeof atob === "function") return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return Uint8Array.from(Buffer.from(b64, "base64"));
  }

  let paraSeq = 1000;
  const nextId = () => String(++paraSeq);

  function hwpxPara(paraPr, runs) {
    const open = `<hp:p id="${nextId()}" paraPrIDRef="${paraPr}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"`;
    if (!runs.length) return open + "/>";
    return (
      open + ">" + runs.map(([charPr, text]) => `<hp:run charPrIDRef="${charPr}"><hp:t>${escapeXml(text)}</hp:t></hp:run>`).join("") + "</hp:p>"
    );
  }

  function hwpxRuns(text, normal, bold) {
    return inlineRuns(text).map(([t, isBold]) => [isBold ? bold : normal, t]);
  }

  const HWPX_TEXT_WIDTH = 42520; // A4에서 좌우 여백을 뺀 본문 폭(HWPUNIT)
  const HWPX_ROW_HEIGHT = 282;

  function hwpxTable(rows, pal) {
    const t = pal.table;
    const cols = rows[0].length;
    const base = Math.floor(HWPX_TEXT_WIDTH / cols);
    const widths = Array.from({ length: cols }, (_, j) => (j === cols - 1 ? HWPX_TEXT_WIDTH - base * (cols - 1) : base));
    const margin = '<hp:cellMargin left="510" right="510" top="141" bottom="141"/>';
    const trs = rows
      .map((row, r) => {
        const tcs = row
          .map((cell, c) => {
            const head = r === 0;
            const runs = head ? hwpxRuns(cell, t.head, t.head) : hwpxRuns(cell, t.cell, t.cellBold);
            return (
              `<hp:tc name="" header="${head ? 1 : 0}" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="${head ? t.headFill : t.cellFill}">` +
              '<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">' +
              hwpxPara(0, runs.length ? runs : [[t.cell, ""]]) +
              `</hp:subList><hp:cellAddr colAddr="${c}" rowAddr="${r}"/><hp:cellSpan colSpan="1" rowSpan="1"/>` +
              `<hp:cellSz width="${widths[c]}" height="${HWPX_ROW_HEIGHT}"/>${margin}</hp:tc>`
            );
          })
          .join("");
        return `<hp:tr>${tcs}</hp:tr>`;
      })
      .join("");
    const tbl =
      `<hp:tbl id="${nextId()}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="${rows.length}" colCnt="${cols}" cellSpacing="0" borderFillIDRef="${t.fill}" noAdjust="0">` +
      `<hp:sz width="${HWPX_TEXT_WIDTH}" widthRelTo="ABSOLUTE" height="${HWPX_ROW_HEIGHT * rows.length}" heightRelTo="ABSOLUTE" protect="0"/>` +
      '<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>' +
      '<hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:inMargin left="510" right="510" top="141" bottom="141"/>' +
      trs +
      "</hp:tbl>";
    return (
      `<hp:p id="${nextId()}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0">${tbl}</hp:run></hp:p>` +
      hwpxPara(0, [])
    );
  }

  function hwpxBody(markdown, pal) {
    const list = (depth) => pal.list[Math.min(depth, pal.list.length - 1)];
    const lc = pal.listChar;
    return parseMarkdown(markdown)
      .map((b) => {
        switch (b.kind) {
          case "heading": {
            const h = pal.heading[b.level];
            return hwpxPara(h.para, hwpxRuns(b.text, h.char, h.char));
          }
          case "rule":
            return hwpxPara(pal.rule, []);
          case "check":
            return hwpxPara(list(0), hwpxRuns((b.checked ? "☑ " : "☐ ") + b.text, lc.char, lc.bold));
          case "bullet":
            return hwpxPara(list(b.depth), hwpxRuns((b.depth ? "◦ " : "• ") + b.text, lc.char, lc.bold));
          case "number":
            return hwpxPara(list(b.depth), hwpxRuns(`${b.number}. ${b.text}`, lc.char, lc.bold));
          case "quote":
            return hwpxPara(pal.quote.para, hwpxRuns(b.text, pal.quote.char, pal.quote.bold));
          case "table":
            return hwpxTable(b.rows, pal);
          default:
            return hwpxPara(pal.para.para, hwpxRuns(b.text, pal.para.char, pal.para.bold));
        }
      })
      .join("");
  }

  async function toHwpx(markdown, data, { JSZip }) {
    const zip = await JSZip.loadAsync(base64ToBytes(data.hwpxTemplate));
    const section = await zip.file("Contents/section0.xml").async("string");
    zip.file("Contents/section0.xml", section.replace("<!--BODY-->", hwpxBody(markdown, data.hwpxPalette)));
    const preview = parseMarkdown(markdown).map((b) => (b.text || "")).join("\n").slice(0, 1024);
    zip.file("Preview/PrvText.txt", preview);
    // mimetype은 압축하지 않고 맨 앞에 둔다(HWPX·ODF 규칙). 불러온 순서가 그대로 유지된다.
    zip.file("mimetype", await zip.file("mimetype").async("string"), { compression: "STORE" });
    return zip.generateAsync({ type: "uint8array", compression: "DEFLATE", mimeType: "application/hwp+zip" });
  }

  const DOCX_SIZE = { body: 21, table: 19, heading: { 1: 32, 2: 27, 3: 24, 4: 22 } };

  function docxRuns(text, size, { bold = false, italic = false } = {}) {
    return inlineRuns(text)
      .map(([t, isBold]) => {
        const props = [(bold || isBold) && "<w:b/>", italic && "<w:i/>", `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`]
          .filter(Boolean)
          .join("");
        return `<w:r><w:rPr>${props}</w:rPr><w:t xml:space="preserve">${escapeXml(t)}</w:t></w:r>`;
      })
      .join("");
  }

  function docxPara(pPr, runs) {
    return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ""}${runs}</w:p>`;
  }

  function docxTable(rows) {
    const cols = rows[0].length;
    const width = Math.floor(9000 / cols);
    const grid = Array(cols).fill(`<w:gridCol w:w="${width}"/>`).join("");
    const trs = rows
      .map(
        (row, r) =>
          "<w:tr>" +
          (r === 0 ? '<w:trPr><w:tblHeader/></w:trPr>' : "") +
          row
            .map(
              (cell) =>
                `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${r === 0 ? '<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>' : ""}</w:tcPr>` +
                docxPara("", docxRuns(cell, DOCX_SIZE.table, { bold: r === 0 })) +
                "</w:tc>"
            )
            .join("") +
          "</w:tr>"
      )
      .join("");
    return (
      '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:jc w:val="center"/></w:tblPr>' +
      `<w:tblGrid>${grid}</w:tblGrid>${trs}</w:tbl>` +
      docxPara("", "")
    );
  }

  function docxBody(markdown) {
    const style = (name) => `<w:pStyle w:val="${name}"/>`;
    return parseMarkdown(markdown)
      .map((b) => {
        switch (b.kind) {
          case "heading":
            return docxPara(style(`Heading${b.level}`) + (b.level === 1 ? '<w:jc w:val="center"/>' : ""), docxRuns(b.text, DOCX_SIZE.heading[b.level]));
          case "rule":
            return docxPara('<w:jc w:val="center"/>', docxRuns("─".repeat(40), DOCX_SIZE.body));
          case "check":
            return docxPara(style("ListBullet"), docxRuns((b.checked ? "☑ " : "☐ ") + b.text, DOCX_SIZE.body));
          case "bullet":
            return docxPara(style(b.depth ? "ListBullet2" : "ListBullet"), docxRuns(b.text, DOCX_SIZE.body));
          case "number":
            return docxPara(`<w:ind w:left="${240 + 240 * b.depth}"/>`, docxRuns(`${b.number}. ${b.text}`, DOCX_SIZE.body));
          case "quote":
            return docxPara('<w:ind w:left="360"/>', docxRuns(b.text, DOCX_SIZE.body, { italic: true }));
          case "table":
            return docxTable(b.rows);
          default:
            return docxPara("", docxRuns(b.text, DOCX_SIZE.body));
        }
      })
      .join("");
  }

  async function toDocx(markdown, data, { JSZip }) {
    const zip = await JSZip.loadAsync(base64ToBytes(data.docxTemplate));
    const doc = await zip.file("word/document.xml").async("string");
    zip.file("word/document.xml", doc.replace("<!--BODY-->", docxBody(markdown)));
    return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  }

  /** HWPX는 저장 허용 형식이 아니어서 zip에 담아 내보낸다. */
  async function hwpxInZip(filename, hwpxBytes, { JSZip }) {
    const zip = new JSZip();
    zip.file(filename, hwpxBytes, { compression: "STORE" });
    return zip.generateAsync({ type: "uint8array" });
  }

  /** 제목에서 파일 이름을 만든다. */
  function fileStem(markdown, today, type) {
    const title = (markdown.match(/^#\s+(.+)$/m) || [, DOC_TYPES[type].name])[1];
    const clean = cleanInline(title).replace(/\*\*/g, "").replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
    return `${today} ${clean}`;
  }

  const api = {
    parseMarkdown, inlineRuns, markdownToHtml, escapeXml,
    extractText, extractHwp, extractHwpx, extractDocx, extractPdf, guessKind,
    selectRelevant, fitSources, keywordsFor, buildWithinLimit,
    questionPrompt, writePrompt, CONTINUE_PROMPT, DOC_TYPES, utf8Bytes, label,
    checkNumbers, countFlags, speechLength,
    toHwpx, toDocx, hwpxInZip, fileStem,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.UijeongCore = api;
})(typeof window !== "undefined" ? window : globalThis);
