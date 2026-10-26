# 의정지원 시스템 핸드오버 — 2026-10-25

> 작성일: 2026-10-25 | 작성: 사용자(랑랑) + 총비서 해일심(Claude) | 검수: 랑랑별
> 저장소: https://github.com/a01026886152-prog/solidarity-intelligence-wiki
> 정책지원관 지원시스템: `https://talk.sakyowon.co.kr/system` (로그인 필요) · 의정지원 웹 화면: https://claude.ai/artifact/7VZmHCHttWHQAbGouRX7r9

## 한 줄 요약

PC의 Claude Desktop 앱과 Claude in Chrome을 연결해, 지원시스템 행감 자료실(기관 카드)과 뉴스를 함께 검색하는 `/policy-research`를 만들고 실제로 돌려 봤다. 비공개 자료 확인 단계, 결과 Markdown 저장, 총비서 해일심·검수AI 랑랑별 체계, `정리해` 명령을 저장소 규칙으로 넣었다.

## 오늘 완료한 작업

| 커밋·PR | 작업 |
|---------|------|
| `b79c468` `338226f` `ccece29` `e00b4f0` / [#3](https://github.com/a01026886152-prog/solidarity-intelligence-wiki/pull/3) | `/policy-research` 스킬 추가. 비공개·대외비 표시 자료는 쓰기 전에 내부 규정 확인 여부를 묻는 단계를 모든 스킬과 웹 화면에 넣음(웹 화면은 다시 게시함) |
| `d4321b6` / [#4](https://github.com/a01026886152-prog/solidarity-intelligence-wiki/pull/4) | 자료함 검색을 행감 자료실의 기관 카드 구조에 맞춤(주제에 맞는 카드 1~3개를 골라 카드 안에서 검색, 출처에 기관 표시) |
| `ba4e5b1` `df76925` / [#5](https://github.com/a01026886152-prog/solidarity-intelligence-wiki/pull/5) | 결과를 항상 Markdown으로 저장(`uijeong/outputs/research/`, `*.검수.md`는 GitHub 제외). `CLAUDE.md`에 해일심·랑랑별 역할, 근거 자료 표시, 검수 절차, `정리해` 규칙. 랑랑별 서브에이전트, `wrap-up` 스킬, `docs/wrap-up-command.md` 추가 |
| `75eb0a9` `cfe5356` `41a067d` / [#6](https://github.com/a01026886152-prog/solidarity-intelligence-wiki/pull/6) | `docs/claude-chrome-setup-guide.md` 연결·시험 가이드(랑랑별 1·2차 검수 반영), 이 핸드오버, 위키 how-to. 검수 보고서 2번째 판도 GitHub에서 빠지게 `.gitignore`를 `*.검수*.md`로 넓힘 |

## 내린 결정과 이유

- **자료함은 PC 세션 + Claude in Chrome으로 읽는다** — 지원시스템이 로그인을 요구해서. 클라우드 세션은 PC의 Chrome에 닿지 못한다.
- **자료함 위치는 '의정활동 > 행감 자료실'** — 사용자가 정함.
- **결과는 항상 Markdown으로 저장하되, 자료함 내용이 든 `uijeong/outputs/research/`는 GitHub에 올리지 않는다** — 사용자의 '항상 저장' 요청과 내부 자료 보호를 함께 만족시키려고(해일심 제안).
- **총비서 = 해일심, 검수AI = 랑랑별** — 사용자 요청 문장이 두 가지로 읽혀 해일심이 이렇게 해석함. 사용자 확인을 기다리는 중(남은 작업 5번).
- **PR 머지는 사용자가 지시할 때만** — 오늘 #3·#4·#5 모두 사용자 지시로 머지함.

## 어디에 무엇이 있나

| 항목 | 위치 |
|------|------|
| 작업 규칙(해일심·랑랑별·출처·검수·정리해) | `CLAUDE.md` |
| 검수AI 랑랑별 | `.claude/agents/rangrang-byeol.md` |
| 자료함·뉴스 검색 스킬 | `.claude/skills/policy-research/SKILL.md`, `template.md` |
| 정리해 스킬 | `.claude/skills/wrap-up/SKILL.md`, `handover-template.md` |
| 연결·시험 가이드 | `docs/claude-chrome-setup-guide.md` |
| 정리해 사용법 | `docs/wrap-up-command.md` |
| PC 저장소 | `C:\Users\user\Documents\solidarity-intelligence-wiki` |
| PC에서만 고친 설정(지원시스템 주소, 자료함 위치) | PC의 `uijeong/profile.md` — 커밋하지 않음. git 관리 파일이라 커밋하면 GitHub에 올라감 |
| 오늘 시험한 브리핑(청년안심주택) | PC 세션 '청년안심주택 공실 현황 및 자료'의 대화. 파일 저장 여부는 확인 못 함 |

## 남은 작업

1. **시험 마저 하기** — 비공개 표시 자료를 열기 전에 묻는지(⑥), 해일심이 문서를 만들 때 랑랑별을 부르고 검수 기록을 붙이는지(⑩), PC 세션에서 `정리해`가 도는지(⑪)를 PC 새 세션에서 확인한다. 시험표: `docs/claude-chrome-setup-guide.md` 5절.
2. **웹 화면 다시 묶기(선택)** — 웹 화면은 스킬 4개(행감·조례안·사업계획서·발언)만 묶는다(`uijeong/web/build.py`의 `SKILLS`, `policy-research`는 없음). #5에서 이 4개에 '랑랑별 검수' 체크리스트 한 줄이 늘었지만 웹 화면에는 아직 빠져 있다. 웹 화면은 랑랑별을 부를 수 없어 실제 동작 차이는 작다. 맞추려면 `python3 uijeong/web/build.py` 후 같은 주소에 다시 게시한다.
3. **비공개 판단 기준 넓히기(사용자 결정 대기)** — 첫 시험 때 출처에 '내부 규정' 종류 자료가 섞였다. 이런 자료도 늘 묻게 할지. 정하면 `audit-issue-report/SKILL.md`의 '비공개 자료 확인'과 `policy-research`, 웹 화면의 표시 낱말을 함께 고친다.
4. **해일심·랑랑별 역할 해석 확인(사용자 답 대기)** — 다르게 의도했으면 `CLAUDE.md`와 `.claude/agents/rangrang-byeol.md`를 고친다.

5. **Chrome 툴바의 Claude 패널은 페이지 읽기가 실패함(2026-10-26 확인)** — 패널은 열리고 대답도 하지만, 네이버에서 요소 찾기·페이지 텍스트 읽기가 실패했다. `chrome://policy`에 조직 정책 `ScreenCaptureAllowed = false`가 있어 가장 유력한 원인으로 본다(문서 보안 프로그램 정책으로 추정, 확인 안 됨). 확장 프로그램을 막는 정책(`ExtensionSettings`)은 없었다. Desktop 앱 → Chrome 조작(자료함 검색)은 2026-10-25에 정상 동작했으니 의정지원 작업은 Desktop 앱에서 한다. 패널이 꼭 필요하면 전산 담당에게 정책 예외를 문의한다. **정정(같은 날 오후)**: 이후 패널이 지원시스템에서 작업 10개를 실행해 한강버스 질의서(Claude Docs 문서)를 만들었다. 오전의 실패는 일시적이었을 수 있고, `ScreenCaptureAllowed`가 원인이라는 추정은 약해졌다.

### 사용자가 직접 해야 할 일

- 오늘 브리핑의 숫자(예: 기사 속 보증금 미반환 금액)를 기사·자료 원문과 직접 대조하기
- PC의 '변경 사항' 패널에서 **PR 생성**을 누르지 않기(`profile.md`가 올라감)
- Chrome 작업 표시줄·툴바 고정, 지원시스템 바로가기 만들기(방법은 '클로드크롬 연결' 세션에서 안내함)

## 다음에 이어서 할 때

첫 메시지 예시: `어제 핸드오버 읽고, 남은 작업 1번 시험부터 이어서 하자`

---

## 스킬

### 1. Windows PC에서 Claude in Chrome 연결하기
Git 설치 → 저장소 clone → Desktop 앱 '이 컴퓨터' 세션에서 폴더 열기 → Chrome(Edge 아님)에 확장 설치·OAuth 승인 → 새 탭 열기로 연결 확인. 절차 전체는 `docs/claude-chrome-setup-guide.md`.

### 2. 카드형 자료함 검색
자료함이 기관별 카드로 나뉘어 있으면, 주제를 `uijeong/knowledge/committee-2026.md` 소관 업무표와 맞춰 카드를 고른 뒤 카드 안에서 검색하고, 카드별 건수(0건 포함)를 남긴다. `.claude/skills/policy-research/SKILL.md` '기관 카드 고르기와 검색'.

## 레슨

### 1. Claude in Chrome은 자기 탭 그룹만 본다
'Chrome에 열린 탭 목록'으로 연결을 확인하려 했더니 목록이 비어 있었다. Claude는 자기 탭 그룹 안에서 작업하고, 사용자가 연 탭은 보이지 않는다([출처: Get started with Claude in Chrome, Anthropic 고객지원](https://support.claude.com/en/articles/12012173-get-started-with-claude-in-chrome), 랑랑별 확인). 연결 확인은 "주소를 새 탭으로 열고 화면을 설명해 줘"로 하고, 로그인도 Claude가 연 탭에서 한다.

### 2. 브라우저와 세션 종류부터 확인한다
확장 프로그램 페이지를 Edge에서 열거나, claude.ai 웹 채팅·클라우드 세션에서 시험하려다 막혔다. 'Chrome인가', 'Desktop 앱의 이 컴퓨터 세션인가'를 먼저 화면으로 확인하면 헛걸음이 준다.

### 3. 검수AI가 실제로 틀린 설명을 잡았다
연결 가이드 초안에 "`profile.md`는 GitHub에 올리지 않음"이라고 썼는데, 랑랑별이 `git ls-files`로 git 관리 파일임을 확인해 높음으로 지적했다. 기억으로 쓴 설명도 저장소에서 다시 확인해야 한다.

### 4. 관리자 PowerShell은 시작 위치가 시스템 폴더다
`C:\Windows\system32`에서 그대로 clone하면 시스템 폴더에 받아진다. 받기 전에 `cd $HOME\Documents`로 옮긴다.

---

## 근거 자료 목록

| 번호 | 자료 이름 | 바로가기 링크 또는 저장 위치 | 쪽·위치 | 확인한 날짜 |
|---|---|---|---|---|
| 1 | 오늘 커밋 | `git log --since="2026-10-25" origin/master`, 브랜치 `claude/pensive-edison-mkabwp` | 위 '완료한 작업' 표의 해시 | 2026-10-26 |
| 2 | PR #3·#4·#5 | [#3](https://github.com/a01026886152-prog/solidarity-intelligence-wiki/pull/3), [#4](https://github.com/a01026886152-prog/solidarity-intelligence-wiki/pull/4), [#5](https://github.com/a01026886152-prog/solidarity-intelligence-wiki/pull/5) | 설명·머지 기록 | 2026-10-25 |
| 3 | 설정·시험 대화 기록 | Claude Desktop 앱 > Code > 최근 항목 > '클로드크롬 연결' 세션(사용자 화면 캡처 포함), PC 세션 'Chrome 열린 탭 목록'·'청년안심주택 공실 현황 및 자료'·'너 누구야?' | 대화 전체 | 2026-10-25 |
| 4 | 랑랑별 1차 검수 보고서 | `docs/claude-chrome-setup-guide.md.검수.md` (클라우드 세션에만 있음, GitHub 제외) | 지적 1번(높음) | 2026-10-25 |
| 5 | git 관리 대상 | `.gitignore` | `uijeong/outputs/research/`, `*.검수.md` | 2026-10-26 |

---

## 검수 기록

- 검수자: 랑랑별 · 2026-10-26 · 지적 높음 0 / 중간 1 / 낮음 5 · 고친 수 6
  - 고친 것: 연결 가이드 커밋 상태를 실제 해시(`cfe5356`, PR #6)로 정정, 웹 화면 영향 설명 정정, 레슨 1에 공식 도움말 출처, 공개 문서에서 자료함 파일명 삭제, 안내 위치를 세션 이름으로, 검수 기록 작성
- 남은 확인 필요: 없음
- 2026-10-26 추가: 남은 작업 5번(패널 실패와 조직 정책)은 검수 뒤에 사용자 화면(`chrome://policy`)을 보고 덧붙였다.
