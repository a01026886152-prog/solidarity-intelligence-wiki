/* 예산안 검토방 화면 동작: 자료방(원문 보기·찾기·빨간펜·캡처) → 근거 출력함(PDF·인쇄) → 검토보고서(증액안·감액안).
 * 자료·캡처·보고서는 이 브라우저(IndexedDB)에만 보관한다. 보고서를 쓸 때만 고른 자료의 글자를 Claude에게 보낸다. */
(function () {
  "use strict";
  const C = window.UijeongCore;
  const B = window.BudgetCore;
  const DATA = window.UIJEONG_DATA;
  const $ = (id) => document.getElementById(id);
  if (!$("budget-room")) return;

  const MAX_PROMPT_BYTES = 250 * 1024;
  const REPORT_BUDGET = 70000;
  const RED = "#d0021b";
  const libs = { JSZip: window.JSZip, CFB: window.CFB, pako: window.pako, pdfjsLib: window.pdfjsLib };

  const st = {
    dept: "",
    years: B.defaultYears(new Date()),
    files: [], // {id, name, dept, kind, size, isPdf, pages:[], mark, consent, marks:{page:[shapes]}, bytes?}
    clips: [], // {id, dept, fileId, fileName, page, image, w, h, memo, text, createdAt}
    reports: [], // {id, dept, category, title, markdown, createdAt}
    open: null, // {file, page, pdf}
    tool: "pen",
    category: "decrease",
    markdown: "",
    reportId: null,
    busy: false,
  };
  let sample = null;
  let downloads = null;
  let controller = null;

  /* ───────── 보관함 (IndexedDB) ───────── */

  const store = (() => {
    let dbp = null;
    function open() {
      if (dbp) return dbp;
      dbp = new Promise((resolve) => {
        try {
          const req = indexedDB.open("uijeong-budget-room", 1);
          req.onupgradeneeded = () => {
            const db = req.result;
            for (const name of ["files", "blobs", "clips", "reports"]) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
      return dbp;
    }
    async function tx(name, mode, fn) {
      const db = await open();
      if (!db) return null;
      return new Promise((resolve) => {
        try {
          const t = db.transaction(name, mode);
          const req = fn(t.objectStore(name));
          t.oncomplete = () => resolve(req && req.result);
          t.onerror = () => resolve(null);
          t.onabort = () => resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
    }
    return {
      all: (name) => tx(name, "readonly", (s) => s.getAll()).then((r) => r || []),
      get: (name, id) => tx(name, "readonly", (s) => s.get(id)),
      put: (name, value) => tx(name, "readwrite", (s) => s.put(value)),
      del: (name, id) => tx(name, "readwrite", (s) => s.delete(id)),
      ok: () => open().then(Boolean),
    };
  })();
  const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const fileMeta = (f) => ({ ...f, bytes: undefined });

  /* ───────── 공통 ───────── */

  function setStatus(id, text, error) {
    const el = $(id);
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("err", Boolean(error));
  }
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const el = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null && v !== false) n.setAttribute(k, v === true ? "" : v);
    }
    n.append(...kids.filter((x) => x !== null && x !== undefined));
    return n;
  };
  const deptFiles = () => st.files.filter((f) => f.dept === st.dept);
  const deptClips = () => st.clips.filter((c) => c.dept === st.dept);
  const fileName = (f) => f.name;

  /* ───────── 상단: 부서·연도, 방 안 탭 ───────── */

  function renderDepts() {
    const sel = $("b-dept");
    const names = [...new Set([...B.departments(DATA.committee), ...st.files.map((f) => f.dept)])];
    sel.replaceChildren(...names.map((n) => new Option(n, n, false, n === st.dept)));
    sel.add(new Option("+ 부서 직접 입력…", "__new"));
    if (!st.dept) st.dept = names[0];
    sel.value = st.dept;
  }

  function switchPane(name) {
    for (const b of document.querySelectorAll("#budget-room .room-tabs button")) b.setAttribute("aria-selected", String(b.dataset.pane === name));
    for (const p of document.querySelectorAll("#budget-room .pane")) p.hidden = p.dataset.pane !== name;
    try {
      localStorage.setItem("uijeong.budget.pane", name);
    } catch (e) {
      /* 무시 */
    }
    if (name === "clips") renderClips();
    if (name === "report") renderReportSources();
  }

  /* ───────── 1. 자료방 ───────── */

  async function addFiles(list) {
    for (const file of list) {
      const item = { id: uid(), name: file.name, dept: st.dept, kind: "기타", size: file.size, isPdf: /\.pdf$/i.test(file.name), pages: [], status: "reading", marks: {}, addedAt: Date.now() };
      st.files.push(item);
      renderFiles();
      try {
        const buf = await file.arrayBuffer();
        if (item.isPdf) {
          const bytes = new Uint8Array(buf.slice(0));
          const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
          for (let n = 1; n <= pdf.numPages; n++) {
            const content = await (await pdf.getPage(n)).getTextContent();
            item.pages.push(content.items.map((it) => it.str + (it.hasEOL ? "\n" : "")).join(""));
          }
          item.bytes = bytes;
          const saved = await store.put("blobs", { id: item.id, bytes });
          if (saved === null) item.memoryOnly = true;
        } else {
          const text = await C.extractText(file.name, buf, libs);
          item.pages = B.splitTextPages(text);
        }
        const all = item.pages.join("\n");
        if (!all.trim()) item.noText = true;
        item.kind = B.guessBudgetKind(file.name, all);
        item.mark = C.restrictedMark(file.name, all);
        item.consent = item.mark ? null : "use";
        item.status = "ready";
        await store.put("files", fileMeta(item));
      } catch (e) {
        item.status = "error";
        item.error = (e && e.message) || "읽지 못했습니다.";
      }
      renderFiles();
    }
  }

  const CONSENT = [
    ["use", "확인함 — 내용까지 사용"],
    ["exclude", "확인 안 함 — 보고서에 쓰지 않음"],
    ["title", "파일 이름만 근거 목록에"],
  ];

  function renderFiles() {
    const ul = $("b-files");
    const files = deptFiles();
    $("b-files-empty").hidden = files.length > 0;
    ul.replaceChildren(
      ...files.map((f) => {
        const li = el("li", { class: f.status === "error" ? "error" : f.mark && !f.consent ? "pending" : "" });
        const meta =
          f.status === "reading" ? "읽는 중…"
          : f.status === "error" ? f.error
          : `${f.pages.length.toLocaleString("ko-KR")}쪽 · ${(f.size / 1024 / 1024).toFixed(1)}MB${f.isPdf ? " · 원문 PDF" : " · 글자 보기"}${f.noText ? " · 글자 없음(스캔본)" : ""}${f.memoryOnly ? " · 이 창에만(보관 실패)" : ""}`;
        const kind = el("select", { "aria-label": `${f.name} 자료 구분` });
        for (const k of B.KINDS) kind.add(new Option(k, k, false, k === f.kind));
        kind.disabled = f.status !== "ready";
        kind.addEventListener("change", () => {
          f.kind = kind.value;
          store.put("files", fileMeta(f));
        });
        const openBtn = el("button", { type: "button", text: "열기", disabled: f.status !== "ready", onclick: () => openFile(f, 1) });
        const rm = el("button", {
          type: "button",
          class: "remove",
          text: "빼기",
          "aria-label": `${f.name} 빼기`,
          onclick: async () => {
            if (!confirm(`'${f.name}'을 자료방에서 뺄까요? 이 자료의 빨간펜 표시도 지워집니다. (근거 출력함에 담은 캡처는 남습니다)`)) return;
            st.files = st.files.filter((x) => x !== f);
            await store.del("files", f.id);
            await store.del("blobs", f.id);
            if (st.open && st.open.file === f) closeViewer();
            renderFiles();
          },
        });
        li.append(el("span", { class: "tag", text: f.isPdf ? "PDF" : "글" }), el("div", {}, el("div", { class: "name", text: f.name }), el("div", { class: "meta", text: meta })), kind, el("span", { class: "row" }, openBtn, rm));
        if (f.status === "ready" && f.mark) {
          const box = el("div", { class: "consent", role: "group" }, el("p", { text: `'${f.mark}' 표시가 있는 비공개 자료입니다. 내부 규정상 외부 AI(Claude)에 넣어도 되는지 확인하셨나요? 자료방에서 보고 표시하는 것은 이 브라우저 안에서만 이루어지고, 보고서를 쓸 때만 이 답에 따라 보냅니다.` }));
          const choices = el("div", { class: "choices" });
          for (const [v, t] of CONSENT)
            choices.append(
              el("button", {
                type: "button",
                text: t,
                "aria-pressed": String(f.consent === v),
                onclick: () => {
                  f.consent = v;
                  store.put("files", fileMeta(f));
                  renderFiles();
                },
              })
            );
          box.append(choices);
          li.append(box);
        }
        return li;
      })
    );
  }

  /* 자료 안에서 찾기 */
  function runSearch() {
    const q = $("b-search").value.trim();
    const box = $("b-hits");
    if (!q) {
      box.replaceChildren();
      setStatus("b-search-status", "");
      return;
    }
    const ready = deptFiles().filter((f) => f.status === "ready");
    const hits = B.searchPages(ready, q);
    setStatus("b-search-status", hits.length ? `${hits.length}곳 찾음${hits.length >= 200 ? " (앞 200곳만)" : ""} · 자료 ${ready.length}개에서` : `'${q}'를 찾지 못했습니다. 띄어쓰기는 무시하고 찾습니다. 스캔본 PDF는 글자가 없어 찾을 수 없습니다.`);
    box.replaceChildren(
      ...hits.map((h) =>
        el(
          "li",
          {},
          el(
            "button",
            {
              type: "button",
              onclick: () => {
                const f = st.files.find((x) => x.id === h.fileId);
                if (f) openFile(f, h.page);
              },
            },
            el("span", { class: "hit-src", text: `${h.fileName} · ${h.page}쪽` }),
            el("span", { class: "hit-text" }, h.before, el("mark", { text: h.match }), h.after)
          )
        )
      )
    );
  }

  /* ───────── 원문 보기와 빨간펜 ───────── */

  async function openFile(f, page) {
    let pdf = null;
    if (f.isPdf) {
      let bytes = f.bytes;
      if (!bytes) {
        const rec = await store.get("blobs", f.id);
        bytes = rec && rec.bytes;
      }
      if (!bytes) {
        setStatus("b-view-status", "원문 PDF를 이 브라우저에서 찾지 못했습니다. 파일을 다시 올려 주세요.", true);
        return;
      }
      f.bytes = bytes;
      try {
        pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
      } catch (e) {
        setStatus("b-view-status", "PDF를 열지 못했습니다.", true);
        return;
      }
    }
    st.open = { file: f, page: Math.min(Math.max(1, page), f.pages.length || 1), pdf };
    $("b-viewer").hidden = false;
    $("b-view-name").textContent = f.name;
    $("b-view-note").textContent = f.isPdf ? "원문 PDF 그대로입니다." : "한글·워드 파일은 글자만 보여 줍니다. 쪽 번호는 원문 인쇄 쪽과 다를 수 있습니다.";
    await renderPage();
    $("b-viewer").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeViewer() {
    st.open = null;
    $("b-viewer").hidden = true;
  }

  const PAGE_W = 1000; // 화면 밖 캔버스 폭(픽셀). 표시는 CSS로 줄인다.

  async function renderPage() {
    const o = st.open;
    if (!o) return;
    const base = $("b-base");
    const ink = $("b-ink");
    const total = o.pdf ? o.pdf.numPages : o.file.pages.length;
    $("b-page").value = o.page;
    $("b-page").max = total;
    $("b-page-total").textContent = `/ ${total}쪽`;
    setStatus("b-view-status", "쪽을 그리는 중…");
    if (o.pdf) {
      const page = await o.pdf.getPage(o.page);
      const vp1 = page.getViewport({ scale: 1 });
      const scale = (PAGE_W * 1.6) / vp1.width;
      const vp = page.getViewport({ scale });
      base.width = Math.round(vp.width);
      base.height = Math.round(vp.height);
      const ctx = base.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, base.width, base.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
    } else {
      drawTextPage(base, o.file.pages[o.page - 1] || "", `${o.file.name} · ${o.page}쪽`);
    }
    ink.width = base.width;
    ink.height = base.height;
    drawMarks();
    setStatus("b-view-status", "");
  }

  /** 글자 자료 한 쪽을 A4 비율 캔버스에 그린다. */
  function drawTextPage(canvas, text, header) {
    const W = PAGE_W * 1.6;
    const H = Math.round(W * 1.414);
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#666";
    ctx.font = `24px "Noto Sans KR", "Malgun Gothic", sans-serif`;
    ctx.fillText(header, 90, 70);
    ctx.fillStyle = "#111";
    ctx.font = `30px "Noto Sans KR", "Malgun Gothic", sans-serif`;
    const maxW = W - 180;
    let y = 140;
    for (const para of text.split("\n")) {
      let line = "";
      for (const ch of para) {
        if (ctx.measureText(line + ch).width > maxW) {
          ctx.fillText(line, 90, y);
          y += 46;
          line = "";
        }
        line += ch;
      }
      ctx.fillText(line, 90, y);
      y += 46;
      if (y > H - 60) break;
    }
  }

  const marksOf = () => {
    const o = st.open;
    if (!o) return [];
    o.file.marks = o.file.marks || {};
    return (o.file.marks[o.page] = o.file.marks[o.page] || []);
  };

  function drawShape(ctx, s, W, H) {
    ctx.save();
    if (s.type === "pen") {
      ctx.strokeStyle = RED;
      ctx.lineWidth = Math.max(3, W / 320);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * W, y * H) : ctx.moveTo(x * W, y * H)));
      ctx.stroke();
    } else if (s.type === "box") {
      ctx.strokeStyle = RED;
      ctx.lineWidth = Math.max(4, W / 260);
      ctx.strokeRect(s.x * W, s.y * H, s.w * W, s.h * H);
    } else if (s.type === "hl") {
      ctx.fillStyle = "rgba(255, 214, 0, 0.38)";
      ctx.fillRect(s.x * W, s.y * H, s.w * W, s.h * H);
    } else if (s.type === "line") {
      ctx.strokeStyle = RED;
      ctx.lineWidth = Math.max(4, W / 300);
      ctx.beginPath();
      ctx.moveTo(s.x * W, (s.y + s.h) * H);
      ctx.lineTo((s.x + s.w) * W, (s.y + s.h) * H);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMarks(extra) {
    const ink = $("b-ink");
    const ctx = ink.getContext("2d");
    ctx.clearRect(0, 0, ink.width, ink.height);
    for (const s of marksOf()) drawShape(ctx, s, ink.width, ink.height);
    if (extra) {
      if (extra.type === "cap") {
        ctx.save();
        ctx.setLineDash([14, 10]);
        ctx.strokeStyle = "#1f5d50";
        ctx.lineWidth = 4;
        ctx.strokeRect(extra.x * ink.width, extra.y * ink.height, extra.w * ink.width, extra.h * ink.height);
        ctx.restore();
      } else drawShape(ctx, extra, ink.width, ink.height);
    }
  }

  function saveMarks() {
    const o = st.open;
    if (o) store.put("files", fileMeta(o.file));
  }

  function wireInk() {
    const ink = $("b-ink");
    let drag = null;
    const pos = (e) => {
      const r = ink.getBoundingClientRect();
      return [Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1), Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1)];
    };
    const rectOf = (a, b) => ({ x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(a[0] - b[0]), h: Math.abs(a[1] - b[1]) });
    ink.addEventListener("pointerdown", (e) => {
      if (!st.open) return;
      e.preventDefault();
      ink.setPointerCapture(e.pointerId);
      const p = pos(e);
      drag = st.tool === "pen" ? { type: "pen", pts: [p] } : { type: st.tool, start: p, ...rectOf(p, p) };
    });
    ink.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const p = pos(e);
      if (drag.type === "pen") drag.pts.push(p);
      else Object.assign(drag, rectOf(drag.start, p));
      drawMarks(drag);
    });
    const end = () => {
      if (!drag) return;
      const d = drag;
      drag = null;
      if (d.type === "cap") {
        drawMarks();
        if (d.w > 0.02 && d.h > 0.01) captureClip({ x: d.x, y: d.y, w: d.w, h: d.h });
        return;
      }
      if (d.type === "pen" ? d.pts.length > 1 : d.w > 0.005 || d.h > 0.005) {
        const shape = d.type === "pen" ? { type: "pen", pts: d.pts.map(([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4]) } : { type: d.type, x: d.x, y: d.y, w: d.w, h: d.h };
        marksOf().push(shape);
        saveMarks();
      }
      drawMarks();
    };
    ink.addEventListener("pointerup", end);
    ink.addEventListener("pointercancel", end);
  }

  function pickTool(tool) {
    st.tool = tool;
    for (const b of document.querySelectorAll("#b-tools button[data-tool]")) b.setAttribute("aria-pressed", String(b.dataset.tool === tool));
    $("b-ink").dataset.tool = tool;
  }

  /** 지금 쪽(빨간펜 포함)을 그림으로 합쳐, rect(0~1 비율) 부분만 잘라 근거 출력함에 담는다. */
  async function captureClip(rect) {
    const o = st.open;
    if (!o) return;
    const base = $("b-base");
    const ink = $("b-ink");
    const r = rect || { x: 0, y: 0, w: 1, h: 1 };
    const sx = Math.round(r.x * base.width);
    const sy = Math.round(r.y * base.height);
    const sw = Math.max(1, Math.round(r.w * base.width));
    const sh = Math.max(1, Math.round(r.h * base.height));
    const out = document.createElement("canvas");
    out.width = sw;
    out.height = sh;
    const ctx = out.getContext("2d");
    ctx.drawImage(base, sx, sy, sw, sh, 0, 0, sw, sh);
    ctx.drawImage(ink, sx, sy, sw, sh, 0, 0, sw, sh);
    const clip = {
      id: uid(),
      dept: st.dept,
      fileId: o.file.id,
      fileName: o.file.name,
      fileKind: o.file.kind,
      isPdf: o.file.isPdf,
      page: o.page,
      whole: !rect,
      image: out.toDataURL("image/jpeg", 0.92),
      w: sw,
      h: sh,
      memo: "",
      text: (o.file.pages[o.page - 1] || "").slice(0, 2000),
      createdAt: Date.now(),
    };
    st.clips.push(clip);
    await store.put("clips", clip);
    updateClipCount();
    setStatus("b-view-status", `근거 출력함에 담았습니다 (${deptClips().length}개). '근거 출력함' 탭에서 메모를 달고 PDF로 만들 수 있습니다.`);
    if (st.tool === "cap") pickTool("pen");
  }

  function updateClipCount() {
    $("b-clip-count").textContent = deptClips().length ? ` ${deptClips().length}` : "";
  }

  /* ───────── 2. 근거 출력함 ───────── */

  function clipSource(c) {
    return `[출처: ${c.fileName}, ${c.page}쪽${c.isPdf ? "" : " (글자 보기 쪽)"}]`;
  }

  function renderClips() {
    const list = deptClips();
    $("b-clips-empty").hidden = list.length > 0;
    for (const id of ["b-pdf", "b-print"]) $(id).disabled = !list.length;
    $("b-clips").replaceChildren(
      ...list.map((c, i) => {
        const memo = el("textarea", { rows: "2", placeholder: "의원에게 드릴 한 줄 설명 (예: 3년 연속 불용 40% 이상)", "aria-label": `근거 ${i + 1} 메모` });
        memo.value = c.memo || "";
        memo.addEventListener("change", () => {
          c.memo = memo.value.trim();
          store.put("clips", c);
        });
        const move = (d) => {
          const all = st.clips;
          const a = all.indexOf(c);
          const peers = all.filter((x) => x.dept === st.dept);
          const target = peers[peers.indexOf(c) + d];
          if (!target) return;
          const b = all.indexOf(target);
          [all[a], all[b]] = [all[b], all[a]];
          // 순서를 보관하려고 만든 시각을 맞바꾼다
          [c.createdAt, target.createdAt] = [target.createdAt, c.createdAt];
          store.put("clips", c);
          store.put("clips", target);
          renderClips();
        };
        return el(
          "li",
          {},
          el("img", { src: c.image, alt: `근거 ${i + 1}: ${c.fileName} ${c.page}쪽 캡처` }),
          el(
            "div",
            { class: "clip-body" },
            el("b", { text: `근거 ${i + 1}` }),
            el("span", { class: "meta", text: `${clipSource(c)}${c.whole ? " · 쪽 전체" : " · 부분 캡처"}` }),
            memo,
            el(
              "div",
              { class: "row" },
              el("button", { type: "button", text: "위로", disabled: i === 0, onclick: () => move(-1) }),
              el("button", { type: "button", text: "아래로", disabled: i === list.length - 1, onclick: () => move(1) }),
              el("button", {
                type: "button",
                text: "원문 쪽 열기",
                onclick: () => {
                  const f = st.files.find((x) => x.id === c.fileId);
                  if (!f) return setStatus("b-clip-status", "이 자료는 자료방에서 빠졌습니다.", true);
                  switchPane("room");
                  openFile(f, c.page);
                },
              }),
              el("button", {
                type: "button",
                class: "remove",
                text: "빼기",
                onclick: async () => {
                  st.clips = st.clips.filter((x) => x !== c);
                  await store.del("clips", c.id);
                  updateClipCount();
                  renderClips();
                },
              })
            )
          )
        );
      })
    );
  }

  /** 출력용 A4 쪽 하나(캔버스): 머리말·출처·메모·캡처·꼬리말 */
  async function sheet(c, i, n) {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const W = 1240;
    const H = 1754; // A4 150dpi
    const M = 90;
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);
    const font = (px, bold) => `${bold ? "700 " : ""}${px}px "Noto Sans KR", "Malgun Gothic", sans-serif`;
    ctx.fillStyle = "#111";
    ctx.font = font(34, true);
    ctx.fillText(`근거 ${i + 1}`, M, M + 20);
    ctx.font = font(22);
    ctx.fillStyle = "#555";
    const title = $("b-print-title").value.trim() || `${st.dept} 예산안 검토 근거자료`;
    ctx.textAlign = "right";
    ctx.fillText(title, W - M, M + 16);
    ctx.textAlign = "left";
    ctx.fillStyle = "#111";
    ctx.font = font(24);
    const wrap = (text, x, y, maxW, lh, maxLines) => {
      let line = "";
      let lines = 0;
      for (const ch of text) {
        if (ctx.measureText(line + ch).width > maxW) {
          ctx.fillText(line, x, y);
          y += lh;
          line = "";
          if (++lines >= maxLines) return y;
        }
        line += ch;
      }
      if (line) {
        ctx.fillText(line, x, y);
        y += lh;
      }
      return y;
    };
    let y = wrap(clipSource(c), M, M + 70, W - 2 * M, 34, 2);
    if (c.memo) {
      ctx.fillStyle = RED;
      ctx.font = font(26, true);
      y = wrap(c.memo, M, y + 6, W - 2 * M, 38, 3);
      ctx.fillStyle = "#111";
    }
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(M, y + 4);
    ctx.lineTo(W - M, y + 4);
    ctx.stroke();
    const top = y + 24;
    const boxW = W - 2 * M;
    const boxH = H - top - M - 40;
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = c.image;
    });
    const s = Math.min(boxW / img.width, boxH / img.height, 2.5);
    const dw = img.width * s;
    const dh = img.height * s;
    ctx.drawImage(img, M + (boxW - dw) / 2, top, dw, dh);
    ctx.strokeStyle = "#bbb";
    ctx.lineWidth = 1;
    ctx.strokeRect(M + (boxW - dw) / 2, top, dw, dh);
    ctx.fillStyle = "#666";
    ctx.font = font(20);
    const p = profileForPrint();
    ctx.fillText(`${p} · ${today()}`, M, H - M + 20);
    ctx.textAlign = "right";
    ctx.fillText(`${i + 1} / ${n}`, W - M, H - M + 20);
    ctx.textAlign = "left";
    return cv;
  }

  function profileForPrint() {
    const member = ($("p-member") && $("p-member").value.trim()) || "";
    const committee = ($("p-committee") && $("p-committee").value.trim()) || "서울특별시의회";
    return member ? `${committee} ${member} 의원실` : committee;
  }

  async function sheets() {
    const list = deptClips();
    const out = [];
    for (let i = 0; i < list.length; i++) out.push(await sheet(list[i], i, list.length));
    return out;
  }

  async function makePdf() {
    if (!window.jspdf) return setStatus("b-clip-status", "PDF 도구를 불러오지 못했습니다. 새로고침해 주세요.", true);
    setStatus("b-clip-status", "PDF를 만드는 중…");
    try {
      const pages = await sheets();
      const doc = new window.jspdf.jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true });
      pages.forEach((cv, i) => {
        if (i) doc.addPage();
        doc.addImage(cv.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, 210, 297);
      });
      const blob = doc.output("blob");
      const name = `${today()} ${($("b-print-title").value.trim() || `${st.dept} 예산 검토 근거자료`).replace(/[\\/:*?"<>|]/g, " ")}.pdf`;
      if (downloads) {
        await downloads.save({ filename: name, data: blob });
        setStatus("b-clip-status", `저장했습니다 (${pages.length}쪽). 내려받은 PDF를 열어 인쇄하면 됩니다.`);
      } else {
        const a = el("a", { href: URL.createObjectURL(blob), download: name });
        document.body.append(a);
        a.click();
        a.remove();
        setStatus("b-clip-status", `PDF를 만들었습니다 (${pages.length}쪽).`);
      }
    } catch (e) {
      if (e && e.code === "declined") setStatus("b-clip-status", "저장을 취소했습니다.");
      else setStatus("b-clip-status", "PDF를 만들지 못했습니다. 캡처 수를 줄여 다시 해 보세요.", true);
    }
  }

  async function printSheets() {
    setStatus("b-clip-status", "인쇄할 쪽을 준비하는 중…");
    const pages = await sheets();
    const area = $("print-area");
    area.replaceChildren(...pages.map((cv) => el("img", { src: cv.toDataURL("image/jpeg", 0.9), alt: "" })));
    document.body.classList.add("printing");
    const done = () => {
      document.body.classList.remove("printing");
      area.replaceChildren();
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    try {
      window.print();
      setStatus("b-clip-status", "인쇄 창이 뜨지 않으면 'PDF 만들기'로 내려받아 인쇄해 주세요.");
    } catch (e) {
      done();
      setStatus("b-clip-status", "이 화면에서는 바로 인쇄할 수 없습니다. 'PDF 만들기'로 내려받아 인쇄해 주세요.", true);
    }
    setTimeout(done, 60000);
  }

  /* ───────── 3. 검토보고서 ───────── */

  function pickCategory(cat) {
    st.category = cat;
    for (const b of document.querySelectorAll("#b-cats .type")) b.setAttribute("aria-pressed", String(b.dataset.cat === cat));
    renderReports();
    refresh();
  }

  function renderReportSources() {
    const files = deptFiles().filter((f) => f.status === "ready");
    const box = $("b-report-files");
    if (!files.length) {
      box.replaceChildren(el("p", { class: "status", text: "자료방에 이 부서 자료가 없습니다. 먼저 자료를 올려 주세요." }));
      refresh();
      return;
    }
    box.replaceChildren(
      ...files.map((f) => {
        const blocked = f.mark && (!f.consent || f.consent === "exclude");
        const cb = el("input", { type: "checkbox", id: `bf-${f.id}`, "data-id": f.id });
        cb.checked = f.selected !== false && !blocked;
        cb.disabled = blocked;
        cb.addEventListener("change", () => {
          f.selected = cb.checked;
          refresh();
        });
        const note = !f.mark ? "" : !f.consent ? " · 비공개 확인 전(자료방에서 고르세요)" : f.consent === "exclude" ? " · 비공개: 보내지 않음" : f.consent === "title" ? " · 비공개: 파일 이름만" : "";
        return el("label", { class: "opt", for: `bf-${f.id}` }, cb, el("span", {}, el("span", { text: f.name }), el("small", { text: `${f.kind} · ${f.pages.length}쪽${note}` })));
      })
    );
    $("b-report-clips").textContent = `근거 출력함의 캡처 ${deptClips().length}개도 '출력 근거'로 함께 보냅니다(캡처한 쪽의 글자만, 그림은 보내지 않음).`;
    refresh();
  }

  function selectedSources() {
    return deptFiles().filter((f) => f.status === "ready" && f.selected !== false && !(f.mark && (!f.consent || f.consent === "exclude")));
  }

  function profileText() {
    const v = (id, d) => ($(id) && $(id).value.trim()) || d;
    return [
      `관점: ${v("p-stance", "의원실")}`,
      `의원명: ${v("p-member", "○○○")}`,
      $("p-party") && $("p-party").value.trim() && `소속 정당: ${$("p-party").value.trim()}`,
      `위원회: ${v("p-committee", "서울특별시의회 주택공간위원회")}`,
      `어조: ${v("p-tone", "단호하되 근거 중심")}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  function buildPrompt() {
    const files = selectedSources();
    const projects = $("b-projects").value.trim();
    const request = $("b-request").value.trim();
    const keywords = [...new Set([st.dept, ...projects.split(/[\s,·]+/), ...request.split(/[\s,·]+/), "결산", "예산현액", "집행", "불용", "이월", "증감", "산출", "단가", "요구액", "성과"].filter((w) => w && w.length >= 2))];
    const sources = files.map((f) =>
      f.consent === "title"
        ? { name: f.name, kind: f.kind, text: "(비공개 자료라 내용을 보내지 않았다. 근거 목록에 파일 이름만 적고, 이 자료를 근거로 쓰지 않는다.)", note: "비공개 자료: 내용 미사용" }
        : { name: f.name, kind: f.kind, text: B.pagedText(f.pages) }
    );
    const clips = deptClips().filter((c) => {
      const f = st.files.find((x) => x.id === c.fileId);
      return !f || !f.mark || f.consent === "use";
    });
    const args = { sources };
    const build = ({ sources: fitted }) =>
      B.reportPrompt({
        category: st.category,
        basis: $("b-basis").value,
        dept: st.dept,
        years: st.years,
        projects,
        request,
        profileText: profileText(),
        sourcesText: fitted.map((s, i) => `<자료 번호="${C.label(i)}" 파일="${s.name}" 구분="${s.kind}"${s.note ? ` 비고="${s.note}"` : s.trimmed ? ' 비고="길어서 관련 대목만 추림. [쪽 n] 표시는 원래 쪽 번호"' : ""}>\n${s.text}\n</자료>`).join("\n\n"),
        clips,
        skill: DATA.skills["budget-review"],
        committee: DATA.committee,
        legal: DATA.legal,
        today: today(),
      });
    return { ...C.buildWithinLimit(build, args, REPORT_BUDGET, keywords, MAX_PROMPT_BYTES), files };
  }

  async function writeReport({ continueFrom = false } = {}) {
    if (!sample || st.busy) return;
    let input;
    if (continueFrom) {
      input = [
        { role: "user", content: st.lastPrompt },
        { role: "assistant", content: st.markdown },
        { role: "user", content: C.CONTINUE_PROMPT },
      ];
    } else {
      try {
        const built = buildPrompt();
        st.lastPrompt = built.prompt;
        st.usedFiles = built.files;
        st.trimmed = built.sources.some((s) => s.trimmed);
      } catch (e) {
        return setStatus("b-write-status", e.message, true);
      }
      input = st.lastPrompt;
      st.markdown = "";
      st.reportId = uid();
    }
    const before = st.markdown;
    controller = new AbortController();
    st.busy = true;
    refresh();
    $("b-draft").hidden = false;
    $("b-draft").innerHTML = before ? C.markdownToHtml(before) : '<p class="status">Claude가 자료를 읽고 있습니다… 첫 글자가 나오기까지 1~2분 걸릴 수 있습니다.</p>';
    setStatus("b-write-status", `쓰는 중…${st.trimmed ? " (자료가 길어 관련 쪽만 추려 보냈습니다)" : ""}`);
    $("b-stop").hidden = false;
    $("b-continue").hidden = true;
    let last = 0;
    let truncated = false;
    try {
      const result = await sample(input, {
        modelTier: "complex",
        cache: false,
        signal: controller.signal,
        onText: ({ text }) => {
          st.markdown = before + text;
          if (Date.now() - last > 400) {
            last = Date.now();
            $("b-draft").innerHTML = C.markdownToHtml(st.markdown);
          }
        },
      });
      st.markdown = before + result.text;
      truncated = result.truncated;
      setStatus("b-write-status", truncated ? "길이 제한으로 끊겼습니다. '이어 쓰기'를 누르세요." : "다 썼습니다. 보고서함에 저장했습니다.");
    } catch (e) {
      if (e && e.text) st.markdown = before + e.text;
      if (e && e.code === "cancelled") setStatus("b-write-status", "멈췄습니다. 쓴 데까지 남겨 두었습니다.");
      else setStatus("b-write-status", errorCopy(e), true);
      truncated = Boolean(st.markdown);
    } finally {
      controller = null;
      st.busy = false;
      $("b-draft").innerHTML = st.markdown ? C.markdownToHtml(st.markdown) : "";
      $("b-stop").hidden = true;
      $("b-continue").hidden = !truncated;
      if (st.markdown) await saveReport();
      renderChecks();
      refresh();
    }
  }

  const ERRORS = {
    not_granted: "이 화면이 Claude를 쓰도록 허락되지 않았습니다. 화면 위쪽 권한 메뉴에서 허용할 수 있습니다.",
    rate_limited: "Claude 사용 한도에 걸렸습니다. 잠시 뒤에 다시 눌러 주세요.",
    session_expired: "로그인이 만료되었습니다. claude.ai에 다시 로그인해 주세요.",
    prompt_too_large: "자료가 너무 많습니다. 보낼 자료를 줄여 주세요.",
    refused: "Claude가 이 요청을 처리하지 않았습니다.",
    upstream_error: "연결이 끊겼습니다. 다시 눌러 주세요.",
  };
  const errorCopy = (e) => ERRORS[e && e.code] || (e && e.message) || "알 수 없는 문제가 생겼습니다. 다시 눌러 주세요.";

  async function saveReport() {
    const title = ((st.markdown.match(/^#\s+(.+)$/m) || [])[1] || `${st.dept} ${B.CATEGORIES[st.category].name}`).replace(/\*\*/g, "");
    const rec = { id: st.reportId || uid(), dept: st.dept, category: st.category, title, markdown: st.markdown, createdAt: Date.now() };
    st.reportId = rec.id;
    const i = st.reports.findIndex((r) => r.id === rec.id);
    if (i >= 0) st.reports[i] = rec;
    else st.reports.push(rec);
    await store.put("reports", rec);
    renderReports();
  }

  function renderChecks() {
    const box = $("b-checks");
    if (!st.markdown) return box.replaceChildren();
    const sources = (st.usedFiles || selectedSources()).filter((f) => f.consent === "use").map((f) => f.pages.join("\n"));
    const missing = C.checkNumbers(st.markdown, [...sources, ...deptClips().map((c) => c.text), DATA.committee, DATA.legal, today(), String(st.years.settlement), String(st.years.budget), $("b-projects").value, $("b-request").value]);
    const flags = C.countFlags(st.markdown);
    const cards = el(
      "div",
      { class: "checks" },
      el("div", { class: "check-card", "data-tone": missing.length ? "bad" : "ok" }, el("span", { text: "자료에서 찾지 못한 숫자" }), el("span", { class: "big", text: `${missing.length}개` }), el("small", { text: "집행률·증감률·조정액처럼 계산한 값도 여기에 나옵니다. 계산식을 직접 검산하세요." })),
      el("div", { class: "check-card", "data-tone": flags ? "warn" : "ok" }, el("span", { text: "확인 필요 표시" }), el("span", { class: "big", text: `${flags}곳` }), el("small", { text: "제출 전에 원문으로 확인하세요." }))
    );
    const nodes = [cards];
    if (missing.length) nodes.push(el("ul", { class: "missing" }, ...missing.map((m) => el("li", {}, el("code", { text: m.number }), el("span", { text: m.context })))));
    box.replaceChildren(...nodes);
  }

  function renderReports() {
    for (const cat of ["increase", "decrease"]) {
      const list = st.reports.filter((r) => r.dept === st.dept && r.category === cat).sort((a, b) => b.createdAt - a.createdAt);
      $(`b-count-${cat}`).textContent = list.length;
      $(`b-list-${cat}`).replaceChildren(
        ...(list.length
          ? list.map((r) =>
              el(
                "li",
                {},
                el("button", {
                  type: "button",
                  class: "linkish",
                  text: r.title,
                  onclick: () => {
                    st.markdown = r.markdown;
                    st.reportId = r.id;
                    pickCategory(r.category);
                    $("b-draft").hidden = false;
                    $("b-draft").innerHTML = C.markdownToHtml(r.markdown);
                    renderChecks();
                    refresh();
                    $("b-draft").scrollIntoView({ behavior: "smooth", block: "start" });
                  },
                }),
                el("span", { class: "meta", text: new Date(r.createdAt).toLocaleString("ko-KR") }),
                el("button", {
                  type: "button",
                  class: "remove",
                  text: "지우기",
                  onclick: async () => {
                    if (!confirm(`'${r.title}'을 보고서함에서 지울까요?`)) return;
                    st.reports = st.reports.filter((x) => x !== r);
                    await store.del("reports", r.id);
                    renderReports();
                  },
                })
              )
            )
          : [el("li", { class: "status", text: "아직 없습니다." })])
      );
    }
  }

  async function saveFile(kind) {
    if (!st.markdown) return;
    const stem = B.reportStem(st.markdown, today(), st.dept, st.category);
    try {
      setStatus("b-dl-status", "파일을 만드는 중…");
      let filename, data;
      if (kind === "hwpx") {
        data = new Blob([await C.hwpxInZip(`${stem}.hwpx`, await C.toHwpx(st.markdown, DATA, libs), libs)]);
        filename = `${stem}.zip`;
      } else if (kind === "docx") {
        data = new Blob([await C.toDocx(st.markdown, DATA, libs)]);
        filename = `${stem}.docx`;
      } else {
        data = st.markdown;
        filename = `${stem}.md`;
      }
      if (!downloads) throw { code: "no_downloads" };
      await downloads.save({ filename, data });
      setStatus("b-dl-status", kind === "hwpx" ? "저장했습니다. zip을 풀면 .hwpx 파일이 나옵니다." : "저장했습니다.");
    } catch (e) {
      if (e && e.code === "declined") setStatus("b-dl-status", "저장을 취소했습니다.");
      else setStatus("b-dl-status", "파일을 저장하지 못했습니다. '마크다운 복사'를 써 주세요.", true);
    }
  }

  function refresh() {
    const n = selectedSources().length;
    $("b-write").disabled = !(sample && n && !st.busy);
    $("b-write-hint").textContent = !sample ? "claude.ai에서 열어야 보고서를 씁니다. 자료방과 근거 출력함은 여기서도 쓸 수 있습니다." : !n ? "보낼 자료를 하나 이상 고르세요." : `${B.CATEGORIES[st.category].name} · ${st.dept} · 자료 ${n}개`;
    const done = Boolean(st.markdown) && !st.busy;
    for (const id of ["b-dl-hwpx", "b-dl-docx", "b-dl-md", "b-copy"]) $(id).disabled = !done;
  }

  /* ───────── 시작 ───────── */

  async function load() {
    const [files, clips, reports] = await Promise.all([store.all("files"), store.all("clips"), store.all("reports")]);
    st.files = files.map((f) => ({ ...f, status: "ready" }));
    st.clips = clips.sort((a, b) => a.createdAt - b.createdAt);
    st.reports = reports;
    if (!(await store.ok())) setStatus("b-store-status", "이 브라우저에서는 자료를 보관할 수 없습니다. 창을 닫으면 올린 자료와 캡처가 사라집니다.", true);
    let saved = null;
    try {
      saved = localStorage.getItem("uijeong.budget.dept");
    } catch (e) {
      /* 무시 */
    }
    if (saved) st.dept = saved;
    renderDepts();
    renderFiles();
    updateClipCount();
    renderReports();
    refresh();
  }

  function wire() {
    $("b-year-s").value = st.years.settlement;
    $("b-year-b").value = st.years.budget;
    $("b-year-s").addEventListener("change", () => (st.years.settlement = Number($("b-year-s").value) || st.years.settlement));
    $("b-year-b").addEventListener("change", () => (st.years.budget = Number($("b-year-b").value) || st.years.budget));
    $("b-dept").addEventListener("change", () => {
      let v = $("b-dept").value;
      if (v === "__new") {
        v = (prompt("부서 이름을 적어 주세요 (예: 주택실 공공주택과)") || "").trim();
        if (!v) return renderDepts();
      }
      st.dept = v;
      try {
        localStorage.setItem("uijeong.budget.dept", v);
      } catch (e) {
        /* 무시 */
      }
      closeViewer();
      renderDepts();
      renderFiles();
      updateClipCount();
      renderClips();
      renderReportSources();
      renderReports();
      $("b-hits").replaceChildren();
      setStatus("b-search-status", "");
    });
    for (const b of document.querySelectorAll("#budget-room .room-tabs button")) b.addEventListener("click", () => switchPane(b.dataset.pane));

    const drop = $("b-drop");
    const input = $("b-file-input");
    drop.addEventListener("click", () => input.click());
    drop.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        input.click();
      }
    });
    input.addEventListener("change", () => {
      addFiles([...input.files]);
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
      addFiles([...e.dataTransfer.files]);
    });

    $("b-search-form").addEventListener("submit", (e) => {
      e.preventDefault();
      runSearch();
    });

    $("b-prev").addEventListener("click", () => st.open && st.open.page > 1 && (st.open.page--, renderPage()));
    $("b-next").addEventListener("click", () => {
      const o = st.open;
      if (!o) return;
      const total = o.pdf ? o.pdf.numPages : o.file.pages.length;
      if (o.page < total) {
        o.page++;
        renderPage();
      }
    });
    $("b-page").addEventListener("change", () => {
      const o = st.open;
      if (!o) return;
      const total = o.pdf ? o.pdf.numPages : o.file.pages.length;
      o.page = Math.min(Math.max(1, Number($("b-page").value) || 1), total);
      renderPage();
    });
    $("b-close").addEventListener("click", closeViewer);
    for (const b of document.querySelectorAll("#b-tools button[data-tool]")) b.addEventListener("click", () => pickTool(b.dataset.tool));
    $("b-undo").addEventListener("click", () => {
      marksOf().pop();
      saveMarks();
      drawMarks();
    });
    $("b-clear").addEventListener("click", () => {
      if (!marksOf().length || !confirm("이 쪽의 표시를 모두 지울까요?")) return;
      marksOf().length = 0;
      saveMarks();
      drawMarks();
    });
    $("b-cap-page").addEventListener("click", () => captureClip(null));
    wireInk();
    pickTool("pen");

    $("b-pdf").addEventListener("click", makePdf);
    $("b-print").addEventListener("click", printSheets);

    for (const b of document.querySelectorAll("#b-cats .type")) b.addEventListener("click", () => pickCategory(b.dataset.cat));
    $("b-write").addEventListener("click", () => writeReport());
    $("b-continue").addEventListener("click", () => writeReport({ continueFrom: true }));
    $("b-stop").addEventListener("click", () => controller && controller.abort());
    $("b-dl-hwpx").addEventListener("click", () => saveFile("hwpx"));
    $("b-dl-docx").addEventListener("click", () => saveFile("docx"));
    $("b-dl-md").addEventListener("click", () => saveFile("md"));
    $("b-copy").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(st.markdown);
        setStatus("b-dl-status", "마크다운을 복사했습니다.");
      } catch (e) {
        setStatus("b-dl-status", "복사하지 못했습니다.", true);
      }
    });

    let pane = "room";
    try {
      pane = localStorage.getItem("uijeong.budget.pane") || "room";
    } catch (e) {
      /* 무시 */
    }
    switchPane(["room", "clips", "report"].includes(pane) ? pane : "room");
    pickCategory("decrease");
    load();

    const use = window.claude && window.claude.use ? window.claude.use.bind(window.claude) : null;
    if (use) {
      use("downloads").then((d) => (downloads = d)).catch(() => {});
      use("sample")
        .then((s) => {
          sample = s;
          refresh();
        })
        .catch(() => {});
    }
  }

  wire();
})();
