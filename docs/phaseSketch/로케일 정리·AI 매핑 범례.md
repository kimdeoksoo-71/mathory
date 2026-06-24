# 작업 계획서 — 로케일 코드 정리 + AI 토론 매핑 범례 주입

> 성격: 유지보수(묵은 코드 청소) + 소규모 기능(AI 입력 어휘 정합)
> 핵심 한 줄: **저장 모델은 그대로 두고**, ① 수식번호 통일 이후 남은 죽은 코드를 청소하고 ② AI에게만 "원문↔화면" 매핑 범례를 동봉해 사람·AI의 지칭 어휘를 일치시킨다.
> 번호(Phase NN)는 덕수가 사용 중인 시퀀스(48~50 공유 트릴로지)와 겹치지 않게 배정.

---

## 1. 배경 / 문제 정의

현재 로케일 파이프라인은 **국제 표준 단일 정규형**으로 저장하고 ko 로케일에서만 표시 변환한다(설계 의도대로 건강함).

- 저장: `(a)(b)…`, `(i)(ii)…`, `\tag{n}`, `\ref{n}`, `Fig.N`, `Table N`
- 표시(ko): `(가)(나)…`, `ㄱ.ㄴ.…`, `(n)`(수식번호), `[그림N]`, `[표N]`

여기서 두 가지 부채가 확인됨.

**(A) 수식번호 통일의 잔재** — `\tag{n}`/`\ref{n}`은 이제 `(n)`으로 렌더된다(`convertTextTags`/`convertRefReferences`). 그러나:
- `lib/locale.ts:5` 헤더 주석은 여전히 *"…㉠㉡㉢…"*라고 기술 → 코드와 모순되는 묵은 주석.
- `CIRCLED_CONSONANTS` 배열(`lib/locale.ts:12`)은 더 이상 태그 렌더에 쓰이지 않으며, **repo 전체에서 import되는 곳이 없음**(확인 완료). 죽은 export.

**(B) AI 혼란의 진원지** — AI 토론/에이전트는 `CommentPanel.fetchTabBlocksText`가 반환하는 **`b.raw_text`(국제 표준 원문)** 를 `/api/discuss`로 그대로 보낸다. 이 경로에 `preprocessLocale`이 끼지 않는다. 결과:
- 사람은 화면에서 `(가)`, `ㄱ.`, `(1)`을 보는데 **AI는 `(a)`, `(i)`, `\tag{1}`을 받고 그 표기로 답한다.**
- 사람이 AI의 "조건 (a)에서…"를 자기 화면의 `(가)`로 머릿속 변환해야 하는 desync 발생.

**해결 방침:** 저장 모델·검색·이식성을 건드리지 않기 위해, 원문은 그대로 주되 **AI 프롬프트에 매핑 범례를 동봉하고 AI에게 "지칭 시 화면 표기를 쓰라"고 지시**한다.

---

## 2. 선행 확인 (구현 착수 전 반드시 읽을 것)

CLI 인스턴스는 아래를 **실제 파일에서 직접 확인**한 뒤 착수한다(프로젝트 지식 문서는 신뢰하지 말 것).

1. `lib/locale.ts` — 전체. 특히 헤더 주석(1~9행), `CIRCLED_CONSONANTS`(12~14행), `GANA`/`GIYEOK`(17~25행 부근), `convertTextTags`/`convertRefReferences`, 하단 `export { … }` 블록.
2. `app/api/discuss/route.ts` — `DiscussRequest` 타입(25~38행 부근), `BASE_SYSTEM_PROMPT`(시스템 프롬프트 상단), `buildUserPrompt`(367행 부근).
3. `components/comment/CommentPanel.tsx` — `fetchTabBlocksText`(429행), `buildContext`(452행), `/api/discuss` 호출부(507행, 622행 부근).
4. 안전 제거 재확인: `grep -rn "CIRCLED_CONSONANTS" . --include=*.ts --include=*.tsx` 결과가 정의부 1줄뿐인지.
5. 범위 제외 확인: `app/api/proofread/route.ts`, `lib/proofread.ts` — proofread는 **본 작업 대상 아님**(아래 5절 사유). 건드리지 말 것.

---

## 3. 목표·결정 (locked)

