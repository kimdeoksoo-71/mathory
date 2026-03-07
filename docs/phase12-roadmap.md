# Phase 12: Markdown LaTeX → 아래한글 수식 변환

> **목표**: Mathory에서 작성한 수학 문제를 아래한글(HWP)에서 사용할 수 있도록 내보내기 파이프라인 구축
> **시작일**: 2026-03-07
> **완료일**: 2026-03-07
> **상태**: ✅ 완료

---

## 전체 워크플로우

```
Mathory (웹)                    Windows 11 (로컬)
┌──────────────┐    .md 파일    ┌──────────────────────┐    COM 자동화    ┌──────────┐
│ Problem View │ ──다운로드──→  │ Python 변환 앱        │ ──자동삽입──→   │ 아래한글  │
│ ⋮ 메뉴       │               │ LaTeX → HWP 수식 변환 │                 │ 문서      │
└──────────────┘               └──────────────────────┘                 └──────────┘
```

---

## Part A: Mathory 웹 변경사항 ✅

| # | 작업 | 상태 |
|---|------|------|
| A-1 | Problem View ⋮ 메뉴에 MD 다운로드 추가 | ✅ |
| A-2 | 메뉴 순서 통일: 편집 → 이름변경 → 폴더변경 → MD 다운로드 → 삭제 | ✅ |
| A-3 | ContextMenu 컴포넌트 통일 (사이드바, FolderView, ProblemView) | ✅ |
| A-4 | AppShell에 download_md 액션 핸들러 추가 | ✅ |
| A-5 | Problem View 제목 클릭 → EditorView 진입 | ✅ |
| A-6 | FolderView 난이도 표시 수정 (DIFFICULTIES 상수 기반 2점/3점/4점) | ✅ |

### 변경된 파일

| 파일 | 변경 유형 |
|------|-----------|
| `components/problem/ProblemView.tsx` | 수정 — MD 다운로드, 메뉴 순서, 제목 클릭 |
| `components/problem/FolderView.tsx` | 수정 — DifficultyBadge → getDifficultyLabel |
| `components/ui/ContextMenu.tsx` | 수정 — DEFAULT_ITEMS 순서 + download_md 추가 |
| `components/layout/AppShell.tsx` | 수정 — handleProblemAction에 download_md case 추가 |

---

## Part B: Python 변환 앱 ✅

### 프로젝트 구조

```
mathory-hwp-converter/
├── main.py                 # tkinter GUI + 아래한글 내보내기
├── converter/
│   ├── __init__.py
│   ├── parser.py           # Markdown 파싱 (텍스트/수식 분리)
│   ├── latex_to_hwp.py     # LaTeX → 아래한글 수식 변환 엔진
│   ├── mappings.py         # 170+ 변환 매핑 테이블
│   └── hwp_automation.py   # 아래한글 COM 자동화
├── tests/
│   ├── test_converter.py
│   └── test_samples/
│       ├── sample_basic.md
│       └── sample_calculus.md
├── requirements.txt
└── README.md
```

### 실행 방법

```bash
# 32비트 Python으로 실행 (필수)
"%LOCALAPPDATA%\Programs\Python\Python313-32\python.exe" main.py
```

---

## ⚠️ 아래한글 COM 자동화 — 핵심 설정 기록

아래한글 2022 COM 자동화를 위해 확인된 설정들입니다.
인터넷에도 정리되지 않은 정보가 많으므로 반드시 기록해둡니다.

### 1. Python 32비트 필수

아래한글 2022는 **32비트** 프로그램입니다.
COM 객체도 32비트로만 등록되므로, **32비트 Python**이 필수입니다.

- Microsoft Store Python (64비트) → ❌ 작동 안 함
- python.org "Windows installer (32-bit)" → ✅ 작동
- 설치 경로: `%LOCALAPPDATA%\Programs\Python\Python313-32\`
- 64비트 Python과 공존 가능 (PATH에 추가하지 않으면 충돌 없음)

```bash
# 비트 확인
python -c "import struct; print(struct.calcsize('P') * 8, 'bit')"
```

### 2. COM 서버 등록 (최초 1회)

아래한글의 COM 서버를 Windows에 등록해야 합니다.
**관리자 권한** 명령 프롬프트에서 실행:

```bash
# Hwp.exe를 COM 서버로 등록 (핵심!)
"C:\Program Files (x86)\HNC\Office 2022\HOffice120\bin\Hwp.exe" /regserver

