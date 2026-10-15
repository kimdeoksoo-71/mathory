/**
 * Phase 71 — HWPX(OWPML) XML 빌더. import 0 — `test:exporthwpx`가 단독 컴파일한다.
 *
 * 모양의 근거는 둘이다(v5 §1-2 "본문 계약"): ① 한글 2022(12.0.0.4426)가 저장한 템플릿의 실물
 * ② python-hwpx 6.5.0의 real-Hancom 계약(수식·미주·표 — "gold-reversed"). 의심스러우면 **한글이 쓴 모양**을 따른다(G4).
 *
 * ⚠ 탭·줄바꿈은 `<hp:t>`의 자식 요소다. `<hp:t>` 안에 U+0009를 날것으로 넣으면 한글이 멈춘다(2026-09-26 실측).
 * ⚠ 런이 객체(수식·글상자·그림·표·미주)로 끝나면 빈 `<hp:t/>`를 붙인다(한글 산출물이 그렇다).
 * ⚠ linesegarray(줄 배치 캐시)는 쓰지 않는다 — 한글이 열며 다시 잰다(T23′).
 */

/* ═══ 모델 ═══ */

export type Item =
  | { k: 'text'; s: string }
  | { k: 'tab' }
  | { k: 'br' }
  /** size = 한글 수식 상자(sz 폭·높이 · baseLine %) — 한글은 열 때 다시 재지 않는다(hwpLayout.ts). 없으면 자리값 */
  | { k: 'eq'; script: string; size?: { w: number; h: number; base: number } }
  | { k: 'rect'; paras: Para[]; width: number }
  | { k: 'pic'; bin: string; pxW: number; pxH: number; width: number; height: number; frame?: boolean }
  | { k: 'tbl'; rows: Para[][][]; colWidths: number[]; outerFill: number; cellFill: number; headRows: number }
  | { k: 'endnote'; num: number; paras: Para[] };

export interface Run {
  charPr: number;
  /** 글자 스타일(문제-번호) — `<hp:t charStyleIDRef>` */
  charStyle?: number;
  items: Item[];
}

export interface Para {
  style: number;
  paraPr: number;
  pageBreak?: boolean;
  columnBreak?: boolean;
  /** 섹션 첫 문단에만 — secPr + colPr 런(템플릿 그대로) */
  secPr?: string;
  /** secPr 런의 글자 모양 — 템플릿처럼 문단 스타일의 charPr */
  secPrCharPr?: number;
  runs: Run[];
}

/* ═══ 단위 ═══ */

/** 1px(96dpi) = 75 HWPUNIT · 1pt = 100 */
export const PX = 75;

/* ═══ 이스케이프 ═══ */

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&apos;'));
}

/** 요소 내용(글자 노드) — `& < >`만. 따옴표는 속성값에서만 이스케이프한다 */
export function escNode(s: string): string {
  return s.replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));
}

/** 본문 글자 — 제어 문자는 버리고(탭은 `<hp:tab/>`로 따로 온다) 이스케이프 */
export function escText(s: string): string {
  // eslint-disable-next-line no-control-regex
  return escNode(s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\t\r\n]/g, ''));
}

/** 같은 글자 모양(글자 스타일 없음)의 이웃 런을 합친다 — 한글 산출물처럼 */
export function mergeRuns(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    const last = out[out.length - 1];
    if (last && last.charPr === r.charPr && last.charStyle === undefined && r.charStyle === undefined) last.items = [...last.items, ...r.items];
    else out.push({ ...r, items: [...r.items] });
  }
  return out;
}

/* ═══ id ═══ */

/** 결정적 카운터 — 객체 id·instid·zOrder. zOrder는 바탕쪽 개체(0·593·594…)와 겹치지 않게 1000부터(G4) */
export class Ids {
  private obj = 1000000;
  private z = 1000;
  nextObj(): number { this.obj += 1; return this.obj; }
  nextZ(): number { this.z += 1; return this.z; }
}

/* ═══ 직렬화 ═══ */

const SUBLIST = (vertAlign: 'TOP' | 'CENTER') =>
  `<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="${vertAlign}" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">`;
