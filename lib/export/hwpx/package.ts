/**
 * Phase 71 — 뼈대 + 본문 문단 + 그림 → .hwpx 바이트(v5 §1-2 zip 순서 · §3-5 5~6).
 *
 * 항목 순서(한글이 저장하는 순서): mimetype → version.xml → Contents/header.xml → Contents/masterpage0.xml →
 *   BinData/*(그것을 쓰는 section **앞**) → Contents/section0.xml → Preview/PrvText.txt → settings.xml →
 *   META-INF/container.rdf → Contents/content.hpf → META-INF/container.xml → META-INF/manifest.xml
 * PrvImage.png는 내지 않는다(container.xml rootfile은 PrvText만 가리킨다 — v3 E3).
 */
import * as P from './skeleton/parts';
import { paraXml, Ids, esc, type Para } from './xml';
import { zipHwpx } from './zip';

export interface BinItem { id: string; ext: 'png' | 'jpg'; data: Uint8Array }

export interface PackageInput {
  title: string;
  header: string;
  paras: Para[];
  bins: BinItem[];
  /** 미리보기 평문(탐색기 미리보기·검색). 템플릿 형식: CRLF · ~2KB */
  prvText: string;
  ids?: Ids;
  /** 진단용(scripts/hwpxEqProbe.mjs) — section0.xml을 통째로 바꿔 넣는다 */
  sectionOverride?: string;
}

const MEDIA: Record<BinItem['ext'], string> = { png: 'image/png', jpg: 'image/jpg' };

export function contentHpf(title: string, bins: BinItem[]): string {
  const meta =
    `<opf:metadata><opf:title>${esc(title)}</opf:title><opf:language>ko</opf:language>` +
    `<opf:meta name="creator" content="text">Mathory</opf:meta><opf:meta name="subject" content="text"/>` +
    `<opf:meta name="description" content="text"/><opf:meta name="lastsaveby" content="text">Mathory</opf:meta>` +
    `<opf:meta name="CreatedDate" content="text"/><opf:meta name="ModifiedDate" content="text"/>` +
    `<opf:meta name="date" content="text"/><opf:meta name="keyword" content="text"/></opf:metadata>`;
  const items =
    `<opf:item id="header" href="Contents/header.xml" media-type="application/xml"/>` +
    `<opf:item id="masterpage0" href="Contents/masterpage0.xml" media-type="application/xml"/>` +
    bins.map((b) => `<opf:item id="${b.id}" href="BinData/${b.id}.${b.ext}" media-type="${MEDIA[b.ext]}" isEmbeded="1"/>`).join('') +
    `<opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/>` +
    `<opf:item id="settings" href="settings.xml" media-type="application/xml"/>`;
  return `${P.HPF_OPEN}${meta}<opf:manifest>${items}</opf:manifest><opf:spine><opf:itemref idref="header" linear="yes"/><opf:itemref idref="section0" linear="yes"/></opf:spine></opf:package>`;
}

export function sectionXml(paras: Para[], ids: Ids): string {
  return P.SECTION_OPEN + paras.map((p) => paraXml(p, ids)).join('') + '</hs:sec>';
}

/** 미리보기 평문 — 앞부분만(템플릿 1,984B 수준) · CRLF */
export function previewText(text: string, maxChars = 1000): string {
  const t = text.replace(/\r?\n/g, '\r\n').replace(/\t/g, ' ');
  return t.length > maxChars ? t.slice(0, maxChars) : t;
}

export function buildPackage(input: PackageInput): Uint8Array {
  const ids = input.ids ?? new Ids();
  if (!input.paras.length || !input.paras[0].secPr) throw new Error('첫 문단에 secPr이 있어야 한다(G5)');
  const section = input.sectionOverride ?? sectionXml(input.paras, ids);
  return zipHwpx([
    ['mimetype', 'application/hwp+zip'],
    ['version.xml', P.VERSION_XML],
    ['Contents/header.xml', input.header],
    ['Contents/masterpage0.xml', P.MASTERPAGE_XML],
    ...input.bins.map((b): [string, Uint8Array] => [`BinData/${b.id}.${b.ext}`, b.data]),
    ['Contents/section0.xml', section],
    ['Preview/PrvText.txt', previewText(input.prvText)],
    ['settings.xml', P.SETTINGS_XML],
    ['META-INF/container.rdf', P.CONTAINER_RDF],
    ['Contents/content.hpf', contentHpf(input.title, input.bins)],
    ['META-INF/container.xml', P.CONTAINER_XML],
    ['META-INF/manifest.xml', P.MANIFEST_XML],
  ]);
}
