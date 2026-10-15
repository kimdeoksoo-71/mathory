/* 생성 파일 — scripts/hwpxSkeleton.mjs가 템플릿 hwpx에서 뽑았다. 손으로 고치지 말 것(스크립트를 다시 돌린다). */
import type { StyleKey } from '../styles';

export interface StyleIds { id: number; name: string; paraPr: number; charPr: number }
export const STYLE_IDS: Record<StyleKey, StyleIds> = {
  "Normal": {
    "id": 0,
    "name": "바탕글",
    "paraPr": 0,
    "charPr": 1
  },
  "MTQBody": {
    "id": 1,
    "name": "문제-본문",
    "paraPr": 4,
    "charPr": 3
  },
  "MTQCont": {
    "id": 2,
    "name": "문제-이음",
    "paraPr": 2,
    "charPr": 3
  },
  "MTQEq": {
    "id": 3,
    "name": "문제-수식",
    "paraPr": 5,
    "charPr": 3
  },
  "MTQNum": {
    "id": 4,
    "name": "문제-번호",
    "paraPr": 0,
    "charPr": 4
  },
  "MTQCh5": {
    "id": 5,
    "name": "선지-5",
    "paraPr": 1,
    "charPr": 3
  },
  "MTQCh3": {
    "id": 6,
    "name": "선지-3",
    "paraPr": 3,
    "charPr": 3
  },
  "MTBoxText": {
    "id": 7,
    "name": "상자-글",
    "paraPr": 6,
    "charPr": 2
  },
  "MTBoxItem": {
    "id": 8,
    "name": "상자-항목",
    "paraPr": 12,
    "charPr": 2
  },
  "MTFig": {
    "id": 9,
    "name": "공통-그림",
    "paraPr": 10,
    "charPr": 3
  },
  "MTSBody": {
    "id": 10,
    "name": "해설-본문",
    "paraPr": 8,
    "charPr": 3
  },
  "MTSEq": {
    "id": 11,
    "name": "해설-수식",
    "paraPr": 5,
    "charPr": 3
  },
  "MTSH1": {
    "id": 12,
    "name": "해설-제목",
    "paraPr": 8,
    "charPr": 5
  },
  "MTSStep1": {
    "id": 13,
    "name": "해설-단계1",
    "paraPr": 13,
    "charPr": 3
  },
  "MTSStep2": {
    "id": 14,
    "name": "해설-단계2",
    "paraPr": 14,
    "charPr": 3
  },
  "MTSTip": {
    "id": 15,
    "name": "해설-Tip",
    "paraPr": 9,
    "charPr": 6
  }
};
/** HWPUNIT — colWidth = (width − left − right − colGap·(colCount−1)) / colCount */
export const PAGE = {
  "width": 84188,
  "height": 119052,
  "left": 8787,
  "right": 8787,
  "colCount": 2,
  "colGap": 3316,
  "colWidth": 31649
} as const;
/** 템플릿 header의 목록별 itemCnt(덧붙일 때 갱신 기준) */
export const ITEM_CNT: Record<string, number> = {
  "fontfaces": 7,
  "borderFills": 9,
  "charProperties": 7,
  "tabProperties": 7,
  "numberings": 1,
  "paraProperties": 15,
  "styles": 16
};
/** 템플릿 header의 목록별 최대 id(덧붙이는 항목은 +1부터) */
export const MAX_ID = {
  "charPr": 6,
  "borderFill": 9,
  "paraPr": 14,
  "tabPr": 6
} as const;
