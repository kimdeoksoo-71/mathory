import type { VersionContent } from '../../types/version';

/**
 * Phase 55b — VersionContent → GitHub 아카이브 산출물(md · json).
 *
 * 전부 순수 함수다. 같은 입력이면 같은 바이트가 나와야 한다 —
 * 서버는 기존 파일과 바이트를 비교해 동일하면 커밋을 건너뛰기(skip) 때문이다.
 *
 * ⚠️ 그래서 파일 안에 export 시각을 넣지 않는다. 넣으면 md가 매 호출 달라져
 *    무변경 재내보내기마다 의미 없는 커밋이 쌓인다. frontmatter에는 버전의
 *    불변 시각(created_at)만 담고, 내보낸 시각은 version doc의
 *    github_export.exported_at에만 기록한다.
 *
 * 렌더 재현은 목표가 아니다(아카이브 목적). 블록은 타입 분기 없이 raw_text를
 * 그대로 흘리고, 타입은 HTML 주석 마커로만 남긴다.
 */

export interface ExportMeta {
  problemId: string;
  seq: number;
  name: string;
  contentHash: string;
  createdAt: string;   // 버전 생성 시각 ISO (불변)
}

/** seq를 4자리로 패딩 — 파일명 사전순 = 시간순. 상한 50이라 넉넉하다. */
export function seqSlug(seq: number): string {
  return String(seq).padStart(4, '0');
}

export function versionMdPath(problemId: string, seq: number): string {
  return `problems/${problemId}/versions/${seqSlug(seq)}.md`;
}
export function versionJsonPath(problemId: string, seq: number): string {
  return `problems/${problemId}/versions/${seqSlug(seq)}.json`;
}
export function indexPath(problemId: string): string {
  return `problems/${problemId}/index.md`;
}

/**
 * YAML 스칼라 인용. 제목·이름·정답에 `:` `#` `"` 개행이 들어올 수 있으므로
 * 전부 JSON 문자열로 감싼다(JSON 문자열은 유효한 YAML 더블쿼트 스칼라).
 */
function yamlValue(v: string | number): string {
  return typeof v === 'number' ? String(v) : JSON.stringify(v);
}

export function toMarkdown(c: VersionContent, meta: ExportMeta): string {
  const fm = [
    '---',
    `problem_id: ${yamlValue(meta.problemId)}`,
    `version_seq: ${yamlValue(meta.seq)}`,
    `version_name: ${yamlValue(meta.name)}`,
    `content_hash: ${yamlValue(meta.contentHash)}`,
    `created_at: ${yamlValue(meta.createdAt)}`,
    `title: ${yamlValue(c.meta.title || '')}`,
    `answer: ${yamlValue(c.meta.answer || '')}`,
    '---',
  ].join('\n');

  const sections: string[] = [];
  for (const tab of c.tabs) {
    const parts: string[] = [`## ${tab.title}`];
    const blocks = [...tab.blocks].sort((a, b) => a.order - b.order);
    for (const b of blocks) {
      const chunk: string[] = [`<!-- block: ${b.type} -->`];
      if (b.title) chunk.push(`### ${b.title}`);
      if (b.raw_text) chunk.push(b.raw_text);
      parts.push(chunk.join('\n'));
    }
    sections.push(parts.join('\n\n'));
  }

  // frontmatter 종료 뒤 빈 줄 1개 — raw_text 첫 줄이 '---'여도 frontmatter로 오인되지 않는다.
  return `${fm}\n\n${sections.join('\n\n')}\n`;
}

/** 무손실 원본. 들여쓰기·말미 개행 고정으로 결정적. */
export function toJson(c: VersionContent): string {
  return `${JSON.stringify(c, null, 2)}\n`;
}

const INDEX_NOTICE =
  '<!-- 이 파일은 versions/{seq}.md의 미러입니다. ' +
  '이미지는 Firebase Storage URL을 참조하므로 레포 단독으로는 표시되지 않을 수 있습니다. -->';

/**
 * index.md = 해당 버전 md + 안내 주석.
 * 주석은 반드시 frontmatter 종료 뒤에 온다 — 앞에 두면 version_seq 파싱이 깨진다.
 */
export function toIndexMarkdown(versionMd: string, seq: number): string {
  const notice = INDEX_NOTICE.replace('{seq}', seqSlug(seq));
  const end = endOfFrontmatter(versionMd);
  if (end < 0) return `${notice}\n\n${versionMd}`;   // frontmatter가 없으면 맨 앞
  return `${versionMd.slice(0, end)}\n${notice}\n${versionMd.slice(end)}`;
}

/** frontmatter 종료 '---' 줄의 끝 오프셋. 없으면 -1. */
function endOfFrontmatter(md: string): number {
  if (!md.startsWith('---\n')) return -1;
  const close = md.indexOf('\n---\n', 3);
  return close < 0 ? -1 : close + 5;   // '\n---\n' 길이
}

/**
 * 기존 index.md의 version_seq 파싱 — index가 더 낮은 seq로 역행하는 것을 막는다.
 * 파싱 실패는 null(호출부가 덮어쓴다 — 레포는 미러이므로 수동 편집을 보존하지 않는다).
 */
export function parseIndexSeq(md: string): number | null {
  if (!md.startsWith('---\n')) return null;
  const close = md.indexOf('\n---\n', 3);
  if (close < 0) return null;
  const m = md.slice(0, close).match(/^version_seq:[ \t]*(\d+)[ \t]*$/m);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * 커밋 제목줄 위생 — title 원문에 개행이 섞이면 커밋 제목이 본문으로 쪼개진다.
 */
export function safeTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim().slice(0, 60);
}
