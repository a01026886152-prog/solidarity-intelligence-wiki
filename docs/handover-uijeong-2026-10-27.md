# 의정지원 시스템 핸드오버 — 2026-10-27

> 작성일: 2026-10-27 | 작성: 사용자(랑랑) + 총비서 해일심(Claude) | 검수: 랑랑별
> 저장소: https://github.com/a01026886152-prog/solidarity-intelligence-wiki
> 사교원 의정지원 시스템: `https://talk.sakyowon.co.kr/system` (로그인 필요)
> 직전 핸드오버: [`docs/handover-uijeong-2026-10-25.md`](handover-uijeong-2026-10-25.md) (10-26 작업 일부도 거기 덧붙임)

## 한 줄 요약

사교원 행감 자료실 자료를 근거로 쓸 때 **기관 카드 이름 + 파일 이름(확장자까지) + 쪽·표 + 찾기어**를 적고, 근거 대목만 모은 **발췌집**을 PC에 남기는 규칙을 만들었다. "근거 n번 열어줘"로 해일심이 Chrome에서 문건을 찾아 열게 했다. Chrome 툴바 Claude 패널도 설정을 마쳐 동작을 확인했다.

## 완료한 작업

| 커밋·PR | 작업 |
|---------|------|
| `cfe5356` `41a067d` `25a8a7c` / [#6](https://github.com/a01026886152-prog/solidarity-intelligence-wiki/pull/6) (10-26 머지) | 10-25 정리해 결과(핸드오버, 연결 가이드, 위키 how-to). 검수 보고서 2번째 판도 GitHub에서 빠지게 `.gitignore`를 `*.검수*.md`로 넓힘 |
| `389567a` `b768d88` / [#7](https://github.com/a01026886152-prog/solidarity-intelligence-wiki/pull/7)에 포함 | 10-25 핸드오버에 Chrome 패널 실패와 조직 정책을 적었다가, 오후에 패널이 동작한 것을 반영해 원인 추정을 정정 |
| `de984fd` / [#7](https://github.com/a01026886152-prog/solidarity-intelligence-wiki/pull/7) (10-27 머지) | 새 기준자료 `uijeong/knowledge/sakyowon-archive.md`: 자료실 화면 구조, 카드 이름 표, 근거 표기 형식, 찾는 법, 문건 열기·출력 절차, 누르지 않는 버튼. `CLAUDE.md`, `/policy-research`, `/audit-issue-report`, 랑랑별이 이 기준을 따름 |
| `36bca16` / [#8](https://github.com/a01026886152-prog/solidarity-intelligence-wiki/pull/8) (10-27 머지) | 근거마다 원문 그대로의 **찾기어**(8~20자), 근거 대목만 모은 **발췌집**(`uijeong/outputs/research/날짜-주제.발췌.md`). 랑랑별이 발췌집으로 숫자·인용 대조. `*.발췌.md`는 GitHub 제외 |

## 내린 결정과 이유

- **근거 표기는 화면 표기 그대로** — 카드 이름·파일 이름을 줄이거나 다듬으면 다시 찾을 수 없어서(사용자 요청).
- **등록일은 지어내지 않는다** — 자료 목록에 등록일 칸이 없음을 화면으로 확인함(2026-10-26 사용자 화면).
- **찾기어·발췌집 추가** — Chrome 패널 Claude가 따로 만든 패치에 있던 아이디어를 사용자가 고름. 그 패치 자체(`docs/citation-sakyowon.md` 신설, `b352dee` 기준)는 PR #7과 겹치고 기준 시점이 옛날이라 적용하지 않음(해일심 권고, 사용자 동의).
- **발췌집은 GitHub에 올리지 않는다** — 자료함 원문 대목이 들어가서.
- **인쇄 창은 Claude가 띄우지 않는다** — 인쇄 창이 뜨면 Chrome 조작이 멈추므로 출력은 사용자가 한다.
- **공개 위키 작성자 이름은 '랑랑'** — 사용자가 그대로 두라고 함.

## 어디에 무엇이 있나

| 항목 | 위치 |
|------|------|
| 자료실 근거 기준(카드 표, 형식, 찾기어, 발췌집, 열기·출력, 누르지 않는 버튼) | `uijeong/knowledge/sakyowon-archive.md` |
| 근거 표기 규칙 요약 | `CLAUDE.md` '근거 자료 표시' 2번 |
| 자료함·뉴스 검색 스킬과 답변 서식 | `.claude/skills/policy-research/SKILL.md`, `template.md` |
| 검수AI | `.claude/agents/rangrang-byeol.md` |
| Chrome 패널이 만든 한강버스 질의서 | claude.ai Claude Docs '2026 행정사무감사 질의서 — 한강버스(서울주택도시개발공사)' (저장소 밖, 랑랑별 검수 안 거침) |
| PC 저장소 | `C:\Users\user\Documents\solidarity-intelligence-wiki` (10-27 `git pull`로 PR #7까지 받음) |

## 남은 작업

1. **문건 열기·출력 확인** — 행감 자료실 자료 목록에서 파일 이름을 누르면 열리는지, 내려받아지는지, 반응이 없는지 화면으로 확인하고 `sakyowon-archive.md` 5절을 확정한다.
2. **카드 안 '자료 안에서 찾기' 확인** — Chrome 패널 답변에 이 검색 기능이 언급됨. 실제로 있으면 `sakyowon-archive.md` 3절 6번(찾기어)과 4절을 고친다.
3. **PC에서 새 규칙 시험** — `git pull`(PR #8까지) → 새 세션에서 `/policy-research 한강버스 SH 손실과 운항 현황, 자료함이랑 최근 뉴스` → 문서 끝 찾기어 칸, `uijeong/outputs/research/…발췌.md`, "근거 1번 열어줘"를 확인한다.
4. **한강버스 질의서 다듬기** — 패널이 만든 Claude Docs 질의서는 SH 투입액이 기사마다 다르다(1,072억·1,090억·1,141억, 패널 Claude의 보고). SH 제출자료로 확정하고, Desktop 앱에서 근거 형식·발췌집·랑랑별 검수를 거친다.
5. **10-25 핸드오버의 남은 작업 1~4 그대로** — 비공개 확인·랑랑별·정리해 시험, 웹 화면 다시 묶기, 비공개 기준 넓히기, 해일심·랑랑별 역할 해석 확인.

### 사용자가 직접 해야 할 일

- PC에서 `git pull` (PR #8 반영)
- 위 1·2번 화면 확인 (파일 이름 눌러 보기, 카드 안 검색창 유무)
- 다른 AI(Chrome 패널 등)가 내놓은 `git apply`·`git add` 같은 명령은 실행 전에 해일심에게 확인받기

## 다음에 이어서 할 때

첫 메시지 예시: `어제 핸드오버 읽고, 남은 작업 1번(파일 열기 확인)부터 이어서 하자`

---

## 스킬

### 1. 카드형 자료실의 근거 표기
근거를 `[출처: 사교원 행감 자료실 > {카드 이름} > {파일 이름}, {쪽·표}]`로 쓰고, 문서 끝 표에 저장 위치·찾기어·파일 정보·확인일을 둔다. 다시 찾아갈 수 있는지가 기준이다. `uijeong/knowledge/sakyowon-archive.md` 3절.

### 2. 접근 못 하는 검수자를 위한 발췌집
검수AI가 로그인 사이트에 못 들어가도, 근거 대목을 원문 그대로 모은 발췌집이 있으면 숫자·인용을 대조할 수 있다. 원문이 들어가므로 GitHub에 올리지 않는 폴더에 둔다. `sakyowon-archive.md` '근거 발췌집'.

## 레슨

### 1. AI가 만든 문서는 '근거로 쓴 자료' 목록부터 본다
사교원 사이트 '문서 작성'으로 한강버스 질의서를 만들었을 때, 근거 자료함을 주택실로 두니 다른 답이 나왔고, SH로 바꾸니 주제는 맞았지만 '근거로 쓴 자료'에 한강버스와 관계없는 파일(보도자료 목록, 주민참여공연 결과보고 등)이 붙었다. 근거 목록이 주제와 맞지 않으면 본문은 근거 없이 쓴 것일 수 있다.

### 2. 원인 추정은 다시 시험해 보고 정한다
Chrome 패널이 페이지를 못 읽자 조직 정책(`ScreenCaptureAllowed = false`)을 원인으로 추정해 핸드오버에 적었는데, 같은 날 오후 패널이 정상 동작했다. 추정은 '추정'으로 적고, 반대 증거가 나오면 바로 정정한다.

### 3. Chrome 자체 페이지에서는 확장 프로그램이 동작하지 않는다
새 탭 페이지·`chrome://` 페이지에서는 Claude 패널이 페이지를 읽지 못했다(패널 Claude도 같은 이유를 댐). 시험은 일반 웹사이트에서 한다.

### 4. 다른 AI가 만든 패치는 기준 시점부터 본다
Chrome 패널 Claude가 `git apply`용 패치를 내놨지만, 이미 합친 변경과 겹치고 옛 시점(`b352dee`) 기준이었다. 그대로 적용했으면 규칙 파일이 두 군데로 갈라졌을 것이다. 좋은 아이디어만 골라 현재 기준자료에 합쳤다.

---

## 근거 자료 목록

| 번호 | 자료 이름 | 바로가기 링크 또는 저장 위치 | 쪽·위치 | 확인한 날짜 |
|---|---|---|---|---|
| 1 | 10-26~27 커밋 | `git log --since=2026-10-26 origin/master` | 위 '완료한 작업' 표의 해시 | 2026-10-27 |
| 2 | PR #6·#7·#8 | [#6](https://github.com/a01026886152-prog/solidarity-intelligence-wiki/pull/6), [#7](https://github.com/a01026886152-prog/solidarity-intelligence-wiki/pull/7), [#8](https://github.com/a01026886152-prog/solidarity-intelligence-wiki/pull/8) | 설명·머지 기록 | 2026-10-27 |
| 3 | 사용자 화면 캡처와 대화 | Claude Desktop 앱 > Code > '클로드크롬 연결' 세션 (10-26~27 대화: Chrome 패널 설정, `chrome://policy`, 사교원 문서 작성 결과, 패널의 패치 안내, PowerShell `git pull`) | 대화 전체 | 2026-10-27 |
| 4 | 자료실 근거 기준 | [`uijeong/knowledge/sakyowon-archive.md`](../uijeong/knowledge/sakyowon-archive.md) | 1~5절 | 2026-10-27 |

---

## 검수 기록

- 검수자: 랑랑별 · (검수 후 채움)
