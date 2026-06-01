# Phase 39 — 이모지(Twemoji) 입력 & 렌더

> 핸드오프 대상: Claude Code CLI (VSCode)
> 작성: 기획 세션. 구현 전 이 문서의 "작업 순서"대로 진행할 것.

## 1. 목표

에디터에서 이모지를 편하게 입력하고, 미리보기·PDF 어디서나 **Notion과 동일한 Twemoji 그림(컬러 SVG)** 으로 렌더한다. OS·브라우저마다 생김새가 달라지는 시스템 폰트 이모지 문제를 제거한다.

## 2. 핵심 설계 결정 (확정)

| 항목 | 결정 | 근거 |
|------|------|------|
| 저장 형식 | **생 유니코드 이모지만** Firestore에 저장 (🥑 그대로) | `preprocessLocale` / `\tag` 와 동일 철학 — 데이터는 안 건드리고 렌더 시점에만 변환 |
| 렌더 방식 | rehype 플러그인이 텍스트의 이모지를 Twemoji **SVG `<img>`** 로 치환 | 줌·고해상도 인쇄에서 안 깨짐(수학 문서 필수) |
| 렌더 라이브러리 | **`@yuna0x0/rehype-twemoji`** (직접 구현 X) | jdecked 포크를 기본 소스로 사용·유지보수 중. 원조 `rehype-twemoji`(aaronlin0122)는 아카이브된 `twitter/twemoji`라 **사용 금지** |
| 에셋 | **jsDelivr CDN** (`jdecked/twemoji`), 번들 0 | 웹앱 온라인 전제 |
| 피커 UI | **커스텀 경량 피커** (`SpecialCharDropdown` 패턴 확장) | 기존 툴바 톤 유지, 한국어 검색, 피커 미리보기까지 Twemoji SVG로 일관 |
| 이모지 데이터 | **`emojibase-data` (ko)** | 한국어 `annotation`/`tags` 내장 → 한글 검색 |
| 출처 표기 | 설정 페이지 "정보" 섹션 1줄 (CC BY 4.0) | Twemoji 아트워크 라이선스 의무 |

**역할 분리 요약**: *입력 피커 = 커스텀*, *렌더 = 검증된 라이브러리*. 둘은 `lib/twemoji-url.ts`의 버전 상수를 공유해 **피커 미리보기와 문서 렌더가 동일한 CDN 파일을 가리키게** 한다.

## 3. 아키텍처

```
[툴바 이모지 버튼] → EmojiPickerDropdown
        │ onInsert('🥑', 2)           ← 생 유니코드만 삽입
        ▼
   CodeMirror / Firestore             ← 변경 없음 (raw_text에 🥑 그대로)
        │
        ▼ (렌더 시점)
   EditorPreview / PrintableContent
   rehypePlugins: [...,  rehypeTwemoji]
        │ 🥑 → <img class="twemoji" src=".../1f951.svg">
        ▼
   화면 · PDF에 컬러 SVG 이모지
```

## 4. 의존성 추가

```bash
npm install emojibase-data @yuna0x0/rehype-twemoji
```

- `emojibase-data` — 데이터 전용(JSON), 런타임 코드 아님. `ko/data.json`, `ko/messages.json` 사용. **동적 import로 코드 스플릿**(피커 첫 오픈 시 로드)하여 초기 번들 영향 0.
- `@yuna0x0/rehype-twemoji` — rehype 플러그인.

> CDN 버전 핀: 작성 시점 jdecked 최신 릴리스 태그 기준. `lib/twemoji-url.ts`의 `TWEMOJI_VERSION` 한 곳에서만 관리. 태그가 jsDelivr에 실제로 resolve 되는지 한 번 확인할 것 (`https://cdn.jsdelivr.net/gh/jdecked/twemoji@<버전>/assets/svg/1f951.svg`).

## 5. 신규 파일

### 5-1. `lib/twemoji-url.ts` — 버전·URL 단일 소스

```ts
// Twemoji 에셋 버전/베이스를 한 곳에서 관리.
// 렌더 플러그인(source)과 피커 미리보기(twemojiSvgUrl)가 동일 파일을 가리키도록 함.
export const TWEMOJI_VERSION = '15.1.0'; // ← 실제 resolve 되는 jdecked 태그로 확정
export const TWEMOJI_BASE =
  `https://cdn.jsdelivr.net/gh/jdecked/twemoji@${TWEMOJI_VERSION}`;
