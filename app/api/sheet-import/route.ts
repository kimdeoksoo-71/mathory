/**
 * Phase 61a — audition 스프레드시트 읽기 프록시 · Phase 72 — 원본 파일 2종 + 문항장부 ID 선택
 *
 * POST /api/sheet-import
 * headers: Authorization: Bearer <Firebase ID token>
 * body:    { source?: 'audition' | 'latex', sheet: 'Data_DS' | 'Stack', rows?: string,
 *            includePreselected?: boolean, jangbuIds?: string[] }
 *          `source` 생략 = 'audition'(문제 검토 파일 — 옛 호출 호환). `jangbuIds`는 `latex`에서만(아니면 400).
 * 응답:    { header: string[], headerWarnings: string[], rows: [{ rowIndex, cells[16] }], unmatched: string[] }
 *          `unmatched` = 요청한 문항장부 ID 중 L열에 없던 것(요청 순서). 옛 호출도 `[]`로 온다.
 *
 * **이 라우트는 시트를 읽기만 한다.** 자격증명 자체를 `spreadsheets.readonly` 스코프로
 * 잠가 두었으므로 "쓰기 API를 부르지 않는" 것이 아니라 **부를 수 없다**.
 * Firestore는 건드리지 않는다 — 저장은 전부 클라이언트가 기존 CRUD로 한다.
 *
 * ⚠️ 인증을 여기서 **직접** 해야 하는 이유:
 *    `app/api/github/export`는 릴레이받은 ID 토큰을 Firestore REST에 그대로 써서
 *    보안 규칙이 인가를 대행하므로 검증 코드가 없다. 이 라우트는 Firestore를 안 거쳐
 *    그 대행이 불가능하다 → `identitytoolkit accounts:lookup`으로 토큰을 검증하고
 *    `AUDITION_ALLOWED_UIDS` 허용목록으로 좁힌다. 무인증이면 시트 전문이 공개된다.
 *
 * Phase 72 D1 — 원본은 `source`(파일) + `sheet`(시트) 두 축. 스프레드시트 ID는 파일마다 환경변수 하나
 *    (`AUDITION_SPREADSHEET_ID` · `LATEX_SPREADSHEET_ID`). 둘 다 **선택**이고 요청한 파일의 것이 없을 때만 500.
 */

import { NextRequest, NextResponse } from 'next/server';
import { JWT } from 'google-auth-library';
import {
  SHEET_COL, SHEET_COL_COUNT, JANGBU_ID_MAX, checkHeaders, parseRowInput, parseJangbuIds, normalizeJangbuId,
  type HeaderProfile,
} from '../../../lib/sheetImport';
import { ApiError, verifyUid } from '../../../lib/apiAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;   // Stack 전량(12MB) 읽기가 실측 1.5초. Latex 변환 Data_DS 전량(~19MB)도 안. 여유를 크게 둔다.

type SheetName = 'Data_DS' | 'Stack';
type SourceName = HeaderProfile;   // 'audition' | 'latex'

/** 원본 파일 표. 조합이 표에 없으면 400. */
const SOURCES = {
  audition: { envId: 'AUDITION_SPREADSHEET_ID', label: '문제 검토', sheets: ['Data_DS', 'Stack'] as readonly SheetName[] },
  latex:    { envId: 'LATEX_SPREADSHEET_ID',    label: 'Latex 변환', sheets: ['Data_DS'] as readonly SheetName[] },
} as const;

/** Vercel 응답 한도(4.5MB) 앞에서 멈춘다. 행당 실측 ~3KB → 약 1,300행 지점. */
const MAX_PAYLOAD_BYTES = 4_000_000;

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

/* ═══ 환경변수 ═══ */

