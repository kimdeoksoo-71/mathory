# Claude API 키 설정 (Phase 27 — 맞춤법 교정 기능)

Phase 27의 한글 맞춤법/띄어쓰기 검증은 Anthropic Claude API를 호출합니다. 사용 전 API 키 등록이 필요합니다.

## 1. Anthropic API 키 발급

1. https://console.anthropic.com 접속 후 로그인
2. 좌측 메뉴 **API Keys** → **Create Key** 클릭
3. 이름 입력(예: `mathory-vercel`) → 생성된 키(`sk-ant-...`) 복사
4. **이 키는 한 번만 표시됨**. 안전한 곳에 저장

## 2. Vercel 환경변수 등록

1. https://vercel.com/dashboard 에서 `mathory` 프로젝트 진입
2. **Settings** → **Environment Variables** 이동
3. 다음 항목 추가:

   | Name | Value | Environments |
   |---|---|---|
   | `ANTHROPIC_API_KEY` | `sk-ant-...` (1번에서 받은 키) | Production, Preview, Development 모두 체크 |
   | `ANTHROPIC_MODEL` *(선택)* | `claude-haiku-4-5-20251001` *(기본값)* | 모두 체크 |

4. **Save** 클릭
5. **Deployments** 탭에서 가장 최근 배포의 ⋯ 메뉴 → **Redeploy** (환경변수는 재배포해야 적용됨)

## 3. 로컬 개발 환경(.env.local)

프로젝트 루트의 `.env.local` 파일에 추가:

```bash
ANTHROPIC_API_KEY=sk-ant-...
# 모델을 바꾸려면 (선택)
# ANTHROPIC_MODEL=claude-haiku-4-5-20251001
```

`.env.local`은 `.gitignore`에 포함되어 있어야 함 (이미 포함됨).

`npm run dev` 재시작 필요.

## 4. 동작 확인

1. EditorView에서 어떤 문제든 열기
2. 툴바의 ✓ 아이콘 (찾기 🔍 옆) 클릭
3. 현재 탭의 모든 텍스트/제목/글상자/(가)(나)/(ㄱ)(ㄴ) 블록이 검사되고
4. 오류가 있는 블록 아래에 노란색 결과 박스가 나타남
5. 결과 박스 우측 상단 `✕`로 닫기, "검토 실패" 시 **재시도** 버튼

## 5. 비용

- 모델: `claude-haiku-4-5` (가장 저렴한 등급)
- 탭당 1회 호출 (블록 일괄)
- 일반적인 풀이 1탭 검사 비용은 수 원 미만

## 6. 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| `ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다` | Vercel에 키 미등록 또는 재배포 누락 |
| 모든 블록 결과 박스가 빨간 "검토 실패" | API 키가 만료/무효 → Anthropic 콘솔에서 재발급 |
| 결과 박스에 "수식·조사 공백" 항목만 나옴 | 정상. 해당 항목은 로컬 정규식이라 키 없이도 항상 검출됨 |
| 응답 지연 (>10초) | 탭의 블록이 매우 많거나 길 때. 정상. |