| # | 결정 | 사유 |
|---|------|------|
| D1 | `lib/locale.ts:5` 헤더 주석에서 `㉠㉡㉢` 표기 부분을 `(n)`(수식번호) 로 수정 | 코드 현실(통일 완료)과 주석 일치 |
| D2 | `CIRCLED_CONSONANTS` 배열 export 제거 | repo 전체에서 미사용 확인됨(죽은 export) |
| D3 | `UnifiedToolbar.tsx`의 `'㉠'` 기호 삽입 버튼은 **유지** | 그것은 일반 기호 입력 버튼이며 태그 렌더와 무관 |
| D4 | `lib/locale.ts`에 `buildLocaleLegend(locale)` 추가 — 범례 문자열을 `GANA`/`GIYEOK` + 규칙 상수에서 **생성** | 매핑 단일 진실원천 유지. 범례를 별도 하드코딩하면 드리프트 발생 |
| D5 | `DiscussRequest`에 `locale?: Locale`(기본 `'ko'`) 추가. `buildUserPrompt`에서 `locale === 'ko'`일 때만 범례 주입 | international 표시 사용자에겐 desync가 없어 범례 불필요·오히려 오도 |
| D6 | AI에게 "열거 항목을 **사용자 화면 표기**(`(가)`,`ㄱ.`,`(n)`)로 지칭하라"고 지시 추가 | desync의 실제 해소는 AI 출력 어휘를 사람과 맞추는 것 |
| D7 | `CommentPanel`의 `/api/discuss` 호출 본문에 `locale: 'ko'` 전달 | 에디터 미리보기·댓글 컨텍스트는 사실상 항상 ko 표시이므로 |
| D8 | proofread·ai-complete 경로, EditorPreview 인라인 중복 일원화, EditorPreview locale 게이트 미배선 — **본 작업 제외**(별도 향후 과제) | 범위 통제. 5절 참조 |

---

## 4. 변경 상세

### 4-1. `lib/locale.ts` (청소 + 범례 생성기)

- 헤더 주석(5행): `㉠㉡㉢` → 수식번호가 `(n)`으로 표시됨을 반영하도록 수정.
- `CIRCLED_CONSONANTS` 상수 블록 삭제(12~14행). 하단 export 블록에는 원래 없으므로 추가 작업 불필요.
- 신규 함수 추가(아래는 명세이며 그대로 복붙용 아님 — 실제 `GANA`/`GIYEOK` 키 순서를 파일에서 확인해 생성):

```ts
/** AI 프롬프트용: 저장 원문 ↔ 화면 표시 매핑 범례를 생성한다.
 *  international 로케일이면 desync가 없으므로 빈 문자열. */
export function buildLocaleLegend(locale: Locale): string {
  if (locale !== 'ko') return '';

  const cond = Object.entries(GANA)            // a→가 …
    .map(([k, v]) => `(${k})→(${v})`).join(', ');
  const choi = Object.entries(GIYEOK)          // i→ㄱ …
    .map(([k, v]) => `(${k})→${v}.`).join(', ');

  return [
    '## 표기 안내 (반드시 준수)',
    '아래 문제·풀이의 원문은 국제 표준 표기이며, 사용자 화면에는 한국식으로 표시됩니다.',
    '**항목을 지칭할 때는 반드시 사용자가 보는 화면 표기를 사용하세요.**',
    `- 조건: ${cond}`,
    `- 보기: ${choi}`,
    '- 수식 번호: \\tag{n} 및 \\ref{n} 는 화면에 (n) 으로 표시됩니다.',
    '- 그림·표: Fig. n → [그림n], Table n → [표n]',
    '- 원숫자 ①②③ 등은 화면에도 그대로 표시됩니다.',
  ].join('\n');
}
```

### 4-2. `app/api/discuss/route.ts` (범례 주입)

- `DiscussRequest`에 `locale?: Locale` 필드 추가(`import type { Locale } from '…/lib/locale'`).
- `import { buildLocaleLegend } from '…/lib/locale'`.
- `buildUserPrompt` 상단에서, `## 문제:` 블록 **앞에** 범례를 1회 삽입:

```ts
function buildUserPrompt(body: DiscussRequest): string {
  const parts: string[] = [];

  const legend = buildLocaleLegend(body.locale ?? 'ko');
  if (legend) { parts.push(legend); parts.push(''); }

  parts.push('## 문제:');
  parts.push(body.problemContent || '(문제 내용 없음)');
  // …이하 기존 동일…
}
```

- D6 지침: `BASE_SYSTEM_PROMPT`에 한 줄 추가하거나 범례 마지막 줄에 포함 — "열거 항목(조건·보기·수식번호)을 지칭할 때는 위 화면 표기를 사용하라." (범례 안에 이미 그 문장이 있으므로 system prompt 중복 추가는 선택사항.)