function readEnv() {
  const missing: string[] = [];
  const need = (name: string) => {
    const v = process.env[name];
    if (!v) { missing.push(name); return ''; }
    return v;
  };
  // 붙여넣기 실수(앞뒤 `/`·공백)를 원인 모를 404로 만들지 않는다.
  const cleanId = (v: string | undefined) => (v ?? '').trim().replace(/^\/+|\/+$/g, '');
  const email = need('GOOGLE_SA_EMAIL');
  const key = need('GOOGLE_SA_PRIVATE_KEY');
  const allowed = need('AUDITION_ALLOWED_UIDS');
  const apiKey = need('NEXT_PUBLIC_FIREBASE_API_KEY');
  if (missing.length) {
    // 값은 절대 노출하지 않고 "어떤 변수가 없는지" 이름만 알린다.
    throw new ApiError(500, `서버 환경변수가 설정되지 않았습니다: ${missing.join(', ')}`);
  }
  // 시트 ID 둘은 선택 — body의 `source`를 알기 전이라 여기서 판정하지 않는다(Phase 72 E5).
  const sheetIds: Partial<Record<SourceName, string>> = {};
  for (const src of Object.keys(SOURCES) as SourceName[]) {
    const id = cleanId(process.env[SOURCES[src].envId]);
    if (id) sheetIds[src] = id;
  }
  return {
    email, key, apiKey, sheetIds,
    allowedUids: allowed.split(',').map((s) => s.trim()).filter(Boolean),
  };
}

/* ═══ 인증 ═══ */

// Phase 61b: `verifyUid`·`ApiError`는 `lib/apiAuth.ts`로 이동(검증 라우트와 공용).

/* ═══ 시트 읽기 ═══ */