export const TWEMOJI_SVG_BASE = `${TWEMOJI_BASE}/assets/svg`;

const VS16 = 0xfe0f; // variation selector-16
const ZWJ = 0x200d;  // zero-width joiner

/** twemoji 파일명 규칙: ZWJ 없으면 FE0F 제거, 소문자, '-' 결합 */
export function toTwemojiCodepoint(emoji: string): string {
  const cps = Array.from(emoji).map((c) => c.codePointAt(0)!);
  const hasZwj = cps.includes(ZWJ);
  const filtered = hasZwj ? cps : cps.filter((cp) => cp !== VS16);
  return filtered.map((cp) => cp.toString(16)).join('-');
}

export function twemojiSvgUrl(emoji: string): string {
  return `${TWEMOJI_SVG_BASE}/${toTwemojiCodepoint(emoji)}.svg`;
}
```

### 5-2. `lib/emoji-data.ts` — emojibase 로더 + 검색 + 최근

```ts
// 동적 import로 첫 호출 시 1회 로드. group=2(Component, 스킨톤 등) 제외.
// 카테고리 탭 라벨은 ko/messages.json의 groups에서 가져옴.
// 검색은 한국어 annotation + tags 대상.

export interface EmojiItem {
  emoji: string;       // 생 유니코드
  label: string;       // 한국어 annotation
  tags: string[];      // 한국어 검색 키워드
  group: number;       // 카테고리 인덱스
}
export interface EmojiGroup { key: number; name: string; items: EmojiItem[]; }

let _cache: { groups: EmojiGroup[]; flat: EmojiItem[] } | null = null;

export async function loadEmoji(): Promise<{ groups: EmojiGroup[]; flat: EmojiItem[] }> {
  if (_cache) return _cache;
  const [data, messages] = await Promise.all([
    import('emojibase-data/ko/data.json').then((m) => m.default),
    import('emojibase-data/ko/messages.json').then((m) => m.default),
  ]);
  const groupNames = new Map<number, string>(
    (messages as any).groups.map((g: any) => [g.order, g.message])
  );
  const flat: EmojiItem[] = (data as any[])
    .filter((e) => e.group !== undefined && e.group !== 2) // Component 제외
    .map((e) => ({
      emoji: e.emoji,
      label: e.label ?? e.annotation ?? '',
      tags: Array.isArray(e.tags) ? e.tags : [],
      group: e.group,
    }));
  const byGroup = new Map<number, EmojiItem[]>();
  for (const it of flat) {
    if (!byGroup.has(it.group)) byGroup.set(it.group, []);
    byGroup.get(it.group)!.push(it);
  }
  const groups: EmojiGroup[] = Array.from(byGroup.keys())
    .sort((a, b) => a - b)
    .map((key) => ({ key, name: groupNames.get(key) ?? `그룹 ${key}`, items: byGroup.get(key)! }));
  _cache = { groups, flat };
  return _cache;
}

export function searchEmoji(flat: EmojiItem[], query: string): EmojiItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return flat
    .filter((e) => e.label.toLowerCase().includes(q) || e.tags.some((t) => t.toLowerCase().includes(q)))
    .slice(0, 60);
}