const ZERO_MARGIN = 'left="0" right="0" top="0" bottom="0"';
const MATRIX = (e1: number | string, e5: number | string) => `e1="${e1}" e2="0" e3="0" e4="0" e5="${e5}" e6="0"`;
const RENDERING = (sx = 1, sy = 1) =>
  `<hp:renderingInfo><hc:transMatrix ${MATRIX(1, 1)}/><hc:scaMatrix ${MATRIX(1, 1)}/><hc:rotMatrix ${MATRIX(1, 1)}/>` +
  (sx !== 1 || sy !== 1 ? `<hc:scaMatrix ${MATRIX(round5(sx), round5(sy))}/><hc:rotMatrix ${MATRIX(1, 1)}/>` : '') +
  `</hp:renderingInfo>`;
const round5 = (n: number) => Math.round(n * 100000) / 100000;

export function paraXml(p: Para, ids: Ids): string {
  const head = `<hp:p id="0" paraPrIDRef="${p.paraPr}" styleIDRef="${p.style}" pageBreak="${p.pageBreak ? 1 : 0}" columnBreak="${p.columnBreak ? 1 : 0}" merged="0">`;
  const sec = p.secPr ? `<hp:run charPrIDRef="${p.secPrCharPr ?? p.runs[0]?.charPr ?? 0}">${p.secPr}</hp:run>` : '';
  const runs = p.runs.length ? mergeRuns(p.runs).map((r) => runXml(r, ids)).join('') : `<hp:run charPrIDRef="0"><hp:t/></hp:run>`;
  return head + sec + runs + '</hp:p>';
}

function runXml(r: Run, ids: Ids): string {
  let out = `<hp:run charPrIDRef="${r.charPr}">`;
  let t: string | null = null;          // 열린 <hp:t> 내용
  const tOpen = r.charStyle !== undefined ? `<hp:t charStyleIDRef="${r.charStyle}">` : '<hp:t>';
  const flush = () => { if (t !== null) { out += `${tOpen}${t}</hp:t>`; t = null; } };
  let lastIsObject = false;
  for (const it of r.items) {
    switch (it.k) {
      case 'text': if (!it.s) break; t = (t ?? '') + escText(it.s); lastIsObject = false; break;
      case 'tab': t = (t ?? '') + '<hp:tab/>'; lastIsObject = false; break;
      case 'br': t = (t ?? '') + '<hp:lineBreak/>'; lastIsObject = false; break;
      default:
        flush();
        out += objectXml(it, ids);
        lastIsObject = true;
    }
  }
  flush();
  if (lastIsObject || r.items.length === 0) out += '<hp:t/>';
  return out + '</hp:run>';
}

function objectXml(it: Item, ids: Ids): string {
  switch (it.k) {
    case 'eq': return equationXml(it.script, ids, 1100, it.size);
    case 'rect': return rectXml(it.paras, it.width, ids);
    case 'pic': return picXml(it, ids);
    case 'tbl': return tblXml(it, ids);
    case 'endnote': return endnoteXml(it.num, it.paras, ids);
    default: return '';
  }
}

/**
 * 수식 — python-hwpx add_equation의 real-Hancom 모양.
 * ⚠ sz·baseLine은 **실제 크기여야 한다** — 한글 2022는 열 때 다시 재지 않고 상자 왼쪽 위에 수식을 그린다(2026-10-15 실물).
 *   크기는 호출자가 낸다(hwpLayout.ts 한글 규칙 모델). 없을 때의 자리값은 옛 python-hwpx 식(테스트 전용).
 */
export function equationXml(script: string, ids: Ids, baseUnit = 1100, size?: { w: number; h: number; base: number }): string {
  const s = script.trim();
  const visible = s.replace(/[{}\s]/g, '').length;
  const w = size?.w ?? Math.round(baseUnit * 0.45 * Math.max(6, visible));
  const h = size?.h ?? Math.round(baseUnit * 2.5);
  const base = size?.base ?? 85;
  return (
    `<hp:equation id="${ids.nextObj()}" zOrder="${ids.nextZ()}" numberingType="EQUATION" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" version="Equation Version 60" baseLine="${base}" textColor="#000000" baseUnit="${baseUnit}" lineMode="CHAR" font="HYhwpEQ">` +
    `<hp:sz width="${w}" widthRelTo="ABSOLUTE" height="${h}" heightRelTo="ABSOLUTE" protect="0"/>` +
    `<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>` +
    `<hp:outMargin ${ZERO_MARGIN}/>` +
    `<hp:shapeComment>수식입니다.</hp:shapeComment>` +
    `<hp:script>${escNode(s)}</hp:script>` +
    `</hp:equation>`
  );
}

