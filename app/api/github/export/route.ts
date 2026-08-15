import { NextRequest, NextResponse } from 'next/server';
import { webcrypto, createHash } from 'node:crypto';
import { canonicalize } from '../../../../lib/version/canonicalize';
import { sha256 } from '../../../../lib/version/hash';
import {
  toMarkdown, toJson, toIndexMarkdown, parseIndexSeq, safeTitle,
  versionMdPath, versionJsonPath, indexPath, seqSlug,
} from '../../../../lib/version/exportMd';
import type { VersionContent } from '../../../../types/version';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;   // Firestore REST 1 + GitHub GET 3 + PUT 3 = 최대 왕복 7회

// hash.ts는 전역 crypto(Web Crypto)를 쓴다. Node 22엔 이미 있지만 방어적으로 채운다.
if (!globalThis.crypto) (globalThis as { crypto?: unknown }).crypto = webcrypto;

/**
 * POST /api/github/export
 * headers: Authorization: Bearer <Firebase ID token>
 * body: { problemId, versionId, content }
 *
 * 이름이 붙은(name != null) 버전을 콘텐츠 레포에 md + json으로 커밋한다.
 *
 * 인증: 클라가 릴레이한 ID 토큰으로 Firestore REST를 직접 호출한다. 토큰이 없거나
 *   위조·만료거나 남의 문항이면 Firestore가 401/403을 주므로 **검증 코드가 따로 없다**
 *   (보안 규칙 verOwner가 대행). firebase-admin 없이 인증이 서는 이유.
 * 무결성: 서버가 읽은 content_hash와 클라가 보낸 content의 해시를 대조한다.
 *   불일치면 409 — 클라가 임의 내용을 밀어 넣을 수 없다.
 *
 * ⚠️ 게이트는 name != null 이지 trigger === 'named'가 아니다. 무변경 상태에서
 *    이름을 저장하면 기존 버전(trigger가 manual_save·editor_exit)에 name만 붙기
 *    때문에(snapshot.ts named_existing), trigger로 걸면 그 버전은 영영 못 내보낸다.
 */

type Json = Record<string, unknown>;

function fail(status: number, error: string, extra?: Json) {
  return NextResponse.json({ error, ...extra }, { status });
}

/**
 * 사용자에게 그대로 보여줄 수 있는 오류. 메시지는 화이트리스트로만 만든다 —
 * 원본 에러 객체를 흘리면 토큰·내부 경로가 새어나갈 수 있다.
 * (tsconfig가 strict:false라 판별 유니온 좁히기가 안 먹으므로 반환값 대신 예외를 쓴다)
 */
class ApiError extends Error {
  constructor(public status: number, public userMessage: string) { super(userMessage); }
}

/* ═══ Firestore REST ═══ */

interface VersionMetaLite {
  name: string | null;
  seq: number;
  contentHash: string;
  createdAt: string;
}

