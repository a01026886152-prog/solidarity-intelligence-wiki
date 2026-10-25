# Claude in Chrome 연결과 자료함·뉴스 검색 시스템 시험 가이드

> **한 줄 요약**: Windows PC에서 Claude Desktop 앱과 Claude in Chrome을 연결해, 정책지원관 지원시스템 행감 자료실과 뉴스를 함께 검색하는 `/policy-research`를 쓰고 시험하는 방법입니다.

**작성일**: 2026-10-25 · **작성**: 총비서 해일심(Claude) · **대상**: 의정지원 저장소 사용자

---

## 1. 전체 구조

| 창 | 하는 일 |
|---|---|
| **Chrome** | 정책지원관 지원시스템에 로그인해 두는 곳. Claude가 이 Chrome을 조작한다. |
| **Claude Desktop 앱 → '이 컴퓨터' 세션** | 명령을 보내는 곳. 저장소 폴더를 열어야 스킬이 보인다. |
| **클라우드 세션**(구름 아이콘) | PC의 Chrome에 닿지 못한다. 자료함 검색은 여기서 하지 않는다. |

## 2. 처음 한 번만 하는 준비

### 2-1. Git 설치와 저장소 받기

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
- Windows '관리자 보호' 알림이 떠도 보안 설정은 바꾸지 말고 닫는다. `git --version`이 나오면 설치된 것이다.

### 2-2. Desktop 앱에서 세션 열기

1. **새로 만들기**를 누르고, 입력창 아래가 **`이 컴퓨터`** 인지 확인한다.
2. **`선택...` → 폴더 열기...** 에서 `폴더:` 칸에 `C:\Users\user\Documents\solidarity-intelligence-wiki`를 붙여넣고 **폴더 선택**을 누른다.
3. '이 워크스페이스를 신뢰하시겠습니까?' 창에서 **작업 공간 신뢰**를 누른다.
4. '인증 실패 · 재시도 중'이 뜨면 1분쯤 기다린다. 계속 실패하면 앱을 업데이트하거나 다시 로그인한다.

### 2-3. Claude in Chrome 설치

1. **Chrome**(Edge가 아님)에서 Chrome 웹 스토어의 Claude 확장 프로그램 페이지를 연다: [Claude - Chrome 웹 스토어](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn)
2. **Chrome에 추가**를 누른다. 버튼이 안 보이면 창을 최대화한다. **Chrome에서 삭제**가 보이면 이미 설치된 것이다.
3. 확장 프로그램 로그인 화면(`claude.ai/oauth/authorize...`)에서 Desktop 앱과 같은 계정인지 확인하고 **승인**을 누른다.
4. 'Chrome에 Claude가 있습니다' 페이지가 나오면 끝이다.

### 2-4. 연결 확인

Desktop 앱 세션에 보낸다.

```
https://talk.sakyowon.co.kr/system 을 새 탭으로 열고, 화면에 뭐가 보이는지 알려줘
```

Chrome에 새 탭이 열리고 화면 내용을 설명하면 연결된 것이다.

- Claude는 **자기 탭 그룹 안의 탭만** 본다. 사용자가 직접 연 탭이 탭 목록에 없는 것은 정상이다.
- 로그인은 Claude가 연 탭에서 사용자가 직접 한다. Claude는 비밀번호를 입력하지 않는다.

## 3. 지원시스템 계정

- 주소: `https://talk.sakyowon.co.kr/system`
- **자료회원·직원회원·관리자** 계정만 들어갈 수 있다. 일반이용자 계정이면 관리자 승인을 받아야 한다.
- 자료함 위치: 왼쪽 메뉴 **의정활동 > 행감 자료실**. 기관별 자료함 카드(서울주택도시개발공사(SH), 주택실, 디지털도시국, 미래공간기획관 등)로 나뉘어 있고, 카드에 들어가야 검색할 수 있다.
- 이 정보는 PC의 `uijeong/profile.md`에 저장되어 있다(PC에서만 수정, GitHub에는 올리지 않음).

## 4. 쓰는 법

```
/policy-research 청년안심주택 공실 현황, 자료함이랑 최근 뉴스
```

- 해일심이 주제에 맞는 기관 카드(예: 주택실 + SH)를 골라 검색하고, 뉴스를 찾아 출처를 단 답변을 쓴다.
- 문서를 넘기기 전에 검수AI 랑랑별이 근거·링크·수치를 다시 검토한다.
- 답변은 `uijeong/outputs/research/`에 Markdown으로 저장된다. 이 폴더는 GitHub에 올라가지 않는다.
- 바로 이어서 `/audit-issue-report 이 내용으로`라고 하면 행감 질의안을 만든다.

## 5. 시험표

| 순서 | 확인할 것 | 2026-10-25 시험 결과 |
|---|---|---|
| ① | Chrome 연결 | 됨 |
| ② | 지원시스템 접속(새 탭으로 열고 화면 읽기) | 됨 |
| ③ | 자료함 검색(기관 카드 안에서) | 됨 — 주택실 카드 자료 6건을 기관·자료 종류와 함께 표시 |
| ④ | 뉴스 검색(언론사·날짜·링크) | 됨 |
| ⑤ | 답변 형식(자료함·뉴스 구분, 확인 필요, 출처 목록) | 됨 |
| ⑥ | 비공개 표시 자료를 열기 전에 묻는지 | 아직 확인 못 함 |
| ⑦ | 답변의 숫자를 원문과 직접 대조 | 사용자가 확인해야 함 |
| ⑧ | 자료함에 쓰기·삭제를 하지 않았는지 | 됨(읽기만 했다고 보고) |
| ⑨ | 총비서 해일심으로 소개하는지 | 됨 |
| ⑩ | 랑랑별 검수와 문서 끝 검수 기록 | 아직 확인 못 함 |
| ⑪ | `정리해`로 핸드오버·위키 문서 생성 | 아직 확인 못 함 |

## 6. 작업을 마칠 때

```
정리해
```

핸드오버, 그날 배운 스킬·레슨, 위키 문서를 만들고 랑랑별 검수를 거친 뒤 GitHub에 올려도 되는지 묻는다. 자세한 내용은 [`docs/wrap-up-command.md`](wrap-up-command.md)에 있다.

---

## 근거 자료 목록

| 번호 | 자료 이름 | 바로가기 링크 또는 저장 위치 | 쪽·위치 | 확인한 날짜 |
|---|---|---|---|---|
| 1 | 작업 규칙 | `CLAUDE.md` (저장소 맨 위) | 이름과 역할, 근거 자료 표시, 검수 절차 | 2026-10-25 |
| 2 | 자료함·뉴스 검색 스킬 | `.claude/skills/policy-research/SKILL.md` | 2~3단계, 기관 카드 고르기와 검색, 7단계 | 2026-10-25 |
| 3 | 의정지원 자동화 시스템 안내 | `uijeong/README.md` | '자료함 검색 (`/policy-research`)' | 2026-10-25 |
| 4 | 정리해 사용법 | `docs/wrap-up-command.md` | 전체 | 2026-10-25 |
| 5 | Claude 확장 프로그램 | [Chrome 웹 스토어](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn) | — | 2026-10-25 (사용자 화면) |
| 6 | 정책지원관 지원시스템 | `https://talk.sakyowon.co.kr/system` | 로그인 화면 안내문, 왼쪽 메뉴 '의정활동 > 행감 자료실' | 2026-10-25 (사용자 화면) |
| 7 | 시험 결과(①~⑨) | 이 대화에서 사용자가 보내 준 Desktop 앱·PowerShell 화면 캡처 | — | 2026-10-25 |