/** 글상자 높이 — 한글 고정값(템플릿 실측: 내용과 무관하게 3984, 실제 높이는 한글이 늘린다 — S-3) */
export const RECT_HEIGHT = 3984;
export const RECT_TEXT_MARGIN = { lr: 1133, tb: 1417 } as const;

/** 글상자 — 템플릿 rect의 자식 순서 그대로(v3 E8). width = 표시 폭(HWPUNIT, 문단 폭의 99%) */
export function rectXml(paras: Para[], width: number, ids: Ids): string {
  const h = RECT_HEIGHT;
  const id = ids.nextObj();
  return (
    `<hp:rect id="${id}" zOrder="${ids.nextZ()}" numberingType="PICTURE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="${id - 500000}" ratio="0">` +
    `<hp:offset x="0" y="0"/><hp:orgSz width="${width}" height="${h}"/><hp:curSz width="${width}" height="${h}"/>` +
    `<hp:flip horizontal="0" vertical="0"/><hp:rotationInfo angle="0" centerX="${Math.round(width / 2)}" centerY="${Math.round(h / 2)}" rotateimage="1"/>` +
    RENDERING() +
    `<hp:lineShape color="#000000" width="33" style="SOLID" endCap="FLAT" headStyle="NORMAL" tailStyle="NORMAL" headfill="1" tailfill="1" headSz="SMALL_SMALL" tailSz="SMALL_SMALL" outlineStyle="NORMAL" alpha="0"/>` +
    `<hp:shadow type="NONE" color="#B2B2B2" offsetX="0" offsetY="0" alpha="0"/>` +
    `<hp:drawText lastWidth="${width}" name="" editable="0">${SUBLIST('CENTER')}${paras.map((p) => paraXml(p, ids)).join('')}</hp:subList>` +
    `<hp:textMargin left="${RECT_TEXT_MARGIN.lr}" right="${RECT_TEXT_MARGIN.lr}" top="${RECT_TEXT_MARGIN.tb}" bottom="${RECT_TEXT_MARGIN.tb}"/></hp:drawText>` +
    `<hc:pt0 x="0" y="0"/><hc:pt1 x="${width}" y="0"/><hc:pt2 x="${width}" y="${h}"/><hc:pt3 x="0" y="${h}"/>` +
    `<hp:sz width="9900" widthRelTo="PARA" height="${h}" heightRelTo="ABSOLUTE" protect="0"/>` +
    `<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="0" allowOverlap="1" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>` +
    `<hp:outMargin ${ZERO_MARGIN}/><hp:shapeComment>사각형입니다.</hp:shapeComment>` +
    `</hp:rect>`
  );
}

/** 그림 — 템플릿 pic의 자식 순서 그대로. 원본 px × 75 = orgSz·imgRect·imgClip·imgDim, 표시 크기 = curSz·sz */
export function picXml(it: Extract<Item, { k: 'pic' }>, ids: Ids): string {
  const ow = Math.max(1, Math.round(it.pxW * PX));
  const oh = Math.max(1, Math.round(it.pxH * PX));
  const { width: w, height: h } = it;
  const id = ids.nextObj();
  const frame = it.frame
    ? `<hp:lineShape color="#000000" width="33" style="SOLID" endCap="FLAT" headStyle="NORMAL" tailStyle="NORMAL" headfill="1" tailfill="1" headSz="SMALL_SMALL" tailSz="SMALL_SMALL" outlineStyle="NORMAL" alpha="0"/>`
    : '';
  return (
    `<hp:pic id="${id}" zOrder="${ids.nextZ()}" numberingType="PICTURE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="${id - 500000}" reverse="0">` +
    `<hp:offset x="0" y="0"/><hp:orgSz width="${ow}" height="${oh}"/><hp:curSz width="${w}" height="${h}"/>` +
    `<hp:flip horizontal="0" vertical="0"/><hp:rotationInfo angle="0" centerX="${Math.round(w / 2)}" centerY="${Math.round(h / 2)}" rotateimage="1"/>` +
    RENDERING(w / ow, h / oh) +
    frame +
    `<hc:img binaryItemIDRef="${esc(it.bin)}" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/>` +
    `<hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="${ow}" y="0"/><hc:pt2 x="${ow}" y="${oh}"/><hc:pt3 x="0" y="${oh}"/></hp:imgRect>` +
    `<hp:imgClip left="0" right="${ow}" top="0" bottom="${oh}"/><hp:inMargin ${ZERO_MARGIN}/><hp:imgDim dimwidth="${ow}" dimheight="${oh}"/><hp:effects/>` +
    `<hp:sz width="${w}" widthRelTo="ABSOLUTE" height="${h}" heightRelTo="ABSOLUTE" protect="0"/>` +
    `<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>` +
    `<hp:outMargin ${ZERO_MARGIN}/>` +
    `</hp:pic>`
  );
}

