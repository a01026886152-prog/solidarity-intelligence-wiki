/* 예산안 검토방 핵심 기능. 화면과 상관없는 순수 함수만 둔다.
 * 브라우저에서는 window.BudgetCore, 노드 시험에서는 module.exports로 쓴다. */
(function (root) {
  "use strict";

  const CATEGORIES = {
    increase: { name: "증액안", verb: "증액" },
    decrease: { name: "감액안", verb: "감액" },
  };
  const BASES = {
    both: "전년도 결산과 다음 연도 예산안을 함께",
    settlement: "전년도 결산만",
    budget: "다음 연도 예산안만",
  };
  const KINDS = ["결산서", "예산서(안)", "업무보고·계획", "요구자료·회의록", "기타"];
  const FALLBACK_DEPTS = ["주택실", "서울주택도시개발공사(SH)", "미래공간기획관", "디지털도시국", "서울AI재단"];

  /** 위원회 기준자료의 '소관 기관' 표에서 기관 이름을 읽는다. */
  function departments(committee) {
    const names = [];
    const re = /^\|\s*([^|`]+?)\s*\|\s*`[a-z-]+`\s*\|/gm;
    let m;
    while ((m = re.exec(committee || ""))) names.push(m[1].trim());
    return names.length ? names : FALLBACK_DEPTS.slice();
  }

  /** 오늘 날짜로 기본 연도: 결산은 지난해, 예산안은 다음 해. */
  function defaultYears(date) {
    const y = date.getFullYear();
    return { settlement: y - 1, budget: y + 1 };
  }

  /** 파일 이름과 첫머리로 자료 구분을 짐작한다. */
  function guessBudgetKind(name, text) {
    const head = `${name} ${(text || "").slice(0, 1500)}`;
    if (/결산|성과보고/.test(head)) return "결산서";
    if (/예산\s?\(?안\)?|예산서|사업설명서|세입세출/.test(head)) return "예산서(안)";
    if (/업무보고|업무계획|사업계획/.test(head)) return "업무보고·계획";
    if (/요구자료|회의록|답변/.test(head)) return "요구자료·회의록";
    return "기타";
  }

  /** 글자 자료(HWP·HWPX·DOCX 등)를 화면용 '쪽'으로 나눈다. 원문 인쇄 쪽과 다를 수 있다. */
  function splitTextPages(text, maxChars = 1600, maxLines = 38) {
    const lines = (text || "").replace(/\r/g, "").split("\n");
    const pages = [];
    let cur = [];
    let chars = 0;
    for (const line of lines) {
      if (cur.length && (cur.length >= maxLines || chars + line.length > maxChars)) {
        pages.push(cur.join("\n"));
        cur = [];
        chars = 0;
      }
      cur.push(line);
      chars += line.length;
    }
    if (cur.length && cur.join("").trim()) pages.push(cur.join("\n"));
    return pages.length ? pages : [""];
  }

  /** 자료 안에서 찾기: 띄어쓰기를 무시하고 찾아, 쪽마다 대목을 돌려준다. */
  function searchPages(files, query, { limit = 200, context = 40 } = {}) {
    const q = (query || "").replace(/\s+/g, "").toLowerCase();
    const hits = [];
    if (q.length < 1) return hits;
    for (const f of files) {
      (f.pages || []).forEach((pageText, i) => {
        const compact = pageText.replace(/\s+/g, "");
        const lower = compact.toLowerCase();
        let from = 0;
        let idx;
        let count = 0;
        while ((idx = lower.indexOf(q, from)) >= 0 && count < 3) {
          if (hits.length >= limit) return;
          const s = Math.max(0, idx - context);
          const e = Math.min(compact.length, idx + q.length + context);
          hits.push({
            fileId: f.id,
            fileName: f.name,
            page: i + 1,
            before: (s > 0 ? "…" : "") + compact.slice(s, idx),
            match: compact.slice(idx, idx + q.length),
            after: compact.slice(idx + q.length, e) + (e < compact.length ? "…" : ""),
          });
          from = idx + q.length;
          count++;
        }
      });
    }
    return hits;
  }

  /** 쪽 표시가 붙은 자료 글자. 보고서가 쪽 번호를 근거로 달 수 있게 한다. */
  function pagedText(pages) {
    return pages.map((t, i) => `[쪽 ${i + 1}]\n${t}`).join("\n");
  }

  /** 집행률 등 비율(%)을 소수 한 자리로. 분모가 0이거나 숫자가 아니면 null. */
  function ratio(part, whole) {
    const a = Number(part);
    const b = Number(whole);
    if (!isFinite(a) || !isFinite(b) || b === 0) return null;
    return Math.round((a / b) * 1000) / 10;
  }

  function clipsText(clips) {
    if (!clips.length) return "(없음)";
    return clips
      .map(
        (c, i) =>
          `<근거 번호="근거 ${i + 1}" 자료="${c.fileName}" 쪽="${c.page}"${c.memo ? ` 메모="${c.memo.replace(/"/g, "'")}"` : ""}>\n${c.text || "(쪽 글자 없음)"}\n</근거>`
      )
      .join("\n\n");
  }

  /** 검토보고서 지시문 */
  function reportPrompt({ category, basis, dept, years, projects, request, profileText, sourcesText, clips, skill, committee, legal, today }) {
    const cat = CATEGORIES[category];
    const other = category === "increase" ? "감액" : "증액";
    return [
      "너는 서울특별시의회 의원실의 예산 심사 보좌진이다. 한국어로 쓴다.",
      "아래 '작업 지침'은 Claude Code에서 쓰려고 만든 것이다. 파일 저장, 명령 실행, 도구 호출, 묻기 단계는 이 화면이 대신하니 무시하고, 분석·작성·검수의 내용 기준만 따른다.",
      `지금 만들 문서: ${years.budget}년도 ${dept} 예산안 검토보고서 (${cat.name}).`,
      `- 이 보고서는 ${cat.name}이다. ${cat.verb} 의견만 쓴다. ${other} 의견은 쓰지 않는다. ${other}이 맞다고 보이는 사업은 '참고사항'에 한 줄로만 적는다.`,
      `- 검토 근거: ${BASES[basis]} (결산 ${years.settlement}회계연도, 예산안 ${years.budget}년도).`,
      `- 대상 사업: ${projects || "자료에 나온 사업 전체에서 조정 의견이 분명한 것"}`,
      "출력 규칙:",
      "- 문서 본문만 Markdown으로 쓴다. 첫 줄은 '# '로 시작하는 제목이다. 앞뒤에 설명이나 인사말을 붙이지 않는다.",
      "- [문서 템플릿]의 구조를 따르고 중괄호 자리표시는 실제 내용으로 바꾼다. 표는 | 로 쓰는 Markdown 표, 강조는 **굵게**만 쓴다.",
      "- 수치와 사실은 [자료]와 [출력 근거]에 있는 것만 쓴다. 근거마다 (자료 ①, n쪽)처럼 자료 번호와 [쪽 n] 표시의 쪽 번호를 단다.",
      "- 집행률·증감률·조정액처럼 계산한 값은 계산식을 함께 쓴다. 산식 근거가 없으면 금액 대신 [조정액 산정 근거 필요]라고 쓴다.",
      "- 자료가 서로 어긋나면 두 값을 모두 적고 [확인 필요]를 붙인다. 자료에 없는 숫자·사업·인용은 만들지 않는다.",
      "- [출력 근거]가 있으면 '4. 출력 근거' 표에 '근거 1', '근거 2' 번호 그대로 옮기고, 본문에서도 그 번호로 가리킨다.",
      "- 확인하지 못한 법령 조문은 [조문 확인 필요]를 붙인다.",
      `- 작성일은 ${today}이다.`,
      `\n[사용자 설정]\n${profileText}`,
      `\n[사용자 요청]\n${request || "(따로 없음)"}`,
      `\n[작업 지침]\n${skill.skill}`,
      `\n[문서 템플릿]\n${skill.template}`,
      `\n[위원회 기준자료]\n${committee}`,
      `\n[법적 근거 참고표]\n${legal}`,
      `\n[출력 근거] 의원실이 자료방에서 빨간펜으로 표시해 출력함에 담은 쪽\n${clipsText(clips)}`,
      `\n[자료]\n${sourcesText}`,
    ].join("\n");
  }

  /** 보고서 제목에서 파일 이름을 만든다. */
  function reportStem(markdown, today, dept, category) {
    const title = (markdown.match(/^#\s+(.+)$/m) || [, `${dept} 예산안 검토보고서 ${CATEGORIES[category].name}`])[1];
    const clean = title.replace(/\*\*/g, "").replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
    return `${today} ${clean}`;
  }

  const api = {
    CATEGORIES, BASES, KINDS, departments, defaultYears, guessBudgetKind,
    splitTextPages, searchPages, pagedText, ratio, clipsText, reportPrompt, reportStem,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BudgetCore = api;
})(typeof window !== "undefined" ? window : globalThis);