### 4-3. `components/comment/CommentPanel.tsx` (locale 전달)

- `/api/discuss`로 보내는 요청 본문(507행·622행 부근 두 곳)에 `locale: 'ko'` 추가.
- 향후 사용자 표시 로케일 설정이 도입되면 그 값으로 교체할 수 있도록, 가능하면 상수 한 곳(`const AI_LOCALE: Locale = 'ko'`)으로 두고 참조.

---

## 5. 명시적 비포함 (scope-out)

- **proofread 경로**: proofread는 raw_text를 **직접 치환·교정**하는 경로다. 여기에 ko 범례를 주입하면 AI가 저장 원문을 한국식 글리프(`(가)` 등)로 "교정"해 **저장 데이터를 오염**시킬 위험이 있다. 국제 표준 원문 유지가 정답이므로 범례 주입 금지.
- **EditorPreview 인라인 중복**: `EditorPreview.tsx:84`에 `lib/locale.ts`와 별개의 로케일 변환 복제본이 존재(드리프트 위험)하고, 그 복제본은 locale 게이트가 없어 항상 ko로 변환한다. 일원화·게이트 배선은 별도 phasedoc로 분리(본 작업과 결합 시 blast radius 과대).

---

## 6. 데이터 모델 / 보안 규칙 / UI

- Firestore 스키마 변경 **없음**. 저장 원문은 국제 표준 그대로.
- `firestore.rules` 변경 **없음**.
- 사용자 가시 UI 변경 **없음**(AI 답변의 지칭 표기가 화면과 일치해지는 체감 개선만 발생).

---

## 7. 위험 / 완화

| 위험 | 완화 |
|------|------|
| AI 출력 `(가)`가 다음 턴 `discussionHistory`로 재투입 | `preprocessLocale`은 국제 표준 패턴만 매칭하므로 `(가)`는 통과·불변. 이중 변환 없음 |
| 댓글 렌더 시 AI의 `(가)` 출력이 재변환됨 | 동일 — 한국식 글리프는 변환 대상이 아니라 그대로 표시됨 |
| international 사용자에게 ko 범례가 오도 | D5의 locale 게이트로 차단(`'ko'`일 때만 주입) |
| `CIRCLED_CONSONANTS` 제거가 어딘가를 깨뜨림 | 선행 확인 4의 grep으로 미사용 재확인 후 삭제 |
| 토큰 비용 증가 | 범례 ≈ 80토큰/요청, 무시 가능 |

---

## 8. 인수 체크리스트

- [ ] `lib/locale.ts` 헤더 주석에 `㉠㉡㉢` 잔재 없음, `(n)` 표기로 정정됨
- [ ] `CIRCLED_CONSONANTS` 제거, `grep -rn CIRCLED_CONSONANTS` 결과 0건, 타입체크·빌드 통과
- [ ] `UnifiedToolbar`의 `㉠` 기호 버튼 정상 동작(회귀 없음)
- [ ] `buildLocaleLegend('ko')`가 `(a)→(가)`…, `(i)→ㄱ.`… 및 수식번호·그림·표 규칙을 포함한 문자열 반환
- [ ] `buildLocaleLegend('international')`이 빈 문자열 반환
- [ ] AI 토론 요청 시 `## 표기 안내`가 프롬프트 선두에 포함됨(서버 로그/임시 echo로 확인)
- [ ] 실제 토론에서 AI가 조건을 `(가)`, 보기를 `ㄱ.`, 수식번호를 `(n)`으로 지칭함(샘플 문제로 수동 검증)
- [ ] proofread 경로는 범례 미주입 상태 유지(변경 없음 확인)

---

## 9. 커밋 가이드

- 전체 파일 교체 방식 선호. 변경 파일: `lib/locale.ts`, `app/api/discuss/route.ts`, `components/comment/CommentPanel.tsx`.
- 커밋 메시지(안):
  - `chore(locale): 수식번호 통일 잔재 정리 — ㉠ 주석·CIRCLED_CONSONANTS 제거`
  - `feat(discuss): AI 프롬프트에 로케일 표기 매핑 범례 주입 (사람·AI 지칭 일치)`
- 두 결정을 한 커밋으로 묶을지 분리할지는 덕수 재량. 분리 권장(청소/기능 구분).
- **푸시는 덕수가 VSCode에서 직접 수행.** CLI는 commit까지만, push 명령은 안내만 제공.