/** 셀 안쪽 여백 — 한글 새 표 기본(1.8mm·0.5mm, python-hwpx gold · 템플릿 표 실측과 같다) */
export const CELL_MARGIN = 'left="510" right="510" top="141" bottom="141"';
const CELL_ROW_H = 2000;

/** 표 — python-hwpx TableElement.create의 real-Hancom 모양 · 셀 자식 순서 subList·cellAddr·cellSpan·cellSz·cellMargin */
export function tblXml(it: Extract<Item, { k: 'tbl' }>, ids: Ids): string {
  const rows = it.rows.length;
  const cols = it.colWidths.length;
  const width = it.colWidths.reduce((a, b) => a + b, 0);
  let out =
    `<hp:tbl id="${ids.nextObj()}" zOrder="${ids.nextZ()}" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="${it.headRows ? 1 : 0}" rowCnt="${rows}" colCnt="${cols}" cellSpacing="0" borderFillIDRef="${it.outerFill}" noAdjust="0">` +
    `<hp:sz width="${width}" widthRelTo="ABSOLUTE" height="${rows * CELL_ROW_H}" heightRelTo="ABSOLUTE" protect="0"/>` +
    `<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>` +
    `<hp:outMargin ${ZERO_MARGIN}/><hp:inMargin ${CELL_MARGIN}/>`;
  it.rows.forEach((row, r) => {
    out += '<hp:tr>';
    for (let c = 0; c < cols; c++) {
      const paras = row[c] ?? [];
      out +=
        `<hp:tc name="" header="${r < it.headRows ? 1 : 0}" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="${it.cellFill}">` +
        `${SUBLIST('CENTER')}${paras.map((p) => paraXml(p, ids)).join('')}</hp:subList>` +
        `<hp:cellAddr colAddr="${c}" rowAddr="${r}"/><hp:cellSpan colSpan="1" rowSpan="1"/>` +
        `<hp:cellSz width="${it.colWidths[c]}" height="${CELL_ROW_H}"/><hp:cellMargin ${CELL_MARGIN}/></hp:tc>`;
    }
    out += '</hp:tr>';
  });
  return out + '</hp:tbl>';
}

/**
 * 미주 — python-hwpx의 real-Hancom 모양: 런 안 `<hp:ctrl><hp:endNote number suffixChar instid>` +
 * 본문 첫 문단 첫 런 앞에 `<hp:autoNum numType="ENDNOTE">`(없으면 한글이 미주를 그리지 않는다 — python-hwpx 주석).
 * suffixChar는 문자 코드(`)` = 41) — 템플릿 endNotePr의 `suffixChar=")"`와 같다.
 */
export function endnoteXml(num: number, paras: Para[], ids: Ids): string {
  const auto = `<hp:ctrl><hp:autoNum num="${num}" numType="ENDNOTE"><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/></hp:autoNum></hp:ctrl>`;
  const body = paras.map((p, i) => {
    const x = paraXml(p, ids);
    if (i !== 0) return x;
    // 첫 런의 여는 태그 바로 뒤에 autoNum ctrl
    return x.replace(/(<hp:run charPrIDRef="\d+">)/, `$1${auto}`);
  }).join('');
  return `<hp:ctrl><hp:endNote number="${num}" suffixChar="41" instid="${ids.nextObj()}">${SUBLIST('TOP')}${body}</hp:subList></hp:endNote></hp:ctrl>`;
}