async function readVersionMeta(
  projectId: string, problemId: string, versionId: string, authorization: string,
): Promise<VersionMetaLite> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)`
    + `/documents/problems/${encodeURIComponent(problemId)}`
    + `/versions/${encodeURIComponent(versionId)}`;

  const res = await fetch(url, { headers: { Authorization: authorization }, cache: 'no-store' });

  if (res.status === 401) throw new ApiError(401, '로그인이 만료되었습니다 — 새로고침 후 다시 시도하세요');
  if (res.status === 403) throw new ApiError(403, '이 문항의 버전에 접근할 수 없습니다');
  if (res.status === 404) throw new ApiError(404, '버전을 찾을 수 없습니다');
  if (!res.ok) throw new ApiError(502, '버전 정보를 읽지 못했습니다');

  const fields = (await res.json())?.fields;
  if (!fields) throw new ApiError(502, '버전 정보가 비어 있습니다');

  // ⚠️ REST는 값을 타입 래핑해서 준다. integerValue는 숫자가 아니라 '문자열'이다.
  return {
    name: typeof fields.name?.stringValue === 'string' ? fields.name.stringValue : null,
    seq: Number(fields.seq?.integerValue ?? fields.seq?.doubleValue ?? 0),
    contentHash: String(fields.content_hash?.stringValue ?? ''),
    createdAt: String(fields.created_at?.timestampValue ?? ''),
  };
}

/* ═══ GitHub Contents API ═══ */

interface GhFile { sha: string; contentB64: string | null; }   // contentB64=null → 1MB 초과

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/** GitHub 응답을 사용자용 한국어로 매핑. 원본 에러 객체는 절대 흘리지 않는다. */
function ghFail(status: number, repo: string, branch: string): ApiError {
  if (status === 401 || status === 403) {
    return new ApiError(status, 'GitHub 토큰이 만료되었거나 권한이 없습니다 — 환경변수 GITHUB_EXPORT_TOKEN 갱신이 필요합니다');
  }
  if (status === 404) {
    return new ApiError(404, `콘텐츠 레포 또는 브랜치를 찾을 수 없습니다: ${repo}@${branch}`);
  }
  if (status === 409) return new ApiError(409, 'GitHub에서 충돌이 발생했습니다 — 다시 시도하세요');
  if (status === 422) return new ApiError(422, 'GitHub이 요청을 거부했습니다 (422)');
  return new ApiError(502, `GitHub 요청 실패 (${status})`);
}

async function ghGet(repo: string, branch: string, token: string, path: string): Promise<GhFile | null> {
  const url = `https://api.github.com/repos/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers: ghHeaders(token), cache: 'no-store' });
  if (res.status === 404) return null;                       // 신규 파일
  if (!res.ok) throw ghFail(res.status, repo, branch);
  const data = await res.json();
  // 1MB 초과면 content가 빈 문자열로 온다 → blob sha로 비교해야 한다.
  const raw = typeof data.content === 'string' ? data.content.replace(/\n/g, '') : '';
  return { sha: String(data.sha), contentB64: raw ? raw : null };
}

