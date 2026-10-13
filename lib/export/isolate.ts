/**
 * Phase 70b D28 — mitex가 변환하지 못하는 수식 찾기(이분 탐색).
 *
 * mitex 미지원 명령 하나가 **문서 전체** 컴파일을 죽인다(v4 J3). Typst엔 try/catch가 없으므로 문서 밖에서 찾는다:
 * 수식만 모은 작은 문서를 반씩 컴파일해 실패 집합을 좁힌다(실패 k개면 약 k·log₂N회 + 1).
 *
 * ⚠ import 0 — 컴파일은 `fails(subset)`으로 주입받는다(브라우저 = typst.ts, 테스트 = node 컴파일러).
 * ⚠ 수식 하나만으로도 실패하는 것만 "실패"로 친다 — 둘이 만나야 실패하는 경우(사실상 없음)는 각자 통과로 남는다.
 */

export interface ProbeFormula { id: string; latex: string; display: boolean }

/** 수식만 모은 프로브 문서 — 직렬화기와 같은 mitex import·호출 꼴 */
export function probeSource(formulas: ProbeFormula[], mitexImport: string, str: (s: string) => string): string {
  const lines = formulas.map((f) => (f.display ? `#mitex(${str(f.latex)})` : `#mi(${str(f.latex)});`));
  return `#import ${str(mitexImport)}: mitex, mi\n${lines.join('\n')}\n`;
}

export interface IsolateResult { failed: ProbeFormula[]; probes: number }

/**
 * @param fails 이 부분집합을 컴파일하면 실패하는가
 * @param maxProbes 안전 상한 — 넘으면 남은 후보를 전부 실패로 친다(PDF가 나오는 쪽을 택한다)
 */
export async function findFailingFormulas(
  formulas: ProbeFormula[],
  fails: (subset: ProbeFormula[]) => Promise<boolean>,
  maxProbes = 400,
): Promise<IsolateResult> {
  let probes = 0;
  const failed: ProbeFormula[] = [];
  const stack: ProbeFormula[][] = [formulas];
  while (stack.length) {
    const group = stack.pop()!;
    if (group.length === 0) continue;
    if (probes >= maxProbes) { failed.push(...group); continue; }
    probes += 1;
    if (!(await fails(group))) continue;
    if (group.length === 1) { failed.push(group[0]); continue; }
    const mid = Math.ceil(group.length / 2);
    stack.push(group.slice(mid), group.slice(0, mid));
  }
  // 직렬화 순서대로
  const order = new Map(formulas.map((f, i) => [f.id, i]));
  failed.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return { failed, probes };
}