/* ═══ header 덧붙임 (T24′) ═══ */

/**
 * 템플릿 header에 항목을 덧붙이고 itemCnt를 갱신한다. 같은 내용의 항목이 이미 있으면 재사용(N6′).
 * charPr 변형: 기준 charPr XML에 `<hh:italic/>`·`<hh:bold/>`를 `<hh:offset …/>` 뒤에 넣는다(OWPML CharShape 순서).
 */
export class HeaderBuilder {
  private header: string;
  private charCache = new Map<string, number>();
  private borderCache = new Map<string, number>();
  constructor(header: string) { this.header = header; }

  private listBody(tag: string): string {
    const m = new RegExp(`<hh:${tag} itemCnt="\\d+">([\\s\\S]*?)</hh:${tag}>`).exec(this.header);
    if (!m) throw new Error(`header에 ${tag}가 없다`);
    return m[1];
  }

  private append(tag: string, itemTag: string, xmlForId: (id: number) => string): number {
    const body = this.listBody(tag);
    const ids = [...body.matchAll(new RegExp(`<hh:${itemTag} id="(\\d+)"`, 'g'))].map((m) => +m[1]);
    const id = (ids.length ? Math.max(...ids) : -1) + 1;
    const count = ids.length + 1;
    this.header = this.header.replace(
      new RegExp(`<hh:${tag} itemCnt="\\d+">([\\s\\S]*?)</hh:${tag}>`),
      (_, inner: string) => `<hh:${tag} itemCnt="${count}">${inner}${xmlForId(id)}</hh:${tag}>`,
    );
    return id;
  }

  charPr(base: number, flags: { bold?: boolean; italic?: boolean }): number {
    if (!flags.bold && !flags.italic) return base;
    const key = `${base}|${flags.bold ? 'b' : ''}${flags.italic ? 'i' : ''}`;
    const hit = this.charCache.get(key);
    if (hit !== undefined) return hit;
    const m = new RegExp(`<hh:charPr id="${base}"([^>]*)>([\\s\\S]*?)</hh:charPr>`).exec(this.listBody('charProperties'));
    if (!m) throw new Error(`charPr ${base}가 없다`);
    const inner = m[2].replace(/<hh:(?:italic|bold)\/>/g, '');
    const add = (flags.italic ? '<hh:italic/>' : '') + (flags.bold ? '<hh:bold/>' : '');
    const body = inner.replace(/(<hh:offset [^>]*\/>)/, `$1${add}`);
    // 같은 내용의 charPr가 이미 있으면 재사용(템플릿 개정으로 기울임 등이 생겼을 때)
    const sig = (attrs: string, b: string) => attrs.replace(/\s*id="\d+"/, '') + b;
    const want = sig(m[1], body);
    for (const e of this.listBody('charProperties').matchAll(/<hh:charPr id="(\d+)"([^>]*)>([\s\S]*?)<\/hh:charPr>/g)) {
      if (sig(e[2], e[3]) === want) { this.charCache.set(key, +e[1]); return +e[1]; }
    }
    const id = this.append('charProperties', 'charPr', (nid) => `<hh:charPr id="${nid}"${m[1]}>${body}</hh:charPr>`);
    this.charCache.set(key, id);
    return id;
  }

  /** 표 테두리 — 'cell' = 네 변 0.12mm 실선 · 'outer' = 네 변 없음 */
  borderFill(kind: 'cell' | 'outer'): number {
    const hit = this.borderCache.get(kind);
    if (hit !== undefined) return hit;
    const t = kind === 'cell' ? 'SOLID' : 'NONE';
    const w = kind === 'cell' ? '0.12 mm' : '0.1 mm';
    const side = (s: string) => `<hh:${s}Border type="${t}" width="${w}" color="#000000"/>`;
    const id = this.append('borderFills', 'borderFill', (nid) =>
      `<hh:borderFill id="${nid}" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0">` +
      `<hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/>` +
      side('left') + side('right') + side('top') + side('bottom') +
      `<hh:diagonal type="SOLID" width="0.1 mm" color="#000000"/></hh:borderFill>`);
    this.borderCache.set(kind, id);
    return id;
  }

  xml(): string { return this.header; }
}