async function ghPut(
  repo: string, branch: string, token: string,
  path: string, contentB64: string, message: string, sha?: string,
): Promise<{ commitSha: string; commitUrl: string }> {
  const url = `https://api.github.com/repos/${repo}/contents/${encodeURI(path)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: contentB64, branch, ...(sha ? { sha } : {}) }),
  });
  if (!res.ok) throw ghFail(res.status, repo, branch);
  const data = await res.json();
  return { commitSha: String(data.commit?.sha ?? ''), commitUrl: String(data.commit?.html_url ?? '') };
}

/** git blob sha — 1MB 초과 파일은 Contents API가 내용을 안 주므로 이걸로 비교한다. */
function gitBlobSha(text: string): string {
  const buf = Buffer.from(text, 'utf8');
  return createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
}

interface PutOutcome { skipped: boolean; commitSha: string; commitUrl: string; }

/**
 * 동일 내용이면 커밋하지 않는다(skip). 파일별로 독립 판정한다.
 * 409(sha 충돌)는 다른 커밋이 끼어든 것이므로 sha를 다시 읽어 1회만 재시도한다.
 */
async function putIfChanged(
  repo: string, branch: string, token: string,
  path: string, text: string, message: string,
): Promise<PutOutcome> {
  const contentB64 = Buffer.from(text, 'utf8').toString('base64');

  const attempt = async (): Promise<PutOutcome> => {
    const existing = await ghGet(repo, branch, token, path);
    if (existing) {
      const same = existing.contentB64 !== null
        ? existing.contentB64 === contentB64
        : existing.sha === gitBlobSha(text);          // 1MB 초과 경로
      if (same) return { skipped: true, commitSha: '', commitUrl: '' };
    }
    const r = await ghPut(repo, branch, token, path, contentB64, message, existing?.sha);
    return { skipped: false, ...r };
  };

  try {
    return await attempt();
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) return await attempt();
    throw e;
  }
}

/* ═══ 핸들러 ═══ */

export async function POST(req: NextRequest) {
  try {
    const authorization = req.headers.get('authorization') || '';
    if (!authorization.startsWith('Bearer ')) {
      return fail(401, '로그인이 만료되었습니다 — 새로고침 후 다시 시도하세요');
    }

    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const token = process.env.GITHUB_EXPORT_TOKEN;
    const repo = process.env.GITHUB_CONTENT_REPO;
    const branch = process.env.GITHUB_CONTENT_BRANCH || 'main';
    if (!projectId) return fail(500, '서버 설정 누락: NEXT_PUBLIC_FIREBASE_PROJECT_ID');
    if (!token || !repo) return fail(500, '서버 설정 누락: GITHUB_EXPORT_TOKEN / GITHUB_CONTENT_REPO');

    const body = await req.json().catch(() => null);
    const problemId = String(body?.problemId || '');
    const versionId = String(body?.versionId || '');
    const content = body?.content as VersionContent | undefined;
    if (!problemId || !versionId || !content?.tabs || !content?.meta) {
      return fail(400, '요청 형식이 올바르지 않습니다');
    }

    const serialized = JSON.stringify(content);
    if (serialized.length > 4_000_000) return fail(413, '버전 본문이 너무 큽니다');

    // 클라 버그 조기 발견용 — block_key는 해시 밖이라 대조로는 잡히지 않는다.
    for (const tab of content.tabs) {
      const keys = new Set<string>();
      for (const b of tab.blocks || []) {
        if (!b.block_key || keys.has(b.block_key)) return fail(400, '버전 본문이 손상되었습니다');
        keys.add(b.block_key);
      }
    }

    // 1) 인증 + 신뢰 가능한 메타 (규칙이 소유 검사를 대행)
    const { name, seq, contentHash, createdAt } =
      await readVersionMeta(projectId, problemId, versionId, authorization);

    // 2) 게이트 — 서버가 읽은 값 기준이라 클라가 우회할 수 없다
    if (!name) return fail(403, '이름이 붙은 버전만 내보낼 수 있습니다');

    // 3) 무결성
    const computed = await sha256(canonicalize(content));
    if (computed !== contentHash) {
      return fail(409, '버전 본문이 일치하지 않습니다 — 새로고침 후 다시 시도하세요', {
        expected: contentHash, computed,   // 진단용. 해시는 비밀이 아니다.
      });
    }

    // 4) 변환 (exported_at은 파일에 넣지 않는다 — 넣으면 skip 판정이 무력해진다)
    const md = toMarkdown(content, { problemId, seq, name, contentHash, createdAt });
    const json = toJson(content);
    const title = safeTitle(content.meta.title || '');
    const mdPath = versionMdPath(problemId, seq);
    const jsonPath = versionJsonPath(problemId, seq);
    const idxPath = indexPath(problemId);
    const msg = `export: ${title} v${seq} — ${name} (${contentHash.slice(0, 8)})`;

    // 5) 본체 → index 순. 지시자(index)는 본체가 다 올라간 뒤에만 갱신한다.
    const mdOut = await putIfChanged(repo, branch, token, mdPath, md, msg);
    const jsonOut = await putIfChanged(repo, branch, token, jsonPath, json, msg);

    // index는 seq가 역행하지 않을 때만. 파싱 실패 시엔 덮어쓴다(레포는 미러).
    let idxOut: PutOutcome = { skipped: true, commitSha: '', commitUrl: '' };
    const existingIdx = await ghGet(repo, branch, token, idxPath);
    const existingSeq = existingIdx?.contentB64
      ? parseIndexSeq(Buffer.from(existingIdx.contentB64, 'base64').toString('utf8'))
      : null;
    if (existingSeq === null || seq >= existingSeq) {
      idxOut = await putIfChanged(
        repo, branch, token, idxPath, toIndexMarkdown(md, seq),
        `export: index → v${seq} (${problemId})`,
      );
    }

    const first = [mdOut, jsonOut, idxOut].find((o) => !o.skipped);
    return NextResponse.json({
      commitUrl: first?.commitUrl ?? null,
      commitSha: first?.commitSha ?? null,
      path: mdPath,
      skipped: !first,
      exportedAt: new Date().toISOString(),
      repo,
    });
  } catch (e) {
    if (e instanceof ApiError) return fail(e.status, e.userMessage);
    console.error('[Phase55b] GitHub export 실패:', e);
    return fail(500, '내보내기에 실패했습니다');
  }
}
