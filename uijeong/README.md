# 의정지원 자동화 시스템

서울시의회 주택공간위원회 활동을 위한 문서 자동 작성 도구다. 자료(HWP, HWPX, PDF, DOCX)를 올리고 명령을 부르면, Claude가 자료를 읽고 단계별로 질문한 뒤 초안을 쓴다.

## 기능

| 명령 | 언제 쓰나 | 결과물 | 상태 |
|------|-----------|--------|------|
| `/audit-issue-report` | 행정사무감사를 앞두고 기관별 쟁점과 질의안을 뽑을 때 | 쟁점보고서 + 질의서 초안 | 사용 가능 |
| `/ordinance-draft` | 새 제도를 도입하려고 현황·법적 근거를 따지고 조례안을 만들 때 | 법적 검토서 + 조례안 (의안 서식, 신·구조문대비표, 비용추계서) | 사용 가능 |
| `/project-plan` | 새 사업을 예산에 올리려고 구조·재정·성과지표를 갖출 때 | 사업계획서(안) (산출근거, 성과지표, 시범사업 설계) | 사용 가능 |
| `/floor-speech` | 본회의 5분 자유발언이나 시정질문 원고를 쓸 때 | 5분 자유발언 원고, 시정질문 일문일답 원고 | 사용 가능 |
| `/policy-research` | 정책지원관 지원시스템 자료함과 뉴스를 함께 찾아 답을 받을 때 | 출처를 단 답변(자료함·뉴스 구분, 엇갈리는 부분 표시) | 사용 가능 (Claude in Chrome 필요) |

## 웹 페이지로 쓰기 (바탕화면 바로가기)

Claude Code 없이 브라우저에서 쓰는 화면이다: https://claude.ai/artifact/7VZmHCHttWHQAbGouRX7r9

1. [`web/의정지원시스템.url`](web/의정지원시스템.url)을 바탕화면에 두면 더블클릭으로 열린다. Chrome이라면 화면을 연 뒤 ⋮ → 저장 및 공유 → 바로가기 만들기 → '창으로 열기'를 고르면 프로그램처럼 따로 뜬다.
2. 자료를 올리고 → 문서 종류를 고르고 → '질문 받기' → 답하고 → '초안 쓰기'.
3. 검수 결과(자료에서 찾지 못한 숫자, 확인 필요 표시, 5분 발언 분량)를 보고 한글(.hwpx를 zip에 담아), 워드(.docx), 마크다운(.md)으로 내려받는다.

- claude.ai에 로그인해야 하고, 사용량은 내 Claude 요금제에서 차감된다. 처음 쓸 때 'Claude 사용 허락' 창이 뜬다.
- 동료에게는 화면의 공유 메뉴로 공유한다. 공유받은 사람의 사용량은 그 사람 요금제에서 차감된다.
- 스킬 지침(`.claude/skills/`)이나 기준자료(`knowledge/`)를 고치면 `python3 uijeong/web/build.py`로 다시 묶고, 같은 주소에 다시 게시한다.
- 웹 페이지 소스: `web/src/`(화면 `index.html`, 동작 `app.js`, 핵심 기능 `core.js`), 시험: `web/test/test_core.js`

## Claude Code로 쓰기

1. Claude Code(웹·앱·터미널)에서 이 저장소를 연다.
2. 자료를 대화창에 올리거나 `uijeong/inbox/`에 넣는다.
3. 명령을 부른다. 예: `/audit-issue-report 주택실이랑 SH 위주로`
4. Claude가 범위를 묻는다(대상 기관, 질의 의원, 분량, 초점). 답하면 초안을 쓴다.
5. 결과는 `uijeong/outputs/<유형>/`에 Markdown과 한글(HWPX) 파일로 저장된다. HWPX는 한글 2014 이상에서 바로 열리고, HWP로 다시 저장할 수 있다. DOCX가 필요하면 `profile.md`의 출력 형식을 바꾼다.

### 자료함 검색 (`/policy-research`)

정책지원관 지원시스템은 로그인이 필요해서, **내 PC의 Chrome**을 Claude가 대신 조작해야 한다. 클라우드 세션(claude.ai/code 웹)이나 위 웹 페이지에서는 자료함에 들어가지 못한다.

1. PC에 **Claude Desktop 앱**을 설치하고 로그인한다.
2. Chrome 웹스토어에서 **Claude in Chrome** 확장 프로그램을 설치하고, 같은 계정으로 로그인한다.
3. Chrome에서 지원시스템에 미리 로그인해 둔다.
4. Desktop 앱에서 이 저장소 폴더를 열고 부른다. 예: `/policy-research 청년안심주택 공실 현황, 자료함이랑 최근 뉴스`
5. 처음에 사이트 접근 허용 창이 뜨면 허용한다. 지원시스템 주소는 처음 한 번 묻고 `profile.md`에 저장한다.

Chrome이 연결되지 않은 곳에서 부르면 뉴스만 검색하고, 자료함 자료는 내려받아 올린 파일로 대신한다. Claude는 자료함을 읽기만 하고, 글쓰기·수정·삭제는 하지 않는다. 결과는 요청할 때만 저장한다(내부 자료가 GitHub에 올라가지 않게).

처음 쓸 때는 [`profile.md`](profile.md)에 관점(의원실/시민단체)과 의원명을 적어 두면 묻는 횟수가 줄어든다.

## 구성

```
uijeong/
├── README.md               # 이 문서
├── profile.md              # 사용자 설정 (관점, 의원명, 어조, 출력)
├── knowledge/
│   ├── committee-2026.md   # 위원회 구성·소관 기관·일정
│   └── legal-basis.md      # 근거 법령 참고표, 상위법 저촉 체크리스트
├── scripts/
│   ├── extract.py          # HWP/HWPX/PDF/DOCX → 텍스트
│   ├── mdparse.py          # Markdown → 문서 블록 (두 변환기 공용)
│   ├── md2hwpx.py          # Markdown → 한글(HWPX)
│   ├── md2docx.py          # Markdown → DOCX
│   └── requirements.txt
├── inbox/                  # 올린 자료 (git에 올리지 않음)
└── outputs/                # 생성 문서

.claude/skills/
├── audit-issue-report/     # 행감 쟁점보고서
├── ordinance-draft/        # 법적 검토·조례안
├── project-plan/           # 사업계획서(안)
├── floor-speech/           # 5분발언·시정질문
└── policy-research/        # 자료함·뉴스 검색 답변
```

## 원칙

- **출처 우선**: 모든 수치와 사실에 출처 문서를 단다. 받은 자료에서 찾지 못한 수치는 `[확인 필요]`로 표시한다.
- **조문 확인**: 법령 조문은 `knowledge/legal-basis.md`나 받은 자료에 있는 것만 쓰고, 그 밖은 `[조문 확인 필요]`로 표시한다. 최종본 전에 국가법령정보센터에서 현행 조문을 확인한다.
- **초안일 뿐**: 결과물은 초안이다. 제출·발언 전에 사람이 검토한다.
- **자료 성격 구분**: 공식 자료와 정당·단체·언론 자료를 구분해 표기한다.

## 연도별 갱신

새 연도 행감 계획서가 나오면 `knowledge/committee-2026.md`를 새 파일로 만들고 `profile.md`의 기준자료 링크를 바꾼다.