// 최근 사용 (localStorage — 세션과 무관, 브라우저 단위. sessionStorage 아님 주의)
const RECENT_KEY = 'mathory:emoji:recent';
const RECENT_MAX = 24;
export function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
export function pushRecent(emoji: string): void {
  try {
    const next = [emoji, ...getRecent().filter((e) => e !== emoji)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}
```

> 주의: `emojibase-data`의 정확한 필드명(`label` vs `annotation`, `tags` 유무)은 설치된 버전에서 `ko/data.json` 한 항목을 직접 찍어 확인하고 매핑을 맞출 것. v6+ 기준 `annotation`/`tags` 존재. `messages.json`의 그룹 키 필드(`order`/`key`)도 실데이터로 확인.

### 5-3. `components/editor/EmojiPickerDropdown.tsx`

`SpecialCharDropdown`(`UnifiedToolbar.tsx` 내부)을 **그대로 복제 후 확장**. 동일 패턴 유지:
- 상위 `IconButton` + `useRef` 외부 클릭 닫기 (`mousedown` 리스너) — 기존과 동일.
- 인라인 스타일, 팝오버 박스 스타일(흰 배경, `border:1px solid #ddd`, `borderRadius:8`, `boxShadow`, `zIndex:1000`)은 SpecialChar 것 재사용.

추가 요소:
1. **검색 인풋** (상단). `onChange` → `searchEmoji`. 입력 있으면 grid를 검색 결과로 교체.
2. **카테고리 탭 바** (작은 버튼들, 각 그룹 대표 이모지 또는 이름). 클릭 시 해당 그룹 grid로.
3. **최근 사용 행** (검색·카테고리 위, `getRecent()` 비어있지 않을 때만).
4. **이모지 그리드**: `gridTemplateColumns: 'repeat(8, 1fr)'`. 각 셀은 `<button>` 안에 **Twemoji SVG `<img>`**:
   ```tsx
   <img
     src={twemojiSvgUrl(it.emoji)}
     alt={it.emoji}
     title={it.label}
     loading="lazy"
     draggable={false}
     width={22} height={22}
     onError={(e) => { (e.currentTarget.replaceWith(document.createTextNode(it.emoji))); }}
   />
   ```
   - `loading="lazy"` 필수 (그룹당 수백 개). **활성 그룹/검색 결과만 마운트**(전체 ~3700개 동시 마운트 금지).
   - `onError` → 네이티브 글자 폴백(렌더 플러그인과 파일명 엣지케이스 어긋날 때 깨짐 방지).
5. 클릭 시: `onInsert(it.emoji, it.emoji.length); pushRecent(it.emoji); setOpen(false);`

데이터 로딩: 팝오버가 처음 열릴 때 `loadEmoji()` await → 로딩 중 `IconLoader` 표시(기존 `../ui/Icons`).

Props: `{ onInsert: (template: string, cursorOffset: number) => void }` — SpecialChar과 동일 시그니처.

## 6. 수정 파일

### 6-1. `components/editor/UnifiedToolbar.tsx`
- `EmojiIcon` 추가: 기존 아이콘 규격 그대로(`SVG_PROPS`, `CORNER_BRACKETS` 포함, 웃는 얼굴 — 원 + 눈 2개 + 호 형태 입).
- 상단 import에 `EmojiPickerDropdown` 추가.
- 버튼 그룹 배열(현재 `{ key: 'special', node: <SpecialCharDropdown onInsert={onInsert} /> }` 있는 곳, 라인 ~828)에 바로 옆에 추가:
  ```tsx
  { key: 'emoji', node: <EmojiPickerDropdown onInsert={onInsert} /> },
  ```
- `onInsert` prop은 이미 존재(시그니처 동일) — 추가 배선 불필요.

### 6-2. `components/editor/EditorPreview.tsx`
- import: `import { rehypeTwemoji } from '@yuna0x0/rehype-twemoji';` + `import { TWEMOJI_BASE } from '../../lib/twemoji-url';`
- `rehypePlugins` 배열(라인 ~261)에 추가. **`rehypeKatex` 뒤**에 배치(수식 노드 처리 후 일반 텍스트만 대상):
  ```tsx
  rehypePlugins={[
    rehypeRaw,
    [rehypeKatex, { strict: false, trust: true, macros: { "\\arraystretch": "1.8" } }],
    [rehypeTwemoji, {
      format: 'svg',
      source: TWEMOJI_BASE,
      className: 'twemoji',
      draggable: false,
      ignore: ['©', '®', '™', '℗', '↩'],
    }],
  ]}
  ```

### 6-3. `components/print/PrintableContent.tsx`
- 6-2와 **동일하게** `rehypeTwemoji` 추가(여기 옵션은 `fleqn: true` 유지). PDF/인쇄에도 이모지가 나오도록 반드시 함께 반영.

### 6-4. `app/globals.css` — 이모지 인라인 정렬
인쇄는 별도 iframe이 아니라 같은 문서에서 `window.print()`(`lib/pdfPrint.tsx`)이므로 **이 한 곳이 미리보기+PDF 동시 적용**.
```css
img.twemoji {
  height: 1em;
  width: 1em;
  margin: 0 0.05em;
  vertical-align: -0.125em;
  display: inline-block;
}
```

### 6-5. `app/settings/page.tsx` — 출처 표기 (CC BY 4.0 의무)
닉네임 편집 아래에 "정보/라이선스" 섹션 추가, 한 줄:
> Emoji artwork by **Twemoji** (jdecked/twemoji), licensed under **CC BY 4.0**.

(원문 표기. jdecked 저장소 링크 걸면 더 안전.)

### 6-6. `docs/roadmap.md`
Phase 39 행 추가(완료 시점에).

## 7. 성능 / UX 메모

- 전체 ~3700개를 한 번에 `<img>` 마운트하면 CDN 요청 폭주 → **활성 그룹/검색 결과만 렌더** + `loading="lazy"`.
- `emojibase-data` 동적 import로 초기 번들 영향 0, 피커 첫 오픈 시 1회 로드 후 메모리 캐시.
- jsDelivr는 SVG당 ~1–2KB + 브라우저/엣지 캐시 → 반복 사용 시 사실상 즉시.
- 스킨톤(`skins`)·키캡은 MVP 제외. 그리드는 기본 이모지만.

## 8. 알려진 리스크 & 검증

1. **인쇄 시 CDN 로드 타이밍** — `PrintableContent`는 새로 렌더되므로 `window.print()` 시점에 이모지 SVG가 아직 안 받아졌을 수 있음(PDF에서 빈칸). 
   → 대응: `printProblemPdf`에서 print 직전 `Array.from(node.querySelectorAll('img.twemoji')).map(img => img.decode().catch(()=>{}))` 를 `Promise.all`로 대기. 그래도 불안정하면 인쇄용만 self-host로 전환.
2. **KaTeX 내부 오염** — 수식 안에 이모지가 들어가는 경우는 드물지만, `rehypeTwemoji`가 KaTeX 렌더 결과 span을 건드리지 않는지 확인(이모지 포함 수식 1건 테스트). 문제 시 `.katex` 하위 노드 skip 가드 추가.
3. **`@`·기호류** — `©®™` 등은 `ignore`로 제외(이미 옵션에 포함). 수학 기호(→, ×, ÷ 등)는 twemoji 대상이 아니라 안전하지만, 화살표 등 일부가 이미지화되면 `ignore`에 추가.
4. **버전 핀 불일치** — `TWEMOJI_BASE`(렌더)와 `twemojiSvgUrl`(피커)가 같은 `TWEMOJI_VERSION`을 쓰는지 확인(어긋나면 피커 미리보기와 문서 렌더가 다른 파일 참조).
5. **emojibase 필드명** — 설치 버전에서 `ko/data.json` 실항목으로 `label/annotation/tags`, `messages.json` 그룹 키 확인 후 매핑 확정.

## 9. 수용 기준 (체크리스트)

- [ ] 툴바 이모지 버튼 → 팝오버에 카테고리·검색·최근 표시, 그리드가 **Twemoji SVG**로 보임
- [ ] 한국어 검색("아보카도", "웃음" 등) 동작
- [ ] 이모지 클릭 → 에디터에 생 유니코드 삽입, Firestore raw_text에 유니코드 그대로 저장(이미지 태그 아님)
- [ ] 미리보기에서 해당 이모지가 컬러 SVG로 렌더, 글자 높이에 정렬
- [ ] PDF 출력물에도 동일 이모지 렌더(빈칸 아님)
- [ ] 줌/확대 시 이모지 깨지지 않음(SVG)
- [ ] 설정 페이지에 CC BY 4.0 출처 표기 노출
- [ ] 초기 번들 크기 유의미한 증가 없음(피커 첫 오픈 전까지 emojibase 미로드)

## 10. 작업 순서 (CLI)

1. `npm install emojibase-data @yuna0x0/rehype-twemoji`
2. `lib/twemoji-url.ts` 생성 → CDN 태그 1건 브라우저로 resolve 확인
3. `lib/emoji-data.ts` 생성 → `ko/data.json` 한 항목 콘솔로 필드 확인 후 매핑 확정
4. `components/editor/EmojiPickerDropdown.tsx` 생성(SpecialChar 복제 → 확장)
5. `UnifiedToolbar.tsx` 아이콘 + 그룹 등록
6. `EditorPreview.tsx` / `PrintableContent.tsx` `rehypeTwemoji` 추가
7. `app/globals.css` `img.twemoji` 규칙
8. `app/settings/page.tsx` 출처 표기
9. 로컬 테스트(수용 기준) → 인쇄 타이밍 리스크 확인 → 필요 시 print decode 대기 추가
10. `docs/roadmap.md` Phase 39 행 추가
11. (커밋까지만, push는 덕수가 직접)