// 모듈 스코프 싱글턴 — warm 인스턴스에서 액세스 토큰 캐시를 재사용한다.
let jwtClient: JWT | null = null;
function getJwt(email: string, key: string): JWT {
  if (!jwtClient) {
    jwtClient = new JWT({
      email,
      key: key.replace(/\\n/g, '\n'),   // Vercel은 리터럴 `\n`으로 저장된다
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
  }
  return jwtClient;
}

/**
 * ⚠️ Sheets는 **행 끝의 빈 셀을 잘라서** 준다(실측: Data_DS 2,224행 중 2,186행이 16칸 미만).
 *    인덱스로 접근하기 전에 반드시 16칸으로 패딩해야 한다.
 */
async function readSheet(
  sheet: SheetName, sheetId: string, envId: string, env: { email: string; key: string },
): Promise<unknown[][]> {
  let token: string | null | undefined;
  try {
    ({ token } = await getJwt(env.email, env.key).getAccessToken());
  } catch {
    jwtClient = null;   // 손상된 자격증명을 warm 인스턴스에 남기지 않는다
    throw new ApiError(502, '스프레드시트 자격증명으로 인증하지 못했습니다 — 서비스 계정 설정을 확인하세요');
  }

  const range = encodeURIComponent(`${sheet}!A1:P`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`
            + `?valueRenderOption=UNFORMATTED_VALUE&majorDimension=ROWS`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (res.status === 403) throw new ApiError(502, '스프레드시트에 접근할 수 없습니다 — 서비스 계정에 뷰어 권한이 있는지 확인하세요');
  if (res.status === 404) throw new ApiError(502, `스프레드시트를 찾을 수 없습니다 — ${envId}를 확인하세요`);
  if (!res.ok) throw new ApiError(502, `스프레드시트를 읽지 못했습니다 (HTTP ${res.status})`);

  return (await res.json())?.values ?? [];
}

/**
 * M열 체크박스 판정. **원시값으로 판정해야 한다.**
 * `UNFORMATTED_VALUE`는 체크 해제를 boolean `false`로 주는데, 이걸 먼저 문자열로 바꾸면
 * `"false"` — 즉 **비어 있지 않은 문자열** — 이 되어 truthy 검사가 전부 참이 된다.
 */
const isChecked = (v: unknown): boolean =>
  v === true || v === 1 || (typeof v === 'string' && ['true', 'y', 'yes', '예', 'o'].includes(v.trim().toLowerCase()));

/* ═══ 핸들러 ═══ */

export async function POST(req: NextRequest) {
  try {
    const env = readEnv();
    await verifyUid(req.headers.get('authorization'), env.apiKey, env.allowedUids);

    const body = (await req.json().catch(() => ({}))) as {
      source?: string; sheet?: string; rows?: string; includePreselected?: boolean; jangbuIds?: unknown;
    };

    // Phase 72 D1 — 원본 파일. 생략 = 문제 검토(옛 호출 호환).
    const source = (body.source ?? 'audition') as SourceName;
    if (!(source in SOURCES)) return fail(400, `source는 ${Object.keys(SOURCES).join(' 또는 ')}여야 합니다`);
    const src = SOURCES[source];
    const sheet = body.sheet as SheetName;
    if (!src.sheets.includes(sheet)) return fail(400, `'${src.label}' sheet는 ${src.sheets.join(' 또는 ')}여야 합니다`);

    const rowsText = (body.rows ?? '').trim();
    const wanted = rowsText ? parseRowInput(rowsText) : [];
    if (rowsText && wanted.length === 0) return fail(400, '행 범위를 해석하지 못했습니다 (예: 15-32 또는 15, 17, 20-25)');

    // Phase 72 D5·D6′ — 문항장부 ID 목록. 서버도 같은 파서로 재검증하고 invalid는 버린다(B8). latex 전용.
    const jangbuIds = Array.isArray(body.jangbuIds)
      ? parseJangbuIds(body.jangbuIds.map((x) => String(x ?? '')).join(',')).ids
      : [];
    if (source !== 'latex' && jangbuIds.length > 0) {
      return fail(400, "문항장부 ID 목록은 'Latex 변환 : Data_DS'에서만 쓸 수 있습니다");
    }
    if (jangbuIds.length > JANGBU_ID_MAX) return fail(400, `문항장부 ID는 한 번에 ${JANGBU_ID_MAX}개까지입니다 — 나눠서 가져오세요`);

    if (!rowsText && !body.includePreselected && jangbuIds.length === 0) {
      return fail(400, '행 범위를 입력하거나 "사전 선별된 문제 포함하기"를 켜세요 (또는 문항장부 ID 목록)');
    }

    const sheetId = env.sheetIds[source];
    if (!sheetId) throw new ApiError(500, `서버 환경변수가 설정되지 않았습니다: ${src.envId}`);

    const values = await readSheet(sheet, sheetId, src.envId, env);
    const pad = (r: unknown[] | undefined) =>
      Array.from({ length: SHEET_COL_COUNT }, (_, i) => String(r?.[i] ?? ''));

    const header = pad(values[0]);
    const headerWarnings = checkHeaders(header, source);

    const wantedSet = new Set(wanted);
    const jangbuSet = new Set(jangbuIds);
    const matchedIds = new Set<string>();
    let preselected = 0;
    const rows: { rowIndex: number; cells: string[] }[] = [];

    for (let i = 1; i < values.length; i++) {
      const rowIndex = i + 1;                       // 헤더가 1행 → 데이터는 2행부터
      const raw = values[i];
      const checked = isChecked(raw?.[SHEET_COL.get]);
      if (checked) preselected++;

      // L열 매칭은 **선택 여부와 무관하게 전 행**에서 모아 `unmatched`를 낸다(D6′). 같은 ID가 둘 이상이면 전부(D3가 거른다).
      let byJangbu = false;
      if (jangbuSet.size > 0) {
        const id = normalizeJangbuId(String(raw?.[SHEET_COL.jangbu_id] ?? ''));
        if (id && jangbuSet.has(id)) { byJangbu = true; matchedIds.add(id); }
      }

      // rows · includePreselected · jangbuIds — 셋의 합집합
      if (!(wantedSet.has(rowIndex) || (body.includePreselected && checked) || byJangbu)) continue;

      const cells = pad(raw);
      // 시트 말미의 빈 행 스킵 — 체크박스가 전 행에 깔려 있어 lastRow가 크게 잡힌다
      if (!cells[SHEET_COL.id].trim() && !cells[SHEET_COL.problem_stem].trim()) continue;

      rows.push({ rowIndex, cells });
    }

    // M열이 하나도 켜져 있지 않으면 "아무 일도 안 일어난 것"처럼 보인다 → 원인을 알려 준다.
    if (body.includePreselected && preselected === 0) {
      headerWarnings.push('M열(get)에 선택된 행이 없습니다 — 시트에서 체크박스를 켜야 사전 선별로 가져옵니다');
    }

    const unmatched = jangbuIds.filter((id) => !matchedIds.has(id));   // 요청 순서 유지(Q8)

    const payload = { header, headerWarnings, rows, unmatched };
    const size = Buffer.byteLength(JSON.stringify(payload));
    if (size > MAX_PAYLOAD_BYTES) {
      return fail(413, `선택한 범위가 너무 큽니다 (${rows.length}행, 약 ${(size / 1048576).toFixed(1)}MB). `
                     + '범위를 나눠서 가져오세요 (한 번에 1,000행 이하 권장)');
    }
    return NextResponse.json(payload);
  } catch (e) {
    if (e instanceof ApiError) return fail(e.status, e.userMessage);
    console.error('[sheet-import] 예상치 못한 오류:', e);
    return fail(500, '시트를 가져오는 중 오류가 발생했습니다');
  }
}
