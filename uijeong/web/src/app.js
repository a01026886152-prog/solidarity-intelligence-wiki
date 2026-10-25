/* 의정지원시스템 화면 동작. 핵심 기능은 core.js(UijeongCore)에 있다. */
(function () {
  "use strict";
  const C = window.UijeongCore;
  const DATA = window.UIJEONG_DATA;
  const $ = (id) => document.getElementById(id);

  const MAX_PROMPT_BYTES = 250 * 1024; // 한도 256KiB에 여유를 둔다
  const QUESTION_BUDGET = 30000; // 질문 단계 자료 글자 수
  const WRITE_BUDGET = 60000; // 작성 단계 자료 글자 수

  const EXAMPLE_MD = `# 청년안심주택, 공급으로 끝난 관리를 입주 이후까지

> **발언자**: ○○○ 의원 (주택공간위원회) · **본문 분량**: 1,428자, 공백 포함 (약 4분 46초)

## 원고

존경하는 서울특별시민 여러분, 의장님과 선배·동료 의원 여러분. 주택공간위원회 ○○○ 의원입니다.

사당동의 한 청년안심주택에는 85세대가 삽니다. 이 청년들이 낸 보증금은 모두 104억 원입니다. 그런데 이 건물에는 5백억 원 가까운 근저당이 먼저 잡혀 있습니다. …

## 근거 각주

| 원고 표현 | 원 수치 | 출처 |
|-----------|---------|------|
| 15개 단지 3천 세대가 넘는 | '25년 9월 기준 15개 단지, 3,166세대 미가입 | 자료 ② [공식자료 확인 필요] |`;

  const state = {
    files: [], // {id, name, size, kind, text, status: "reading"|"ready"|"error", error, mark, consent: null|"use"|"title"|"exclude"}
    type: null,
    summary: "",
    questions: [],
    answers: {},
    markdown: "",
    lastPrompt: "",
    truncated: false,
    busy: false,
  };
  let sample = null;
  let downloads = null;
  let controller = null;
  let fileSeq = 0;

  const libs = { JSZip: window.JSZip, CFB: window.CFB, pako: window.pako, pdfjsLib: window.pdfjsLib };
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  /* ───────── 설정 ───────── */

  const PROFILE_FIELDS = ["stance", "member", "party", "district", "org", "tone", "committee"];
  const STORE_KEY = "uijeong.profile";

  function loadProfile() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      for (const f of PROFILE_FIELDS) if (saved[f] != null) $(`p-${f}`).value = saved[f];
    } catch (e) {
      /* 저장소를 못 쓰면 기본값으로 */
    }
  }
  function profile() {
    const p = {};
    for (const f of PROFILE_FIELDS) p[f] = $(`p-${f}`).value.trim();
    return p;
  }
  function saveProfile() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(profile()));
    } catch (e) {
      /* 무시 */
    }
    const p = profile();
    $("settings-summary").textContent = `· ${p.stance} · ${p.member || "의원명 미입력(○○○)"}`;
    $("org-label").textContent = p.committee || "서울특별시의회 주택공간위원회";
  }

  /* ───────── 1. 자료 ───────── */

  function addFiles(list) {
    for (const file of list) {
      const item = { id: ++fileSeq, name: file.name, size: file.size, kind: "기타", text: "", status: "reading" };
      state.files.push(item);
      renderFiles();
      file
        .arrayBuffer()
        .then((buf) => C.extractText(file.name, buf, libs))
        .then((text) => {
          if (!text.trim()) throw new Error("글자를 찾지 못했습니다. 스캔한 PDF라면 글자 인식(OCR)을 거친 파일을 올려 주세요.");
          item.text = text;
          item.kind = C.guessKind(file.name, text);
          item.mark = C.restrictedMark(file.name, text);
          item.consent = item.mark ? null : "use";
          item.status = "ready";
        })
        .catch((e) => {
          item.status = "error";
          item.error = e && e.message ? e.message : "읽지 못했습니다.";
        })
        .finally(() => {
          renderFiles();
          refresh();
        });
    }
  }

  const CONSENT_CHOICES = [
    ["use", "확인함 — 내용까지 사용"],
    ["exclude", "확인 안 함 — 이 자료는 빼고 작성"],
    ["title", "파일 이름만 근거 목록에 남기기"],
  ];
  const TITLE_ONLY_TEXT = "(비공개 자료라 내용을 보내지 않았다. 근거 목록에 파일 이름만 적고, 이 자료를 근거로 쓰지 않는다.)";

  /** 비공개 자료 확인 칸: 내부 규정상 외부 AI에 넣어도 되는지 확인했는지 묻는다. */
  function consentBox(f) {
    const box = document.createElement("div");
    box.className = "consent";
    box.setAttribute("role", "group");
    const q = document.createElement("p");
    q.textContent = `'${f.mark}' 표시가 있는 비공개 자료입니다. 내부 규정상 외부 AI(Claude)에 넣어도 되는지 확인하셨나요? 고르기 전에는 Claude에게 보내지 않습니다.`;
    q.id = `consent-q-${f.id}`;
    box.setAttribute("aria-labelledby", q.id);
    const choices = document.createElement("div");
    choices.className = "choices";
    for (const [value, text] of CONSENT_CHOICES) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = text;
      b.setAttribute("aria-pressed", String(f.consent === value));
      b.addEventListener("click", () => {
        f.consent = value;
        renderFiles();
        refresh();
      });
      choices.append(b);
    }
    box.append(q, choices);
    return box;
  }

  function renderFiles() {
    const ul = $("file-list");
    const sent = sentFiles();
    ul.replaceChildren(
      ...state.files.map((f) => {
        const li = document.createElement("li");
        if (f.status === "error") li.className = "error";
        else if (f.mark && !f.consent) li.className = "pending";
        else if (f.consent === "exclude") li.className = "excluded";
        const tag = document.createElement("span");
        tag.className = "tag";
        const n = sent.indexOf(f);
        tag.textContent = n >= 0 ? C.label(n) : "–";
        const name = document.createElement("div");
        const title = document.createElement("div");
        title.className = "name";
        title.textContent = f.name;
        const meta = document.createElement("div");
        meta.className = "meta";
        meta.textContent =
          f.status === "reading" ? "읽는 중…"
          : f.status === "error" ? f.error
          : `${f.text.length.toLocaleString("ko-KR")}자${f.consent === "exclude" ? " · 보내지 않음" : f.consent === "title" ? " · 파일 이름만 보냄" : ""}`;
        name.append(title, meta);
        const kind = document.createElement("select");
        kind.setAttribute("aria-label", `${f.name} 자료 성격`);
        for (const k of ["공식", "정당·단체", "언론", "기타"]) kind.add(new Option(k, k, false, k === f.kind));
        kind.disabled = f.status !== "ready";
        kind.addEventListener("change", () => (f.kind = kind.value));
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "remove";
        remove.textContent = "빼기";
        remove.setAttribute("aria-label", `${f.name} 빼기`);
        remove.addEventListener("click", () => {
          state.files = state.files.filter((x) => x !== f);
          renderFiles();
          refresh();
        });
        li.append(tag, name, kind, remove);
        if (f.status === "ready" && f.mark) li.append(consentBox(f));
        return li;
      })
    );
  }

  const readyFiles = () => state.files.filter((f) => f.status === "ready");
  /** Claude에게 보낼 자료: 비공개 자료는 사용자가 고른 경우만(빼기를 고른 것은 제외). */
  const sentFiles = () => readyFiles().filter((f) => f.consent === "use" || f.consent === "title");
  const pendingFiles = () => readyFiles().filter((f) => f.mark && !f.consent);

  /* ───────── 2. 문서 종류 ───────── */

  function pickType(type) {
    state.type = type;
    for (const b of document.querySelectorAll(".type")) b.setAttribute("aria-pressed", String(b.dataset.type === type));
    refresh();
  }

  /* ───────── Claude 호출 공통 ───────── */

  const ERROR_COPY = {
    not_granted: "이 화면이 Claude를 쓰도록 허락되지 않았습니다. 화면 위쪽 권한 메뉴에서 허용할 수 있습니다.",
    sampling_disabled: "이 계정에서는 Claude를 쓸 수 없습니다.",
    rate_limited: "Claude 사용 한도에 걸렸습니다. 잠시 뒤에 다시 눌러 주세요.",
    session_expired: "로그인이 만료되었습니다. claude.ai에 다시 로그인해 주세요.",
    prompt_too_large: "자료가 너무 많습니다. 파일 수를 줄여 주세요.",
    refused: "Claude가 이 요청을 처리하지 않았습니다. 요청 내용을 바꿔 다시 시도해 주세요.",
    empty_completion: "Claude가 빈 답을 보냈습니다. 다시 눌러 주세요.",
    invalid_json: "질문을 읽지 못했습니다. 다시 눌러 주세요.",
    upstream_error: "연결이 끊겼습니다. 다시 눌러 주세요.",
  };
  const errorCopy = (e) => ERROR_COPY[e && e.code] || (e && e.message) || "알 수 없는 문제가 생겼습니다. 다시 눌러 주세요.";

  function commonArgs() {
    return {
      type: state.type,
      request: $("request").value.trim(),
      profile: profile(),
      sources: sentFiles().map((f) =>
        f.consent === "title"
          ? { name: f.name, kind: f.kind, text: TITLE_ONLY_TEXT, note: "비공개 자료: 내용 미사용" }
          : { name: f.name, kind: f.kind, text: f.text }
      ),
      data: DATA,
    };
  }
  function answersFlat() {
    return Object.values(state.answers)
      .flatMap((a) => [...(a.picked || []), a.other || ""])
      .join(" ");
  }
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  /* ───────── 3. 질문 ───────── */

  async function askQuestions() {
    if (!sample || state.busy) return;
    const args = commonArgs();
    const keywords = C.keywordsFor({ request: args.request, answersFlat: "", committee: DATA.committee });
    let built;
    try {
      built = C.buildWithinLimit(C.questionPrompt, args, QUESTION_BUDGET, keywords, MAX_PROMPT_BYTES);
    } catch (e) {
      setStatus("ask-status", e.message, true);
      return;
    }
    setBusy(true);
    setStatus("ask-status", "Claude가 자료를 읽고 있습니다… (보통 30초~1분)");
    try {
      const result = await sample.json(built.prompt, { modelTier: "default" });
      if (!result || !Array.isArray(result.questions)) throw { code: "invalid_json" };
      state.summary = String(result.summary || "");
      state.questions = result.questions
        .filter((q) => q && q.question && Array.isArray(q.options) && q.options.length)
        .slice(0, 4)
        .map((q, i) => ({
          id: String(q.id || `q${i + 1}`),
          header: String(q.header || "").slice(0, 16),
          question: String(q.question),
          multiple: Boolean(q.multiple),
          options: q.options.slice(0, 5).map((o) => ({
            label: String(o.label || ""),
            description: String(o.description || ""),
            recommended: Boolean(o.recommended),
          })),
        }));
      state.answers = {};
      for (const q of state.questions) {
        const rec = q.options.find((o) => o.recommended);
        state.answers[q.id] = { picked: rec ? [rec.label] : [], other: "" };
      }
      renderQuestions();
      const trimmed = built.sources.some((s) => s.trimmed);
      setStatus("ask-status", trimmed ? "자료가 길어 관련 대목만 추려 읽었습니다." : "");
      $("step-questions").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      setStatus("ask-status", errorCopy(e), true);
    } finally {
      setBusy(false);
    }
  }

  function renderQuestions() {
    const box = $("questions");
    const nodes = [];
    if (state.summary) {
      const s = document.createElement("div");
      s.className = "summary-box";
      s.textContent = state.summary;
      nodes.push(s);
    }
    state.questions.forEach((q, qi) => {
      const wrap = document.createElement("fieldset");
      wrap.className = "q";
      wrap.style.border = "0";
      wrap.style.margin = "0";
      if (q.header) {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = q.header;
        wrap.append(chip);
      }
      const legend = document.createElement("p");
      legend.textContent = q.question + (q.multiple ? " (여러 개 고를 수 있음)" : "");
      wrap.append(legend);
      q.options.forEach((o, oi) => {
        const label = document.createElement("label");
        label.className = "opt";
        const input = document.createElement("input");
        input.type = q.multiple ? "checkbox" : "radio";
        input.name = `q-${qi}`;
        input.id = `q-${qi}-${oi}`;
        input.checked = state.answers[q.id].picked.includes(o.label);
        input.addEventListener("change", () => {
          const a = state.answers[q.id];
          if (q.multiple) a.picked = input.checked ? [...a.picked, o.label] : a.picked.filter((x) => x !== o.label);
          else a.picked = [o.label];
        });
        const text = document.createElement("span");
        const strong = document.createElement("span");
        strong.textContent = o.label;
        text.append(strong);
        if (o.recommended) {
          const rec = document.createElement("span");
          rec.className = "rec";
          rec.textContent = "추천";
          text.append(rec);
        }
        if (o.description) {
          const small = document.createElement("small");
          small.textContent = o.description;
          text.append(small);
        }
        label.append(input, text);
        wrap.append(label);
      });
      const other = document.createElement("input");
      other.type = "text";
      other.id = `q-${qi}-other`;
      other.placeholder = "기타 (직접 적기)";
      other.setAttribute("aria-label", `${q.question} 기타 답`);
      other.style.marginTop = "6px";
      other.addEventListener("input", () => (state.answers[q.id].other = other.value.trim()));
      wrap.append(other);
      nodes.push(wrap);
    });
    if (!state.questions.length) {
      const p = document.createElement("p");
      p.className = "status";
      p.textContent = "물어볼 것이 없다고 합니다. 바로 '초안 쓰기'를 눌러 주세요.";
      nodes.push(p);
    }
    box.replaceChildren(...nodes);
    refresh();
  }

  /* ───────── 4. 초안 ───────── */

  async function writeDraft({ continueFrom = false } = {}) {
    if (!sample || state.busy) return;
    let input;
    if (continueFrom) {
      input = [
        { role: "user", content: state.lastPrompt },
        { role: "assistant", content: state.markdown },
        { role: "user", content: C.CONTINUE_PROMPT },
      ];
    } else {
      const args = { ...commonArgs(), questions: state.questions, answers: state.answers, today: today() };
      const keywords = C.keywordsFor({ request: args.request, answersFlat: answersFlat(), committee: DATA.committee });
      try {
        const built = C.buildWithinLimit(C.writePrompt, args, WRITE_BUDGET, keywords, MAX_PROMPT_BYTES);
        state.lastPrompt = built.prompt;
        state.usedSources = built.sources;
      } catch (e) {
        setStatus("write-status", e.message, true);
        return;
      }
      input = state.lastPrompt;
      state.markdown = "";
    }
    const before = state.markdown;
    controller = new AbortController();
    setBusy(true);
    state.truncated = false;
    $("example-tag").hidden = true;
    $("draft").classList.remove("example");
    $("draft").innerHTML = before ? C.markdownToHtml(before) : '<p class="status">Claude가 생각하고 있습니다… 첫 글자가 나오기까지 1~2분 걸릴 수 있습니다.</p>';
    setStatus("draft-status", "쓰는 중…");
    $("stop-btn").hidden = false;
    $("continue-btn").hidden = true;
    $("rewrite-btn").hidden = true;
    $("step-draft").scrollIntoView({ behavior: "smooth", block: "start" });
    let lastPaint = 0;
    try {
      const result = await sample(input, {
        modelTier: "complex",
        cache: false,
        signal: controller.signal,
        onText: ({ text }) => {
          state.markdown = before + text;
          const now = Date.now();
          if (now - lastPaint > 400) {
            lastPaint = now;
            $("draft").innerHTML = C.markdownToHtml(state.markdown);
          }
        },
      });
      state.markdown = before + result.text;
      state.truncated = result.truncated;
      setStatus("draft-status", result.truncated ? "길이 제한으로 끊겼습니다. '이어 쓰기'를 누르세요." : "다 썼습니다.");
    } catch (e) {
      if (e && e.text) state.markdown = before + e.text;
      if (e && e.code === "refused") state.markdown = before;
      if (e && e.code === "cancelled") setStatus("draft-status", "멈췄습니다. 쓴 데까지 남겨 두었습니다.");
      else setStatus("draft-status", errorCopy(e), true);
      state.truncated = Boolean(state.markdown) && (!e || e.code !== "refused");
    } finally {
      controller = null;
      $("draft").innerHTML = state.markdown ? C.markdownToHtml(state.markdown) : "";
      $("stop-btn").hidden = true;
      $("continue-btn").hidden = !state.truncated;
      $("rewrite-btn").hidden = !state.markdown;
      setBusy(false);
      renderChecks();
    }
  }

  /* ───────── 5. 검수·내려받기 ───────── */

  function renderChecks() {
    const box = $("checks");
    if (!state.markdown) {
      box.replaceChildren();
      return;
    }
    const sources = sentFiles().filter((f) => f.consent === "use").map((f) => f.text);
    const p = profile();
    const missing = C.checkNumbers(state.markdown, [...sources, DATA.committee, DATA.legal, today(), Object.values(p).join(" "), $("request").value]);
    const flags = C.countFlags(state.markdown);
    const cards = document.createElement("div");
    cards.className = "checks";
    cards.append(
      card(missing.length ? "bad" : "ok", "자료에서 찾지 못한 숫자", `${missing.length}개`, missing.length ? "아래 목록을 원문과 대조하세요." : "모든 숫자가 자료에 있습니다."),
      card(flags ? "warn" : "ok", "확인 필요 표시", `${flags}곳`, "초안 안에 노란 표시로 보입니다.")
    );
    if (state.type === "floor-speech") {
      const len = C.speechLength(state.markdown);
      if (len != null) {
        const inRange = len >= 1400 && len <= 1600;
        const c = card(inRange ? "ok" : "warn", "5분 발언 본문 분량", `${len.toLocaleString("ko-KR")}자`, `공백 포함, 분당 300자 기준 약 ${Math.floor(len / 300)}분 ${Math.round(((len / 300) % 1) * 60)}초 · 목표 1,400~1,600자`);
        const meter = document.createElement("div");
        meter.className = "meter";
        meter.setAttribute("role", "img");
        meter.setAttribute("aria-label", `${len}자, 목표 1,400~1,600자`);
        const max = 2200;
        const band = document.createElement("span");
        band.className = "band";
        band.style.left = `${(1400 / max) * 100}%`;
        band.style.width = `${(200 / max) * 100}%`;
        const pos = document.createElement("span");
        pos.className = "pos";
        pos.style.left = `${Math.min(len / max, 1) * 100}%`;
        meter.append(band, pos);
        c.append(meter);
        cards.append(c);
      }
    }
    const nodes = [cards];
    if (missing.length) {
      const ul = document.createElement("ul");
      ul.className = "missing";
      for (const m of missing) {
        const li = document.createElement("li");
        const code = document.createElement("code");
        code.textContent = m.number;
        const ctx = document.createElement("span");
        ctx.textContent = m.context;
        li.append(code, ctx);
        ul.append(li);
      }
      nodes.push(ul);
    }
    box.replaceChildren(...nodes);
    refresh();
  }

  function card(tone, title, big, note) {
    const d = document.createElement("div");
    d.className = "check-card";
    d.dataset.tone = tone;
    const t = document.createElement("span");
    t.textContent = title;
    const b = document.createElement("span");
    b.className = "big";
    b.textContent = big;
    const n = document.createElement("small");
    n.textContent = note;
    d.append(t, b, n);
    return d;
  }

  async function save(kind) {
    if (!state.markdown) return;
    if (!downloads) {
      setStatus("dl-status", "이 화면에서는 파일 저장을 쓸 수 없습니다. '마크다운 복사'를 써 주세요.", true);
      return;
    }
    const stem = C.fileStem(state.markdown, today(), state.type);
    try {
      setStatus("dl-status", "파일을 만드는 중…");
      let filename, data;
      if (kind === "hwpx") {
        const hwpx = await C.toHwpx(state.markdown, DATA, libs);
        data = new Blob([await C.hwpxInZip(`${stem}.hwpx`, hwpx, libs)]);
        filename = `${stem}.zip`;
      } else if (kind === "docx") {
        data = new Blob([await C.toDocx(state.markdown, DATA, libs)]);
        filename = `${stem}.docx`;
      } else {
        data = state.markdown;
        filename = `${stem}.md`;
      }
      await downloads.save({ filename, data });
      setStatus("dl-status", kind === "hwpx" ? "저장했습니다. zip을 풀면 .hwpx 파일이 나옵니다. 한글 2014 이상에서 열리고, 한글에서 .hwp로 다시 저장할 수 있습니다." : "저장했습니다.");
    } catch (e) {
      const code = e && e.code;
      if (code === "declined") setStatus("dl-status", "저장을 취소했습니다.");
      else if (code === "rate_limited") setStatus("dl-status", "저장 창이 이미 열려 있습니다. 그 창을 먼저 닫아 주세요.", true);
      else setStatus("dl-status", "파일을 저장하지 못했습니다. '마크다운 복사'를 써 주세요.", true);
    }
  }

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(state.markdown);
      setStatus("dl-status", "마크다운을 복사했습니다.");
    } catch (e) {
      setStatus("dl-status", "복사하지 못했습니다. 브라우저가 클립보드를 막았습니다.", true);
    }
  }

  /* ───────── 화면 상태 ───────── */

  function setStatus(id, text, error) {
    const el = $(id);
    el.textContent = text || "";
    el.classList.toggle("err", Boolean(error));
  }
  function setBusy(busy) {
    state.busy = busy;
    refresh();
  }

  function refresh() {
    const pending = pendingFiles().length > 0;
    const hasFiles = sentFiles().length > 0 && !pending;
    const reading = state.files.some((f) => f.status === "reading");
    const canAsk = Boolean(sample) && hasFiles && !reading && Boolean(state.type) && !state.busy;
    $("ask-btn").disabled = !canAsk;
    $("write-btn").disabled = !(Boolean(sample) && hasFiles && state.type && !state.busy && (state.questions.length || state.summary));
    $("consent-status").textContent = pending ? "비공개 자료 확인이 남았습니다. 위에서 자료마다 골라 주세요." : "";
    const done = Boolean(state.markdown) && !state.busy;
    for (const id of ["dl-hwpx", "dl-docx", "dl-md", "copy-md"]) $(id).disabled = !done;
    $("step-questions").setAttribute("aria-disabled", String(!(state.questions.length || state.summary)));
    $("step-export").setAttribute("aria-disabled", String(!done));
    const stepState = {
      files: hasFiles ? "done" : "current",
      type: !hasFiles ? "todo" : state.type ? "done" : "current",
      questions: !state.type || !hasFiles ? "todo" : state.questions.length || state.summary ? "done" : "current",
      draft: !(state.questions.length || state.summary) ? "todo" : state.markdown && !state.busy ? "done" : "current",
      export: done ? "current" : "todo",
    };
    for (const a of document.querySelectorAll("nav.steps a")) a.dataset.state = stepState[a.dataset.step];
  }

  /* ───────── 시작 ───────── */

  function wire() {
    loadProfile();
    saveProfile();
    for (const f of PROFILE_FIELDS) $(`p-${f}`).addEventListener("change", saveProfile);

    const drop = $("drop");
    const input = $("file-input");
    drop.addEventListener("click", () => input.click());
    drop.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        input.click();
      }
    });
    input.addEventListener("change", () => {
      addFiles(input.files);
      input.value = "";
    });
    drop.addEventListener("dragover", (e) => {
      e.preventDefault();
      drop.classList.add("over");
    });
    drop.addEventListener("dragleave", () => drop.classList.remove("over"));
    drop.addEventListener("drop", (e) => {
      e.preventDefault();
      drop.classList.remove("over");
      addFiles(e.dataTransfer.files);
    });

    for (const b of document.querySelectorAll(".type")) b.addEventListener("click", () => pickType(b.dataset.type));
    $("ask-btn").addEventListener("click", askQuestions);
    $("write-btn").addEventListener("click", () => writeDraft());
    $("stop-btn").addEventListener("click", () => controller && controller.abort());
    $("continue-btn").addEventListener("click", () => writeDraft({ continueFrom: true }));
    $("rewrite-btn").addEventListener("click", () => writeDraft());
    $("dl-hwpx").addEventListener("click", () => save("hwpx"));
    $("dl-docx").addEventListener("click", () => save("docx"));
    $("dl-md").addEventListener("click", () => save("md"));
    $("copy-md").addEventListener("click", copyMarkdown);

    $("draft").innerHTML = C.markdownToHtml(EXAMPLE_MD);
    refresh();

    const missingLibs = Object.entries(libs).filter(([, v]) => !v).map(([k]) => k);
    if (missingLibs.length) setStatus("claude-status", `일부 도구를 불러오지 못했습니다(${missingLibs.join(", ")}). 새로고침해 주세요.`, true);

    const use = window.claude && window.claude.use ? window.claude.use.bind(window.claude) : null;
    if (!use) {
      setStatus("claude-status", "claude.ai에서 열어야 Claude가 문서를 씁니다.", true);
      return;
    }
    use("downloads").then((d) => (downloads = d)).catch(() => {});
    use("sample")
      .then((s) => {
        sample = s;
        if (s) setStatus("claude-status", "Claude 연결됨 · 사용량은 내 Claude 요금제에서 차감됩니다");
        else setStatus("claude-status", "이 화면에서는 Claude를 쓸 수 없습니다. claude.ai에서 열어 주세요.", true);
        refresh();
      })
      .catch(() => setStatus("claude-status", "Claude에 연결하지 못했습니다.", true));
  }

  wire();
})();