# 32비트 regsvr32로 OCX/DLL 등록
C:\Windows\SysWOW64\regsvr32.exe "C:\Program Files (x86)\HNC\Office 2022\HOffice120\bin\HwpCtrl.ocx"
C:\Windows\SysWOW64\regsvr32.exe "C:\Program Files (x86)\HNC\Office 2022\HOffice120\bin\HwpAutomation.dll"
```

> **주의**: `C:\Windows\System32\regsvr32.exe`는 64비트이므로 사용하면 안 됨.
> 반드시 `C:\Windows\SysWOW64\regsvr32.exe` (32비트) 사용.

### 3. ProgID — 작동하는 것 vs 작동하지 않는 것

| ProgID | 결과 |
|--------|------|
| `HWPFrame.HwpObject` | ✅ **작동** (Hwp.exe /regserver 후) |
| `HwpAutomationApp2.HwpAutomation` | ❌ 연결은 되나 메서드 호출 시 멈춤 |
| `HwpAutomationApp2.HwpAutomation.2` | ❌ 동일 |
| `HWPCONTROL.HwpCtrlCtrl.1` | ❌ ActiveX 컨트롤 (COM 자동화용 아님) |
| `Hwp.HwpObject` | ❌ 등록 안 됨 |

### 4. 수식 삽입 — 작동하는 방식

```python
# ✅ 작동: CreateAction 방식
act = hwp.CreateAction("EquationCreate")
s = act.CreateSet()
act.GetDefault(s)
s.SetItem("String", "{1} over {2}")
act.Execute(s)

# ❌ 작동 안 함: HParameterSet.HEqEdit 방식
pset = hwp.HParameterSet.HEqEdit
hwp.HAction.GetDefault("EquationCreate", pset.HSet)
pset.String = equation_str
hwp.HAction.Execute("EquationCreate", pset.HSet)
```

### 5. 텍스트 삽입 — 작동하는 방식

```python
# ✅ 작동
pset = hwp.HParameterSet.HInsertText
hwp.HAction.GetDefault("InsertText", pset.HSet)
pset.Text = "텍스트"
hwp.HAction.Execute("InsertText", pset.HSet)

# 줄바꿈
hwp.HAction.Run("BreakPara")
```

### 6. 보안 모듈 등록

```python
hwp.RegisterModule("FilePathCheckDLL", "FilePathCheckerModule")
```

이것을 호출하지 않으면 파일 열기/저장 등 일부 기능이 차단됩니다.

### 7. COM은 메인 스레드에서 실행

- 별도 스레드(threading)에서 COM 호출 → **프로세스 크래시**
- `pythoncom.CoInitialize()` 로도 해결 안 됨
- **반드시 메인 스레드에서 실행** (tkinter GUI가 잠시 멈추는 것은 감수)

### 8. 빈 문서 생성

```python
hwp.HAction.Run("FileNew")
```

> 아래한글이 열려있지 않아도 Dispatch 시 자동으로 프로세스가 생성됩니다.
> 단, 읽기 전용으로 열릴 수 있으며, 이는 정상 동작입니다.

---

## 변환 매핑 주요 예시

| LaTeX | 아래한글 수식 |
|-------|-------------|
| `\frac{a}{b}` | `{a} over {b}` |
| `\sqrt{x}` | `sqrt {x}` |
| `\sqrt[3]{x}` | `root {3} of {x}` |
| `\int_{0}^{2} f(x)\,dx` | `int _{0}^{2} f(x)~dx` |
| `\sum_{k=1}^{n}` | `sum _{k=1}^{n}` |
| `\lim_{x \to \infty}` | `lim _{x -> inf}` |
| `\left( \right)` | `left ( right )` |
| `\begin{cases} ... \end{cases}` | `cases {...}` |
| `\begin{pmatrix} a & b \\ c & d \end{pmatrix}` | `pmatrix {a & b ## c & d}` |
| `\overline{AB}` | `overline {AB}` |
| `\vec{v}` | `vec {v}` |
| `\text{이므로}` | `"이므로"` |
| `\displaystyle` | (삭제) |
| `\\` (행렬 내) | `##` |
| `\,` | `~` |

---

## Phase 13+ 확장 계획

- [ ] 읽기 전용 해제 방법 조사
- [ ] 아래한글 문서 자동 저장 (.hwpx)
- [ ] 배치 변환 (폴더 내 모든 .md 파일 일괄 처리)
- [ ] 수식 크기/폰트 조정 옵션
- [ ] Mathory에서 직접 .hwpx 다운로드 (서버사이드 변환)
- [ ] 고급 LaTeX 명령어 지원 확장 (\underbrace, \stackrel 등)