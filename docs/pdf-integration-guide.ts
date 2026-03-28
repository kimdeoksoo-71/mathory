/**
 * PDF 다운로드 통합 가이드
 * 
 * 이 파일은 기존 edit/page.tsx 또는 [id]/page.tsx에
 * PdfDownloadButton을 추가하는 방법을 보여줍니다.
 * 
 * 실제 적용 시 기존 파일에서 해당 부분만 추가/수정하면 됩니다.
 */

// ===== 1. import 추가 =====
// 기존 import들에 아래를 추가:
//
// import PdfDownloadButton from '../../../components/print/PdfDownloadButton';
// import { PrintTab } from '../../../components/print/PrintableContent';

// ===== 2. 탭 데이터를 PrintTab 형태로 변환 =====
// 기존 questionBlocks, solutionBlocks를 PrintTab[]으로 변환:
//
// const printTabs: PrintTab[] = [
//   {
//     label: '문제',
//     blocks: questionBlocks.map(b => ({
//       id: b.id,
//       type: b.type,
//       raw_text: b.raw_text,
//     })),
//   },
//   {
//     label: '풀이',
//     blocks: solutionBlocks.map(b => ({
//       id: b.id,
//       type: b.type,
//       raw_text: b.raw_text,
//     })),
//   },
// ];

// ===== 3. 버튼 배치 =====
// 저장 버튼 옆에 PDF 다운로드 버튼 추가:
//
// <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '16px' }}>
//   <button onClick={handleSave} disabled={saving} ...>
//     {saving ? '저장 중...' : '저장'}
//   </button>
//
//   {/* PDF 다운로드 버튼 추가 */}
//   <PdfDownloadButton
//     title={title || '수학 문제'}
//     headerInfo={`${year}학년도 ${examType} | ${category}`}
//     tabs={printTabs}
//     locale="ko"
//   />
//
//   {status && <span ...>{status}</span>}
// </div>

// ===== 4. 선택적: 개별 탭만 출력 =====
// 현재 활성 탭만 출력하고 싶은 경우:
//
// const currentTabOnly: PrintTab[] = activeTab === 'question'
//   ? [{ label: '문제', blocks: questionBlocks }]
//   : [{ label: '풀이', blocks: solutionBlocks }];
//
// <PdfDownloadButton
//   title={title}
//   tabs={currentTabOnly}
//   locale="ko"
//   label="현재 탭만 PDF"
// />

// ===== 5. package.json에 추가 필요한 패키지 =====
// remark-gfm이 이미 설치되어 있지 않은 경우:
// npm install remark-gfm

export {};