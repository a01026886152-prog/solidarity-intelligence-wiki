# Claude in Chrome 연결과 자료함·뉴스 검색 시스템 시험 가이드

> **한 줄 요약**: Windows PC에서 Claude Desktop 앱과 Claude in Chrome을 연결해, 정책지원관 지원시스템 행감 자료실과 뉴스를 함께 검색하는 `/policy-research`를 쓰고 시험하는 방법입니다.

**작성일**: 2026-10-25 · **작성**: 총비서 해일심(Claude) · **검수**: 랑랑별 · **대상**: 의정지원 저장소 사용자

본문의 `[근거 n]`은 문서 끝 '근거 자료 목록'의 번호입니다.

---

## 1. 전체 구조

| 창 | 하는 일 |
|---|---|
| **Chrome** | 정책지원관 지원시스템에 로그인해 두는 곳. Claude가 이 Chrome을 조작한다. [근거 2] |
| **Claude Desktop 앱 → '이 컴퓨터' 세션** | 명령을 보내는 곳. 저장소 폴더를 열어야 스킬이 보인다. [근거 3] |
| **클라우드 세션**(Desktop 앱 목록에서 구름 아이콘이 붙은 세션) | PC의 Chrome에 닿지 못한다. 자료함 검색은 여기서 하지 않는다. [근거 3][근거 7] |

## 2. 처음 한 번만 하는 준비

### 2-1. Git 설치와 저장소 받기 [근거 7]

PowerShell에서 한 줄씩 입력한다.

```
winget install --id Git.Git -e --source winget
```

설치가 끝나면 PowerShell을 닫았다가 새로 열고 입력한다.

```
git --version
cd $HOME\Documents
git clone https://github.com/a01026886152-prog/solidarity-intelligence-wiki.git
```

- 받은 위치: `C:\Users\user\Documents\solidarity-intelligence-wiki`
- 시작 위치가 `C:\Windows\system32`이면 그대로 받지 말고 먼저 `cd $HOME\Documents`로 옮긴다.
- Windows '이 응용 프로그램은 관리자 보호로 실행할 수 없습니다' 알림이 떠도 보안 설정은 바꾸지 말고 닫는다. 2026-10-25 시험에서는 이 알림이 떠도 `git --version`이 `git version 2.56.0.windows.3`으로 나와 설치가 끝나 있었다.

### 2-2. Desktop 앱에서 세션 열기 [근거 7]

1. **새로 만들기**를 누르고, 입력창 아래가 **`이 컴퓨터`** 인지 확인한다.
2. **`선택...` → 폴더 열기...** 에서 `폴더:` 칸에 `C:\Users\user\Documents\solidarity-intelligence-wiki`를 붙여넣고 **폴더 선택**을 누른다.
3. '이 워크스페이스를 신뢰하시겠습니까?' 창에서 **작업 공간 신뢰**를 누른다.
4. '인증 실패 · 재시도 중'이 뜨면 1분쯤 기다린다. 2026-10-25 시험에서는 기다리는 사이 저절로 풀렸다. 계속 실패하면 앱을 업데이트하거나 다시 로그인한다.

### 2-3. Claude in Chrome 설치 [근거 5][근거 7]

1. **Chrome**(Edge가 아님)에서 Claude 확장 프로그램 페이지를 연다: [출처: Claude, Chrome 웹 스토어 (게시자 표시 claude.com)](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn). Edge에서 열면 'Claude는 Microsoft Edge에서 작동합니다' 안내가 뜨는데, Chrome에서 다시 연다.
2. **Chrome에 추가**를 누른다. 버튼이 안 보이면 창을 최대화한다. **Chrome에서 삭제**가 보이면 이미 설치된 것이다.
3. 'Claude for Chrome 앱에서 내 Claude chat account 연결을 요청합니다' 화면(주소 `claude.ai/oauth/authorize...`)에서 아래쪽 로그인 계정이 Desktop 앱과 같은지 확인하고 **승인**을 누른다.
4. 'Chrome에 Claude가 있습니다' 페이지(`claude.ai/chrome/installed`)가 나오면 끝이다.

### 2-4. 연결 확인 [근거 2][근거 7]

Desktop 앱 세션에 보낸다.

```
https://talk.sakyowon.co.kr/system 을 새 탭으로 열고, 화면에 뭐가 보이는지 알려줘
```

Chrome에 새 탭이 열리고 화면 내용을 설명하면 연결된 것이다.

