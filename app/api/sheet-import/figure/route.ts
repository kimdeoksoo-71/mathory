/**
 * Phase 61e — Drive 그림 읽기 프록시
 *
 * GET /api/sheet-import/figure?name=<파일명>
 * headers: Authorization: Bearer <Firebase ID token>
 * 응답:    이미지 바이트 (Content-Type = 원본, X-Fig-Duplicates = 동명 파일 수)
 *
 * Data_DS 본문의 그림은 **파일명 문자열**이고 실물은 Drive `PBMAI/IMAGE_FIG`에 비공개로 있다.
 * 그래서 Mathory가 파일명으로 실물을 가져오는 경로를 새로 만든다.
 *
 * ⚠️ 표기는 두 가지다(61e-2차) — 구형 `\includegraphics{<stem>_figN.jpg}` 와, GAS 패치 11이
 *    2026-09-01부터 만드는 `![<stem>_figN.jpg](https://drive.google.com/…)`. 어느 쪽이든
 *    **이 라우트에 오는 것은 파일명뿐**이다(링크의 fileId는 쓰지 않는다 — 아래 D29 주석).
 *
 * ⚠️ **`../route.ts`(시트 읽기)를 건드리지 않는다.** 그쪽 JWT는 스코프가
 *    `spreadsheets.readonly` 하나로 잠겨 있어 "쓰기 API를 안 부르는" 게 아니라 **못 부른다**.
 *    거기에 `drive.readonly`를 더하면 그 잠금이 시트 라우트에서도 느슨해진다 →
 *    이 라우트가 **자기 JWT 싱글턴**을 갖는다(계획서 D20).
 *
 * ⚠️ **무인증이면 Drive 폴더 전체가 인터넷에 노출된다**(61a D1과 같은 이유).
 *    `verifyUid` + 허용목록 + 폴더 ID 고정 + 파일명 화이트리스트 4중으로 좁힌다.
 *
 * ⚠️ 브라우저 `<img src="/api/…">`로는 못 쓴다 — Authorization 헤더를 실을 수 없어 401이 된다.
 *    호출부는 `fetch` → `blob()` → `URL.createObjectURL`이어야 한다(계획서 N-5).
 *
 * Firestore는 건드리지 않는다. 저장은 전부 클라이언트가 기존 CRUD로 한다(61a 아키텍처).
 */

import { NextRequest, NextResponse } from 'next/server';
import { JWT } from 'google-auth-library';
import { ApiError, verifyUid } from '../../../../lib/apiAuth';
import { FIG_NAME_RE } from '../../../../lib/sheetImport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/* 허용 파일명 `FIG_NAME_RE`는 `lib/sheetImport.ts`가 소유한다(61e-2차 D32) —
 * **클라의 분할 게이트와 서버의 조회 게이트가 한 벌이어야** 한다. 사본이 갈리면
 * 접미사만 맞는 이름이 클라에서 분할된 뒤 여기서 400으로 죽는다. */

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

/* ═══ 환경변수 ═══ */

function readEnv() {
  const missing: string[] = [];
  const need = (name: string) => {
    const v = process.env[name];
    if (!v) { missing.push(name); return ''; }
    return v;
  };
  const email = need('GOOGLE_SA_EMAIL');
  const key = need('GOOGLE_SA_PRIVATE_KEY');
  const folderId = need('AUDITION_FIG_FOLDER_ID');
  const allowed = need('AUDITION_ALLOWED_UIDS');
  const apiKey = need('NEXT_PUBLIC_FIREBASE_API_KEY');
  if (missing.length) {
    // 값은 절대 노출하지 않고 "어떤 변수가 없는지" 이름만 알린다.
    throw new ApiError(500, `서버 환경변수가 설정되지 않았습니다: ${missing.join(', ')}`);
  }
  return {
    email, key, apiKey,
    folderId: folderId.trim().replace(/^\/+|\/+$/g, ''),
    allowedUids: allowed.split(',').map((s) => s.trim()).filter(Boolean),
  };
}

/* ═══ Drive ═══ */

