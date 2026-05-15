export type Digit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type CellValue = 0 | Digit;
export type Board = number[];
export type CandidateMask = number;
export type HouseType = 'row' | 'col' | 'box';

export interface HouseRef {
  type: HouseType;
  index: number;
}