- Claude는 **자기 탭 그룹 안의 탭만** 본다. 사용자가 직접 연 탭이 탭 목록에 없는 것은 정상이다.
- 로그인은 Claude가 연 탭에서 사용자가 직접 한다. Claude는 비밀번호를 입력하지 않는다.

## 3. 지원시스템 계정과 자료함 [근거 6][근거 7]

- 주소: `https://talk.sakyowon.co.kr/system`
- 로그인 화면 안내문: "자료회원·직원회원·관리자 계정만 들어올 수 있습니다(가입 후 관리자 승인 필요)". 승인되지 않은 계정은 관리자 승인을 받아야 한다.
- 자료함 위치: 왼쪽 메뉴 **의정활동 > 행감 자료실**. 기관별 자료함 카드(서울주택도시개발공사(SH), 주택실, 디지털도시국, 미래공간기획관 등)로 나뉘어 있고, 카드에 들어가야 검색할 수 있다.
- 2026-10-25 시험 때 PC 세션이 지원시스템 주소와 자료함 위치를 PC의 `uijeong/profile.md`에 적었고, 커밋은 하지 않았다고 보고했다.
- **주의**: `uijeong/profile.md`는 git이 관리하는 파일이다. Desktop 앱 오른쪽 '변경 사항'의 **PR 생성**을 누르거나 커밋하면 GitHub에 올라간다. 올리지 않으려면 누르지 않는다. [근거 8]

## 4. 쓰는 법 [근거 2]

```
/policy-research 청년안심주택 공실 현황, 자료함이랑 최근 뉴스
```

- 해일심이 주제에 맞는 기관 카드(예: 주택실 + SH)를 골라 검색하고, 뉴스를 찾아 출처를 단 답변을 쓴다.
- 문서를 넘기기 전에 검수AI 랑랑별이 근거·링크·수치를 다시 검토한다. [근거 1]
- 답변은 `uijeong/outputs/research/`에 Markdown으로 저장된다. 이 폴더는 GitHub에 올라가지 않는다. [근거 8]
- 2026-10-25 시험에서 해일심은 답변 끝에 행감 쟁점보고서·질의서(`/audit-issue-report`)로 이어 갈 수 있다고 제안했다. 이 연결은 아직 시험하지 않았다. `/audit-issue-report`는 올린 자료가 없으면 무엇을 올릴지 안내하고 멈추게 되어 있으니, 브리핑 파일이나 원자료를 함께 넘겨야 한다. [근거 7][근거 9]

## 5. 시험표 [근거 7]

| 순서 | 확인할 것 | 2026-10-25 시험 결과 |
|---|---|---|
| ① | Chrome 연결 | 됨 — '이번에는 Chrome 확장 프로그램과 연결됐습니다' |
| ② | 지원시스템 접속(새 탭으로 열고 화면 읽기) | 됨 — 로그인 화면의 제목·안내문·입력칸을 설명 |
| ③ | 자료함 검색(기관 카드 안에서) | 됨 — 출처 목록에 주택실 카드 자료 6건이 '— 주택실, 행감 요구자료'처럼 기관·자료 종류와 함께 나옴. 등록일은 '화면에 표시되지 않음'으로 적음 |
| ④ | 뉴스 검색(언론사·날짜·링크) | 됨 — MTN·헤럴드경제·인사이트 기사와 서울 열린데이터광장 자료 |
| ⑤ | 답변 형식(자료함·뉴스 구분, 확인 필요, 출처 목록) | 됨 — '확인 필요'와 '6. 출처 목록'(자료함 / 뉴스·공개자료로 구분)이 나옴 |
| ⑥ | 비공개 표시 자료를 열기 전에 묻는지 | 아직 확인 못 함 |
| ⑦ | 답변의 숫자를 원문과 직접 대조 | 사용자가 확인해야 함 |
| ⑧ | 자료함에 쓰기·삭제를 하지 않았는지 | Claude가 '자료함은 읽기만 했고 아무것도 올리거나 만들지 않았다'고 보고함. 사용자가 자료실에서 직접 확인해야 함 |
| ⑨ | 총비서 해일심으로 소개하는지 | 됨 — '저는 이 저장소에서 일하는 총비서 해일심입니다' |
| ⑩ | 랑랑별 검수와 문서 끝 검수 기록 | 아직 확인 못 함 |
| ⑪ | `정리해`로 핸드오버·위키 문서 생성 | 아직 확인 못 함 |

## 6. 작업을 마칠 때 [근거 4]