// 모듈 스코프 싱글턴 — warm 인스턴스에서 액세스 토큰 캐시를 재사용한다.
// 시트 라우트의 것과 **별개 객체**이고 스코프도 다르다(D20).
let jwtClient: JWT | null = null;
function getJwt(email: string, key: string): JWT {
  if (!jwtClient) {
    jwtClient = new JWT({
      email,
      key: key.replace(/\\n/g, '\n'),   // Vercel은 리터럴 `\n`으로 저장된다
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
  }
  return jwtClient;
}

async function getToken(env: ReturnType<typeof readEnv>): Promise<string> {
  try {
    const { token } = await getJwt(env.email, env.key).getAccessToken();
    if (!token) throw new Error('빈 토큰');
    return token;
  } catch {
    jwtClient = null;   // 손상된 자격증명을 warm 인스턴스에 남기지 않는다
    throw new ApiError(502, 'Drive 자격증명으로 인증하지 못했습니다 — 서비스 계정 설정을 확인하세요');
  }
}

/**
 * 파일명 → 파일 id.
 *
 * ⚠️ **Drive는 동명 파일을 허용한다** — GAS를 다시 돌리면 같은 이름이 또 생긴다.
 *    정렬 없이 `files[0]`을 쓰면 어느 판본이 올지 알 수 없으므로 `modifiedTime desc`로
 *    최신을 고르고, 2건 이상이면 호출부가 알 수 있게 개수를 함께 돌려준다.
 */
async function findFile(name: string, token: string, env: ReturnType<typeof readEnv>) {
  const q = `name='${name}' and '${env.folderId}' in parents and trashed=false`;
  const url = 'https://www.googleapis.com/drive/v3/files'
    + `?q=${encodeURIComponent(q)}`
    + '&fields=files(id,name,mimeType)'
    + `&orderBy=${encodeURIComponent('modifiedTime desc')}&pageSize=2`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (res.status === 401 || res.status === 403) {
    // 서비스 계정에 폴더가 공유되지 않았거나 Drive API가 꺼져 있다.
    throw new ApiError(502, 'Drive 폴더에 접근할 수 없습니다 — 서비스 계정 공유와 Drive API 활성화를 확인하세요');
  }
  if (!res.ok) throw new ApiError(502, `Drive를 조회하지 못했습니다 (HTTP ${res.status})`);

  const files = (await res.json())?.files ?? [];
  return { file: files[0] as { id: string; mimeType?: string } | undefined, count: files.length };
}

/* ═══ 핸들러 ═══ */

export async function GET(req: NextRequest) {
  try {
    const env = readEnv();
    await verifyUid(req.headers.get('authorization'), env.apiKey, env.allowedUids);

    const raw = (req.nextUrl.searchParams.get('name') ?? '').trim();
    if (!raw) return fail(400, 'name 파라미터가 필요합니다');

    // ⚠️ 정규식 검사는 **NFC 정규화 뒤**에 한다(61e-2차 C4).
    //    NFD 한글은 U+1100 계열 자모라 `[가-힣ㄱ-ㅎㅏ-ㅣ]`에 안 걸린다 → 그냥 검사하면
    //    NFD 이름이 **검색해 보기도 전에 400**으로 죽는다(61e에도 잠복해 있던 버그).
    const nfc = raw.normalize('NFC');
    if (!FIG_NAME_RE.test(nfc)) {
      return fail(400, '허용되지 않는 파일명입니다 — 시트가 만든 그림 파일만 가져올 수 있습니다');
    }

    const token = await getToken(env);

    /* GAS 패치 11이 본문의 alt를 `nfc_()`로 만드는데(Datalatex_To_Data_DS.gs:184-191)
       Drive의 실제 파일명은 비정규화 원형이다(Mathpix 그림 추출.gs:229 — `stemOf_`가
       정규화하지 않고, 파일명 수집도 "비교만 NFC, 기록은 원본명"이다). 두 형태가 다 오므로
       **NFC 먼저, 0건이면 NFD로 한 번 더** 찾는다(D29).
       ⚠️ 이름으로 찾는다 — 링크의 fileId를 쓰지 않는 이유는 그림을 재추출하면 `saveBlob_`이
          동명 파일을 휴지통에 보내고 새로 만들어, 시트에 박힌 id가 **옛 휴지통 판본**을
          가리키기 때문이다. 이름 검색은 `trashed=false`라 늘 최신을 집는다.
       ⚠️ GAS처럼 폴더 밖(드라이브 전역)으로 넓히지 말 것 — 폴더 고정이 4중 방어의 한 축이다. */
    let hit: { file?: { id: string; mimeType?: string }; count: number } | null = null;
    for (const variant of Array.from(new Set([nfc, raw.normalize('NFD')]))) {
      const r = await findFile(variant, token, env);
      if (r.file) { hit = r; break; }
    }
    if (!hit?.file) return fail(404, '그림 파일을 Drive에서 찾지 못했습니다');
    const { file, count } = hit;

    const media = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!media.ok) throw new ApiError(502, `그림을 내려받지 못했습니다 (HTTP ${media.status})`);

    const buf = await media.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': file.mimeType || media.headers.get('content-type') || 'application/octet-stream',
        'Content-Length': String(buf.byteLength),
        // 사용자별 인가를 거친 응답이라 공용 캐시에 남기지 않는다. 재사용은 클라가 맵으로 한다.
        'Cache-Control': 'private, no-store',
        'X-Fig-Duplicates': String(count),
      },
    });
  } catch (e) {
    if (e instanceof ApiError) return fail(e.status, e.userMessage);
    console.error('[sheet-import/figure] 예상치 못한 오류:', e);
    return fail(500, '그림을 가져오는 중 오류가 발생했습니다');
  }
}