```
정리해
```

핸드오버, 그날 배운 스킬·레슨, 위키 문서를 만들고 랑랑별 검수를 거친 뒤 GitHub에 올려도 되는지 묻는다. 자세한 내용은 [`docs/wrap-up-command.md`](wrap-up-command.md)에 있다.

---

## 근거 자료 목록

| 번호 | 자료 이름 | 바로가기 링크 또는 저장 위치 | 쪽·위치 | 확인한 날짜 |
|---|---|---|---|---|
| 1 | 작업 규칙 | [`CLAUDE.md`](../CLAUDE.md) (저장소 맨 위) | '이름과 역할', '근거 자료 표시', '검수 절차' | 2026-10-25 |
| 2 | 자료함·뉴스 검색 스킬 | [`.claude/skills/policy-research/SKILL.md`](../.claude/skills/policy-research/SKILL.md) | 2~3단계, '기관 카드 고르기와 검색', 7단계 | 2026-10-25 |
| 3 | 의정지원 자동화 시스템 안내 | [`uijeong/README.md`](../uijeong/README.md) | '자료함 검색 (`/policy-research`)' | 2026-10-25 |
| 4 | 정리해 사용법 | [`docs/wrap-up-command.md`](wrap-up-command.md) | 전체 | 2026-10-25 |
| 5 | Claude 확장 프로그램 (공식 안내: [Get started with Claude in Chrome, Anthropic 고객지원](https://support.claude.com/en/articles/12012173-get-started-with-claude-in-chrome)) | [출처: Claude, Chrome 웹 스토어](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn) | 상세 페이지(게시자 표시 claude.com) | 2026-10-25, 사용자 화면 캡처 |
| 6 | 정책지원관 지원시스템 | `https://talk.sakyowon.co.kr/system` (로그인 필요) | 로그인 화면 안내문, 왼쪽 메뉴 '의정활동 > 행감 자료실' | 2026-10-25, 사용자 화면 캡처 |
| 7 | 2026-10-25 설정·시험 기록 | Claude Desktop 앱 > Code > 최근 항목 > **'클로드크롬 연결'** 세션 대화(사용자가 보낸 PowerShell·Chrome·Desktop 앱 화면 캡처 포함). PC 세션 결과는 같은 목록의 **'Chrome 열린 탭 목록'**, **'청년안심주택 공실 현황 및 자료'**, **'너 누구야?'** 세션 | 해당 세션 대화 전체 | 2026-10-25 |
| 8 | git 관리 대상 설정 | [`.gitignore`](../.gitignore) (`uijeong/outputs/research/`, `*.검수.md`가 들어 있고 `profile.md`는 없음) | 전체 | 2026-10-25 |
| 9 | 행감 쟁점보고서 스킬 | [`.claude/skills/audit-issue-report/SKILL.md`](../.claude/skills/audit-issue-report/SKILL.md) | 2단계 1번 | 2026-10-25 |

---

## 검수 기록

- 1차 검수: 랑랑별 · 2026-10-25 · 지적 높음 1 / 중간 4 / 낮음 6 · 고친 수 10
  - 고친 것: `profile.md`를 GitHub에 올리지 않는다는 틀린 설명 정정, `/audit-issue-report` 연결을 '제안됨·시험 안 함'으로 정정, 시험표 ③⑤⑧을 캡처 근거로 다시 쓰고 ⑧은 Claude의 자기 보고로 표시, 본문에 `[근거 n]` 표시 추가, 캡처 근거(근거 7)를 찾아갈 수 있는 위치로 바꿈, 웹 스토어 출처 형식 정리, '일반이용자' 표현을 안내문 원문으로 바꿈
  - 고치지 않은 것: 저장소 주소의 계정 이름(사용자 본인 공개 계정이라 그대로 둠)
- 2차 검수: 랑랑별 · 2026-10-26 · 통과(조건부) · 지적 높음 0 / 중간 0 / 낮음 3
  - 조건이던 인용·세부(시험표 ①③④⑤⑨, 신뢰 창, '저절로 풀렸다', `claude.ai/chrome/installed`, 'Chrome에서 삭제')는 해일심이 사용자 캡처와 하나씩 대조해 모두 일치함을 확인함
- 남은 확인 필요: Chrome 웹 스토어 링크는 랑랑별이 직접 열지 못함(웹 검색과 사용자 캡처로 부분 확인). 지원시스템 화면은 로그인이 필요해 사용자 캡처로만 확인.
