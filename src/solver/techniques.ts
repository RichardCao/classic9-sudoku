import { EMPTY_VALUE } from '../core/constants.js';
import { countMaskBits, digitsFromMask, hasDigit, maskForDigit } from '../core/bitset.js';
import {
  ALL_HOUSES,
  BOX_HOUSES,
  CELL_TO_BOX,
  CELL_TO_COL,
  CELL_TO_PEERS,
  CELL_TO_ROW,
  COL_HOUSES,
  ROW_HOUSES,
} from '../core/grid.js';
import type { Digit, HouseRef } from '../core/types.js';
import type {
  SolveStep,
  SolverContextLike,
  SolverTechnique,
  TechniqueDefinition,
  TechniqueId,
} from './types.js';
import { candidateRef, collectGroupedNodeSeeds, nodeCellsFitHouse } from './grouped-chain.js';

export const TECHNIQUE_DEFINITIONS: TechniqueDefinition[] = [
  {
    id: 'full-house',
    nameZh: '满屋法',
    nameEn: 'Full House',
    family: 'single',
    defaultScore: 10,
    stability: 'stable',
  },
  {
    id: 'naked-single',
    nameZh: '显性单数',
    nameEn: 'Naked Single',
    family: 'single',
    defaultScore: 20,
    stability: 'stable',
  },
  {
    id: 'hidden-single',
    nameZh: '隐性单数',
    nameEn: 'Hidden Single',
    family: 'single',
    defaultScore: 30,
    stability: 'stable',
  },
  {
    id: 'locked-candidates',
    nameZh: '区块摒除',
    nameEn: 'Locked Candidates',
    family: 'intersection',
    defaultScore: 50,
    stability: 'stable',
  },
  {
    id: 'naked-pair',
    nameZh: '显性数对',
    nameEn: 'Naked Pair',
    family: 'subset',
    defaultScore: 60,
    stability: 'stable',
  },
  {
    id: 'hidden-pair',
    nameZh: '隐性数对',
    nameEn: 'Hidden Pair',
    family: 'subset',
    defaultScore: 70,
    stability: 'stable',
  },
  {
    id: 'naked-triple',
    nameZh: '显性三数组',
    nameEn: 'Naked Triple',
    family: 'subset',
    defaultScore: 80,
    stability: 'stable',
  },
  {
    id: 'hidden-triple',
    nameZh: '隐性三数组',
    nameEn: 'Hidden Triple',
    family: 'subset',
    defaultScore: 90,
    stability: 'stable',
  },
  {
    id: 'naked-quad',
    nameZh: '显性四数组',
    nameEn: 'Naked Quad',
    family: 'subset',
    defaultScore: 95,
    stability: 'stable',
  },
  {
    id: 'hidden-quad',
    nameZh: '隐性四数组',
    nameEn: 'Hidden Quad',
    family: 'subset',
    defaultScore: 105,
    stability: 'stable',
  },
  {
    id: 'x-wing',
    nameZh: 'X-Wing',
    nameEn: 'X-Wing',
    family: 'fish',
    defaultScore: 100,
    stability: 'stable',
  },
  {
    id: 'swordfish',
    nameZh: '剑鱼',
    nameEn: 'Swordfish',
    family: 'fish',
    defaultScore: 140,
    stability: 'stable',
  },
  {
    id: 'franken-swordfish',
    nameZh: 'Franken Swordfish',
    nameEn: 'Franken Swordfish',
    family: 'fish',
    defaultScore: 152,
    stability: 'stable',
  },
  {
    id: 'jellyfish',
    nameZh: '水母',
    nameEn: 'Jellyfish',
    family: 'fish',
    defaultScore: 180,
    stability: 'stable',
  },
  {
    id: 'finned-x-wing',
    nameZh: '带鳍 X-Wing',
    nameEn: 'Finned X-Wing',
    family: 'fish',
    defaultScore: 110,
    stability: 'stable',
  },
  {
    id: 'finned-swordfish',
    nameZh: '带鳍剑鱼',
    nameEn: 'Finned Swordfish',
    family: 'fish',
    defaultScore: 170,
    stability: 'stable',
  },
  {
    id: 'finned-jellyfish',
    nameZh: '带鳍水母',
    nameEn: 'Finned Jellyfish',
    family: 'fish',
    defaultScore: 210,
    stability: 'stable',
  },
  {
    id: 'sashimi-swordfish',
    nameZh: '刺身剑鱼',
    nameEn: 'Sashimi Swordfish',
    family: 'fish',
    defaultScore: 176,
    stability: 'stable',
  },
  {
    id: 'sashimi-jellyfish',
    nameZh: '刺身水母',
    nameEn: 'Sashimi Jellyfish',
    family: 'fish',
    defaultScore: 218,
    stability: 'stable',
  },
  {
    id: 'xy-wing',
    nameZh: 'XY-Wing',
    nameEn: 'XY-Wing',
    family: 'wing',
    defaultScore: 115,
    stability: 'stable',
  },
  {
    id: 'xyz-wing',
    nameZh: 'XYZ-Wing',
    nameEn: 'XYZ-Wing',
    family: 'wing',
    defaultScore: 165,
    stability: 'stable',
  },
  {
    id: 'wxyz-wing',
    nameZh: 'WXYZ-Wing',
    nameEn: 'WXYZ-Wing',
    family: 'wing',
    defaultScore: 174,
    stability: 'stable',
  },
  {
    id: 'w-wing',
    nameZh: 'W-Wing',
    nameEn: 'W-Wing',
    family: 'wing',
    defaultScore: 168,
    stability: 'stable',
  },
  {
    id: 'chute-remote-pairs',
    nameZh: '宫带远程数对',
    nameEn: 'Chute Remote Pairs',
    family: 'wing',
    defaultScore: 166,
    stability: 'stable',
  },
  {
    id: 'almost-locked-pair',
    nameZh: '准锁定数对',
    nameEn: 'Almost Locked Pair',
    family: 'als',
    defaultScore: 126,
    stability: 'stable',
  },
  {
    id: 'almost-locked-triple',
    nameZh: '准锁定三数组',
    nameEn: 'Almost Locked Triple',
    family: 'als',
    defaultScore: 144,
    stability: 'stable',
  },
  {
    id: 'als-xz',
    nameZh: 'ALS-XZ',
    nameEn: 'ALS-XZ',
    family: 'als',
    defaultScore: 182,
    stability: 'stable',
  },
  {
    id: 'als-xy-wing',
    nameZh: 'ALS-XY-Wing',
    nameEn: 'ALS-XY-Wing',
    family: 'als',
    defaultScore: 188,
    stability: 'stable',
  },
  {
    id: 'aic-als',
    nameZh: 'ALS-AIC',
    nameEn: 'AIC with ALS',
    family: 'als',
    defaultScore: 214,
    stability: 'stable',
  },
  {
    id: 'fireworks',
    nameZh: 'Fireworks',
    nameEn: 'Fireworks',
    family: 'als',
    defaultScore: 211,
    stability: 'stable',
  },
  {
    id: 'twinned-xy-chains',
    nameZh: '双生 XY-Chains',
    nameEn: 'Twinned XY-Chains',
    family: 'als',
    defaultScore: 213,
    stability: 'stable',
  },
  {
    id: 'sue-de-coq',
    nameZh: 'Sue-de-Coq',
    nameEn: 'Sue-de-Coq',
    family: 'als',
    defaultScore: 207,
    stability: 'stable',
  },
  {
    id: 'death-blossom',
    nameZh: 'Death Blossom',
    nameEn: 'Death Blossom',
    family: 'als',
    defaultScore: 196,
    stability: 'stable',
  },
  {
    id: 'aligned-pair-exclusion',
    nameZh: '对齐数对排除',
    nameEn: 'Aligned Pair Exclusion',
    family: 'als',
    defaultScore: 209,
    stability: 'stable',
  },
  {
    id: 'exocet',
    nameZh: 'Exocet',
    nameEn: 'Exocet',
    family: 'pattern',
    defaultScore: 226,
    stability: 'stable',
  },
  {
    id: 'double-exocet',
    nameZh: '双 Exocet',
    nameEn: 'Double Exocet',
    family: 'pattern',
    defaultScore: 228,
    stability: 'stable',
  },
  {
    id: 'pattern-overlay',
    nameZh: 'Pattern Overlay',
    nameEn: 'Pattern Overlay',
    family: 'pattern',
    defaultScore: 228,
    stability: 'stable',
  },
  {
    id: 'tridagons',
    nameZh: 'Tridagons',
    nameEn: 'Tridagons',
    family: 'pattern',
    defaultScore: 232,
    stability: 'stable',
  },
  {
    id: 'sk-loops',
    nameZh: 'SK Loops',
    nameEn: 'SK Loops',
    family: 'pattern',
    defaultScore: 236,
    stability: 'stable',
  },
  {
    id: 'forcing-nets',
    nameZh: 'Forcing Nets',
    nameEn: 'Forcing Nets',
    family: 'forcing',
    defaultScore: 220,
    stability: 'experimental',
  },
  {
    id: 'digit-forcing-chains',
    nameZh: '数字强制链',
    nameEn: 'Digit Forcing Chains',
    family: 'forcing',
    defaultScore: 221,
    stability: 'experimental',
  },
  {
    id: 'nishio-forcing-chains',
    nameZh: 'Nishio 强制链',
    nameEn: 'Nishio Forcing Chains',
    family: 'forcing',
    defaultScore: 222,
    stability: 'experimental',
  },
  {
    id: 'cell-forcing-chains',
    nameZh: '单元格强制链',
    nameEn: 'Cell Forcing Chains',
    family: 'forcing',
    defaultScore: 223,
    stability: 'experimental',
  },
  {
    id: 'unit-forcing-chains',
    nameZh: '区域强制链',
    nameEn: 'Unit Forcing Chains',
    family: 'forcing',
    defaultScore: 224,
    stability: 'experimental',
  },
  {
    id: 'bowmans-bingo',
    nameZh: "Bowman's Bingo",
    nameEn: "Bowman's Bingo",
    family: 'forcing',
    defaultScore: 248,
    stability: 'experimental',
  },
  {
    id: 'simple-coloring',
    nameZh: '简单染色',
    nameEn: 'Simple Coloring',
    family: 'coloring',
    defaultScore: 170,
    stability: 'stable',
  },
  {
    id: 'grouped-x-cycles',
    nameZh: '分组 X-Cycles',
    nameEn: 'Grouped X-Cycles',
    family: 'single-digit-chain',
    defaultScore: 168,
    stability: 'stable',
  },
  {
    id: 'grouped-aic',
    nameZh: '分组 AIC',
    nameEn: 'Grouped AIC',
    family: 'chain',
    defaultScore: 212,
    stability: 'stable',
  },
  {
    id: 'x-chain',
    nameZh: 'X-Chain',
    nameEn: 'X-Chain',
    family: 'chain',
    defaultScore: 176,
    stability: 'stable',
  },
  {
    id: 'multi-colors',
    nameZh: '多重染色',
    nameEn: 'Multi-Colors',
    family: 'coloring',
    defaultScore: 178,
    stability: 'stable',
  },
  {
    id: 'three-d-medusa',
    nameZh: '3D Medusa',
    nameEn: '3D Medusa',
    family: 'coloring',
    defaultScore: 202,
    stability: 'stable',
  },
  {
    id: 'xy-chain',
    nameZh: 'XY-Chain',
    nameEn: 'XY-Chain',
    family: 'chain',
    defaultScore: 184,
    stability: 'stable',
  },
  {
    id: 'aic',
    nameZh: '交替推理链',
    nameEn: 'AIC',
    family: 'chain',
    defaultScore: 205,
    stability: 'stable',
  },
  {
    id: 'aic-exotic',
    nameZh: 'AIC with Exotic Links',
    nameEn: 'AIC with Exotic Links',
    family: 'chain',
    defaultScore: 222,
    stability: 'stable',
  },
  {
    id: 'skyscraper',
    nameZh: '摩天楼',
    nameEn: 'Skyscraper',
    family: 'single-digit-chain',
    defaultScore: 175,
    stability: 'stable',
  },
  {
    id: 'two-string-kite',
    nameZh: '双线风筝',
    nameEn: 'Two-String Kite',
    family: 'single-digit-chain',
    defaultScore: 180,
    stability: 'stable',
  },
  {
    id: 'turbot-fish',
    nameZh: '涡轮鱼',
    nameEn: 'Turbot Fish',
    family: 'single-digit-chain',
    defaultScore: 174,
    stability: 'stable',
  },
  {
    id: 'empty-rectangle',
    nameZh: '空矩形',
    nameEn: 'Empty Rectangle',
    family: 'single-digit-chain',
    defaultScore: 186,
    stability: 'stable',
  },
  {
    id: 'unique-rectangle',
    nameZh: '唯一矩形',
    nameEn: 'Unique Rectangle',
    family: 'uniqueness',
    defaultScore: 190,
    stability: 'stable',
  },
  {
    id: 'avoidable-rectangle',
    nameZh: '可避免矩形',
    nameEn: 'Avoidable Rectangle',
    family: 'uniqueness',
    defaultScore: 176,
    stability: 'stable',
  },
  {
    id: 'rectangle-elimination',
    nameZh: '矩形删减',
    nameEn: 'Rectangle Elimination',
    family: 'uniqueness',
    defaultScore: 160,
    stability: 'stable',
  },
  {
    id: 'extended-rectangle',
    nameZh: '扩展矩形',
    nameEn: 'Extended Rectangle',
    family: 'uniqueness',
    defaultScore: 198,
    stability: 'stable',
  },
  {
    id: 'hidden-unique-rectangle',
    nameZh: '隐藏唯一矩形',
    nameEn: 'Hidden Unique Rectangle',
    family: 'uniqueness',
    defaultScore: 201,
    stability: 'stable',
  },
  {
    id: 'aic-ur',
    nameZh: 'UR-AIC',
    nameEn: 'AIC with Unique Rectangles',
    family: 'uniqueness',
    defaultScore: 216,
    stability: 'stable',
  },
  {
    id: 'bug-plus-one',
    nameZh: 'BUG+1',
    nameEn: 'BUG+1',
    family: 'uniqueness',
    defaultScore: 210,
    stability: 'stable',
  },
];

export function getTechniqueDefinitions(): TechniqueDefinition[] {
  return TECHNIQUE_DEFINITIONS.map((definition) => ({ ...definition }));
}

export function buildDefaultTechniques(): SolverTechnique[] {
  return [
    new FullHouseTechnique(),
    new NakedSingleTechnique(),
    new HiddenSingleTechnique(),
    new LockedCandidatesTechnique(),
    new NakedSubsetTechnique(2),
    new HiddenSubsetTechnique(2),
    new NakedSubsetTechnique(3),
    new HiddenSubsetTechnique(3),
    new NakedSubsetTechnique(4),
    new HiddenSubsetTechnique(4),
    new BasicFishTechnique(2),
    new BasicFishTechnique(3),
    new FrankenSwordfishTechnique(),
    new BasicFishTechnique(4),
    new FinnedXWingTechnique(),
    new FinnedFishTechnique(3, false),
    new FinnedFishTechnique(4, false),
    new FinnedFishTechnique(3, true),
    new FinnedFishTechnique(4, true),
    new XYWingTechnique(),
    new XYZWingTechnique(),
    new WXYZWingTechnique(),
    new WWingTechnique(),
    new ChuteRemotePairsTechnique(),
    new AlmostLockedCandidatesTechnique(2),
    new AlmostLockedCandidatesTechnique(3),
    new AlsXZTechnique(),
    new AlsXYWingTechnique(),
    new AICWithAlsTechnique(),
    new FireworksTechnique(),
    new TwinnedXYChainsTechnique(),
    new SueDeCoqTechnique(),
    new DeathBlossomTechnique(),
    new AlignedPairExclusionTechnique(),
    new ExocetTechnique(),
    new DoubleExocetTechnique(),
    new PatternOverlayTechnique(),
    new TridagonsTechnique(),
    new SKLoopsTechnique(),
    new ForcingNetsTechnique(),
    new DigitForcingChainsTechnique(),
    new NishioForcingChainsTechnique(),
    new CellForcingChainsTechnique(),
    new UnitForcingChainsTechnique(),
    new BowmansBingoTechnique(),
    new SimpleColoringTechnique(),
    new GroupedXCyclesTechnique(),
    new GroupedAICTechnique(),
    new XChainTechnique(),
    new MultiColorsTechnique(),
    new ThreeDMedusaTechnique(),
    new XYChainTechnique(),
    new AICTechnique(),
    new AICTechnique('aic-exotic', 222),
    new SkyscraperTechnique(),
    new TwoStringKiteTechnique(),
    new TurbotFishTechnique(),
    new EmptyRectangleTechnique(),
    new UniqueRectangleTechnique(),
    new AvoidableRectangleTechnique(),
    new RectangleEliminationTechnique(),
    new ExtendedRectangleTechnique(),
    new HiddenUniqueRectangleTechnique(),
    new AICWithUrTechnique(),
    new BugPlusOneTechnique(),
  ];
}

class FullHouseTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'full-house';
  public readonly score = 10;

  public find(context: SolverContextLike): SolveStep | null {
    for (const house of ALL_HOUSES) {
      const cells = context.getHouseCells(house);
      let emptyCell = -1;
      let emptyCount = 0;
      const seen = new Set<number>();
      for (const cell of cells) {
        const value = context.board[cell] ?? EMPTY_VALUE;
        if (value === EMPTY_VALUE) {
          emptyCell = cell;
          emptyCount += 1;
        } else {
          seen.add(value);
        }
      }
      if (emptyCount !== 1) {
        continue;
      }
      for (let digit = 1; digit <= 9; digit += 1) {
        if (!seen.has(digit)) {
          return placementStep(this.id, this.score, emptyCell, digit as Digit, house, 'Only one empty cell remains in this house.');
        }
      }
    }
    return null;
  }
}

class NakedSingleTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'naked-single';
  public readonly score = 20;

  public find(context: SolverContextLike): SolveStep | null {
    for (let cell = 0; cell < context.board.length; cell += 1) {
      if (context.board[cell] !== EMPTY_VALUE) {
        continue;
      }
      const mask = context.getCandidateMask(cell);
      if (countMaskBits(mask) === 1) {
        const digit = digitsFromMask(mask)[0];
        if (digit) {
          return placementStep(this.id, this.score, cell, digit, undefined, 'Only one candidate remains in this cell.');
        }
      }
    }
    return null;
  }
}

class HiddenSingleTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'hidden-single';
  public readonly score = 30;

  public find(context: SolverContextLike): SolveStep | null {
    for (const house of ALL_HOUSES) {
      const cells = context.getHouseCells(house);
      for (let digit = 1; digit <= 9; digit += 1) {
        const candidateCells: number[] = [];
        let alreadyPlaced = false;
        for (const cell of cells) {
          if (context.board[cell] === digit) {
            alreadyPlaced = true;
            break;
          }
          if (context.board[cell] === EMPTY_VALUE && context.getCandidateDigits(cell).includes(digit as Digit)) {
            candidateCells.push(cell);
          }
        }
        if (!alreadyPlaced && candidateCells.length === 1) {
          return placementStep(
            this.id,
            this.score,
            candidateCells[0]!,
            digit as Digit,
            house,
            'This digit appears in only one candidate cell in the house.',
          );
        }
      }
    }
    return null;
  }
}

class LockedCandidatesTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'locked-candidates';
  public readonly score = 50;

  public find(context: SolverContextLike): SolveStep | null {
    return this.findBoxLockedCandidates(context) ?? this.findLineClaimingCandidates(context);
  }

  private findBoxLockedCandidates(context: SolverContextLike): SolveStep | null {
    for (let box = 0; box < 9; box += 1) {
      const boxHouse: HouseRef = { type: 'box', index: box };
      for (let digit = 1; digit <= 9; digit += 1) {
        const reasonCells = context.getHouseCandidateCells(boxHouse, digit as Digit);
        if (reasonCells.length < 2) {
          continue;
        }

        const rows = new Set(reasonCells.map((cell) => context.getCellRow(cell)));
        if (rows.size === 1) {
          const row = context.getCellRow(reasonCells[0]!);
          const rowHouse: HouseRef = { type: 'row', index: row };
          const targets = context.getHouseCandidateCells(rowHouse, digit as Digit)
            .filter((cell) => context.getCellBox(cell) !== box);
          if (targets.length > 0) {
            return eliminationStep(this.id, this.score, targets, digit as Digit, [boxHouse, rowHouse], reasonCells, 'Box candidates are locked to one row.');
          }
        }

        const cols = new Set(reasonCells.map((cell) => context.getCellCol(cell)));
        if (cols.size === 1) {
          const col = context.getCellCol(reasonCells[0]!);
          const colHouse: HouseRef = { type: 'col', index: col };
          const targets = context.getHouseCandidateCells(colHouse, digit as Digit)
            .filter((cell) => context.getCellBox(cell) !== box);
          if (targets.length > 0) {
            return eliminationStep(this.id, this.score, targets, digit as Digit, [boxHouse, colHouse], reasonCells, 'Box candidates are locked to one column.');
          }
        }
      }
    }
    return null;
  }

  private findLineClaimingCandidates(context: SolverContextLike): SolveStep | null {
    for (const type of ['row', 'col'] as const) {
      for (let index = 0; index < 9; index += 1) {
        const lineHouse: HouseRef = { type, index };
        for (let digit = 1; digit <= 9; digit += 1) {
          const reasonCells = context.getHouseCandidateCells(lineHouse, digit as Digit);
          if (reasonCells.length < 2) {
            continue;
          }

          const boxes = new Set(reasonCells.map((cell) => context.getCellBox(cell)));
          if (boxes.size !== 1) {
            continue;
          }

          const box = context.getCellBox(reasonCells[0]!);
          const boxHouse: HouseRef = { type: 'box', index: box };
          const targets = context.getHouseCandidateCells(boxHouse, digit as Digit)
            .filter((cell) => type === 'row' ? context.getCellRow(cell) !== index : context.getCellCol(cell) !== index);
          if (targets.length > 0) {
            return eliminationStep(this.id, this.score, targets, digit as Digit, [lineHouse, boxHouse], reasonCells, 'Line candidates are locked to one box.');
          }
        }
      }
    }
    return null;
  }
}

class NakedSubsetTechnique implements SolverTechnique {
  public readonly id: TechniqueId;
  public readonly score: number;

  public constructor(private readonly subsetSize: 2 | 3 | 4) {
    this.id = subsetSize === 2 ? 'naked-pair' : subsetSize === 3 ? 'naked-triple' : 'naked-quad';
    this.score = subsetSize === 2 ? 60 : subsetSize === 3 ? 80 : 95;
  }

  public find(context: SolverContextLike): SolveStep | null {
    for (const house of ALL_HOUSES) {
      const subsetCells = context.getHouseCells(house)
        .filter((cell) => context.board[cell] === EMPTY_VALUE)
        .filter((cell) => {
          const count = context.getCandidateCount(cell);
          return count >= 2 && count <= this.subsetSize;
        });

      for (const combo of createCombinations(subsetCells, this.subsetSize)) {
        let unionMask = 0;
        for (const cell of combo) {
          unionMask |= context.getCandidateMask(cell);
        }
        if (countMaskBits(unionMask) !== this.subsetSize) {
          continue;
        }

        const digits = digitsFromMask(unionMask);
        const actions: SolveStep['actions'] = [];
        for (const cell of context.getHouseCells(house)) {
          if (combo.includes(cell) || context.board[cell] !== EMPTY_VALUE) {
            continue;
          }
          for (const digit of digits) {
            if (context.isCandidatePresent(cell, digit)) {
              actions.push({ type: 'eliminate', cell, digit });
            }
          }
        }
        if (actions.length > 0) {
          return subsetStep(this.id, this.score, house, combo, actions, 'Naked subset removes its digits from other cells in the house.');
        }
      }
    }
    return null;
  }
}

class HiddenSubsetTechnique implements SolverTechnique {
  public readonly id: TechniqueId;
  public readonly score: number;

  public constructor(private readonly subsetSize: 2 | 3 | 4) {
    this.id = subsetSize === 2 ? 'hidden-pair' : subsetSize === 3 ? 'hidden-triple' : 'hidden-quad';
    this.score = subsetSize === 2 ? 70 : subsetSize === 3 ? 90 : 105;
  }

  public find(context: SolverContextLike): SolveStep | null {
    const digits: Digit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (const house of ALL_HOUSES) {
      for (const digitCombo of createCombinations(digits, this.subsetSize)) {
        const cells = new Set<number>();
        let valid = true;
        for (const digit of digitCombo) {
          const digitCells = context.getHouseCandidateCells(house, digit);
          if (digitCells.length === 0 || digitCells.length > this.subsetSize) {
            valid = false;
            break;
          }
          for (const cell of digitCells) {
            cells.add(cell);
          }
        }
        if (!valid || cells.size !== this.subsetSize) {
          continue;
        }

        const allowedMask = digitCombo.reduce((mask, digit) => mask | maskForDigit(digit), 0);
        const actions: SolveStep['actions'] = [];
        for (const cell of cells) {
          for (const digit of context.getCandidateDigits(cell)) {
            if ((allowedMask & maskForDigit(digit)) === 0) {
              actions.push({ type: 'eliminate', cell, digit });
            }
          }
        }
        if (actions.length > 0) {
          return subsetStep(this.id, this.score, house, [...cells], actions, 'Hidden subset removes other digits from the subset cells.');
        }
      }
    }
    return null;
  }
}

class BasicFishTechnique implements SolverTechnique {
  public readonly id: TechniqueId;
  public readonly score: number;

  public constructor(private readonly size: 2 | 3 | 4) {
    this.id = size === 2 ? 'x-wing' : size === 3 ? 'swordfish' : 'jellyfish';
    this.score = size === 2 ? 100 : size === 3 ? 140 : 180;
  }

  public find(context: SolverContextLike): SolveStep | null {
    for (let digit = 1; digit <= 9; digit += 1) {
      const rowFish = this.findByBasis(context, digit as Digit, 'row');
      if (rowFish) {
        return rowFish;
      }
      const colFish = this.findByBasis(context, digit as Digit, 'col');
      if (colFish) {
        return colFish;
      }
    }
    return null;
  }

  private findByBasis(
    context: SolverContextLike,
    digit: Digit,
    basisType: 'row' | 'col',
  ): SolveStep | null {
    const basisIndexes = Array.from({ length: 9 }, (_, index) => index)
      .filter((index) => {
        const coverIndexes = this.getCoverIndexes(context, digit, basisType, index);
        return coverIndexes.length >= 2 && coverIndexes.length <= this.size;
      });

    for (const basisCombo of createCombinations(basisIndexes, this.size)) {
      const coverUnion = uniqueNumbers(
        basisCombo.flatMap((basisIndex) => this.getCoverIndexes(context, digit, basisType, basisIndex)),
      ).sort((left, right) => left - right);
      if (coverUnion.length !== this.size) {
        continue;
      }

      const selectedBasis = new Set(basisCombo);
      const reasonCells = uniqueNumbers(
        basisCombo.flatMap((basisIndex) => this.getCandidateCells(context, digit, basisType, basisIndex)),
      );
      const targetCells: number[] = [];
      for (const coverIndex of coverUnion) {
        const coverHouse: HouseRef = { type: basisType === 'row' ? 'col' : 'row', index: coverIndex };
        for (const cell of context.getHouseCandidateCells(coverHouse, digit)) {
          const cellBasis = basisType === 'row' ? context.getCellRow(cell) : context.getCellCol(cell);
          if (!selectedBasis.has(cellBasis)) {
            targetCells.push(cell);
          }
        }
      }

      const uniqueTargets = uniqueNumbers(targetCells);
      if (uniqueTargets.length === 0) {
        continue;
      }

      const basisHouses: HouseRef[] = basisCombo.map((index) => ({ type: basisType, index }));
      const coverHouses: HouseRef[] = coverUnion.map((index) => ({
        type: basisType === 'row' ? 'col' : 'row',
        index,
      }));
      return eliminationStep(
        this.id,
        this.score,
        uniqueTargets,
        digit,
        [...basisHouses, ...coverHouses],
        reasonCells,
        `${this.id} removes cover-line candidates outside the selected basis lines.`,
      );
    }
    return null;
  }

  private getCoverIndexes(
    context: SolverContextLike,
    digit: Digit,
    basisType: 'row' | 'col',
    basisIndex: number,
  ): number[] {
    return this.getCandidateCells(context, digit, basisType, basisIndex)
      .map((cell) => basisType === 'row' ? context.getCellCol(cell) : context.getCellRow(cell));
  }

  private getCandidateCells(
    context: SolverContextLike,
    digit: Digit,
    basisType: 'row' | 'col',
    basisIndex: number,
  ): number[] {
    return context.getHouseCandidateCells({ type: basisType, index: basisIndex }, digit);
  }
}

type FrankenOrientation = 'row' | 'col';
type FrankenBasisHouse = HouseRef & { type: 'row' | 'col' | 'box' };

class FrankenSwordfishTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'franken-swordfish';
  public readonly score = 152;

  public find(context: SolverContextLike): SolveStep | null {
    for (let digit = 1; digit <= 9; digit += 1) {
      const rowStep = this.findForOrientation(context, digit as Digit, 'row');
      if (rowStep) {
        return rowStep;
      }
      const colStep = this.findForOrientation(context, digit as Digit, 'col');
      if (colStep) {
        return colStep;
      }
    }
    return null;
  }

  private findForOrientation(
    context: SolverContextLike,
    digit: Digit,
    orientation: FrankenOrientation,
  ): SolveStep | null {
    const basisHouses = this.getBasisHouses(orientation).filter((house) => {
      const coverIndexes = this.getCoverIndexes(context, house, digit, orientation);
      return coverIndexes.length >= 2 && coverIndexes.length <= 3;
    });

    for (const combo of createCombinations(basisHouses, 3)) {
      if (!this.isMixedCombo(combo, orientation) || this.hasRedundantBasisHouse(context, combo, digit)) {
        continue;
      }

      const coverUnion = uniqueNumbers(combo.flatMap((house) => this.getCoverIndexes(context, house, digit, orientation)))
        .sort((left, right) => left - right);
      if (coverUnion.length !== 3) {
        continue;
      }
      if (this.hasWeakCoverSet(context, combo, digit, orientation, coverUnion)) {
        continue;
      }

      const basisCellSet = new Set<number>();
      const reasonCellSet = new Set<number>();
      for (const house of combo) {
        for (const cell of context.getHouseCells(house)) {
          basisCellSet.add(cell);
        }
        for (const cell of this.getCandidateCells(context, house, digit)) {
          reasonCellSet.add(cell);
        }
      }

      const actions: SolveStep['actions'] = [];
      for (const coverIndex of coverUnion) {
        const coverCells = orientation === 'row' ? COL_HOUSES[coverIndex]! : ROW_HOUSES[coverIndex]!;
        for (const cell of coverCells) {
          if (basisCellSet.has(cell) || !context.isCandidatePresent(cell, digit)) {
            continue;
          }
          actions.push({ type: 'eliminate', cell, digit });
        }
      }
      if (actions.length === 0) {
        continue;
      }

      const coverHouses: HouseRef[] = coverUnion.map((index) => ({
        type: orientation === 'row' ? 'col' : 'row',
        index,
      }));
      return {
        technique: this.id,
        score: this.score,
        actions,
        evidence: {
          houses: [...combo, ...coverHouses],
          cells: [
            ...[...reasonCellSet].map((cell) => ({ cell, digit, role: 'reason' as const })),
            ...uniqueNumbers(actions.map((action) => action.cell)).map((cell) => ({ cell, digit, role: 'target' as const })),
          ],
          note: 'Franken Swordfish uses mixed line and box basis houses to lock three cover lines.',
        },
      };
    }

    return null;
  }

  private getBasisHouses(orientation: FrankenOrientation): FrankenBasisHouse[] {
    const houses: FrankenBasisHouse[] = [];
    for (let index = 0; index < 9; index += 1) {
      houses.push({ type: orientation, index });
      houses.push({ type: 'box', index });
    }
    return houses;
  }

  private isMixedCombo(combo: FrankenBasisHouse[], orientation: FrankenOrientation): boolean {
    let boxCount = 0;
    let lineCount = 0;
    for (const house of combo) {
      if (house.type === 'box') {
        boxCount += 1;
      } else if (house.type === orientation) {
        lineCount += 1;
      } else {
        return false;
      }
    }
    return boxCount >= 1 && lineCount >= 1;
  }

  private hasRedundantBasisHouse(
    context: SolverContextLike,
    combo: FrankenBasisHouse[],
    digit: Digit,
  ): boolean {
    const candidateSets = combo.map((house) => ({
      cells: this.getCandidateCells(context, house, digit),
    }));

    for (let index = 0; index < candidateSets.length; index += 1) {
      const current = candidateSets[index]!;
      if (current.cells.length === 0) {
        return true;
      }
      const otherCells = new Set<number>();
      for (let otherIndex = 0; otherIndex < candidateSets.length; otherIndex += 1) {
        if (otherIndex === index) {
          continue;
        }
        for (const cell of candidateSets[otherIndex]!.cells) {
          otherCells.add(cell);
        }
      }
      if (current.cells.every((cell) => otherCells.has(cell))) {
        return true;
      }
    }

    return false;
  }

  private hasWeakCoverSet(
    context: SolverContextLike,
    combo: FrankenBasisHouse[],
    digit: Digit,
    orientation: FrankenOrientation,
    coverIndexes: number[],
  ): boolean {
    for (const coverIndex of coverIndexes) {
      let supportCount = 0;
      for (const house of combo) {
        const candidates = this.getCandidateCells(context, house, digit);
        const contributes = candidates.some((cell) =>
          (orientation === 'row' ? CELL_TO_COL[cell] : CELL_TO_ROW[cell]) === coverIndex,
        );
        if (contributes) {
          supportCount += 1;
        }
      }
      if (supportCount < 2) {
        return true;
      }
    }
    return false;
  }

  private getCandidateCells(
    context: SolverContextLike,
    house: FrankenBasisHouse,
    digit: Digit,
  ): number[] {
    return context.getHouseCandidateCells(house, digit);
  }

  private getCoverIndexes(
    context: SolverContextLike,
    house: FrankenBasisHouse,
    digit: Digit,
    orientation: FrankenOrientation,
  ): number[] {
    return uniqueNumbers(
      this.getCandidateCells(context, house, digit)
        .map((cell) => orientation === 'row' ? CELL_TO_COL[cell] : CELL_TO_ROW[cell])
        .filter((value): value is number => typeof value === 'number'),
    ).sort((left, right) => left - right);
  }
}

class XWingTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'x-wing';
  public readonly score = 100;

  public find(context: SolverContextLike): SolveStep | null {
    for (let digit = 1; digit <= 9; digit += 1) {
      const rowFish = this.findByBasis(context, digit as Digit, 'row');
      if (rowFish) {
        return rowFish;
      }
      const colFish = this.findByBasis(context, digit as Digit, 'col');
      if (colFish) {
        return colFish;
      }
    }
    return null;
  }

  private findByBasis(
    context: SolverContextLike,
    digit: Digit,
    basisType: 'row' | 'col',
  ): SolveStep | null {
    const basisIndexes = Array.from({ length: 9 }, (_, index) => index)
      .filter((index) => {
        const coverIndexes = this.getCoverIndexes(context, digit, basisType, index);
        return coverIndexes.length === 2;
      });

    for (const basisCombo of createCombinations(basisIndexes, 2)) {
      const coverUnion = uniqueNumbers(
        basisCombo.flatMap((basisIndex) => this.getCoverIndexes(context, digit, basisType, basisIndex)),
      ).sort((left, right) => left - right);
      if (coverUnion.length !== 2) {
        continue;
      }

      const selectedBasis = new Set(basisCombo);
      const reasonCells = uniqueNumbers(
        basisCombo.flatMap((basisIndex) => this.getCandidateCells(context, digit, basisType, basisIndex)),
      );
      const targetCells: number[] = [];
      for (const coverIndex of coverUnion) {
        const coverHouse: HouseRef = { type: basisType === 'row' ? 'col' : 'row', index: coverIndex };
        for (const cell of context.getHouseCandidateCells(coverHouse, digit)) {
          const cellBasis = basisType === 'row' ? context.getCellRow(cell) : context.getCellCol(cell);
          if (!selectedBasis.has(cellBasis)) {
            targetCells.push(cell);
          }
        }
      }

      const uniqueTargets = uniqueNumbers(targetCells);
      if (uniqueTargets.length === 0) {
        continue;
      }

      const basisHouses: HouseRef[] = basisCombo.map((index) => ({ type: basisType, index }));
      const coverHouses: HouseRef[] = coverUnion.map((index) => ({
        type: basisType === 'row' ? 'col' : 'row',
        index,
      }));
      return eliminationStep(
        this.id,
        this.score,
        uniqueTargets,
        digit,
        [...basisHouses, ...coverHouses],
        reasonCells,
        'Two basis lines share the same two cover lines, forming an X-Wing.',
      );
    }
    return null;
  }

  private getCoverIndexes(
    context: SolverContextLike,
    digit: Digit,
    basisType: 'row' | 'col',
    basisIndex: number,
  ): number[] {
    return this.getCandidateCells(context, digit, basisType, basisIndex)
      .map((cell) => basisType === 'row' ? context.getCellCol(cell) : context.getCellRow(cell));
  }

  private getCandidateCells(
    context: SolverContextLike,
    digit: Digit,
    basisType: 'row' | 'col',
    basisIndex: number,
  ): number[] {
    return context.getHouseCandidateCells({ type: basisType, index: basisIndex }, digit);
  }
}

class FinnedXWingTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'finned-x-wing';
  public readonly score = 110;

  public find(context: SolverContextLike): SolveStep | null {
    for (let digit = 1; digit <= 9; digit += 1) {
      const rowStep = this.findByBasis(context, digit as Digit, 'row');
      if (rowStep) {
        return rowStep;
      }
      const colStep = this.findByBasis(context, digit as Digit, 'col');
      if (colStep) {
        return colStep;
      }
    }
    return null;
  }

  private findByBasis(
    context: SolverContextLike,
    digit: Digit,
    basisType: 'row' | 'col',
  ): SolveStep | null {
    const basisSets = Array.from({ length: 9 }, (_, index) => ({
      index,
      cells: context.getHouseCandidateCells({ type: basisType, index }, digit),
    })).filter((entry) => entry.cells.length >= 2 && entry.cells.length <= 3);

    for (const [first, second] of createCombinations(basisSets, 2)) {
      if (!first || !second) {
        continue;
      }
      const firstCovers = uniqueNumbers(first.cells.map((cell) => this.getCoverIndex(context, cell, basisType)));
      const secondCovers = uniqueNumbers(second.cells.map((cell) => this.getCoverIndex(context, cell, basisType)));
      const sharedCovers = firstCovers.filter((index) => secondCovers.includes(index));
      if (sharedCovers.length !== 2) {
        continue;
      }

      const finCells = [
        ...first.cells.filter((cell) => !sharedCovers.includes(this.getCoverIndex(context, cell, basisType))),
        ...second.cells.filter((cell) => !sharedCovers.includes(this.getCoverIndex(context, cell, basisType))),
      ];
      if (finCells.length === 0) {
        continue;
      }

      const finBasisIndexes = new Set(finCells.map((cell) => this.getBasisIndex(context, cell, basisType)));
      const finBoxes = new Set(finCells.map((cell) => context.getCellBox(cell)));
      if (finBasisIndexes.size !== 1 || finBoxes.size !== 1) {
        continue;
      }

      const finBox = context.getCellBox(finCells[0]!);
      const basisIndexes = new Set([first.index, second.index]);
      const targetCells: number[] = [];
      for (const coverIndex of sharedCovers) {
        const coverCells = basisType === 'row' ? COL_HOUSES[coverIndex] ?? [] : ROW_HOUSES[coverIndex] ?? [];
        for (const cell of coverCells) {
          if (basisIndexes.has(this.getBasisIndex(context, cell, basisType))) {
            continue;
          }
          if (context.getCellBox(cell) !== finBox) {
            continue;
          }
          if (context.isCandidatePresent(cell, digit)) {
            targetCells.push(cell);
          }
        }
      }

      const uniqueTargets = uniqueNumbers(targetCells);
      if (uniqueTargets.length === 0) {
        continue;
      }

      const coverType = basisType === 'row' ? 'col' : 'row';
      const basisHouses: HouseRef[] = [first, second].map((entry) => ({ type: basisType, index: entry.index }));
      const coverHouses: HouseRef[] = sharedCovers.map((index) => ({ type: coverType, index }));
      const reasonCells = uniqueNumbers([...first.cells, ...second.cells]);
      return eliminationStep(
        this.id,
        this.score,
        uniqueTargets,
        digit,
        [...basisHouses, ...coverHouses, { type: 'box', index: finBox }],
        reasonCells,
        'Finned X-Wing removes cover-line candidates that see the fin.',
      );
    }
    return null;
  }

  private getBasisIndex(context: SolverContextLike, cell: number, basisType: 'row' | 'col'): number {
    return basisType === 'row' ? context.getCellRow(cell) : context.getCellCol(cell);
  }

  private getCoverIndex(context: SolverContextLike, cell: number, basisType: 'row' | 'col'): number {
    return basisType === 'row' ? context.getCellCol(cell) : context.getCellRow(cell);
  }
}

class FinnedFishTechnique implements SolverTechnique {
  public readonly id: TechniqueId;
  public readonly score: number;

  public constructor(
    private readonly size: 3 | 4,
    private readonly sashimi: boolean,
  ) {
    if (size === 3) {
      this.id = sashimi ? 'sashimi-swordfish' : 'finned-swordfish';
      this.score = sashimi ? 176 : 170;
    } else {
      this.id = sashimi ? 'sashimi-jellyfish' : 'finned-jellyfish';
      this.score = sashimi ? 218 : 210;
    }
  }

  public find(context: SolverContextLike): SolveStep | null {
    for (let digit = 1; digit <= 9; digit += 1) {
      const rowStep = this.findByBasis(context, digit as Digit, 'row');
      if (rowStep) {
        return rowStep;
      }
      const colStep = this.findByBasis(context, digit as Digit, 'col');
      if (colStep) {
        return colStep;
      }
    }
    return null;
  }

  private findByBasis(
    context: SolverContextLike,
    digit: Digit,
    basisType: 'row' | 'col',
  ): SolveStep | null {
    const basisSets = Array.from({ length: 9 }, (_, index) => ({
      index,
      cells: context.getHouseCandidateCells({ type: basisType, index }, digit),
    })).filter((entry) => entry.cells.length >= 2 && entry.cells.length <= this.size + 1);

    for (const combo of createCombinations(basisSets, this.size)) {
      const coverUnion = uniqueNumbers(
        combo.flatMap((entry) => entry.cells.map((cell) => this.getCoverIndex(context, cell, basisType))),
      ).sort((left, right) => left - right);
      if (coverUnion.length !== this.size + 1) {
        continue;
      }

      for (const baseCoverSet of createCombinations(coverUnion, this.size)) {
        const finCells = combo.flatMap((entry) => (
          entry.cells.filter((cell) => !baseCoverSet.includes(this.getCoverIndex(context, cell, basisType)))
        ));
        if (finCells.length === 0) {
          continue;
        }

        const finBasisIndexes = uniqueNumbers(finCells.map((cell) => this.getBasisIndex(context, cell, basisType)));
        const finBoxes = uniqueNumbers(finCells.map((cell) => context.getCellBox(cell)));
        if (finBasisIndexes.length !== 1 || finBoxes.length !== 1) {
          continue;
        }

        const finBasisIndex = finBasisIndexes[0]!;
        const finBox = finBoxes[0]!;
        let valid = true;
        const reasonCells = new Set<number>();
        for (const entry of combo) {
          const cellsOnBaseCover = entry.cells.filter((cell) => (
            baseCoverSet.includes(this.getCoverIndex(context, cell, basisType))
          ));
          if (entry.index === finBasisIndex) {
            if (this.sashimi ? cellsOnBaseCover.length !== 1 : cellsOnBaseCover.length < 2) {
              valid = false;
              break;
            }
          } else if (this.sashimi ? cellsOnBaseCover.length < 2 || cellsOnBaseCover.length !== entry.cells.length : cellsOnBaseCover.length === 0 || cellsOnBaseCover.length !== entry.cells.length) {
            valid = false;
            break;
          }
          for (const cell of entry.cells) {
            reasonCells.add(cell);
          }
        }
        if (!valid) {
          continue;
        }

        const selectedBasis = new Set(combo.map((entry) => entry.index));
        const targetCells: number[] = [];
        for (const coverIndex of baseCoverSet) {
          const coverCells = basisType === 'row' ? COL_HOUSES[coverIndex] ?? [] : ROW_HOUSES[coverIndex] ?? [];
          for (const cell of coverCells) {
            if (selectedBasis.has(this.getBasisIndex(context, cell, basisType))) {
              continue;
            }
            if (context.getCellBox(cell) !== finBox || !context.isCandidatePresent(cell, digit)) {
              continue;
            }
            targetCells.push(cell);
          }
        }

        const uniqueTargets = uniqueNumbers(targetCells);
        if (uniqueTargets.length === 0) {
          continue;
        }

        const coverType = basisType === 'row' ? 'col' : 'row';
        const basisHouses: HouseRef[] = combo.map((entry) => ({ type: basisType, index: entry.index }));
        const coverHouses: HouseRef[] = baseCoverSet.map((index) => ({ type: coverType, index }));
        return eliminationStep(
          this.id,
          this.score,
          uniqueTargets,
          digit,
          [...basisHouses, ...coverHouses, { type: 'box', index: finBox }],
          [...reasonCells],
          this.sashimi
            ? 'Sashimi fish removes cover-line candidates that see the fin in the missing-corner box.'
            : 'Finned fish removes cover-line candidates that see the fin.',
        );
      }
    }
    return null;
  }

  private getBasisIndex(context: SolverContextLike, cell: number, basisType: 'row' | 'col'): number {
    return basisType === 'row' ? context.getCellRow(cell) : context.getCellCol(cell);
  }

  private getCoverIndex(context: SolverContextLike, cell: number, basisType: 'row' | 'col'): number {
    return basisType === 'row' ? context.getCellCol(cell) : context.getCellRow(cell);
  }
}

class XYWingTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'xy-wing';
  public readonly score = 115;

  public find(context: SolverContextLike): SolveStep | null {
    for (let pivot = 0; pivot < context.board.length; pivot += 1) {
      const pivotDigits = context.getCandidateDigits(pivot);
      if (pivotDigits.length !== 2) {
        continue;
      }

      const peers = (CELL_TO_PEERS[pivot] ?? []).filter((cell) => context.getCandidateCount(cell) === 2);
      for (let leftIndex = 0; leftIndex < peers.length; leftIndex += 1) {
        const leftWing = peers[leftIndex]!;
        const leftDigits = context.getCandidateDigits(leftWing);
        const leftShared = leftDigits.filter((digit) => pivotDigits.includes(digit));
        if (leftShared.length !== 1) {
          continue;
        }
        const leftExtra = leftDigits.find((digit) => !pivotDigits.includes(digit));
        if (!leftExtra) {
          continue;
        }

        for (let rightIndex = leftIndex + 1; rightIndex < peers.length; rightIndex += 1) {
          const rightWing = peers[rightIndex]!;
          const rightDigits = context.getCandidateDigits(rightWing);
          const rightShared = rightDigits.filter((digit) => pivotDigits.includes(digit));
          if (rightShared.length !== 1 || rightShared[0] === leftShared[0]) {
            continue;
          }
          const rightExtra = rightDigits.find((digit) => !pivotDigits.includes(digit));
          if (!rightExtra || rightExtra !== leftExtra) {
            continue;
          }

          const eliminationCells = intersectNumbers(CELL_TO_PEERS[leftWing] ?? [], CELL_TO_PEERS[rightWing] ?? [])
            .filter((cell) => (
              cell !== pivot
              && cell !== leftWing
              && cell !== rightWing
              && context.isCandidatePresent(cell, leftExtra)
            ));
          const uniqueTargets = uniqueNumbers(eliminationCells);
          if (uniqueTargets.length === 0) {
            continue;
          }
          return eliminationStep(
            this.id,
            this.score,
            uniqueTargets,
            leftExtra,
            [],
            [pivot, leftWing, rightWing],
            'XY-Wing removes the shared wing digit from cells seeing both wings.',
          );
        }
      }
    }
    return null;
  }
}

class XYZWingTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'xyz-wing';
  public readonly score = 165;

  public find(context: SolverContextLike): SolveStep | null {
    for (let pivot = 0; pivot < context.board.length; pivot += 1) {
      const pivotDigits = context.getCandidateDigits(pivot);
      if (pivotDigits.length !== 3) {
        continue;
      }

      const peers = (CELL_TO_PEERS[pivot] ?? []).filter((cell) => context.getCandidateCount(cell) === 2);
      for (let leftIndex = 0; leftIndex < peers.length; leftIndex += 1) {
        const leftWing = peers[leftIndex]!;
        const leftDigits = context.getCandidateDigits(leftWing);
        if (!leftDigits.every((digit) => pivotDigits.includes(digit))) {
          continue;
        }

        for (let rightIndex = leftIndex + 1; rightIndex < peers.length; rightIndex += 1) {
          const rightWing = peers[rightIndex]!;
          const rightDigits = context.getCandidateDigits(rightWing);
          if (!rightDigits.every((digit) => pivotDigits.includes(digit))) {
            continue;
          }

          const commonDigits = leftDigits.filter((digit) => rightDigits.includes(digit));
          if (commonDigits.length !== 1) {
            continue;
          }
          const eliminationDigit = commonDigits[0]!;
          const leftOnly = leftDigits.find((digit) => digit !== eliminationDigit);
          const rightOnly = rightDigits.find((digit) => digit !== eliminationDigit);
          if (!leftOnly || !rightOnly || leftOnly === rightOnly) {
            continue;
          }

          const eliminationCells = intersectNumbers(
            intersectNumbers(CELL_TO_PEERS[pivot] ?? [], CELL_TO_PEERS[leftWing] ?? []),
            CELL_TO_PEERS[rightWing] ?? [],
          ).filter((cell) => (
            cell !== pivot
            && cell !== leftWing
            && cell !== rightWing
            && context.isCandidatePresent(cell, eliminationDigit)
          ));
          const uniqueTargets = uniqueNumbers(eliminationCells);
          if (uniqueTargets.length === 0) {
            continue;
          }
          return eliminationStep(
            this.id,
            this.score,
            uniqueTargets,
            eliminationDigit,
            [],
            [pivot, leftWing, rightWing],
            'XYZ-Wing removes the shared wing digit from cells seeing pivot and both wings.',
          );
        }
      }
    }
    return null;
  }
}

class WXYZWingTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'wxyz-wing';
  public readonly score = 174;

  public find(context: SolverContextLike): SolveStep | null {
    const candidateEntries = Array.from({ length: context.board.length }, (_, cell) => cell)
      .filter((cell) => (
        context.board[cell] === EMPTY_VALUE
        && context.getCandidateCount(cell) >= 2
        && context.getCandidateCount(cell) <= 4
      ))
      .map((cell) => ({
        cell,
        mask: context.getCandidateMask(cell),
        houses: getCellHouses(context, cell),
      }));

    for (const combo of createCombinations(candidateEntries, 4)) {
      let unionMask = 0;
      for (const entry of combo) {
        unionMask |= entry.mask;
      }
      if (countMaskBits(unionMask) !== 4) {
        continue;
      }
      const cells = combo.map((entry) => entry.cell);
      if (!isConnectedCluster(cells)) {
        continue;
      }
      const coveringHouses = findCoveringHousePair(cells, combo.map((entry) => entry.houses));
      if (!coveringHouses) {
        continue;
      }

      const unionDigits = digitsFromMask(unionMask);
      const digitCellsByDigit = new Map<Digit, number[]>();
      for (const digit of unionDigits) {
        digitCellsByDigit.set(digit, cells.filter((cell) => context.isCandidatePresent(cell, digit)));
      }
      const sharedDigits = unionDigits.filter((digit) => (digitCellsByDigit.get(digit) ?? []).length >= 2);
      if (sharedDigits.length === 0) {
        continue;
      }

      const eliminations = new Map<string, { cell: number; digit: Digit }>();
      for (const digit of sharedDigits) {
        const digitCells = digitCellsByDigit.get(digit) ?? [];
        if (!isRestrictedDigit(digitCells)) {
          continue;
        }
        for (const cell of getCommonSeenCells(digitCells)) {
          if (!cells.includes(cell) && context.isCandidatePresent(cell, digit)) {
            eliminations.set(`${cell}:${digit}`, { cell, digit });
          }
        }
      }

      const actions: SolveStep['actions'] = [...eliminations.values()]
        .map((item) => ({ type: 'eliminate' as const, cell: item.cell, digit: item.digit }));
      if (actions.length === 0) {
        continue;
      }

      return {
        technique: this.id,
        score: this.score,
        actions,
        evidence: {
          houses: coveringHouses,
          cells: [
            ...cells.map((cell) => ({ cell, role: 'reason' as const })),
            ...actions.map((action) => ({ cell: action.cell, digit: action.digit, role: 'target' as const })),
          ],
          note: 'WXYZ-Wing removes candidates that see every restricted occurrence inside the four-cell wing.',
        },
      };
    }
    return null;
  }
}

class WWingTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'w-wing';
  public readonly score = 168;

  public find(context: SolverContextLike): SolveStep | null {
    const bivalueCells = Array.from({ length: context.board.length }, (_, cell) => cell)
      .filter((cell) => context.board[cell] === EMPTY_VALUE && context.getCandidateCount(cell) === 2);

    for (let leftIndex = 0; leftIndex < bivalueCells.length; leftIndex += 1) {
      const left = bivalueCells[leftIndex]!;
      const leftDigits = context.getCandidateDigits(left);
      for (let rightIndex = leftIndex + 1; rightIndex < bivalueCells.length; rightIndex += 1) {
        const right = bivalueCells[rightIndex]!;
        const rightDigits = context.getCandidateDigits(right);
        if (leftDigits.length !== 2 || leftDigits[0] !== rightDigits[0] || leftDigits[1] !== rightDigits[1]) {
          continue;
        }

        for (const bridgeDigit of leftDigits) {
          const eliminationDigit = leftDigits.find((digit) => digit !== bridgeDigit);
          if (!eliminationDigit) {
            continue;
          }
          const strongLink = this.findStrongLink(context, bridgeDigit, left, right);
          if (!strongLink) {
            continue;
          }

          const eliminationCells = intersectNumbers(CELL_TO_PEERS[left] ?? [], CELL_TO_PEERS[right] ?? [])
            .filter((cell) => (
              cell !== left
              && cell !== right
              && cell !== strongLink.leftCell
              && cell !== strongLink.rightCell
              && context.isCandidatePresent(cell, eliminationDigit)
            ));
          const uniqueTargets = uniqueNumbers(eliminationCells);
          if (uniqueTargets.length === 0) {
            continue;
          }

          return eliminationStep(
            this.id,
            this.score,
            uniqueTargets,
            eliminationDigit,
            strongLink.houses,
            [left, right, strongLink.leftCell, strongLink.rightCell],
            'Two equal bivalue cells are connected by a strong link on one digit, so the other digit is eliminated from common peers.',
          );
        }
      }
    }
    return null;
  }

  private findStrongLink(
    context: SolverContextLike,
    digit: Digit,
    left: number,
    right: number,
  ): { leftCell: number; rightCell: number; houses: HouseRef[] } | null {
    for (const house of ALL_HOUSES) {
      const cells = context.getHouseCandidateCells(house, digit);
      if (cells.length !== 2) {
        continue;
      }
      const [first, second] = cells;
      if (first == null || second == null) {
        continue;
      }

      const leftSeesFirst = (CELL_TO_PEERS[left] ?? []).includes(first);
      const leftSeesSecond = (CELL_TO_PEERS[left] ?? []).includes(second);
      const rightSeesFirst = (CELL_TO_PEERS[right] ?? []).includes(first);
      const rightSeesSecond = (CELL_TO_PEERS[right] ?? []).includes(second);

      if (leftSeesFirst && rightSeesSecond) {
        return { leftCell: first, rightCell: second, houses: [house] };
      }
      if (leftSeesSecond && rightSeesFirst) {
        return { leftCell: second, rightCell: first, houses: [house] };
      }
    }
    return null;
  }
}

class ChuteRemotePairsTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'chute-remote-pairs';
  public readonly score = 166;

  public find(context: SolverContextLike): SolveStep | null {
    const bivalueCells = Array.from({ length: context.board.length }, (_, cell) => cell)
      .filter((cell) => context.board[cell] === EMPTY_VALUE && context.getCandidateCount(cell) === 2);
    for (let leftIndex = 0; leftIndex < bivalueCells.length; leftIndex += 1) {
      const left = bivalueCells[leftIndex]!;
      const leftDigits = context.getCandidateDigits(left);
      for (let rightIndex = leftIndex + 1; rightIndex < bivalueCells.length; rightIndex += 1) {
        const right = bivalueCells[rightIndex]!;
        if ((CELL_TO_PEERS[left] ?? []).includes(right)) {
          continue;
        }
        const rightDigits = context.getCandidateDigits(right);
        if (
          leftDigits.length !== 2
          || rightDigits.length !== 2
          || leftDigits[0] !== rightDigits[0]
          || leftDigits[1] !== rightDigits[1]
        ) {
          continue;
        }
        const horizontal = this.tryHorizontal(context, left, right, leftDigits);
        if (horizontal) {
          return horizontal;
        }
        const vertical = this.tryVertical(context, left, right, leftDigits);
        if (vertical) {
          return vertical;
        }
      }
    }
    return null;
  }

  private tryHorizontal(context: SolverContextLike, left: number, right: number, digits: Digit[]): SolveStep | null {
    const bandLeft = Math.floor(context.getCellRow(left) / 3);
    const bandRight = Math.floor(context.getCellRow(right) / 3);
    if (bandLeft !== bandRight) {
      return null;
    }
    const boxLeft = context.getCellBox(left);
    const boxRight = context.getCellBox(right);
    if (boxLeft === boxRight || Math.floor(boxLeft / 3) !== Math.floor(boxRight / 3)) {
      return null;
    }
    const rowLeft = context.getCellRow(left);
    const rowRight = context.getCellRow(right);
    if (rowLeft === rowRight) {
      return null;
    }
    const missingRow = [bandLeft * 3, bandLeft * 3 + 1, bandLeft * 3 + 2].find((row) => row !== rowLeft && row !== rowRight);
    const boxStart = Math.floor(boxLeft / 3) * 3;
    const unusedBox = [boxStart, boxStart + 1, boxStart + 2].find((box) => box !== boxLeft && box !== boxRight);
    if (missingRow == null || unusedBox == null) {
      return null;
    }
    const yellowCells = context.getHouseCells({ type: 'box', index: unusedBox }).filter((cell) => context.getCellRow(cell) === missingRow);
    return this.buildStep(context, left, right, digits, yellowCells, { type: 'row', index: missingRow });
  }

  private tryVertical(context: SolverContextLike, top: number, bottom: number, digits: Digit[]): SolveStep | null {
    const stackTop = Math.floor(context.getCellCol(top) / 3);
    const stackBottom = Math.floor(context.getCellCol(bottom) / 3);
    if (stackTop !== stackBottom) {
      return null;
    }
    const boxTop = context.getCellBox(top);
    const boxBottom = context.getCellBox(bottom);
    if (boxTop === boxBottom || boxTop % 3 !== boxBottom % 3) {
      return null;
    }
    const colTop = context.getCellCol(top);
    const colBottom = context.getCellCol(bottom);
    if (colTop === colBottom) {
      return null;
    }
    const missingCol = [stackTop * 3, stackTop * 3 + 1, stackTop * 3 + 2].find((col) => col !== colTop && col !== colBottom);
    const stackStart = boxTop % 3;
    const unusedBox = [stackStart, stackStart + 3, stackStart + 6].find((box) => box !== boxTop && box !== boxBottom);
    if (missingCol == null || unusedBox == null) {
      return null;
    }
    const yellowCells = context.getHouseCells({ type: 'box', index: unusedBox }).filter((cell) => context.getCellCol(cell) === missingCol);
    return this.buildStep(context, top, bottom, digits, yellowCells, { type: 'col', index: missingCol });
  }

  private buildStep(
    context: SolverContextLike,
    left: number,
    right: number,
    digits: Digit[],
    yellowCells: number[],
    yellowHouse: HouseRef,
  ): SolveStep | null {
    const absentDigits = digits.filter((digit) => yellowCells.every((cell) => context.board[cell] !== digit && !context.isCandidatePresent(cell, digit)));
    if (absentDigits.length === 0) {
      return null;
    }
    const eliminationMap = new Map<string, { cell: number; digit: Digit }>();
    const commonPeers = intersectNumbers(CELL_TO_PEERS[left] ?? [], CELL_TO_PEERS[right] ?? []).filter((cell) => cell !== left && cell !== right);
    for (const absentDigit of absentDigits) {
      const eliminationDigit = digits.find((digit) => digit !== absentDigit);
      if (!eliminationDigit) {
        continue;
      }
      for (const cell of commonPeers) {
        if (context.isCandidatePresent(cell, eliminationDigit)) {
          eliminationMap.set(`${cell}:${eliminationDigit}`, { cell, digit: eliminationDigit });
        }
      }
    }
    const actions = [...eliminationMap.values()].map((item) => ({ type: 'eliminate' as const, cell: item.cell, digit: item.digit }));
    if (actions.length === 0) {
      return null;
    }
    return {
      technique: this.id,
      score: this.score,
      actions,
      evidence: {
        houses: uniqueHouses([...context.getCellHouses(left), ...context.getCellHouses(right), yellowHouse]),
        cells: [
          { cell: left, role: 'reason' as const },
          { cell: right, role: 'reason' as const },
          ...yellowCells.map((cell) => ({ cell, role: 'link' as const })),
          ...actions.map((action) => ({ cell: action.cell, digit: action.digit, role: 'target' as const })),
        ],
        note: 'Chute remote pairs use two remote bivalue cells plus the missing yellow-cell digit in the third box.',
      },
    };
  }
}

interface AlsSegment {
  primaryHouse: HouseRef;
  secondaryHouse: HouseRef;
  primaryExclusiveCells: number[];
  secondaryExclusiveCells: number[];
  intersectionCells: number[];
}

interface AlignedPairExclusionReason {
  leftDigit: Digit;
  rightDigit: Digit;
  als: AlmostLockedSet | null;
}

class AlignedPairExclusionTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'aligned-pair-exclusion';
  public readonly score = 209;

  public find(context: SolverContextLike): SolveStep | null {
    const allAls = enumerateAlmostLockedSets(context, 1, 3);

    for (let left = 0; left < 80; left += 1) {
      if (context.board[left] !== EMPTY_VALUE) {
        continue;
      }
      for (let right = left + 1; right < 81; right += 1) {
        if (context.board[right] !== EMPTY_VALUE || !(CELL_TO_PEERS[left] ?? []).includes(right)) {
          continue;
        }

        const leftDigits = context.getCandidateDigits(left);
        const rightDigits = context.getCandidateDigits(right);
        if (leftDigits.length < 2 || rightDigits.length < 2) {
          continue;
        }

        const validPairs = new Set<string>();
        const excludedPairs: AlignedPairExclusionReason[] = [];
        for (const leftDigit of leftDigits) {
          for (const rightDigit of rightDigits) {
            const exclusion = this.getExclusionReason(left, right, leftDigit, rightDigit, allAls);
            if (exclusion) {
              excludedPairs.push(exclusion);
              continue;
            }
            validPairs.add(`${leftDigit}:${rightDigit}`);
          }
        }

        const actions: SolveStep['actions'] = [];
        for (const leftDigit of leftDigits) {
          const survives = rightDigits.some((rightDigit) => validPairs.has(`${leftDigit}:${rightDigit}`));
          if (!survives) {
            actions.push({ type: 'eliminate', cell: left, digit: leftDigit });
          }
        }
        for (const rightDigit of rightDigits) {
          const survives = leftDigits.some((leftDigit) => validPairs.has(`${leftDigit}:${rightDigit}`));
          if (!survives) {
            actions.push({ type: 'eliminate', cell: right, digit: rightDigit });
          }
        }
        if (actions.length === 0) {
          continue;
        }

        const reasonAlsCells = uniqueNumbers(excludedPairs.flatMap((item) => item.als?.cells ?? []));
        return {
          technique: this.id,
          score: this.score,
          actions,
          evidence: {
            houses: uniqueHouses([...context.getCellHouses(left), ...context.getCellHouses(right)]),
            cells: [
              { cell: left, role: 'reason' as const },
              { cell: right, role: 'reason' as const },
              ...reasonAlsCells.map((cell) => ({ cell, role: 'link' as const })),
              ...actions.map((action) => ({ cell: action.cell, digit: action.digit, role: 'target' as const })),
            ],
            note: 'Aligned Pair Exclusion removes candidates unsupported by every legal pair assignment.',
          },
        };
      }
    }

    return null;
  }

  private getExclusionReason(
    left: number,
    right: number,
    leftDigit: Digit,
    rightDigit: Digit,
    allAls: AlmostLockedSet[],
  ): AlignedPairExclusionReason | null {
    if (leftDigit === rightDigit) {
      return {
        leftDigit,
        rightDigit,
        als: null,
      };
    }

    for (const als of allAls) {
      if (als.cells.includes(left) || als.cells.includes(right)) {
        continue;
      }
      if (!als.digits.includes(leftDigit) || !als.digits.includes(rightDigit)) {
        continue;
      }
      const leftSeesAll = als.cells.every((cell) => (CELL_TO_PEERS[left] ?? []).includes(cell));
      const rightSeesAll = als.cells.every((cell) => (CELL_TO_PEERS[right] ?? []).includes(cell));
      if (!leftSeesAll || !rightSeesAll) {
        continue;
      }
      return {
        leftDigit,
        rightDigit,
        als,
      };
    }

    return null;
  }
}

interface ExocetPattern {
  lineType: 'row' | 'col';
  bandOrStack: number;
  baseBox: number;
  baseLine: number;
  baseCells: number[];
  baseDigits: Digit[];
  targets: [number, number];
}

interface BoxPattern {
  box: number;
  cells: number[];
  parity: 0 | 1;
  guardianCells: number[];
}

interface SKLoopNode {
  cells: [number, number];
}

interface SKLoopLink {
  house: HouseRef;
  digits: Digit[];
}

interface SKLoopStructure {
  pivots: number[];
  nodes: SKLoopNode[];
  links: SKLoopLink[];
}

class ExocetTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'exocet';
  public readonly score = 226;

  public find(context: SolverContextLike): SolveStep | null {
    for (const pattern of collectExocetPatterns(context)) {
      const step = buildExocetStep(context, this.id, this.score, [pattern]);
      if (step) {
        return step;
      }
    }
    return null;
  }
}

class DoubleExocetTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'double-exocet';
  public readonly score = 228;

  public find(context: SolverContextLike): SolveStep | null {
    const patterns = collectExocetPatterns(context);
    for (let leftIndex = 0; leftIndex < patterns.length; leftIndex += 1) {
      const left = patterns[leftIndex]!;
      for (let rightIndex = leftIndex + 1; rightIndex < patterns.length; rightIndex += 1) {
        const right = patterns[rightIndex]!;
        if (left.lineType !== right.lineType || left.bandOrStack !== right.bandOrStack) {
          continue;
        }
        if (left.baseBox === right.baseBox || left.baseLine === right.baseLine) {
          continue;
        }
        if (left.baseDigits.length !== right.baseDigits.length) {
          continue;
        }
        if (!left.baseDigits.every((digit) => right.baseDigits.includes(digit))) {
          continue;
        }
        if (left.baseCells.some((cell) => right.baseCells.includes(cell))) {
          continue;
        }
        if (left.targets.some((cell) => right.targets.includes(cell))) {
          continue;
        }

        const step = buildExocetStep(context, this.id, this.score, [left, right]);
        if (step) {
          return step;
        }
      }
    }
    return null;
  }
}

class PatternOverlayTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'pattern-overlay';
  public readonly score = 228;
  private static readonly MAX_TEMPLATES = 4096;

  public find(context: SolverContextLike): SolveStep | null {
    for (let digit = 1; digit <= 9; digit += 1) {
      const result = this.enumerateTemplates(context, digit as Digit);
      if (!result || result.templates.length === 0) {
        continue;
      }

      const templateCells = new Set(result.templates.flat());
      const forcedCells = this.findForcedCells(result.templates);
      const actions: SolveStep['actions'] = [];

      for (const cell of forcedCells) {
        if (context.board[cell] === EMPTY_VALUE) {
          actions.push({ type: 'place', cell, digit: digit as Digit });
        }
      }
      for (let cell = 0; cell < 81; cell += 1) {
        if (
          context.board[cell] === EMPTY_VALUE
          && !forcedCells.has(cell)
          && context.isCandidatePresent(cell, digit as Digit)
          && !templateCells.has(cell)
        ) {
          actions.push({ type: 'eliminate', cell, digit: digit as Digit });
        }
      }

      if (actions.length === 0) {
        continue;
      }

      return {
        technique: this.id,
        score: this.score,
        actions,
        evidence: {
          houses: uniqueHouses(result.supportingCells.flatMap((cell) => context.getCellHouses(cell))),
          cells: [
            ...result.supportingCells.map((cell) => ({ cell, digit: digit as Digit, role: 'reason' as const })),
            ...actions.map((action) => ({ cell: action.cell, digit: action.digit, role: 'target' as const })),
          ],
          note: 'Pattern Overlay enumerates all legal templates for one digit and applies common placements or eliminations.',
        },
      };
    }

    return null;
  }

  private findForcedCells(templates: number[][]): Set<number> {
    if (templates.length === 0) {
      return new Set<number>();
    }

    const common = new Set<number>(templates[0]);
    for (let index = 1; index < templates.length; index += 1) {
      const current = new Set<number>(templates[index]);
      for (const cell of [...common]) {
        if (!current.has(cell)) {
          common.delete(cell);
        }
      }
    }
    return common;
  }

  private enumerateTemplates(
    context: SolverContextLike,
    digit: Digit,
  ): { templates: number[][]; supportingCells: number[] } | null {
    const rowsNeedingDigit: number[] = [];
    const rowCandidates = new Map<number, number[]>();

    for (let row = 0; row < 9; row += 1) {
      const rowCells = context.getHouseCells({ type: 'row', index: row });
      if (rowCells.some((cell) => context.board[cell] === digit)) {
        continue;
      }

      const candidates = rowCells.filter((cell) => context.isCandidatePresent(cell, digit));
      if (candidates.length === 0) {
        return null;
      }

      rowsNeedingDigit.push(row);
      rowCandidates.set(row, candidates);
    }

    if (rowsNeedingDigit.length <= 1) {
      return null;
    }

    rowsNeedingDigit.sort(
      (left, right) => (rowCandidates.get(left)?.length ?? 0) - (rowCandidates.get(right)?.length ?? 0),
    );

    const templates: number[][] = [];
    const usedCols = new Set<number>();
    const usedBoxes = new Set<number>();
    let overflowed = false;

    const search = (depth: number, current: number[]): void => {
      if (overflowed) {
        return;
      }
      if (templates.length > PatternOverlayTechnique.MAX_TEMPLATES) {
        overflowed = true;
        return;
      }
      if (depth >= rowsNeedingDigit.length) {
        templates.push([...current]);
        return;
      }

      const row = rowsNeedingDigit[depth]!;
      const candidates = rowCandidates.get(row) ?? [];
      for (const cell of candidates) {
        const col = CELL_TO_COL[cell]!;
        const box = CELL_TO_BOX[cell]!;
        if (usedCols.has(col) || usedBoxes.has(box)) {
          continue;
        }

        usedCols.add(col);
        usedBoxes.add(box);
        current.push(cell);

        if (this.canStillComplete(rowsNeedingDigit, rowCandidates, depth + 1, usedCols, usedBoxes)) {
          search(depth + 1, current);
        }

        current.pop();
        usedCols.delete(col);
        usedBoxes.delete(box);
      }
    };

    search(0, []);

    if (overflowed || templates.length === 0) {
      return null;
    }

    return {
      templates,
      supportingCells: templates[0]!,
    };
  }

  private canStillComplete(
    rowsNeedingDigit: number[],
    rowCandidates: Map<number, number[]>,
    depth: number,
    usedCols: Set<number>,
    usedBoxes: Set<number>,
  ): boolean {
    for (let index = depth; index < rowsNeedingDigit.length; index += 1) {
      const row = rowsNeedingDigit[index]!;
      const hasAvailable = (rowCandidates.get(row) ?? []).some((cell) => (
        !usedCols.has(CELL_TO_COL[cell]!) && !usedBoxes.has(CELL_TO_BOX[cell]!)
      ));
      if (!hasAvailable) {
        return false;
      }
    }
    return true;
  }
}

class TridagonsTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'tridagons';
  public readonly score = 232;

  public find(context: SolverContextLike): SolveStep | null {
    const bandPairs: Array<[number, number]> = [[0, 1], [0, 2], [1, 2]];
    const stackPairs: Array<[number, number]> = [[0, 1], [0, 2], [1, 2]];

    for (const [topBand, bottomBand] of bandPairs) {
      for (const [leftStack, rightStack] of stackPairs) {
        const boxes = [
          topBand * 3 + leftStack,
          topBand * 3 + rightStack,
          bottomBand * 3 + leftStack,
          bottomBand * 3 + rightStack,
        ];

        const commonDigits = this.getCommonDigits(context, boxes);
        for (const digits of createCombinations(commonDigits, 3)) {
          const patternsPerBox = boxes.map((box) => this.findBoxPatterns(context, box, digits));
          if (patternsPerBox.some((patterns) => patterns.length === 0)) {
            continue;
          }

          for (const topLeft of patternsPerBox[0]!) {
            for (const topRight of patternsPerBox[1]!) {
              for (const bottomLeft of patternsPerBox[2]!) {
                for (const bottomRight of patternsPerBox[3]!) {
                  const chosen = [topLeft, topRight, bottomLeft, bottomRight];
                  const paritySum = chosen.reduce((sum, pattern) => sum + pattern.parity, 0);
                  if (paritySum !== 1 && paritySum !== 3) {
                    continue;
                  }

                  const guardianCells = uniqueNumbers(chosen.flatMap((pattern) => pattern.guardianCells));
                  if (guardianCells.length !== 1) {
                    continue;
                  }

                  const guardianCell = guardianCells[0]!;
                  const extraDigits = context.getCandidateDigits(guardianCell).filter((digit) => !digits.includes(digit));
                  if (extraDigits.length === 0) {
                    continue;
                  }

                  const actions = digits
                    .filter((digit) => context.isCandidatePresent(guardianCell, digit))
                    .map((digit) => ({ type: 'eliminate' as const, cell: guardianCell, digit }));
                  if (actions.length === 0) {
                    continue;
                  }

                  return {
                    technique: this.id,
                    score: this.score,
                    actions,
                    evidence: {
                      houses: uniqueHouses(chosen.flatMap((pattern) => context.getCellHouses(pattern.cells[0]!))),
                      cells: [
                        ...chosen.flatMap((pattern) =>
                          pattern.cells.map((cell) => ({ cell, role: 'reason' as const })),
                        ),
                        { cell: guardianCell, role: 'reason' as const },
                        ...actions.map((action) => ({ cell: action.cell, digit: action.digit, role: 'target' as const })),
                      ],
                      note: 'Tridagons uses a four-box parity structure with one guardian cell.',
                    },
                  };
                }
              }
            }
          }
        }
      }
    }

    return null;
  }

  private getCommonDigits(context: SolverContextLike, boxes: number[]): Digit[] {
    const common = new Set<Digit>();
    for (let digit = 1; digit <= 9; digit += 1) {
      const availableInAll = boxes.every((box) =>
        context.getHouseCells({ type: 'box', index: box })
          .some((cell) => context.isCandidatePresent(cell, digit as Digit)),
      );
      if (availableInAll) {
        common.add(digit as Digit);
      }
    }
    return [...common];
  }

  private findBoxPatterns(
    context: SolverContextLike,
    box: number,
    digits: Digit[],
  ): BoxPattern[] {
    const boxCells = context.getHouseCells({ type: 'box', index: box }).filter((cell) => context.board[cell] === EMPTY_VALUE);
    const candidates = boxCells.filter((cell) => {
      const overlap = context.getCandidateDigits(cell).filter((digit) => digits.includes(digit));
      return overlap.length === 2;
    });

    const results: BoxPattern[] = [];
    for (const cells of createCombinations(candidates, 3)) {
      const rowOffsets = new Set(cells.map((cell) => CELL_TO_ROW[cell]! % 3));
      const colOffsets = new Set(cells.map((cell) => CELL_TO_COL[cell]! % 3));
      if (rowOffsets.size !== 3 || colOffsets.size !== 3) {
        continue;
      }

      const pairKeys = cells.map((cell) => this.getTriplePairKey(context, cell, digits));
      if (pairKeys.includes(null)) {
        continue;
      }
      if (new Set(pairKeys).size !== 3) {
        continue;
      }

      const sorted = [...cells].sort((left, right) => (CELL_TO_ROW[left]! % 3) - (CELL_TO_ROW[right]! % 3));
      const permutation = sorted.map((cell) => CELL_TO_COL[cell]! % 3);
      const parity = this.getPermutationParity(permutation);
      const guardianCells = cells.filter((cell) =>
        context.getCandidateDigits(cell).some((digit) => !digits.includes(digit)),
      );

      results.push({
        box,
        cells: [...cells],
        parity,
        guardianCells,
      });
    }

    return results;
  }

  private getTriplePairKey(
    context: SolverContextLike,
    cell: number,
    digits: Digit[],
  ): string | null {
    const overlap = context.getCandidateDigits(cell)
      .filter((digit) => digits.includes(digit))
      .sort((left, right) => left - right);
    return overlap.length === 2 ? overlap.join('') : null;
  }

  private getPermutationParity(permutation: number[]): 0 | 1 {
    let inversions = 0;
    for (let left = 0; left < permutation.length; left += 1) {
      for (let right = left + 1; right < permutation.length; right += 1) {
        if (permutation[left]! > permutation[right]!) {
          inversions += 1;
        }
      }
    }
    return (inversions % 2) as 0 | 1;
  }
}

class SKLoopsTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'sk-loops';
  public readonly score = 236;

  public find(context: SolverContextLike): SolveStep | null {
    const bandPairs: Array<[number, number]> = [[0, 1], [0, 2], [1, 2]];
    const stackPairs: Array<[number, number]> = [[0, 1], [0, 2], [1, 2]];

    for (const [topBand, bottomBand] of bandPairs) {
      for (const [leftStack, rightStack] of stackPairs) {
        for (let topLocalRow = 0; topLocalRow < 3; topLocalRow += 1) {
          for (let bottomLocalRow = 0; bottomLocalRow < 3; bottomLocalRow += 1) {
            for (let leftLocalCol = 0; leftLocalCol < 3; leftLocalCol += 1) {
              for (let rightLocalCol = 0; rightLocalCol < 3; rightLocalCol += 1) {
                const structure = this.buildLoop(
                  context,
                  topBand,
                  bottomBand,
                  leftStack,
                  rightStack,
                  topLocalRow,
                  bottomLocalRow,
                  leftLocalCol,
                  rightLocalCol,
                );
                if (!structure) {
                  continue;
                }

                const step = this.buildEliminationStep(context, structure);
                if (step) {
                  return step;
                }
              }
            }
          }
        }
      }
    }

    return null;
  }

  private buildLoop(
    context: SolverContextLike,
    topBand: number,
    bottomBand: number,
    leftStack: number,
    rightStack: number,
    topLocalRow: number,
    bottomLocalRow: number,
    leftLocalCol: number,
    rightLocalCol: number,
  ): SKLoopStructure | null {
    const topRow = topBand * 3 + topLocalRow;
    const bottomRow = bottomBand * 3 + bottomLocalRow;
    const leftCol = leftStack * 3 + leftLocalCol;
    const rightCol = rightStack * 3 + rightLocalCol;

    const topLeftBox = topBand * 3 + leftStack;
    const topRightBox = topBand * 3 + rightStack;
    const bottomLeftBox = bottomBand * 3 + leftStack;
    const bottomRightBox = bottomBand * 3 + rightStack;

    const pivots = [
      topRow * 9 + leftCol,
      topRow * 9 + rightCol,
      bottomRow * 9 + leftCol,
      bottomRow * 9 + rightCol,
    ];
    if (pivots.some((cell) => context.board[cell] === EMPTY_VALUE)) {
      return null;
    }

    const nodeCells = [
      this.getMiniRowNodeCells(context, topLeftBox, topRow, leftCol),
      this.getMiniRowNodeCells(context, topRightBox, topRow, rightCol),
      this.getMiniColNodeCells(context, topRightBox, rightCol, topRow),
      this.getMiniColNodeCells(context, bottomRightBox, rightCol, bottomRow),
      this.getMiniRowNodeCells(context, bottomRightBox, bottomRow, rightCol),
      this.getMiniRowNodeCells(context, bottomLeftBox, bottomRow, leftCol),
      this.getMiniColNodeCells(context, bottomLeftBox, leftCol, bottomRow),
      this.getMiniColNodeCells(context, topLeftBox, leftCol, topRow),
    ];
    if (nodeCells.some((cells) => cells === null)) {
      return null;
    }
    const nodes: SKLoopNode[] = nodeCells.map((cells) => ({ cells: cells! }));

    const linkHouses: HouseRef[] = [
      { type: 'row', index: topRow },
      { type: 'box', index: topRightBox },
      { type: 'col', index: rightCol },
      { type: 'box', index: bottomRightBox },
      { type: 'row', index: bottomRow },
      { type: 'box', index: bottomLeftBox },
      { type: 'col', index: leftCol },
      { type: 'box', index: topLeftBox },
    ];

    const links: SKLoopLink[] = [];
    let totalLinkDigits = 0;
    for (let index = 0; index < nodes.length; index += 1) {
      const current = nodes[index]!;
      const next = nodes[(index + 1) % nodes.length]!;
      const house = linkHouses[index]!;
      const digits = this.collectLinkDigits(context, current.cells, next.cells, house);
      if (digits.length === 0 || digits.length > 3) {
        return null;
      }
      totalLinkDigits += digits.length;
      links.push({ house, digits });
    }
    if (totalLinkDigits > 16) {
      return null;
    }

    for (let index = 0; index < nodes.length; index += 1) {
      const nodeDigits = uniqueNumbers([
        ...links[(index + nodes.length - 1) % nodes.length]!.digits,
        ...links[index]!.digits,
      ]).sort((left, right) => left - right) as Digit[];
      if (nodeDigits.length < 2 || nodeDigits.length > 4) {
        return null;
      }
      if (!nodeDigits.every((digit) => this.nodeContainsDigit(context, nodes[index]!.cells, digit))) {
        return null;
      }
    }

    return { pivots, nodes, links };
  }

  private buildEliminationStep(context: SolverContextLike, structure: SKLoopStructure): SolveStep | null {
    const loopCells = uniqueNumbers(structure.nodes.flatMap((node) => node.cells));
    const protectedCells = new Set<number>([...structure.pivots, ...loopCells]);
    const actionMap = new Map<string, { type: 'eliminate'; cell: number; digit: Digit }>();

    for (let index = 0; index < structure.links.length; index += 1) {
      const link = structure.links[index]!;
      const left = structure.nodes[index]!;
      const right = structure.nodes[(index + 1) % structure.nodes.length]!;
      const alignedCells = uniqueNumbers([...left.cells, ...right.cells]);

      for (const cell of context.getHouseCells(link.house)) {
        if (protectedCells.has(cell) || alignedCells.includes(cell) || context.board[cell] !== EMPTY_VALUE) {
          continue;
        }
        for (const digit of link.digits) {
          if (context.isCandidatePresent(cell, digit)) {
            actionMap.set(`${cell}:${digit}`, { type: 'eliminate', cell, digit });
          }
        }
      }
    }

    const actions = [...actionMap.values()];
    if (actions.length === 0) {
      return null;
    }

    const reasonCells = uniqueNumbers([...structure.pivots, ...loopCells]);
    return {
      technique: this.id,
      score: this.score,
      actions,
      evidence: {
        houses: uniqueHouses(structure.links.map((link) => link.house)),
        cells: [
          ...reasonCells.map((cell) => ({ cell, role: 'reason' as const })),
          ...actions.map((action) => ({ cell: action.cell, digit: action.digit, role: 'target' as const })),
        ],
        note: 'SK Loops lock candidates into an eight-node loop and eliminate linked digits from outside cells.',
      },
    };
  }

  private collectLinkDigits(
    context: SolverContextLike,
    leftCells: [number, number],
    rightCells: [number, number],
    house: HouseRef,
  ): Digit[] {
    const allowed = new Set<number>([...leftCells, ...rightCells]);
    const digits: Digit[] = [];

    for (let digit = 1; digit <= 9; digit += 1) {
      const hasSolvedDigitOutsideLoop = context.getHouseCells(house).some((cell) =>
        !allowed.has(cell) && context.board[cell] === digit,
      );
      if (hasSolvedDigitOutsideLoop) {
        continue;
      }
      if (!this.nodeContainsDigit(context, leftCells, digit as Digit) || !this.nodeContainsDigit(context, rightCells, digit as Digit)) {
        continue;
      }
      digits.push(digit as Digit);
    }

    return digits;
  }

  private nodeContainsDigit(context: SolverContextLike, cells: [number, number], digit: Digit): boolean {
    return cells.some((cell) => context.board[cell] === digit || context.isCandidatePresent(cell, digit));
  }

  private getMiniRowNodeCells(
    context: SolverContextLike,
    box: number,
    row: number,
    pivotCol: number,
  ): [number, number] | null {
    const cells = context.getHouseCells({ type: 'box', index: box }).filter((cell) =>
      CELL_TO_ROW[cell] === row && CELL_TO_COL[cell] !== pivotCol,
    );
    return cells.length === 2 ? [cells[0]!, cells[1]!] : null;
  }

  private getMiniColNodeCells(
    context: SolverContextLike,
    box: number,
    col: number,
    pivotRow: number,
  ): [number, number] | null {
    const cells = context.getHouseCells({ type: 'box', index: box }).filter((cell) =>
      CELL_TO_COL[cell] === col && CELL_TO_ROW[cell] !== pivotRow,
    );
    return cells.length === 2 ? [cells[0]!, cells[1]!] : null;
  }
}

interface BranchOutcome {
  assumption: {
    type: 'place' | 'eliminate';
    cell: number;
    digit: Digit;
  };
  contradiction: boolean;
  exhausted: boolean;
  contradictionAt?: NonNullable<SolveStep['evidence']['branches']>[number]['contradictionAt'];
  placements: Array<{ cell: number; digit: Digit }>;
  eliminations: Array<{ cell: number; digit: Digit }>;
}

class ForcingNetsTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'forcing-nets';
  public readonly score = 220;

  public find(context: SolverContextLike): SolveStep | null {
    for (const pivot of collectBranchCells(context, 4).slice(0, 8)) {
      const digits = context.getCandidateDigits(pivot);
      const outcomes = digits.map((digit) => evaluateBranchWithPlacement(context, pivot, digit));
      const step = buildForcingConclusion(context, this.id, this.score, [{ cell: pivot, role: 'reason' as const }], outcomes, [pivot]);
      if (step) {
        return step;
      }
    }
    return null;
  }
}

class DigitForcingChainsTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'digit-forcing-chains';
  public readonly score = 221;

  public find(context: SolverContextLike): SolveStep | null {
    for (const source of collectBranchCandidateSources(context).slice(0, 24)) {
      const outcomes = [
        evaluateBranchWithPlacement(context, source.cell, source.digit),
        evaluateBranchWithCandidateRemoval(context, source.cell, source.digit),
      ];
      const step = buildForcingConclusion(
        context,
        this.id,
        this.score,
        [{ cell: source.cell, digit: source.digit, role: 'reason' as const }],
        outcomes,
        [source.cell],
      );
      if (step) {
        return step;
      }
    }
    return null;
  }
}

class NishioForcingChainsTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'nishio-forcing-chains';
  public readonly score = 222;

  public find(context: SolverContextLike): SolveStep | null {
    for (const source of collectBranchCandidateSources(context).slice(0, 40)) {
      const branch = context.clone();
      branch.placeDigit(source.cell, source.digit);
      if (!branch.hasContradiction()) {
        continue;
      }
      const outcome: BranchOutcome = {
        assumption: { type: 'place', cell: source.cell, digit: source.digit },
        contradiction: true,
        exhausted: true,
        contradictionAt: inspectContradiction(branch),
        placements: [],
        eliminations: [],
      };
      return {
        technique: this.id,
        score: this.score,
        actions: [{ type: 'eliminate', cell: source.cell, digit: source.digit }],
        evidence: {
          houses: context.getCellHouses(source.cell),
          cells: [
            { cell: source.cell, digit: source.digit, role: 'reason' as const },
            { cell: source.cell, digit: source.digit, role: 'target' as const },
          ],
          branches: buildBranchEvidence([outcome]),
          note: 'Nishio removes a candidate whose direct assumption contradicts the current candidate state.',
        },
      };
    }
    return null;
  }
}

class CellForcingChainsTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'cell-forcing-chains';
  public readonly score = 223;

  public find(context: SolverContextLike): SolveStep | null {
    for (const pivot of collectBranchCells(context, 4).slice(0, 24)) {
      const outcomes = context.getCandidateDigits(pivot)
        .map((digit) => evaluateBranchWithPlacement(context, pivot, digit));
      const step = buildForcingConclusion(context, this.id, this.score, [{ cell: pivot, role: 'reason' as const }], outcomes, [pivot]);
      if (step) {
        return step;
      }
    }
    return null;
  }
}

class UnitForcingChainsTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'unit-forcing-chains';
  public readonly score = 224;

  public find(context: SolverContextLike): SolveStep | null {
    const sources = collectUnitBranchSources(context).slice(0, 24);
    for (const source of sources) {
      const outcomes = source.cells.map((cell) => evaluateBranchWithPlacement(context, cell, source.digit));
      const step = buildForcingConclusion(
        context,
        this.id,
        this.score,
        source.cells.map((cell) => ({ cell, digit: source.digit, role: 'reason' as const })),
        outcomes,
        source.cells,
        [source.house],
      );
      if (step) {
        return step;
      }
    }
    return null;
  }
}

class BowmansBingoTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'bowmans-bingo';
  public readonly score = 248;

  public find(context: SolverContextLike): SolveStep | null {
    for (const source of collectBranchCandidateSources(context).slice(0, 32)) {
      const branch = context.clone();
      branch.placeDigit(source.cell, source.digit);
      const result = runBranchWalkthrough(branch, 16, {
        type: 'place',
        cell: source.cell,
        digit: source.digit,
      });
      if (!result.contradiction) {
        continue;
      }
      return {
        technique: this.id,
        score: this.score,
        actions: [{ type: 'eliminate', cell: source.cell, digit: source.digit }],
        evidence: {
          houses: context.getCellHouses(source.cell),
          cells: [
            { cell: source.cell, digit: source.digit, role: 'reason' as const },
            { cell: source.cell, digit: source.digit, role: 'target' as const },
          ],
          branches: buildBranchEvidence([result]),
          note: "Bowman's Bingo removes a candidate whose bounded logical branch reaches a contradiction.",
        },
      };
    }
    return null;
  }
}

class AlmostLockedCandidatesTechnique implements SolverTechnique {
  public readonly id: TechniqueId;
  public readonly score: number;

  public constructor(private readonly size: 2 | 3) {
    this.id = size === 2 ? 'almost-locked-pair' : 'almost-locked-triple';
    this.score = size === 2 ? 126 : 144;
  }

  public find(context: SolverContextLike): SolveStep | null {
    for (const segment of buildAlsSegments()) {
      const direct = this.findInSegment(context, segment);
      if (direct) {
        return direct;
      }
      const swapped = this.findInSegment(context, {
        primaryHouse: segment.secondaryHouse,
        secondaryHouse: segment.primaryHouse,
        primaryExclusiveCells: segment.secondaryExclusiveCells,
        secondaryExclusiveCells: segment.primaryExclusiveCells,
        intersectionCells: segment.intersectionCells,
      });
      if (swapped) {
        return swapped;
      }
    }
    return null;
  }

  private findInSegment(context: SolverContextLike, segment: AlsSegment): SolveStep | null {
    const alsCandidates = segment.primaryExclusiveCells.filter((cell) => context.getCandidateCount(cell) >= 2);
    if (alsCandidates.length < this.size - 1) {
      return null;
    }
    for (const alsCells of createCombinations(alsCandidates, this.size - 1)) {
      let mask = 0;
      for (const cell of alsCells) {
        mask |= context.getCandidateMask(cell);
      }
      if (countMaskBits(mask) !== this.size) {
        continue;
      }
      const digits = digitsFromMask(mask);
      if (digits.some((digit) => houseContainsSolvedDigit(context, segment.secondaryHouse, digit))) {
        continue;
      }
      const ahsCells = uniqueNumbers(segment.secondaryExclusiveCells.filter((cell) => (context.getCandidateMask(cell) & mask) !== 0));
      if (ahsCells.length !== this.size - 1) {
        continue;
      }
      const actions: SolveStep['actions'] = [];
      const alsSet = new Set(alsCells);
      for (const cell of segment.primaryExclusiveCells) {
        if (alsSet.has(cell)) {
          continue;
        }
        for (const digit of digits) {
          if (context.isCandidatePresent(cell, digit)) {
            actions.push({ type: 'eliminate', cell, digit });
          }
        }
      }
      for (const cell of ahsCells) {
        for (const digit of context.getCandidateDigits(cell)) {
          if ((mask & maskForDigit(digit)) === 0) {
            actions.push({ type: 'eliminate', cell, digit });
          }
        }
      }
      if (actions.length === 0) {
        continue;
      }
      const intersectionReasons = segment.intersectionCells.filter((cell) => (context.getCandidateMask(cell) & mask) !== 0);
      return {
        technique: this.id,
        score: this.score,
        actions,
        evidence: {
          houses: [segment.primaryHouse, segment.secondaryHouse],
          cells: [
            ...alsCells.map((cell) => ({ cell, role: 'reason' as const })),
            ...ahsCells.map((cell) => ({ cell, role: 'reason' as const })),
            ...intersectionReasons.map((cell) => ({ cell, role: 'link' as const })),
            ...actions.map((action) => ({ cell: action.cell, digit: action.digit, role: 'target' as const })),
          ],
          note: 'Almost locked candidates connect an ALS and an AHS across a line-box intersection.',
        },
      };
    }
    return null;
  }
}

class AlsXZTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'als-xz';
  public readonly score = 182;

  public find(context: SolverContextLike): SolveStep | null {
    const allAls = enumerateAlmostLockedSets(context, 1, 4);
    for (let leftIndex = 0; leftIndex < allAls.length; leftIndex += 1) {
      const left = allAls[leftIndex]!;
      for (let rightIndex = leftIndex + 1; rightIndex < allAls.length; rightIndex += 1) {
        const right = allAls[rightIndex]!;
        if (!areCellSetsDisjoint(left.cells, right.cells)) {
          continue;
        }
        const restrictedCommons = getRestrictedCommonDigits(left, right);
        if (restrictedCommons.length === 0) {
          continue;
        }
        const eliminationDigits = getCommonAlsDigits(left, right).filter((digit) => !restrictedCommons.includes(digit));
        for (const digit of eliminationDigits) {
          const targetCells = getCommonSeenCellsForDigit(digit, left, right)
            .filter((cell) => !left.cells.includes(cell) && !right.cells.includes(cell) && context.isCandidatePresent(cell, digit));
          const uniqueTargets = uniqueNumbers(targetCells);
          if (uniqueTargets.length === 0) {
            continue;
          }
          return eliminationStep(
            this.id,
            this.score,
            uniqueTargets,
            digit,
            collectAlsHouses(left, right),
            [...left.cells, ...right.cells],
            'ALS-XZ uses restricted common digits between two ALS groups to eliminate shared non-restricted digits.',
          );
        }
      }
    }
    return null;
  }
}

class AlsXYWingTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'als-xy-wing';
  public readonly score = 188;

  public find(context: SolverContextLike): SolveStep | null {
    const allAls = enumerateAlmostLockedSets(context, 1, 4);
    for (const pivot of allAls) {
      for (let leftIndex = 0; leftIndex < allAls.length; leftIndex += 1) {
        const left = allAls[leftIndex]!;
        if (left === pivot || !areCellSetsDisjoint(pivot.cells, left.cells)) {
          continue;
        }
        const pivotLeftRestricted = getRestrictedCommonDigits(pivot, left);
        if (pivotLeftRestricted.length === 0) {
          continue;
        }
        for (let rightIndex = leftIndex + 1; rightIndex < allAls.length; rightIndex += 1) {
          const right = allAls[rightIndex]!;
          if (right === pivot || !areCellSetsDisjoint(pivot.cells, left.cells, right.cells)) {
            continue;
          }
          const pivotRightRestricted = getRestrictedCommonDigits(pivot, right);
          if (pivotRightRestricted.length === 0) {
            continue;
          }
          for (const leftRestricted of pivotLeftRestricted) {
            for (const rightRestricted of pivotRightRestricted) {
              if (leftRestricted === rightRestricted) {
                continue;
              }
              const wingCommons = getCommonAlsDigits(left, right).filter((digit) => (
                digit !== leftRestricted
                && digit !== rightRestricted
                && !pivot.digits.includes(digit)
              ));
              for (const digit of wingCommons) {
                const targetCells = getCommonSeenCellsForDigit(digit, left, right)
                  .filter((cell) => (
                    !pivot.cells.includes(cell)
                    && !left.cells.includes(cell)
                    && !right.cells.includes(cell)
                    && context.isCandidatePresent(cell, digit)
                  ));
                const uniqueTargets = uniqueNumbers(targetCells);
                if (uniqueTargets.length === 0) {
                  continue;
                }
                return eliminationStep(
                  this.id,
                  this.score,
                  uniqueTargets,
                  digit,
                  collectAlsHouses(pivot, left, right),
                  [...pivot.cells, ...left.cells, ...right.cells],
                  'ALS-XY-Wing uses a pivot ALS and two wing ALS groups to eliminate their shared wing candidate.',
                );
              }
            }
          }
        }
      }
    }
    return null;
  }
}

interface AlsPairFragment {
  als: AlmostLockedSet;
  pairCell: number;
  tripleCell: number;
  pairDigits: Digit[];
  extraDigit: Digit;
  sharedHouses: HouseRef[];
}

interface AlsAicEntryLink {
  sourceCell: number;
  sourceHouse: HouseRef;
  digit: Digit;
}

interface AlsInternalStrongLink {
  digit: Digit;
  house: HouseRef;
}

interface ExternalStrongLinkBridge {
  bridgeCell: number;
  house: HouseRef;
}

class AICWithAlsTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'aic-als';
  public readonly score = 214;

  public find(context: SolverContextLike): SolveStep | null {
    for (const fragment of findAlsPairFragments(context)) {
      const internalStrongLinks = findAlsInternalStrongLinks(context, fragment);
      if (internalStrongLinks.length === 0) {
        continue;
      }
      for (const entry of findAlsAicEntryLinks(context, fragment)) {
        const sourceDigits = context.getCandidateDigits(entry.sourceCell);
        if (sourceDigits.length !== 2 || !sourceDigits.includes(entry.digit)) {
          continue;
        }
        const endpointDigit = sourceDigits.find((digit) => digit !== entry.digit);
        if (!endpointDigit || !context.isCandidatePresent(fragment.pairCell, endpointDigit)) {
          continue;
        }
        if (!this.isCellWeakLink(context, fragment.tripleCell, entry.digit, internalStrongLinks)) {
          continue;
        }
        if (!this.isBivalueWeakLinkOnPairCell(context, fragment, endpointDigit, internalStrongLinks)) {
          continue;
        }
        for (const internal of internalStrongLinks) {
          if (internal.digit === endpointDigit || !this.isDistinctStructuralChain(entry, fragment, internal)) {
            continue;
          }
          const type1 = this.tryType1(context, fragment, entry, internal, endpointDigit);
          if (type1) {
            return type1;
          }
          const type2 = this.tryType2(context, fragment, entry, internal, endpointDigit);
          if (type2) {
            return type2;
          }
        }
      }
    }
    return null;
  }

  private tryType1(
    context: SolverContextLike,
    fragment: AlsPairFragment,
    entry: AlsAicEntryLink,
    internal: AlsInternalStrongLink,
    endpointDigit: Digit,
  ): SolveStep | null {
    if (!this.isValidSameDigitEndpoint(context, entry.sourceCell, fragment.pairCell, endpointDigit)) {
      return null;
    }
    const targetCells = getCommonSeenCells([entry.sourceCell, fragment.pairCell])
      .filter((cell) => !fragment.als.cells.includes(cell) && context.isCandidatePresent(cell, endpointDigit));
    const uniqueTargets = uniqueNumbers(targetCells);
    if (uniqueTargets.length === 0) {
      return null;
    }
    return this.buildStep(
      context,
      fragment,
      entry,
      internal,
      endpointDigit,
      uniqueTargets.map((cell) => ({ type: 'eliminate' as const, cell, digit: endpointDigit })),
      'ALS-AIC uses an external conjugate link, an ALS internal strong link, and matching endpoints to eliminate common peers.',
    );
  }

  private tryType2(
    context: SolverContextLike,
    fragment: AlsPairFragment,
    entry: AlsAicEntryLink,
    internal: AlsInternalStrongLink,
    endpointDigit: Digit,
  ): SolveStep | null {
    for (const bridge of findExternalStrongLinkBridges(context, fragment.pairCell, endpointDigit, [entry.sourceCell, ...fragment.als.cells])) {
      if (!this.isDistinctBridgeChain(entry, internal, bridge)) {
        continue;
      }
      if (!this.isValidSameDigitEndpoint(context, entry.sourceCell, bridge.bridgeCell, endpointDigit)) {
        continue;
      }
      const targetCells = getCommonSeenCells([entry.sourceCell, bridge.bridgeCell])
        .filter((cell) => !fragment.als.cells.includes(cell) && context.isCandidatePresent(cell, endpointDigit));
      const uniqueTargets = uniqueNumbers(targetCells);
      if (uniqueTargets.length === 0) {
        continue;
      }
      return this.buildStep(
        context,
        fragment,
        entry,
        internal,
        endpointDigit,
        uniqueTargets.map((cell) => ({ type: 'eliminate' as const, cell, digit: endpointDigit })),
        'ALS-AIC extends through an external endpoint strong link, so common peers of the endpoints lose the candidate.',
        bridge,
      );
    }
    return null;
  }

  private buildStep(
    context: SolverContextLike,
    fragment: AlsPairFragment,
    entry: AlsAicEntryLink,
    internal: AlsInternalStrongLink,
    endpointDigit: Digit,
    actions: SolveStep['actions'],
    note: string,
    bridge?: ExternalStrongLinkBridge,
  ): SolveStep {
    return {
      technique: this.id,
      score: this.score,
      actions,
      evidence: {
        houses: uniqueHouses([
          entry.sourceHouse,
          ...fragment.sharedHouses,
          internal.house,
          ...(bridge ? [bridge.house] : []),
          ...context.getCellHouses(entry.sourceCell),
          ...context.getCellHouses(fragment.pairCell),
          ...(bridge ? context.getCellHouses(bridge.bridgeCell) : []),
        ]),
        cells: [
          { cell: entry.sourceCell, digit: endpointDigit, role: 'reason' as const },
          { cell: entry.sourceCell, digit: entry.digit, role: 'reason' as const },
          { cell: fragment.tripleCell, digit: fragment.extraDigit, role: 'reason' as const },
          { cell: fragment.tripleCell, digit: internal.digit, role: 'reason' as const },
          { cell: fragment.pairCell, digit: internal.digit, role: 'reason' as const },
          { cell: fragment.pairCell, digit: endpointDigit, role: 'reason' as const },
          ...(bridge ? [{ cell: bridge.bridgeCell, digit: endpointDigit, role: 'reason' as const }] : []),
          ...fragment.als.cells.map((cell) => ({ cell, role: 'link' as const })),
          ...actions.map((action) => ({ cell: action.cell, digit: action.digit, role: 'target' as const })),
        ],
        links: [
          { from: entry.sourceCell, to: fragment.tripleCell, digit: entry.digit, type: 'strong' as const, house: entry.sourceHouse },
          { from: fragment.tripleCell, to: fragment.pairCell, digit: internal.digit, type: 'strong' as const, house: internal.house },
          ...(bridge ? [{ from: fragment.pairCell, to: bridge.bridgeCell, digit: endpointDigit, type: 'strong' as const, house: bridge.house }] : []),
        ],
        note,
      },
    };
  }

  private isCellWeakLink(
    context: SolverContextLike,
    cell: number,
    digit: Digit,
    internalStrongLinks: AlsInternalStrongLink[],
  ): boolean {
    const digits = context.getCandidateDigits(cell);
    return digits.includes(digit) && internalStrongLinks.some((internal) => internal.digit !== digit && digits.includes(internal.digit));
  }

  private isBivalueWeakLinkOnPairCell(
    context: SolverContextLike,
    fragment: AlsPairFragment,
    endpointDigit: Digit,
    internalStrongLinks: AlsInternalStrongLink[],
  ): boolean {
    const digits = context.getCandidateDigits(fragment.pairCell);
    return digits.length === 2
      && digits.includes(endpointDigit)
      && internalStrongLinks.some((internal) => internal.digit !== endpointDigit && digits.includes(internal.digit));
  }

  private isValidSameDigitEndpoint(
    context: SolverContextLike,
    leftCell: number,
    rightCell: number,
    digit: Digit,
  ): boolean {
    return leftCell !== rightCell
      && (CELL_TO_PEERS[leftCell] ?? []).includes(rightCell)
      && context.isCandidatePresent(leftCell, digit)
      && context.isCandidatePresent(rightCell, digit);
  }

  private isDistinctStructuralChain(
    entry: AlsAicEntryLink,
    fragment: AlsPairFragment,
    internal: AlsInternalStrongLink,
  ): boolean {
    return !sameHouse(entry.sourceHouse, internal.house)
      && fragment.sharedHouses.some((house) => sameHouse(house, internal.house));
  }

  private isDistinctBridgeChain(
    entry: AlsAicEntryLink,
    internal: AlsInternalStrongLink,
    bridge: ExternalStrongLinkBridge,
  ): boolean {
    return !sameHouse(bridge.house, entry.sourceHouse) && !sameHouse(bridge.house, internal.house);
  }
}

interface FireworkSignature {
  wingRowCell: number;
  wingColCell: number;
  digits: Digit[];
}

class FireworksTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'fireworks';
  public readonly score = 211;

  public find(context: SolverContextLike): SolveStep | null {
    for (let intersection = 0; intersection < context.board.length; intersection += 1) {
      if (context.board[intersection] !== EMPTY_VALUE) {
        continue;
      }

      const signatureMap = new Map<string, FireworkSignature>();
      for (const digit of context.getCandidateDigits(intersection)) {
        const signature = this.buildSignature(context, intersection, digit);
        if (!signature) {
          continue;
        }
        const key = `${signature.wingRowCell}:${signature.wingColCell}`;
        const existing = signatureMap.get(key);
        if (existing) {
          existing.digits.push(digit);
        } else {
          signatureMap.set(key, signature);
        }
      }

      for (const signature of signatureMap.values()) {
        if (signature.digits.length < 3) {
          continue;
        }
        const patternCells = [intersection, signature.wingRowCell, signature.wingColCell];
        const actions: SolveStep['actions'] = [];
        for (const cell of patternCells) {
          for (const digit of context.getCandidateDigits(cell)) {
            if (signature.digits.includes(digit)) {
              continue;
            }
            actions.push({ type: 'eliminate' as const, cell, digit });
          }
        }
        if (actions.length === 0) {
          continue;
        }
        return {
          technique: this.id,
          score: this.score,
          actions,
          evidence: {
            houses: context.getCellHouses(intersection),
            cells: [
              ...patternCells.map((cell) => ({ cell, role: 'reason' as const })),
              ...actions.map((action) => ({ cell: action.cell, digit: action.digit, role: 'target' as const })),
            ],
            note: 'Fireworks locks three cells into a hidden subset by aligning multiple digits through a shared intersection.',
          },
        };
      }
    }

    return null;
  }

  private buildSignature(
    context: SolverContextLike,
    intersection: number,
    digit: Digit,
  ): FireworkSignature | null {
    const box = context.getCellBox(intersection);
    const rowHouse = context.getCellHouses(intersection).find((house) => house.type === 'row');
    const colHouse = context.getCellHouses(intersection).find((house) => house.type === 'col');
    if (!rowHouse || !colHouse) {
      return null;
    }
    const rowCells = context.getHouseCandidateCells(rowHouse, digit);
    const colCells = context.getHouseCandidateCells(colHouse, digit);
    const rowOutsideBox = rowCells.filter((cell) => context.getCellBox(cell) !== box);
    const colOutsideBox = colCells.filter((cell) => context.getCellBox(cell) !== box);
    if (rowOutsideBox.length !== 1 || colOutsideBox.length !== 1) {
      return null;
    }
    return {
      wingRowCell: rowOutsideBox[0]!,
      wingColCell: colOutsideBox[0]!,
      digits: [digit],
    };
  }
}

class TwinnedXYChainsTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'twinned-xy-chains';
  public readonly score = 213;

  public find(context: SolverContextLike): SolveStep | null {
    for (let rowA = 0; rowA < 8; rowA += 1) {
      for (let rowB = rowA + 1; rowB < 9; rowB += 1) {
        for (const cols of createCombinations([0, 1, 2, 3, 4, 5, 6, 7, 8], 3)) {
          const cells = [
            rowA * 9 + cols[0]!,
            rowA * 9 + cols[1]!,
            rowA * 9 + cols[2]!,
            rowB * 9 + cols[0]!,
            rowB * 9 + cols[1]!,
            rowB * 9 + cols[2]!,
          ];
          const step = this.tryPattern(context, cells);
          if (step) {
            return step;
          }
        }
      }
    }

    for (let colA = 0; colA < 8; colA += 1) {
      for (let colB = colA + 1; colB < 9; colB += 1) {
        for (const rows of createCombinations([0, 1, 2, 3, 4, 5, 6, 7, 8], 3)) {
          const cells = [
            rows[0]! * 9 + colA,
            rows[1]! * 9 + colA,
            rows[2]! * 9 + colA,
            rows[0]! * 9 + colB,
            rows[1]! * 9 + colB,
            rows[2]! * 9 + colB,
          ];
          const step = this.tryPattern(context, cells);
          if (step) {
            return step;
          }
        }
      }
    }

    return null;
  }

  private tryPattern(context: SolverContextLike, cells: number[]): SolveStep | null {
    if (cells.some((cell) => context.board[cell] !== EMPTY_VALUE)) {
      return null;
    }
    if (cells.some((cell) => {
      const count = context.getCandidateCount(cell);
      return count < 2 || count > 3;
    })) {
      return null;
    }

    const unionDigits = uniqueNumbers(cells.flatMap((cell) => context.getCandidateDigits(cell)));
    if (unionDigits.length !== 6) {
      return null;
    }

    const digitCells = new Map<Digit, number[]>();
    for (const digit of unionDigits as Digit[]) {
      const positions = cells.filter((cell) => context.isCandidatePresent(cell, digit));
      if (positions.length < 2 || positions.length > 3) {
        return null;
      }
      if (!this.allSeeEachOther(positions)) {
        return null;
      }
      digitCells.set(digit, positions);
    }

    const actions: SolveStep['actions'] = [];
    for (const [digit, positions] of digitCells.entries()) {
      if (positions.length !== 2) {
        continue;
      }
      const eliminationCells = this.getCommonSeenCells(positions[0]!, positions[1]!)
        .filter((cell) => !cells.includes(cell) && context.isCandidatePresent(cell, digit));
      for (const cell of uniqueNumbers(eliminationCells)) {
        actions.push({ type: 'eliminate', cell, digit });
      }
    }

    if (actions.length === 0) {
      return null;
    }

    return {
      technique: this.id,
      score: this.score,
      actions,
      evidence: {
        cells: [
          ...cells.map((cell) => ({ cell, role: 'reason' as const })),
          ...actions.map((action) => ({ cell: action.cell, digit: action.digit, role: 'target' as const })),
        ],
        note: 'Twinned XY-Chains lock six digits into a 2x3/3x2 pattern, allowing paired digits to eliminate common peers.',
      },
    };
  }

  private allSeeEachOther(cells: number[]): boolean {
    for (let leftIndex = 0; leftIndex < cells.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < cells.length; rightIndex += 1) {
        const left = cells[leftIndex]!;
        const right = cells[rightIndex]!;
        const sameRow = CELL_TO_ROW[left] === CELL_TO_ROW[right];
        const sameCol = CELL_TO_COL[left] === CELL_TO_COL[right];
        if (!sameRow && !sameCol) {
          return false;
        }
      }
    }
    return true;
  }

  private getCommonSeenCells(left: number, right: number): number[] {
    const result: number[] = [];
    for (let cell = 0; cell < 81; cell += 1) {
      if (cell === left || cell === right) {
        continue;
      }
      const seesLeft = CELL_TO_ROW[cell] === CELL_TO_ROW[left] || CELL_TO_COL[cell] === CELL_TO_COL[left];
      const seesRight = CELL_TO_ROW[cell] === CELL_TO_ROW[right] || CELL_TO_COL[cell] === CELL_TO_COL[right];
      if (seesLeft && seesRight) {
        result.push(cell);
      }
    }
    return result;
  }
}

class SueDeCoqTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'sue-de-coq';
  public readonly score = 207;

  public find(context: SolverContextLike): SolveStep | null {
    for (let box = 0; box < 9; box += 1) {
      const baseRow = Math.floor(box / 3) * 3;
      for (let row = baseRow; row < baseRow + 3; row += 1) {
        const rowStep = this.findForIntersection(context, 'row', row, box);
        if (rowStep) {
          return rowStep;
        }
      }

      const baseCol = (box % 3) * 3;
      for (let col = baseCol; col < baseCol + 3; col += 1) {
        const colStep = this.findForIntersection(context, 'col', col, box);
        if (colStep) {
          return colStep;
        }
      }
    }
    return null;
  }

  private findForIntersection(
    context: SolverContextLike,
    lineType: 'row' | 'col',
    lineIndex: number,
    boxIndex: number,
  ): SolveStep | null {
    const intersection = context.getHouseCells({ type: 'box', index: boxIndex }).filter((cell) =>
      context.board[cell] === EMPTY_VALUE
      && context.getCandidateCount(cell) >= 2
      && (lineType === 'row' ? context.getCellRow(cell) === lineIndex : context.getCellCol(cell) === lineIndex),
    );
    if (intersection.length < 2 || intersection.length > 3) {
      return null;
    }

    const lineWingPool = context.getHouseCells({ type: lineType, index: lineIndex }).filter((cell) =>
      context.board[cell] === EMPTY_VALUE
      && context.getCandidateCount(cell) >= 2
      && !intersection.includes(cell)
      && context.getCellBox(cell) !== boxIndex,
    );
    const boxWingPool = context.getHouseCells({ type: 'box', index: boxIndex }).filter((cell) =>
      context.board[cell] === EMPTY_VALUE
      && context.getCandidateCount(cell) >= 2
      && !intersection.includes(cell)
      && (lineType === 'row' ? context.getCellRow(cell) !== lineIndex : context.getCellCol(cell) !== lineIndex),
    );
    if (lineWingPool.length === 0 || boxWingPool.length === 0) {
      return null;
    }

    const intersectionMask = this.unionMask(context, intersection);
    if (countMaskBits(intersectionMask) < intersection.length + 2) {
      return null;
    }

    for (let lineSize = 1; lineSize <= Math.min(3, lineWingPool.length); lineSize += 1) {
      for (const lineWing of createCombinations(lineWingPool, lineSize)) {
        const lineUnion = intersectionMask | this.unionMask(context, lineWing);
        if (countMaskBits(lineUnion) !== intersection.length + lineWing.length) {
          continue;
        }
        const lineExclusive = digitsFromMask(lineUnion & ~intersectionMask);
        if (lineExclusive.length === 0) {
          continue;
        }

        for (let boxSize = 1; boxSize <= Math.min(3, boxWingPool.length); boxSize += 1) {
          for (const boxWing of createCombinations(boxWingPool, boxSize)) {
            const boxUnion = intersectionMask | this.unionMask(context, boxWing);
            if (countMaskBits(boxUnion) !== intersection.length + boxWing.length) {
              continue;
            }
            const boxExclusive = digitsFromMask(boxUnion & ~intersectionMask);
            if (boxExclusive.length === 0 || lineExclusive.some((digit) => boxExclusive.includes(digit))) {
              continue;
            }

            const actions: SolveStep['actions'] = [];
            for (const cell of context.getHouseCells({ type: lineType, index: lineIndex })) {
              if (intersection.includes(cell) || lineWing.includes(cell) || context.board[cell] !== EMPTY_VALUE) {
                continue;
              }
              for (const digit of lineExclusive) {
                if (context.isCandidatePresent(cell, digit)) {
                  actions.push({ type: 'eliminate', cell, digit });
                }
              }
            }
            for (const cell of context.getHouseCells({ type: 'box', index: boxIndex })) {
              if (intersection.includes(cell) || boxWing.includes(cell) || context.board[cell] !== EMPTY_VALUE) {
                continue;
              }
              if (lineType === 'row' && context.getCellRow(cell) === lineIndex) {
                continue;
              }
              if (lineType === 'col' && context.getCellCol(cell) === lineIndex) {
                continue;
              }
              for (const digit of boxExclusive) {
                if (context.isCandidatePresent(cell, digit)) {
                  actions.push({ type: 'eliminate', cell, digit });
                }
              }
            }
            if (actions.length === 0) {
              continue;
            }
            return {
              technique: this.id,
              score: this.score,
              actions,
              evidence: {
                houses: [
                  { type: lineType, index: lineIndex },
                  { type: 'box', index: boxIndex },
                ],
                cells: [
                  ...intersection.map((cell) => ({ cell, role: 'reason' as const })),
                  ...lineWing.map((cell) => ({ cell, role: 'reason' as const })),
                  ...boxWing.map((cell) => ({ cell, role: 'reason' as const })),
                  ...actions.map((action) => ({ cell: action.cell, digit: action.digit, role: 'target' as const })),
                ],
                note: 'Sue-de-Coq splits a line-box intersection into line and box exclusive digit sets, removing those digits from the corresponding regions.',
              },
            };
          }
        }
      }
    }
    return null;
  }

  private unionMask(context: SolverContextLike, cells: number[]): number {
    let mask = 0;
    for (const cell of cells) {
      mask |= context.getCandidateMask(cell);
    }
    return mask;
  }
}

interface DeathBlossomChoice {
  pivotDigit: Digit;
  als: AlmostLockedSet;
}

class DeathBlossomTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'death-blossom';
  public readonly score = 196;

  public find(context: SolverContextLike): SolveStep | null {
    const allAls = enumerateAlmostLockedSets(context, 1, 4);

    for (let pivot = 0; pivot < context.board.length; pivot += 1) {
      const pivotDigits = context.getCandidateDigits(pivot);
      if (pivotDigits.length < 3 || pivotDigits.length > 4) {
        continue;
      }

      const petalOptions = new Map<Digit, AlmostLockedSet[]>();
      for (const digit of pivotDigits) {
        const options = allAls.filter((als) =>
          !als.cells.includes(pivot)
          && als.digits.includes(digit)
          && (als.digitCells.get(digit) ?? []).every((cell) => (CELL_TO_PEERS[pivot] ?? []).includes(cell)),
        );
        if (options.length === 0) {
          petalOptions.clear();
          break;
        }
        petalOptions.set(digit, options);
      }

      if (petalOptions.size !== pivotDigits.length) {
        continue;
      }

      const result = this.searchChoices(context, pivot, pivotDigits, petalOptions, [], 0);
      if (result) {
        return result;
      }
    }

    return null;
  }

  private searchChoices(
    context: SolverContextLike,
    pivot: number,
    pivotDigits: Digit[],
    petalOptions: Map<Digit, AlmostLockedSet[]>,
    choices: DeathBlossomChoice[],
    digitIndex: number,
  ): SolveStep | null {
    if (digitIndex >= pivotDigits.length) {
      return this.buildStep(context, pivot, choices);
    }

    const pivotDigit = pivotDigits[digitIndex]!;
    for (const als of petalOptions.get(pivotDigit) ?? []) {
      if (!areCellSetsDisjoint(...choices.map((choice) => choice.als.cells), als.cells)) {
        continue;
      }
      const result = this.searchChoices(
        context,
        pivot,
        pivotDigits,
        petalOptions,
        [...choices, { pivotDigit, als }],
        digitIndex + 1,
      );
      if (result) {
        return result;
      }
    }

    return null;
  }

  private buildStep(
    context: SolverContextLike,
    pivot: number,
    choices: DeathBlossomChoice[],
  ): SolveStep | null {
    if (choices.length === 0) {
      return null;
    }

    const pivotDigits = choices.map((choice) => choice.pivotDigit);
    const commonDigits = choices[0]!.als.digits.filter((digit) =>
      !pivotDigits.includes(digit)
      && choices.every((choice) => choice.als.digits.includes(digit)),
    );

    for (const digit of commonDigits) {
      const targetCells = getCommonSeenCellsForDigit(digit, ...choices.map((choice) => choice.als))
        .filter((cell) =>
          cell !== pivot
          && !choices.some((choice) => choice.als.cells.includes(cell))
          && context.isCandidatePresent(cell, digit),
        );
      const uniqueTargets = uniqueNumbers(targetCells);
      if (uniqueTargets.length === 0) {
        continue;
      }

      return {
        technique: this.id,
        score: this.score,
        actions: uniqueTargets.map((cell) => ({ type: 'eliminate' as const, cell, digit })),
        evidence: {
          houses: uniqueHouses([
            ...getCellHouses(context, pivot),
            ...collectAlsHouses(...choices.map((choice) => choice.als)),
          ]),
          cells: [
            { cell: pivot, role: 'reason' as const },
            ...choices.flatMap((choice) => choice.als.cells.map((cell) => ({ cell, role: 'reason' as const }))),
            ...uniqueTargets.map((cell) => ({ cell, digit, role: 'target' as const })),
          ],
          note: 'Death Blossom connects each pivot digit to a separate ALS petal, so their shared external digit can be eliminated.',
        },
      };
    }

    return null;
  }
}

function buildLinkKey(left: number, right: number): string {
  return left < right ? `${left}:${right}` : `${right}:${left}`;
}

class SimpleColoringTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'simple-coloring';
  public readonly score = 170;

  public find(context: SolverContextLike): SolveStep | null {
    for (let digit = 1; digit <= 9; digit += 1) {
      const adjacency = new Map<number, Set<number>>();
      const linkHouses = new Map<string, HouseRef[]>();

      for (const house of ALL_HOUSES) {
        const cells = context.getHouseCandidateCells(house, digit as Digit);
        if (cells.length !== 2) {
          continue;
        }
        for (const cell of cells) {
          if (!adjacency.has(cell)) {
            adjacency.set(cell, new Set<number>());
          }
        }
        adjacency.get(cells[0]!)!.add(cells[1]!);
        adjacency.get(cells[1]!)!.add(cells[0]!);
        const key = buildLinkKey(cells[0]!, cells[1]!);
        linkHouses.set(key, uniqueHouses([...(linkHouses.get(key) ?? []), house]));
      }

      const visited = new Set<number>();
      for (const start of adjacency.keys()) {
        if (visited.has(start)) {
          continue;
        }
        const colorMap = new Map<number, 0 | 1>();
        const queue = [start];
        colorMap.set(start, 0);
        visited.add(start);

        while (queue.length > 0) {
          const current = queue.shift()!;
          const nextColor = colorMap.get(current) === 0 ? 1 : 0;
          for (const neighbor of adjacency.get(current) ?? []) {
            if (!colorMap.has(neighbor)) {
              colorMap.set(neighbor, nextColor);
              queue.push(neighbor);
              visited.add(neighbor);
            }
          }
        }

        const sameColor = this.findSameColorRule(context, digit as Digit, colorMap, linkHouses);
        if (sameColor) {
          return sameColor;
        }
        const trap = this.findTrapRule(context, digit as Digit, colorMap, linkHouses);
        if (trap) {
          return trap;
        }
      }
    }
    return null;
  }

  private findSameColorRule(
    context: SolverContextLike,
    digit: Digit,
    colorMap: Map<number, 0 | 1>,
    linkHouses: Map<string, HouseRef[]>,
  ): SolveStep | null {
    const coloredCells = [...colorMap.keys()];
    for (let leftIndex = 0; leftIndex < coloredCells.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < coloredCells.length; rightIndex += 1) {
        const left = coloredCells[leftIndex]!;
        const right = coloredCells[rightIndex]!;
        if (colorMap.get(left) !== colorMap.get(right) || !(CELL_TO_PEERS[left] ?? []).includes(right)) {
          continue;
        }
        const badColor = colorMap.get(left)!;
        const targetCells = coloredCells.filter((cell) => colorMap.get(cell) === badColor && context.isCandidatePresent(cell, digit));
        if (targetCells.length === 0) {
          continue;
        }
        return {
          technique: this.id,
          score: this.score,
          actions: targetCells.map((cell) => ({ type: 'eliminate' as const, cell, digit })),
          evidence: {
            houses: collectLinkedHouses(coloredCells, linkHouses),
            cells: [
              ...coloredCells.map((cell) => ({ cell, digit, role: 'reason' as const })),
              ...targetCells.map((cell) => ({ cell, digit, role: 'target' as const })),
            ],
            links: buildColorLinks(colorMap, digit, linkHouses),
            note: 'Two cells of the same color see each other, so that color is false.',
          },
        };
      }
    }
    return null;
  }

  private findTrapRule(
    context: SolverContextLike,
    digit: Digit,
    colorMap: Map<number, 0 | 1>,
    linkHouses: Map<string, HouseRef[]>,
  ): SolveStep | null {
    const coloredCells = [...colorMap.keys()];
    for (let cell = 0; cell < context.board.length; cell += 1) {
      if (colorMap.has(cell) || !context.isCandidatePresent(cell, digit)) {
        continue;
      }
      const seesZero = coloredCells.some((colored) => colorMap.get(colored) === 0 && (CELL_TO_PEERS[cell] ?? []).includes(colored));
      const seesOne = coloredCells.some((colored) => colorMap.get(colored) === 1 && (CELL_TO_PEERS[cell] ?? []).includes(colored));
      if (!seesZero || !seesOne) {
        continue;
      }
      return {
        technique: this.id,
        score: this.score,
        actions: [{ type: 'eliminate', cell, digit }],
        evidence: {
          houses: collectLinkedHouses(coloredCells, linkHouses),
          cells: [
            ...coloredCells.map((colored) => ({ cell: colored, digit, role: 'reason' as const })),
            { cell, digit, role: 'target' as const },
          ],
          links: buildColorLinks(colorMap, digit, linkHouses),
          note: 'The target sees both colors of the chain, so the candidate is eliminated.',
        },
      };
    }
    return null;
  }
}

interface GroupedXCycleNode {
  key: string;
  cells: number[];
  houses: HouseRef[];
  isGroup: boolean;
}

interface GroupedXCycleEdge {
  to: string;
  houses: HouseRef[];
}

class GroupedXCyclesTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'grouped-x-cycles';
  public readonly score = 168;
  private static readonly MAX_PATH_NODES = 9;

  public find(context: SolverContextLike): SolveStep | null {
    for (let digit = 1; digit <= 9; digit += 1) {
      const currentDigit = digit as Digit;
      const nodes = this.buildNodes(context, currentDigit);
      const adjacency = this.buildAdjacency(context, currentDigit, nodes);

      for (const start of adjacency.keys()) {
        const queue: Array<{ key: string; path: string[]; houses: HouseRef[] }> = [
          { key: start, path: [start], houses: [] },
        ];

        while (queue.length > 0) {
          const state = queue.shift()!;
          const pathEdges = state.path.length - 1;
          if (state.path.length >= 4 && pathEdges % 2 === 1) {
            const endpoints = [
              nodes.get(state.path[0]!)!,
              nodes.get(state.path[state.path.length - 1]!)!,
            ];
            const eliminations = this.findEliminations(context, currentDigit, endpoints, state.path, nodes);
            if (eliminations.length > 0) {
              return {
                technique: this.id,
                score: this.score,
                actions: eliminations.map((cell) => ({ type: 'eliminate' as const, cell, digit: currentDigit })),
                evidence: {
                  houses: uniqueHouses(state.houses),
                  cells: [
                    ...uniqueNumbers(state.path.flatMap((key) => nodes.get(key)!.cells))
                      .map((cell) => ({ cell, digit: currentDigit, role: 'reason' as const })),
                    ...eliminations.map((cell) => ({ cell, digit: currentDigit, role: 'target' as const })),
                  ],
                  note: `Grouped X-Cycles path ${this.describePath(state.path, nodes)} eliminates digit ${currentDigit}.`,
                },
              };
            }
          }

          if (state.path.length >= GroupedXCyclesTechnique.MAX_PATH_NODES) {
            continue;
          }

          for (const edge of adjacency.get(state.key) ?? []) {
            if (state.path.includes(edge.to)) {
              continue;
            }
            if (this.pathReusesCandidate(state.path, edge.to, nodes, currentDigit)) {
              continue;
            }
            queue.push({
              key: edge.to,
              path: [...state.path, edge.to],
              houses: [...state.houses, ...edge.houses],
            });
          }
        }
      }
    }
    return null;
  }

  private buildNodes(
    context: SolverContextLike,
    digit: Digit,
  ): Map<string, GroupedXCycleNode> {
    const nodes = new Map<string, GroupedXCycleNode>();

    for (let cell = 0; cell < context.board.length; cell += 1) {
      if (!context.isCandidatePresent(cell, digit)) {
        continue;
      }
      nodes.set(`c:${cell}`, {
        key: `c:${cell}`,
        cells: [cell],
        houses: getCellHouses(context, cell),
        isGroup: false,
      });
    }

    for (const seed of collectGroupedNodeSeeds(context, digit)) {
      const key = `g:${seed.lineType}:${seed.box}:${seed.lineIndex}:${seed.cells.join('-')}`;
      nodes.set(key, {
        key,
        cells: seed.cells,
        houses: [
          { type: 'box', index: seed.box },
          { type: seed.lineType, index: seed.lineIndex },
        ],
        isGroup: true,
      });
    }

    return nodes;
  }

  private buildAdjacency(
    context: SolverContextLike,
    digit: Digit,
    nodes: Map<string, GroupedXCycleNode>,
  ): Map<string, GroupedXCycleEdge[]> {
    const adjacency = new Map<string, GroupedXCycleEdge[]>();
    const allNodes = [...nodes.values()];

    const addEdge = (from: string, to: string, house: HouseRef): void => {
      const edges = adjacency.get(from) ?? [];
      const existing = edges.find((edge) => edge.to === to);
      if (existing) {
        existing.houses = uniqueHouses([...existing.houses, house]);
      } else {
        edges.push({ to, houses: [house] });
      }
      adjacency.set(from, edges);
    };

    for (const house of context.getAllHouses()) {
      const candidateCells = context.getHouseCandidateCells(house, digit);
      if (candidateCells.length < 2) {
        continue;
      }

      const compatibleNodes = allNodes.filter((node) =>
        node.cells.every((cell) => candidateCells.includes(cell))
        && nodeCellsFitHouse(node.cells, house),
      );

      for (let leftIndex = 0; leftIndex < compatibleNodes.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < compatibleNodes.length; rightIndex += 1) {
          const left = compatibleNodes[leftIndex]!;
          const right = compatibleNodes[rightIndex]!;
          if (left.cells.some((cell) => right.cells.includes(cell))) {
            continue;
          }
          const union = new Set<number>([...left.cells, ...right.cells]);
          if (union.size !== candidateCells.length) {
            continue;
          }
          if (!candidateCells.every((cell) => union.has(cell))) {
            continue;
          }
          addEdge(left.key, right.key, house);
          addEdge(right.key, left.key, house);
        }
      }
    }

    return adjacency;
  }

  private findEliminations(
    context: SolverContextLike,
    digit: Digit,
    endpoints: GroupedXCycleNode[],
    path: string[],
    nodes: Map<string, GroupedXCycleNode>,
  ): number[] {
    const pathCells = new Set<number>(path.flatMap((key) => nodes.get(key)!.cells));
    const seenByLeft = this.cellsSeeingNode(endpoints[0]!);
    const seenByRight = this.cellsSeeingNode(endpoints[1]!);
    return uniqueNumbers(seenByLeft.filter((cell) => seenByRight.includes(cell)))
      .filter((cell) => !pathCells.has(cell) && context.isCandidatePresent(cell, digit));
  }

  private cellsSeeingNode(node: GroupedXCycleNode): number[] {
    if (node.cells.length === 1) {
      return [node.cells[0]!, ...(CELL_TO_PEERS[node.cells[0]!] ?? [])];
    }
    return getCommonSeenCells(node.cells);
  }

  private describePath(
    path: string[],
    nodes: Map<string, GroupedXCycleNode>,
  ): string {
    return path.map((key) => {
      const node = nodes.get(key)!;
      if (node.isGroup) {
        return `[${node.cells.map((cell) => formatCellLabel(cell)).join(', ')}]`;
      }
      return formatCellLabel(node.cells[0]!);
    }).join(' -> ');
  }

  private pathReusesCandidate(
    path: string[],
    nextKey: string,
    nodes: Map<string, GroupedXCycleNode>,
    digit: Digit,
  ): boolean {
    const used = new Set<string>();
    for (const key of path) {
      const node = nodes.get(key)!;
      for (const cell of node.cells) {
        used.add(candidateRef(cell, digit));
      }
    }
    const nextNode = nodes.get(nextKey)!;
    return nextNode.cells.some((cell) => used.has(candidateRef(cell, digit)));
  }
}

type GroupedAicLinkType = 'strong' | 'weak';

interface GroupedAicNode {
  key: string;
  digit: Digit;
  cells: number[];
  isGroup: boolean;
}

interface GroupedAicEdge {
  to: string;
  type: GroupedAicLinkType;
  house?: HouseRef;
}

interface GroupedAicPathEdge {
  from: string;
  to: string;
  type: GroupedAicLinkType;
  house?: HouseRef;
}

class GroupedAICTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'grouped-aic';
  public readonly score = 212;
  private static readonly MAX_EDGES = 13;

  public find(context: SolverContextLike): SolveStep | null {
    const nodes = this.buildNodes(context);
    const adjacency = this.buildAdjacency(context, nodes);

    for (const start of adjacency.keys()) {
      const queue: Array<{
        key: string;
        path: string[];
        edges: GroupedAicPathEdge[];
        nextType: GroupedAicLinkType;
      }> = [{ key: start, path: [start], edges: [], nextType: 'strong' }];

      while (queue.length > 0) {
        const state = queue.shift()!;
        if (state.edges.length >= GroupedAICTechnique.MAX_EDGES) {
          continue;
        }

        for (const edge of adjacency.get(state.key) ?? []) {
          if (edge.type !== state.nextType || state.path.includes(edge.to)) {
            continue;
          }
          if (this.pathReusesCandidate(state.path, edge.to, nodes)) {
            continue;
          }

          const nextPath = [...state.path, edge.to];
          const nextEdge: GroupedAicPathEdge = {
            from: state.key,
            to: edge.to,
            type: edge.type,
            ...(edge.house ? { house: edge.house } : {}),
          };
          const nextEdges = [...state.edges, nextEdge];

          if (nextEdges.length >= 3 && edge.type === 'strong') {
            const type1 = this.trySameDigitEndpoint(context, nextPath, nextEdges, nodes);
            if (type1) {
              return type1;
            }
            const type2 = this.tryDifferentDigitEndpoint(context, nextPath, nextEdges, nodes);
            if (type2) {
              return type2;
            }
          }

          queue.push({
            key: edge.to,
            path: nextPath,
            edges: nextEdges,
            nextType: state.nextType === 'strong' ? 'weak' : 'strong',
          });
        }
      }
    }

    return null;
  }

  private buildNodes(context: SolverContextLike): Map<string, GroupedAicNode> {
    const nodes = new Map<string, GroupedAicNode>();

    for (let cell = 0; cell < context.board.length; cell += 1) {
      for (const digit of context.getCandidateDigits(cell)) {
        const key = groupedAicSingleNodeKey(cell, digit);
        nodes.set(key, { key, digit, cells: [cell], isGroup: false });
      }
    }

    for (let digit = 1; digit <= 9; digit += 1) {
      for (const seed of collectGroupedNodeSeeds(context, digit as Digit)) {
        const key = groupedAicGroupNodeKey(seed.digit, seed.lineType, seed.box, seed.lineIndex, seed.cells);
        nodes.set(key, {
          key,
          digit: seed.digit,
          cells: seed.cells,
          isGroup: true,
        });
      }
    }

    return nodes;
  }

  private buildAdjacency(
    context: SolverContextLike,
    nodes: Map<string, GroupedAicNode>,
  ): Map<string, GroupedAicEdge[]> {
    const adjacency = new Map<string, GroupedAicEdge[]>();
    const allNodes = [...nodes.values()];

    for (let cell = 0; cell < context.board.length; cell += 1) {
      const digits = context.getCandidateDigits(cell);
      for (let leftIndex = 0; leftIndex < digits.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < digits.length; rightIndex += 1) {
          const left = nodes.get(groupedAicSingleNodeKey(cell, digits[leftIndex]!));
          const right = nodes.get(groupedAicSingleNodeKey(cell, digits[rightIndex]!));
          if (!left || !right) {
            continue;
          }
          addGroupedAicEdge(adjacency, left, right, 'weak');
          addGroupedAicEdge(adjacency, right, left, 'weak');
          if (digits.length === 2) {
            addGroupedAicEdge(adjacency, left, right, 'strong');
            addGroupedAicEdge(adjacency, right, left, 'strong');
          }
        }
      }
    }

    for (const house of context.getAllHouses()) {
      for (let digit = 1; digit <= 9; digit += 1) {
        const candidateCells = context.getHouseCandidateCells(house, digit as Digit);
        if (candidateCells.length < 2) {
          continue;
        }
        const compatibleNodes = allNodes.filter((node) =>
          node.digit === digit
          && node.cells.every((cell) => candidateCells.includes(cell))
          && nodeCellsFitHouse(node.cells, house),
        );

        for (let leftIndex = 0; leftIndex < compatibleNodes.length; leftIndex += 1) {
          for (let rightIndex = leftIndex + 1; rightIndex < compatibleNodes.length; rightIndex += 1) {
            const left = compatibleNodes[leftIndex]!;
            const right = compatibleNodes[rightIndex]!;
            if (groupedAicNodesOverlap(left, right)) {
              continue;
            }

            addGroupedAicEdge(adjacency, left, right, 'weak', house);
            addGroupedAicEdge(adjacency, right, left, 'weak', house);

            const union = new Set<number>([...left.cells, ...right.cells]);
            if (union.size !== candidateCells.length) {
              continue;
            }
            if (!candidateCells.every((cell) => union.has(cell))) {
              continue;
            }
            addGroupedAicEdge(adjacency, left, right, 'strong', house);
            addGroupedAicEdge(adjacency, right, left, 'strong', house);
          }
        }
      }
    }

    return adjacency;
  }

  private trySameDigitEndpoint(
    context: SolverContextLike,
    path: string[],
    edges: GroupedAicPathEdge[],
    nodes: Map<string, GroupedAicNode>,
  ): SolveStep | null {
    const start = nodes.get(path[0]!)!;
    const end = nodes.get(path[path.length - 1]!)!;
    if (start.digit !== end.digit || groupedAicNodesOverlap(start, end)) {
      return null;
    }

    const pathCells = uniqueNumbers(path.flatMap((key) => nodes.get(key)!.cells));
    const excluded = new Set<number>([...pathCells]);
    const seenByStart = groupedAicCellsSeeingNode(start);
    const seenByEnd = groupedAicCellsSeeingNode(end);
    const targetCells = uniqueNumbers(seenByStart.filter((cell) => seenByEnd.includes(cell)))
      .filter((cell) => !excluded.has(cell) && context.isCandidatePresent(cell, start.digit));

    if (targetCells.length === 0) {
      return null;
    }

    return this.buildStep(
      path,
      edges,
      nodes,
      targetCells.map((cell) => ({ type: 'eliminate' as const, cell, digit: start.digit })),
      `Grouped AIC endpoints share digit ${start.digit}, so common peers lose that candidate.`,
    );
  }

  private tryDifferentDigitEndpoint(
    context: SolverContextLike,
    path: string[],
    edges: GroupedAicPathEdge[],
    nodes: Map<string, GroupedAicNode>,
  ): SolveStep | null {
    const start = nodes.get(path[0]!)!;
    const end = nodes.get(path[path.length - 1]!)!;
    if (start.isGroup || end.isGroup || start.digit === end.digit) {
      return null;
    }
    const startCell = start.cells[0]!;
    const endCell = end.cells[0]!;
    if (!(CELL_TO_PEERS[startCell] ?? []).includes(endCell)) {
      return null;
    }

    const pathCandidates = new Set(path);
    const actions: SolveStep['actions'] = [];
    if (
      context.isCandidatePresent(endCell, start.digit)
      && !pathCandidates.has(groupedAicSingleNodeKey(endCell, start.digit))
    ) {
      actions.push({ type: 'eliminate', cell: endCell, digit: start.digit });
    }
    if (
      context.isCandidatePresent(startCell, end.digit)
      && !pathCandidates.has(groupedAicSingleNodeKey(startCell, end.digit))
    ) {
      actions.push({ type: 'eliminate', cell: startCell, digit: end.digit });
    }

    if (actions.length === 0) {
      return null;
    }

    return this.buildStep(
      path,
      edges,
      nodes,
      actions,
      'Grouped AIC endpoints have different digits, so endpoint cross-candidates are eliminated.',
    );
  }

  private buildStep(
    path: string[],
    edges: GroupedAicPathEdge[],
    nodes: Map<string, GroupedAicNode>,
    actions: SolveStep['actions'],
    note: string,
  ): SolveStep {
    const reasonCells = path.flatMap((key) => {
      const node = nodes.get(key)!;
      return node.cells.map((cell) => ({ cell, digit: node.digit, role: 'reason' as const }));
    });
    return {
      technique: this.id,
      score: this.score,
      actions,
      evidence: {
        houses: uniqueHouses(edges.flatMap((edge) => edge.house ? [edge.house] : [])),
        cells: [
          ...reasonCells,
          ...actions.map((action) => ({ cell: action.cell, digit: action.digit, role: 'target' as const })),
        ],
        links: edges.map((edge) => {
          const from = nodes.get(edge.from)!;
          const to = nodes.get(edge.to)!;
          return {
            from: from.cells[0]!,
            to: to.cells[0]!,
            ...(from.digit === to.digit ? { digit: from.digit } : {}),
            type: edge.type,
            ...(edge.house ? { house: edge.house } : {}),
          };
        }),
        note: `${note} Path: ${formatGroupedAicPath(path, nodes)}.`,
      },
    };
  }

  private pathReusesCandidate(
    path: string[],
    nextKey: string,
    nodes: Map<string, GroupedAicNode>,
  ): boolean {
    const used = new Set<string>();
    for (const key of path) {
      const node = nodes.get(key)!;
      for (const cell of node.cells) {
        used.add(candidateRef(cell, node.digit));
      }
    }
    const nextNode = nodes.get(nextKey)!;
    return nextNode.cells.some((cell) => used.has(candidateRef(cell, nextNode.digit)));
  }
}

class XChainTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'x-chain';
  public readonly score = 176;

  public find(context: SolverContextLike): SolveStep | null {
    for (let digit = 1; digit <= 9; digit += 1) {
      const adjacency = buildStrongLinkAdjacency(context, digit as Digit);
      if (adjacency.size < 4) {
        continue;
      }
      for (const start of adjacency.keys()) {
        const queue: Array<{ cell: number; path: number[]; edges: Array<{ from: number; to: number; houses: HouseRef[] }> }> = [
          { cell: start, path: [start], edges: [] },
        ];

        while (queue.length > 0) {
          const current = queue.shift()!;
          for (const edge of adjacency.get(current.cell) ?? []) {
            if (current.path.includes(edge.to)) {
              continue;
            }
            const nextPath = [...current.path, edge.to];
            const nextEdges = [...current.edges, { from: current.cell, to: edge.to, houses: edge.houses }];
            if (nextPath.length >= 4 && nextPath.length % 2 === 0) {
              const start = nextPath[0]!;
              const end = nextPath[nextPath.length - 1]!;
              const eliminationCells = intersectNumbers(CELL_TO_PEERS[start] ?? [], CELL_TO_PEERS[end] ?? [])
                .filter((cell) => !nextPath.includes(cell) && context.isCandidatePresent(cell, digit as Digit));
              const uniqueTargets = uniqueNumbers(eliminationCells);
              if (uniqueTargets.length > 0) {
                return {
                  technique: this.id,
                  score: this.score,
                  actions: uniqueTargets.map((cell) => ({ type: 'eliminate' as const, cell, digit: digit as Digit })),
                  evidence: {
                    houses: uniqueHouses(nextEdges.flatMap((item) => item.houses)),
                    cells: [
                      ...nextPath.map((cell) => ({ cell, digit: digit as Digit, role: 'reason' as const })),
                      ...uniqueTargets.map((cell) => ({ cell, digit: digit as Digit, role: 'target' as const })),
                    ],
                    links: nextEdges.flatMap((item) => item.houses.map((house) => ({
                      from: item.from,
                      to: item.to,
                      digit: digit as Digit,
                      type: 'strong' as const,
                      house,
                    }))),
                    note: 'An even-length strong-link chain makes both endpoints true together, so common peers lose the candidate.',
                  },
                };
              }
            }
            if (nextPath.length < 12) {
              queue.push({ cell: edge.to, path: nextPath, edges: nextEdges });
            }
          }
        }
      }
    }
    return null;
  }
}

interface XYNode {
  cell: number;
  inDigit: Digit;
  outDigit: Digit;
}

class MultiColorsTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'multi-colors';
  public readonly score = 178;

  public find(context: SolverContextLike): SolveStep | null {
    for (let digit = 1; digit <= 9; digit += 1) {
      const adjacency = new Map<number, Set<number>>();
      const linkHouses = new Map<string, HouseRef[]>();
      for (const house of ALL_HOUSES) {
        const cells = context.getHouseCandidateCells(house, digit as Digit);
        if (cells.length !== 2) {
          continue;
        }
        for (const cell of cells) {
          if (!adjacency.has(cell)) {
            adjacency.set(cell, new Set<number>());
          }
        }
        adjacency.get(cells[0]!)!.add(cells[1]!);
        adjacency.get(cells[1]!)!.add(cells[0]!);
        const key = buildLinkKey(cells[0]!, cells[1]!);
        linkHouses.set(key, uniqueHouses([...(linkHouses.get(key) ?? []), house]));
      }

      const components = buildColorComponents(adjacency);
      if (components.length < 2) {
        continue;
      }

      const coloredCells = new Set<number>(components.flatMap((component) => component.cells));
      for (let leftIndex = 0; leftIndex < components.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < components.length; rightIndex += 1) {
          const left = components[leftIndex]!;
          const right = components[rightIndex]!;
          for (const leftCell of left.cells) {
            for (const rightCell of right.cells) {
              if (!(CELL_TO_PEERS[leftCell] ?? []).includes(rightCell)) {
                continue;
              }
              const leftTruth = left.cells.filter((cell) => left.colorMap.get(cell) !== left.colorMap.get(leftCell));
              const rightTruth = right.cells.filter((cell) => right.colorMap.get(cell) !== right.colorMap.get(rightCell));
              const eliminationCells = Array.from({ length: context.board.length }, (_, cell) => cell)
                .filter((cell) => (
                  !coloredCells.has(cell)
                  && context.isCandidatePresent(cell, digit as Digit)
                  && leftTruth.some((truth) => (CELL_TO_PEERS[cell] ?? []).includes(truth))
                  && rightTruth.some((truth) => (CELL_TO_PEERS[cell] ?? []).includes(truth))
                ));
              const uniqueTargets = uniqueNumbers(eliminationCells);
              if (uniqueTargets.length === 0) {
                continue;
              }
              const allColored = [...left.cells, ...right.cells];
              return {
                technique: this.id,
                score: this.score,
                actions: uniqueTargets.map((cell) => ({ type: 'eliminate' as const, cell, digit: digit as Digit })),
                evidence: {
                  houses: collectLinkedHouses(allColored, linkHouses),
                  cells: [
                    ...allColored.map((cell) => ({ cell, digit: digit as Digit, role: 'reason' as const })),
                    ...uniqueTargets.map((cell) => ({ cell, digit: digit as Digit, role: 'target' as const })),
                  ],
                  links: [
                    ...buildColorLinks(left.colorMap, digit as Digit, linkHouses),
                    ...buildColorLinks(right.colorMap, digit as Digit, linkHouses),
                    { from: leftCell, to: rightCell, digit: digit as Digit, type: 'weak' as const },
                  ],
                  note: 'Two independent coloring chains are weakly connected, so cells seeing both opposite colors lose the candidate.',
                },
              };
            }
          }
        }
      }
    }
    return null;
  }
}

type MedusaColor = 0 | 1;

interface MedusaNode {
  cell: number;
  digit: Digit;
}

interface MedusaComponent {
  nodes: string[];
  colorMap: Map<string, MedusaColor>;
}

class ThreeDMedusaTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'three-d-medusa';
  public readonly score = 202;

  public find(context: SolverContextLike): SolveStep | null {
    const { adjacency, linkHouses } = this.buildAdjacency(context);
    const components = this.buildComponents(adjacency);

    for (const component of components) {
      const contradiction = this.findSameColorContradiction(context, component, linkHouses);
      if (contradiction) {
        return contradiction;
      }
      const twoColorsInCell = this.findTwoColorsInCell(context, component, linkHouses);
      if (twoColorsInCell) {
        return twoColorsInCell;
      }
      const unitPlusCell = this.findUnitPlusCellElimination(context, component, linkHouses);
      if (unitPlusCell) {
        return unitPlusCell;
      }
      const trap = this.findTwoColorTrap(context, component, linkHouses);
      if (trap) {
        return trap;
      }
    }

    return null;
  }

  private buildAdjacency(context: SolverContextLike): {
    adjacency: Map<string, Set<string>>;
    linkHouses: Map<string, HouseRef[]>;
  } {
    const adjacency = new Map<string, Set<string>>();
    const linkHouses = new Map<string, HouseRef[]>();
    const connect = (left: string, right: string, houses: HouseRef[] = []): void => {
      if (!adjacency.has(left)) {
        adjacency.set(left, new Set<string>());
      }
      if (!adjacency.has(right)) {
        adjacency.set(right, new Set<string>());
      }
      adjacency.get(left)!.add(right);
      adjacency.get(right)!.add(left);
      if (houses.length > 0) {
        const key = buildMedusaLinkKey(left, right);
        linkHouses.set(key, uniqueHouses([...(linkHouses.get(key) ?? []), ...houses]));
      }
    };

    for (let cell = 0; cell < context.board.length; cell += 1) {
      const digits = context.getCandidateDigits(cell);
      if (digits.length !== 2) {
        continue;
      }
      connect(medusaNodeKey(cell, digits[0]!), medusaNodeKey(cell, digits[1]!));
    }

    for (const house of context.getAllHouses()) {
      for (let digit = 1; digit <= 9; digit += 1) {
        const cells = context.getHouseCandidateCells(house, digit as Digit);
        if (cells.length !== 2) {
          continue;
        }
        connect(medusaNodeKey(cells[0]!, digit as Digit), medusaNodeKey(cells[1]!, digit as Digit), [house]);
      }
    }

    return { adjacency, linkHouses };
  }

  private buildComponents(adjacency: Map<string, Set<string>>): MedusaComponent[] {
    const visited = new Set<string>();
    const components: MedusaComponent[] = [];
    for (const start of adjacency.keys()) {
      if (visited.has(start)) {
        continue;
      }
      const nodes: string[] = [];
      const colorMap = new Map<string, MedusaColor>();
      const queue = [start];
      colorMap.set(start, 0);
      visited.add(start);
      while (queue.length > 0) {
        const current = queue.shift()!;
        nodes.push(current);
        const nextColor: MedusaColor = colorMap.get(current) === 0 ? 1 : 0;
        for (const neighbor of adjacency.get(current) ?? []) {
          if (!colorMap.has(neighbor)) {
            colorMap.set(neighbor, nextColor);
          }
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
      if (nodes.length >= 4) {
        components.push({ nodes, colorMap });
      }
    }
    return components;
  }

  private findSameColorContradiction(
    context: SolverContextLike,
    component: MedusaComponent,
    linkHouses: Map<string, HouseRef[]>,
  ): SolveStep | null {
    const nodes = component.nodes.map(parseMedusaNode);
    for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
        const left = nodes[leftIndex]!;
        const right = nodes[rightIndex]!;
        if (component.colorMap.get(medusaNodeKey(left.cell, left.digit)) !== component.colorMap.get(medusaNodeKey(right.cell, right.digit))) {
          continue;
        }
        const sameCellConflict = left.cell === right.cell && left.digit !== right.digit;
        const sameDigitConflict = left.digit === right.digit && (CELL_TO_PEERS[left.cell] ?? []).includes(right.cell);
        if (!sameCellConflict && !sameDigitConflict) {
          continue;
        }
        const badColor = component.colorMap.get(medusaNodeKey(left.cell, left.digit))!;
        const badNodes = nodes.filter((node) =>
          component.colorMap.get(medusaNodeKey(node.cell, node.digit)) === badColor
          && context.isCandidatePresent(node.cell, node.digit),
        );
        if (badNodes.length === 0) {
          continue;
        }
        return this.buildStep(
          component,
          linkHouses,
          badNodes.map((node) => ({ type: 'eliminate' as const, cell: node.cell, digit: node.digit })),
          sameCellConflict
            ? '3D Medusa found two candidates of one color in the same cell, so that color is false.'
            : '3D Medusa found two same-color same-digit candidates seeing each other, so that color is false.',
        );
      }
    }
    return null;
  }

  private findTwoColorTrap(
    context: SolverContextLike,
    component: MedusaComponent,
    linkHouses: Map<string, HouseRef[]>,
  ): SolveStep | null {
    const nodes = component.nodes.map(parseMedusaNode);
    for (let cell = 0; cell < context.board.length; cell += 1) {
      if (context.board[cell] !== EMPTY_VALUE) {
        continue;
      }
      for (const digit of context.getCandidateDigits(cell)) {
        if (component.colorMap.has(medusaNodeKey(cell, digit))) {
          continue;
        }
        const seesZero = nodes.some((node) =>
          node.digit === digit
          && component.colorMap.get(medusaNodeKey(node.cell, node.digit)) === 0
          && (CELL_TO_PEERS[cell] ?? []).includes(node.cell),
        );
        const seesOne = nodes.some((node) =>
          node.digit === digit
          && component.colorMap.get(medusaNodeKey(node.cell, node.digit)) === 1
          && (CELL_TO_PEERS[cell] ?? []).includes(node.cell),
        );
        if (!seesZero || !seesOne) {
          continue;
        }
        return this.buildStep(
          component,
          linkHouses,
          [{ type: 'eliminate', cell, digit }],
          '3D Medusa target candidate sees both colors of the same digit.',
        );
      }
    }
    return null;
  }

  private findTwoColorsInCell(
    context: SolverContextLike,
    component: MedusaComponent,
    linkHouses: Map<string, HouseRef[]>,
  ): SolveStep | null {
    const nodes = component.nodes.map(parseMedusaNode);
    for (let cell = 0; cell < context.board.length; cell += 1) {
      if (context.board[cell] !== EMPTY_VALUE) {
        continue;
      }
      const coloredInCell = nodes.filter((node) => node.cell === cell);
      if (coloredInCell.length < 2) {
        continue;
      }
      const seenColors = new Set(coloredInCell.map((node) => component.colorMap.get(medusaNodeKey(node.cell, node.digit))));
      if (seenColors.size < 2) {
        continue;
      }
      const protectedDigits = new Set(coloredInCell.map((node) => node.digit));
      const actions = context.getCandidateDigits(cell)
        .filter((digit) => !protectedDigits.has(digit))
        .map((digit) => ({ type: 'eliminate' as const, cell, digit }));
      if (actions.length === 0) {
        continue;
      }
      return this.buildStep(
        component,
        linkHouses,
        actions,
        '3D Medusa found both colors in one cell, so uncolored candidates in that cell are removed.',
      );
    }
    return null;
  }

  private findUnitPlusCellElimination(
    context: SolverContextLike,
    component: MedusaComponent,
    linkHouses: Map<string, HouseRef[]>,
  ): SolveStep | null {
    const nodes = component.nodes.map(parseMedusaNode);
    for (let cell = 0; cell < context.board.length; cell += 1) {
      if (context.board[cell] !== EMPTY_VALUE) {
        continue;
      }
      const coloredInCell = nodes.filter((node) => node.cell === cell);
      if (coloredInCell.length === 0) {
        continue;
      }
      const actions: SolveStep['actions'] = [];
      for (const digit of context.getCandidateDigits(cell)) {
        if (coloredInCell.some((node) => node.digit === digit)) {
          continue;
        }
        const canEliminate = coloredInCell.some((coloredNode) => {
          const color = component.colorMap.get(medusaNodeKey(coloredNode.cell, coloredNode.digit));
          if (color == null) {
            return false;
          }
          const opposite: MedusaColor = color === 0 ? 1 : 0;
          return nodes.some((node) =>
            node.digit === digit
            && component.colorMap.get(medusaNodeKey(node.cell, node.digit)) === opposite
            && (CELL_TO_PEERS[cell] ?? []).includes(node.cell),
          );
        });
        if (canEliminate) {
          actions.push({ type: 'eliminate', cell, digit });
        }
      }
      if (actions.length === 0) {
        continue;
      }
      return this.buildStep(
        component,
        linkHouses,
        actions,
        '3D Medusa removes uncolored cell candidates that see the opposite color of a colored candidate in the same cell.',
      );
    }
    return null;
  }

  private buildStep(
    component: MedusaComponent,
    linkHouses: Map<string, HouseRef[]>,
    actions: SolveStep['actions'],
    note: string,
  ): SolveStep {
    const nodes = component.nodes.map(parseMedusaNode);
    return {
      technique: this.id,
      score: this.score,
      actions,
      evidence: {
        houses: uniqueHouses(component.nodes.flatMap((left, leftIndex) =>
          component.nodes.slice(leftIndex + 1).flatMap((right) => linkHouses.get(buildMedusaLinkKey(left, right)) ?? []),
        )),
        cells: [
          ...nodes.map((node) => ({ cell: node.cell, digit: node.digit, role: 'reason' as const })),
          ...actions.map((action) => ({ cell: action.cell, digit: action.digit, role: 'target' as const })),
        ],
        links: buildMedusaLinks(component, linkHouses),
        note,
      },
    };
  }
}

class XYChainTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'xy-chain';
  public readonly score = 184;

  public find(context: SolverContextLike): SolveStep | null {
    const bivalueCells = Array.from({ length: context.board.length }, (_, cell) => cell)
      .filter((cell) => context.board[cell] === EMPTY_VALUE && context.getCandidateCount(cell) === 2);

    for (const startCell of bivalueCells) {
      const digits = context.getCandidateDigits(startCell);
      for (const startDigit of digits) {
        const endDigit = digits.find((digit) => digit !== startDigit);
        if (!endDigit) {
          continue;
        }
        const queue: Array<{ node: XYNode; path: XYNode[] }> = [{
          node: { cell: startCell, inDigit: startDigit, outDigit: endDigit },
          path: [{ cell: startCell, inDigit: startDigit, outDigit: endDigit }],
        }];

        while (queue.length > 0) {
          const current = queue.shift()!;
          const nextCandidates = bivalueCells.filter((cell) => (
            cell !== current.node.cell
            && !current.path.some((item) => item.cell === cell)
            && (CELL_TO_PEERS[current.node.cell] ?? []).includes(cell)
            && context.isCandidatePresent(cell, current.node.outDigit)
          ));

          for (const nextCell of nextCandidates) {
            const nextDigits = context.getCandidateDigits(nextCell);
            const otherDigit = nextDigits.find((digit) => digit !== current.node.outDigit);
            if (!otherDigit) {
              continue;
            }
            const nextNode: XYNode = {
              cell: nextCell,
              inDigit: current.node.outDigit,
              outDigit: otherDigit,
            };
            const nextPath = [...current.path, nextNode];
            if (nextPath.length >= 3 && nextNode.outDigit === startDigit && nextNode.cell !== startCell) {
              const endpoints = [startCell, nextNode.cell];
              const eliminationCells = getCommonSeenCells(endpoints)
                .filter((cell) => !endpoints.includes(cell) && context.isCandidatePresent(cell, startDigit));
              const uniqueTargets = uniqueNumbers(eliminationCells);
              if (uniqueTargets.length > 0) {
                const cellPath = nextPath.map((item) => item.cell);
                return {
                  technique: this.id,
                  score: this.score,
                  actions: uniqueTargets.map((cell) => ({ type: 'eliminate' as const, cell, digit: startDigit })),
                  evidence: {
                    houses: buildPathHouses(cellPath),
                    cells: [
                      ...cellPath.map((cell) => ({ cell, role: 'reason' as const })),
                      ...uniqueTargets.map((cell) => ({ cell, digit: startDigit, role: 'target' as const })),
                    ],
                    links: buildXYChainLinks(nextPath),
                    note: 'A bivalue chain makes the same digit true at both endpoints, so common peers lose that candidate.',
                  },
                };
              }
            }
            if (nextPath.length < 12) {
              queue.push({ node: nextNode, path: nextPath });
            }
          }
        }
      }
    }
    return null;
  }
}

interface AicNode {
  key: string;
  cell: number;
  digit: Digit;
}

interface AicEdge {
  to: string;
  type: 'strong' | 'weak';
  house?: HouseRef;
}

interface AicPathEdge {
  from: string;
  to: string;
  type: 'strong' | 'weak';
  house?: HouseRef;
}

class AICTechnique implements SolverTechnique {
  public readonly id: TechniqueId;
  public readonly score: number;
  private static readonly MAX_EDGES = 11;

  public constructor(id: 'aic' | 'aic-exotic' = 'aic', score = 205) {
    this.id = id;
    this.score = score;
  }

  public find(context: SolverContextLike): SolveStep | null {
    const graph = buildAicGraph(context);
    for (const start of graph.adjacency.keys()) {
      const queue: Array<{
        key: string;
        path: string[];
        edges: AicPathEdge[];
        nextType: 'strong' | 'weak';
      }> = [{ key: start, path: [start], edges: [], nextType: 'strong' }];

      while (queue.length > 0) {
        const state = queue.shift()!;
        if (state.edges.length >= AICTechnique.MAX_EDGES) {
          continue;
        }
        for (const edge of graph.adjacency.get(state.key) ?? []) {
          if (edge.type !== state.nextType || state.path.includes(edge.to) || pathReusesAicCandidate(state.path, edge.to, graph.nodes)) {
            continue;
          }
          const nextPath = [...state.path, edge.to];
          const nextEdge: AicPathEdge = {
            from: state.key,
            to: edge.to,
            type: edge.type,
            ...(edge.house ? { house: edge.house } : {}),
          };
          const nextEdges = [...state.edges, nextEdge];
          if (nextEdges.length >= 3 && edge.type === 'strong') {
            const type1 = this.trySameDigitEndpoint(context, nextPath, nextEdges, graph.nodes);
            if (type1) {
              return type1;
            }
            const type2 = this.tryDifferentDigitEndpoint(context, nextPath, nextEdges, graph.nodes);
            if (type2) {
              return type2;
            }
          }
          queue.push({
            key: edge.to,
            path: nextPath,
            edges: nextEdges,
            nextType: state.nextType === 'strong' ? 'weak' : 'strong',
          });
        }
      }
    }
    return null;
  }

  private trySameDigitEndpoint(
    context: SolverContextLike,
    path: string[],
    edges: AicPathEdge[],
    nodes: Map<string, AicNode>,
  ): SolveStep | null {
    const start = nodes.get(path[0]!)!;
    const end = nodes.get(path[path.length - 1]!)!;
    if (start.digit !== end.digit || start.cell === end.cell || !(CELL_TO_PEERS[start.cell] ?? []).includes(end.cell)) {
      return null;
    }
    const pathCells = uniqueNumbers(path.map((key) => nodes.get(key)!.cell));
    const targetCells = getCommonSeenCells([start.cell, end.cell])
      .filter((cell) => !pathCells.includes(cell) && context.isCandidatePresent(cell, start.digit));
    const uniqueTargets = uniqueNumbers(targetCells);
    if (uniqueTargets.length === 0) {
      return null;
    }
    return this.buildStep(path, edges, nodes, uniqueTargets.map((cell) => ({
      type: 'eliminate' as const,
      cell,
      digit: start.digit,
    })), 'AIC endpoints have the same digit, so common peers lose that candidate.');
  }

  private tryDifferentDigitEndpoint(
    context: SolverContextLike,
    path: string[],
    edges: AicPathEdge[],
    nodes: Map<string, AicNode>,
  ): SolveStep | null {
    const start = nodes.get(path[0]!)!;
    const end = nodes.get(path[path.length - 1]!)!;
    if (start.cell === end.cell || start.digit === end.digit || !(CELL_TO_PEERS[start.cell] ?? []).includes(end.cell)) {
      return null;
    }
    const actions: SolveStep['actions'] = [];
    const pathCandidates = new Set(path);
    if (context.isCandidatePresent(end.cell, start.digit) && !pathCandidates.has(aicNodeKey(end.cell, start.digit))) {
      actions.push({ type: 'eliminate', cell: end.cell, digit: start.digit });
    }
    if (context.isCandidatePresent(start.cell, end.digit) && !pathCandidates.has(aicNodeKey(start.cell, end.digit))) {
      actions.push({ type: 'eliminate', cell: start.cell, digit: end.digit });
    }
    if (actions.length === 0) {
      return null;
    }
    return this.buildStep(path, edges, nodes, actions, 'AIC endpoints have different digits, so endpoint cross-candidates are eliminated.');
  }

  private buildStep(
    path: string[],
    edges: AicPathEdge[],
    nodes: Map<string, AicNode>,
    actions: SolveStep['actions'],
    note: string,
  ): SolveStep {
    const reasonCells = path.map((key) => nodes.get(key)!);
    return {
      technique: this.id,
      score: this.score,
      actions,
      evidence: {
        houses: uniqueHouses(edges.flatMap((edge) => edge.house ? [edge.house] : [])),
        cells: [
          ...reasonCells.map((node) => ({ cell: node.cell, digit: node.digit, role: 'reason' as const })),
          ...actions.map((action) => ({ cell: action.cell, digit: action.digit, role: 'target' as const })),
        ],
        links: edges.map((edge) => {
          const from = nodes.get(edge.from)!;
          const to = nodes.get(edge.to)!;
          return {
            from: from.cell,
            to: to.cell,
            ...(from.digit === to.digit ? { digit: from.digit } : {}),
            type: edge.type,
            ...(edge.house ? { house: edge.house } : {}),
          };
        }),
        note,
      },
    };
  }
}

class SkyscraperTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'skyscraper';
  public readonly score = 175;

  public find(context: SolverContextLike): SolveStep | null {
    for (let digit = 1; digit <= 9; digit += 1) {
      const rowStep = this.findByLineType(context, digit as Digit, 'row');
      if (rowStep) {
        return rowStep;
      }
      const colStep = this.findByLineType(context, digit as Digit, 'col');
      if (colStep) {
        return colStep;
      }
    }
    return null;
  }

  private findByLineType(
    context: SolverContextLike,
    digit: Digit,
    lineType: 'row' | 'col',
  ): SolveStep | null {
    const houses = Array.from({ length: 9 }, (_, index) => ({
      house: { type: lineType, index } as HouseRef,
      cells: context.getHouseCandidateCells({ type: lineType, index }, digit),
    })).filter((entry) => entry.cells.length === 2);

    for (let leftIndex = 0; leftIndex < houses.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < houses.length; rightIndex += 1) {
        const left = houses[leftIndex]!;
        const right = houses[rightIndex]!;
        const leftCover = left.cells.map((cell) => lineType === 'row' ? context.getCellCol(cell) : context.getCellRow(cell));
        const rightCover = right.cells.map((cell) => lineType === 'row' ? context.getCellCol(cell) : context.getCellRow(cell));
        const shared = leftCover.filter((value) => rightCover.includes(value));
        if (shared.length !== 1) {
          continue;
        }

        const leftRoof = left.cells.find((cell) => (lineType === 'row' ? context.getCellCol(cell) : context.getCellRow(cell)) !== shared[0]);
        const rightRoof = right.cells.find((cell) => (lineType === 'row' ? context.getCellCol(cell) : context.getCellRow(cell)) !== shared[0]);
        if (leftRoof == null || rightRoof == null || context.getCellBox(leftRoof) === context.getCellBox(rightRoof)) {
          continue;
        }

        const targetCells = intersectNumbers(CELL_TO_PEERS[leftRoof] ?? [], CELL_TO_PEERS[rightRoof] ?? [])
          .filter((cell) => cell !== leftRoof && cell !== rightRoof && context.isCandidatePresent(cell, digit));
        const uniqueTargets = uniqueNumbers(targetCells);
        if (uniqueTargets.length === 0) {
          continue;
        }

        const coverType = lineType === 'row' ? 'col' : 'row';
        return eliminationStep(
          this.id,
          this.score,
          uniqueTargets,
          digit,
          [left.house, right.house, { type: coverType, index: shared[0]! }],
          [...left.cells, ...right.cells],
          'Skyscraper removes candidates seen by both roof cells.',
        );
      }
    }
    return null;
  }
}

class TwoStringKiteTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'two-string-kite';
  public readonly score = 180;

  public find(context: SolverContextLike): SolveStep | null {
    for (let digit = 1; digit <= 9; digit += 1) {
      const rows = Array.from({ length: 9 }, (_, index) => ({
        house: { type: 'row', index } as HouseRef,
        cells: context.getHouseCandidateCells({ type: 'row', index }, digit as Digit),
      })).filter((entry) => entry.cells.length === 2);
      const cols = Array.from({ length: 9 }, (_, index) => ({
        house: { type: 'col', index } as HouseRef,
        cells: context.getHouseCandidateCells({ type: 'col', index }, digit as Digit),
      })).filter((entry) => entry.cells.length === 2);

      for (const rowEntry of rows) {
        for (const colEntry of cols) {
          for (const rowCell of rowEntry.cells) {
            for (const colCell of colEntry.cells) {
              if (context.getCellBox(rowCell) !== context.getCellBox(colCell) || rowCell === colCell) {
                continue;
              }

              const boxIndex = context.getCellBox(rowCell);
              const boxCandidates = context.getHouseCandidateCells({ type: 'box', index: boxIndex }, digit as Digit);
              if (boxCandidates.length !== 2 || !boxCandidates.includes(rowCell) || !boxCandidates.includes(colCell)) {
                continue;
              }

              const rowRemote = rowEntry.cells.find((cell) => cell !== rowCell);
              const colRemote = colEntry.cells.find((cell) => cell !== colCell);
              if (rowRemote == null || colRemote == null || rowRemote === colRemote) {
                continue;
              }

              const eliminationCell = context.getCellRow(colRemote) * 9 + context.getCellCol(rowRemote);
              if (
                eliminationCell === rowCell
                || eliminationCell === colCell
                || eliminationCell === rowRemote
                || eliminationCell === colRemote
                || !context.isCandidatePresent(eliminationCell, digit as Digit)
              ) {
                continue;
              }

              return eliminationStep(
                this.id,
                this.score,
                [eliminationCell],
                digit as Digit,
                [rowEntry.house, colEntry.house, { type: 'box', index: boxIndex }],
                [...rowEntry.cells, ...colEntry.cells],
                'Two-String Kite removes the candidate at the remote row-column intersection.',
              );
            }
          }
        }
      }
    }
    return null;
  }
}

interface EmptyRectangleShape {
  box: number;
  row: number;
  col: number;
  boxCells: number[];
}

class EmptyRectangleTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'empty-rectangle';
  public readonly score = 186;

  public find(context: SolverContextLike): SolveStep | null {
    for (let digit = 1; digit <= 9; digit += 1) {
      for (let box = 0; box < 9; box += 1) {
        const shape = this.findShape(context, box, digit as Digit);
        if (!shape) {
          continue;
        }
        const colStep = this.findColumnPairElimination(context, digit as Digit, shape);
        if (colStep) {
          return colStep;
        }
        const rowStep = this.findRowPairElimination(context, digit as Digit, shape);
        if (rowStep) {
          return rowStep;
        }
      }
    }
    return null;
  }

  private findShape(context: SolverContextLike, box: number, digit: Digit): EmptyRectangleShape | null {
    const boxCells = context.getHouseCandidateCells({ type: 'box', index: box }, digit);
    if (boxCells.length < 3) {
      return null;
    }

    const rows = uniqueNumbers(boxCells.map((cell) => CELL_TO_ROW[cell] ?? -1));
    const cols = uniqueNumbers(boxCells.map((cell) => CELL_TO_COL[cell] ?? -1));
    for (const row of rows) {
      for (const col of cols) {
        const intersection = row * 9 + col;
        if ((CELL_TO_BOX[intersection] ?? -1) !== box) {
          continue;
        }
        if (context.isCandidatePresent(intersection, digit)) {
          continue;
        }
        if (boxCells.every((cell) => (CELL_TO_ROW[cell] ?? -1) === row || (CELL_TO_COL[cell] ?? -1) === col)) {
          return { box, row, col, boxCells };
        }
      }
    }
    return null;
  }

  private findColumnPairElimination(
    context: SolverContextLike,
    digit: Digit,
    shape: EmptyRectangleShape,
  ): SolveStep | null {
    for (let col = 0; col < 9; col += 1) {
      const pairCells = context.getHouseCandidateCells({ type: 'col', index: col }, digit);
      if (pairCells.length !== 2) {
        continue;
      }
      const erRowCell = pairCells.find((cell) => (CELL_TO_ROW[cell] ?? -1) === shape.row);
      if (erRowCell == null) {
        continue;
      }
      const otherCell = pairCells.find((cell) => cell !== erRowCell);
      if (otherCell == null || (CELL_TO_BOX[otherCell] ?? -1) === shape.box) {
        continue;
      }
      const targetCell = (CELL_TO_ROW[otherCell] ?? -1) * 9 + shape.col;
      if ((CELL_TO_BOX[targetCell] ?? -1) === shape.box || !context.isCandidatePresent(targetCell, digit)) {
        continue;
      }
      return this.buildStep(digit, shape, pairCells, targetCell, [
        { type: 'box', index: shape.box },
        { type: 'row', index: shape.row },
        { type: 'col', index: col },
        { type: 'col', index: shape.col },
      ]);
    }
    return null;
  }

  private findRowPairElimination(
    context: SolverContextLike,
    digit: Digit,
    shape: EmptyRectangleShape,
  ): SolveStep | null {
    for (let row = 0; row < 9; row += 1) {
      const pairCells = context.getHouseCandidateCells({ type: 'row', index: row }, digit);
      if (pairCells.length !== 2) {
        continue;
      }
      const erColCell = pairCells.find((cell) => (CELL_TO_COL[cell] ?? -1) === shape.col);
      if (erColCell == null) {
        continue;
      }
      const otherCell = pairCells.find((cell) => cell !== erColCell);
      if (otherCell == null || (CELL_TO_BOX[otherCell] ?? -1) === shape.box) {
        continue;
      }
      const targetCell = shape.row * 9 + (CELL_TO_COL[otherCell] ?? -1);
      if ((CELL_TO_BOX[targetCell] ?? -1) === shape.box || !context.isCandidatePresent(targetCell, digit)) {
        continue;
      }
      return this.buildStep(digit, shape, pairCells, targetCell, [
        { type: 'box', index: shape.box },
        { type: 'col', index: shape.col },
        { type: 'row', index: row },
        { type: 'row', index: shape.row },
      ]);
    }
    return null;
  }

  private buildStep(
    digit: Digit,
    shape: EmptyRectangleShape,
    pairCells: number[],
    targetCell: number,
    houses: HouseRef[],
  ): SolveStep {
    return eliminationStep(
      this.id,
      this.score,
      [targetCell],
      digit,
      houses,
      [...shape.boxCells, ...pairCells],
      'Empty Rectangle combines a box pattern and a conjugate pair to eliminate the target candidate.',
    );
  }
}

class TurbotFishTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'turbot-fish';
  public readonly score = 174;

  public find(context: SolverContextLike): SolveStep | null {
    for (let digit = 1; digit <= 9; digit += 1) {
      const adjacency = buildStrongLinkAdjacency(context, digit as Digit);
      if (adjacency.size < 4) {
        continue;
      }

      for (const start of adjacency.keys()) {
        for (const firstEdge of adjacency.get(start) ?? []) {
          const bridgeStart = firstEdge.to;
          for (const bridgeEnd of CELL_TO_PEERS[bridgeStart] ?? []) {
            if (
              bridgeEnd === start
              || !context.isCandidatePresent(bridgeEnd, digit as Digit)
            ) {
              continue;
            }
            const weakLinkHouses = housesForCellPair(bridgeStart, bridgeEnd);
            if (weakLinkHouses.length === 0) {
              continue;
            }

            for (const secondEdge of adjacency.get(bridgeEnd) ?? []) {
              const end = secondEdge.to;
              if (
                end === start
                || end === bridgeStart
                || end === bridgeEnd
                || !context.isCandidatePresent(end, digit as Digit)
              ) {
                continue;
              }
              const path = [start, bridgeStart, bridgeEnd, end];
              const eliminationCells = intersectNumbers(CELL_TO_PEERS[start] ?? [], CELL_TO_PEERS[end] ?? [])
                .filter((cell) => !path.includes(cell) && context.isCandidatePresent(cell, digit as Digit));
              const uniqueTargets = uniqueNumbers(eliminationCells);
              if (uniqueTargets.length === 0) {
                continue;
              }

              return eliminationStep(
                this.id,
                this.score,
                uniqueTargets,
                digit as Digit,
                uniqueHouses([...firstEdge.houses, ...weakLinkHouses, ...secondEdge.houses]),
                path,
                'Turbot Fish uses a strong-weak-strong chain to eliminate candidates seen by both endpoints.',
              );
            }
          }
        }
      }
    }
    return null;
  }
}

class UniqueRectangleTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'unique-rectangle';
  public readonly score = 190;

  public find(context: SolverContextLike): SolveStep | null {
    for (let rowA = 0; rowA < 8; rowA += 1) {
      for (let rowB = rowA + 1; rowB < 9; rowB += 1) {
        for (let colA = 0; colA < 8; colA += 1) {
          for (let colB = colA + 1; colB < 9; colB += 1) {
            const cells = [
              rowA * 9 + colA,
              rowA * 9 + colB,
              rowB * 9 + colA,
              rowB * 9 + colB,
            ];
            if (cells.some((cell) => context.board[cell] !== EMPTY_VALUE)) {
              continue;
            }
            if (new Set(cells.map((cell) => CELL_TO_BOX[cell])).size !== 2) {
              continue;
            }

            const pairDigits = this.getPairDigits(context, cells);
            if (!pairDigits) {
              continue;
            }
            const type1 = this.tryType1(context, cells, pairDigits);
            if (type1) {
              return type1;
            }
            const sharedRoof = this.trySharedRoofExtra(context, cells, pairDigits);
            if (sharedRoof) {
              return sharedRoof;
            }
          }
        }
      }
    }
    return null;
  }

  private getPairDigits(context: SolverContextLike, cells: number[]): Digit[] | null {
    const pairCells = cells.filter((cell) => context.getCandidateCount(cell) === 2);
    if (pairCells.length < 2) {
      return null;
    }
    const pairDigits = context.getCandidateDigits(pairCells[0]!);
    if (pairDigits.length !== 2) {
      return null;
    }
    const pairMask = pairDigits.reduce((mask, digit) => mask | maskForDigit(digit), 0);
    if (pairCells.some((cell) => context.getCandidateMask(cell) !== pairMask)) {
      return null;
    }
    const roofCells = cells.filter((cell) => context.getCandidateMask(cell) !== pairMask);
    if (
      roofCells.length === 0
      || roofCells.some((cell) => (context.getCandidateMask(cell) & pairMask) !== pairMask)
    ) {
      return null;
    }
    return pairDigits;
  }

  private tryType1(context: SolverContextLike, cells: number[], pairDigits: Digit[]): SolveStep | null {
    const pairMask = pairDigits.reduce((mask, digit) => mask | maskForDigit(digit), 0);
    const pairCells = cells.filter((cell) => context.getCandidateMask(cell) === pairMask);
    if (pairCells.length !== 3) {
      return null;
    }
    const targetCell = cells.find((cell) => context.getCandidateMask(cell) !== pairMask);
    if (targetCell == null || countMaskBits(context.getCandidateMask(targetCell)) <= 2) {
      return null;
    }
    const actions: SolveStep['actions'] = pairDigits
      .filter((digit) => hasDigit(context.getCandidateMask(targetCell), digit))
      .map((digit) => ({ type: 'eliminate' as const, cell: targetCell, digit }));
    if (actions.length === 0) {
      return null;
    }
    return {
      technique: this.id,
      score: this.score,
      actions,
      evidence: {
        cells: [
          ...pairCells.map((cell) => ({ cell, role: 'reason' as const })),
          { cell: targetCell, role: 'target' as const },
        ],
        note: 'Unique Rectangle Type 1 removes the deadly pair from the only roof cell.',
      },
    };
  }

  private trySharedRoofExtra(context: SolverContextLike, cells: number[], pairDigits: Digit[]): SolveStep | null {
    const pairMask = pairDigits.reduce((mask, digit) => mask | maskForDigit(digit), 0);
    const roofCells = cells.filter((cell) => context.getCandidateMask(cell) !== pairMask);
    if (roofCells.length !== 2) {
      return null;
    }
    const [roofA, roofB] = roofCells;
    if (roofA == null || roofB == null || housesForCellPair(roofA, roofB).length === 0) {
      return null;
    }
    const sharedExtraDigits = digitsFromMask((context.getCandidateMask(roofA) & context.getCandidateMask(roofB)) & ~pairMask);
    if (sharedExtraDigits.length !== 1) {
      return null;
    }
    const extraDigit = sharedExtraDigits[0]!;
    const targetCells = intersectNumbers(CELL_TO_PEERS[roofA] ?? [], CELL_TO_PEERS[roofB] ?? [])
      .filter((cell) => !cells.includes(cell) && context.isCandidatePresent(cell, extraDigit));
    const uniqueTargets = uniqueNumbers(targetCells);
    if (uniqueTargets.length === 0) {
      return null;
    }
    return eliminationStep(
      this.id,
      this.score,
      uniqueTargets,
      extraDigit,
      housesForCellPair(roofA, roofB),
      cells,
      'Unique Rectangle with shared roof extra removes the extra digit from cells seeing both roof cells.',
    );
  }
}

class AvoidableRectangleTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'avoidable-rectangle';
  public readonly score = 176;

  public find(context: SolverContextLike): SolveStep | null {
    for (let rowA = 0; rowA < 8; rowA += 1) {
      for (let rowB = rowA + 1; rowB < 9; rowB += 1) {
        for (let colA = 0; colA < 8; colA += 1) {
          for (let colB = colA + 1; colB < 9; colB += 1) {
            const cells = [
              rowA * 9 + colA,
              rowA * 9 + colB,
              rowB * 9 + colA,
              rowB * 9 + colB,
            ];
            if (new Set(cells.map((cell) => context.getCellBox(cell))).size !== 2) {
              continue;
            }

            const unsolved = cells.filter((cell) => context.board[cell] === EMPTY_VALUE);
            if (unsolved.length !== 1) {
              continue;
            }
            const targetCell = unsolved[0]!;
            const solvedCells = cells.filter((cell) => cell !== targetCell);
            const solvedValues = solvedCells.map((cell) => context.board[cell]);
            if (solvedValues.some((value) => value === EMPTY_VALUE) || new Set(solvedValues).size !== 2) {
              continue;
            }

            const forbiddenDigit = this.getForbiddenDigit(targetCell, solvedCells, solvedValues as Digit[]);
            if (!forbiddenDigit || !context.isCandidatePresent(targetCell, forbiddenDigit)) {
              continue;
            }

            return {
              technique: this.id,
              score: this.score,
              actions: [{ type: 'eliminate', cell: targetCell, digit: forbiddenDigit }],
              evidence: {
                cells: [
                  ...solvedCells.map((cell) => ({ cell, role: 'reason' as const })),
                  { cell: targetCell, digit: forbiddenDigit, role: 'target' as const },
                ],
                note: 'Avoidable Rectangle removes the candidate that would complete a swappable rectangle with three solved corners.',
              },
            };
          }
        }
      }
    }
    return null;
  }

  private getForbiddenDigit(targetCell: number, solvedCells: number[], solvedValues: Digit[]): Digit | null {
    const targetRow = Math.floor(targetCell / 9);
    const targetCol = targetCell % 9;
    const sameRow = solvedCells.find((cell) => Math.floor(cell / 9) === targetRow);
    const sameCol = solvedCells.find((cell) => cell % 9 === targetCol);
    const diagonal = solvedCells.find((cell) => Math.floor(cell / 9) !== targetRow && cell % 9 !== targetCol);
    if (sameRow == null || sameCol == null || diagonal == null) {
      return null;
    }

    const sameRowValue = solvedValues[solvedCells.indexOf(sameRow)]!;
    const sameColValue = solvedValues[solvedCells.indexOf(sameCol)]!;
    const diagonalValue = solvedValues[solvedCells.indexOf(diagonal)]!;
    if (diagonalValue === sameRowValue && diagonalValue !== sameColValue) {
      return sameColValue;
    }
    if (diagonalValue === sameColValue && diagonalValue !== sameRowValue) {
      return sameRowValue;
    }
    return null;
  }
}

class RectangleEliminationTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'rectangle-elimination';
  public readonly score = 160;

  public find(context: SolverContextLike): SolveStep | null {
    for (let digit = 1; digit <= 9; digit += 1) {
      const rowStep = this.findByRowStrongLink(context, digit as Digit);
      if (rowStep) {
        return rowStep;
      }
      const colStep = this.findByColStrongLink(context, digit as Digit);
      if (colStep) {
        return colStep;
      }
    }
    return null;
  }

  private findByRowStrongLink(context: SolverContextLike, digit: Digit): SolveStep | null {
    for (let row = 0; row < 9; row += 1) {
      const rowCells = context.getHouseCandidateCells({ type: 'row', index: row }, digit);
      if (rowCells.length !== 2) {
        continue;
      }
      for (const hinge of rowCells) {
        const wingStrong = rowCells.find((cell) => cell !== hinge);
        if (wingStrong == null) {
          continue;
        }
        const col = context.getCellCol(hinge);
        const weakCells = context.getHouseCandidateCells({ type: 'col', index: col }, digit)
          .filter((cell) => cell !== hinge && context.getCellBox(cell) !== context.getCellBox(hinge));
        for (const wingWeak of weakCells) {
          const targetBox = getFourthCornerBox(context.getCellBox(hinge), context.getCellBox(wingStrong), context.getCellBox(wingWeak));
          if (targetBox == null) {
            continue;
          }
          const fourthCornerCandidates = context.getHouseCandidateCells({ type: 'box', index: targetBox }, digit);
          if (fourthCornerCandidates.length === 0) {
            continue;
          }
          const fullyCovered = fourthCornerCandidates.every((cell) => (
            context.getCellRow(cell) === context.getCellRow(wingWeak)
            || context.getCellCol(cell) === context.getCellCol(wingStrong)
          ));
          if (!fullyCovered) {
            continue;
          }
          return eliminationStep(
            this.id,
            this.score,
            [wingWeak],
            digit,
            [
              { type: 'row', index: context.getCellRow(hinge) },
              { type: 'col', index: context.getCellCol(hinge) },
              { type: 'box', index: context.getCellBox(hinge) },
              { type: 'box', index: targetBox },
            ],
            [hinge, wingStrong],
            'Rectangle Elimination removes the weak wing candidate because it would cover all candidates in the fourth box.',
          );
        }
      }
    }
    return null;
  }

  private findByColStrongLink(context: SolverContextLike, digit: Digit): SolveStep | null {
    for (let col = 0; col < 9; col += 1) {
      const colCells = context.getHouseCandidateCells({ type: 'col', index: col }, digit);
      if (colCells.length !== 2) {
        continue;
      }
      for (const hinge of colCells) {
        const wingStrong = colCells.find((cell) => cell !== hinge);
        if (wingStrong == null) {
          continue;
        }
        const row = context.getCellRow(hinge);
        const weakCells = context.getHouseCandidateCells({ type: 'row', index: row }, digit)
          .filter((cell) => cell !== hinge && context.getCellBox(cell) !== context.getCellBox(hinge));
        for (const wingWeak of weakCells) {
          const targetBox = getFourthCornerBox(context.getCellBox(hinge), context.getCellBox(wingStrong), context.getCellBox(wingWeak));
          if (targetBox == null) {
            continue;
          }
          const fourthCornerCandidates = context.getHouseCandidateCells({ type: 'box', index: targetBox }, digit);
          if (fourthCornerCandidates.length === 0) {
            continue;
          }
          const fullyCovered = fourthCornerCandidates.every((cell) => (
            context.getCellCol(cell) === context.getCellCol(wingWeak)
            || context.getCellRow(cell) === context.getCellRow(wingStrong)
          ));
          if (!fullyCovered) {
            continue;
          }
          return eliminationStep(
            this.id,
            this.score,
            [wingWeak],
            digit,
            [
              { type: 'col', index: context.getCellCol(hinge) },
              { type: 'row', index: context.getCellRow(hinge) },
              { type: 'box', index: context.getCellBox(hinge) },
              { type: 'box', index: targetBox },
            ],
            [hinge, wingStrong],
            'Rectangle Elimination removes the weak wing candidate because it would cover all candidates in the fourth box.',
          );
        }
      }
    }
    return null;
  }
}

class ExtendedRectangleTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'extended-rectangle';
  public readonly score = 198;

  public find(context: SolverContextLike): SolveStep | null {
    for (let band = 0; band < 3; band += 1) {
      const rows = [band * 3, band * 3 + 1, band * 3 + 2];
      for (const rowPair of createCombinations(rows, 2)) {
        for (let offset = 0; offset < 3; offset += 1) {
          const cols = [offset, offset + 3, offset + 6];
          const step = this.tryPattern(context, rowPair.flatMap((row) => cols.map((col) => row * 9 + col)));
          if (step) {
            return step;
          }
        }
      }
    }

    for (let stack = 0; stack < 3; stack += 1) {
      const cols = [stack * 3, stack * 3 + 1, stack * 3 + 2];
      for (const colPair of createCombinations(cols, 2)) {
        for (let offset = 0; offset < 3; offset += 1) {
          const rows = [offset, offset + 3, offset + 6];
          const step = this.tryPattern(context, rows.flatMap((row) => colPair.map((col) => row * 9 + col)));
          if (step) {
            return step;
          }
        }
      }
    }
    return null;
  }

  private tryPattern(context: SolverContextLike, cells: number[]): SolveStep | null {
    if (cells.some((cell) => context.board[cell] !== EMPTY_VALUE)) {
      return null;
    }
    const pairMask = this.findBasePairMask(context, cells);
    if (pairMask === 0) {
      return null;
    }
    const purePairCells = cells.filter((cell) => context.getCandidateMask(cell) === pairMask);
    const roofCells = cells.filter((cell) => context.getCandidateMask(cell) !== pairMask);
    if (purePairCells.length !== 5 || roofCells.length !== 1) {
      return null;
    }
    const targetCell = roofCells[0]!;
    const targetMask = context.getCandidateMask(targetCell);
    if ((targetMask & pairMask) !== pairMask || countMaskBits(targetMask) <= 2) {
      return null;
    }
    const pairDigits = digitsFromMask(pairMask);
    return {
      technique: this.id,
      score: this.score,
      actions: pairDigits.map((digit) => ({ type: 'eliminate' as const, cell: targetCell, digit })),
      evidence: {
        cells: [
          ...purePairCells.map((cell) => ({ cell, role: 'reason' as const })),
          { cell: targetCell, role: 'target' as const },
        ],
        note: 'Extended Rectangle removes the deadly pair from the only roof cell in a 2x3/3x2 pattern.',
      },
    };
  }

  private findBasePairMask(context: SolverContextLike, cells: number[]): number {
    const frequency = new Map<number, number>();
    for (const cell of cells) {
      const mask = context.getCandidateMask(cell);
      if (countMaskBits(mask) === 2) {
        frequency.set(mask, (frequency.get(mask) ?? 0) + 1);
      }
    }
    for (const [mask, count] of frequency) {
      if (count >= 5) {
        return mask;
      }
    }
    return 0;
  }
}

class HiddenUniqueRectangleTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'hidden-unique-rectangle';
  public readonly score = 201;

  public find(context: SolverContextLike): SolveStep | null {
    for (let rowA = 0; rowA < 8; rowA += 1) {
      for (let rowB = rowA + 1; rowB < 9; rowB += 1) {
        for (let colA = 0; colA < 8; colA += 1) {
          for (let colB = colA + 1; colB < 9; colB += 1) {
            const cells = [
              rowA * 9 + colA,
              rowA * 9 + colB,
              rowB * 9 + colA,
              rowB * 9 + colB,
            ];
            if (cells.some((cell) => context.board[cell] !== EMPTY_VALUE)) {
              continue;
            }
            if (new Set(cells.map((cell) => context.getCellBox(cell))).size !== 2) {
              continue;
            }
            const pairDigits = getBasePairDigits(context, cells);
            if (!pairDigits) {
              continue;
            }
            const type1 = this.tryType1(context, cells, pairDigits);
            if (type1) {
              return type1;
            }
          }
        }
      }
    }
    return null;
  }

  private tryType1(context: SolverContextLike, cells: number[], pairDigits: Digit[]): SolveStep | null {
    for (const opposite of cells) {
      const roles = getUrOppositeRoles(cells, opposite);
      if (!roles) {
        continue;
      }
      const pairMask = pairDigits.reduce((mask, digit) => mask | maskForDigit(digit), 0);
      if (context.getCandidateMask(roles.diagonal) !== pairMask) {
        continue;
      }
      for (const strongDigit of pairDigits) {
        if (
          context.getHouseCandidateCells({ type: 'row', index: context.getCellRow(opposite) }, strongDigit).length !== 2
          || context.getHouseCandidateCells({ type: 'col', index: context.getCellCol(opposite) }, strongDigit).length !== 2
          || !context.isCandidatePresent(opposite, strongDigit)
        ) {
          continue;
        }
        const otherDigit = pairDigits.find((digit) => digit !== strongDigit);
        if (!otherDigit || !context.isCandidatePresent(opposite, otherDigit)) {
          continue;
        }
        return eliminationStep(
          this.id,
          this.score,
          [opposite],
          otherDigit,
          [
            { type: 'row', index: context.getCellRow(opposite) },
            { type: 'col', index: context.getCellCol(opposite) },
          ],
          [roles.diagonal, roles.rowMate, roles.colMate],
          'Hidden Unique Rectangle removes the other pair digit from the strong-link corner.',
        );
      }
    }
    return null;
  }
}

class AICWithUrTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'aic-ur';
  public readonly score = 216;

  public find(context: SolverContextLike): SolveStep | null {
    for (const cells of enumerateUrCells(context)) {
      const pairDigits = getBasePairDigits(context, cells);
      if (!pairDigits) {
        continue;
      }

      const singleRoof = this.trySingleRoofChain(context, cells, pairDigits);
      if (singleRoof) {
        return singleRoof;
      }

      const floorRoof = this.tryFloorRoofChain(context, cells, pairDigits);
      if (floorRoof) {
        return floorRoof;
      }
    }
    return null;
  }

  private trySingleRoofChain(
    context: SolverContextLike,
    cells: number[],
    pairDigits: Digit[],
  ): SolveStep | null {
    const pairMask = pairDigits.reduce((mask, digit) => mask | maskForDigit(digit), 0);
    for (const opposite of cells) {
      const roles = getUrOppositeRoles(cells, opposite);
      if (!roles || context.getCandidateMask(roles.diagonal) !== pairMask) {
        continue;
      }

      for (const strongDigit of pairDigits) {
        if (
          context.getHouseCandidateCells({ type: 'row', index: context.getCellRow(opposite) }, strongDigit).length !== 2
          || context.getHouseCandidateCells({ type: 'col', index: context.getCellCol(opposite) }, strongDigit).length !== 2
          || !context.isCandidatePresent(opposite, strongDigit)
        ) {
          continue;
        }
        const otherDigit = pairDigits.find((digit) => digit !== strongDigit);
        if (!otherDigit || !context.isCandidatePresent(opposite, otherDigit)) {
          continue;
        }

        return this.buildStep(
          cells,
          [roles.diagonal, roles.rowMate, roles.colMate],
          opposite,
          otherDigit,
          [
            { type: 'row', index: context.getCellRow(opposite) },
            { type: 'col', index: context.getCellCol(opposite) },
          ],
          'UR-AIC treats the rectangle as a chain node and removes the other pair digit from the strong-link corner.',
        );
      }
    }
    return null;
  }

  private tryFloorRoofChain(
    context: SolverContextLike,
    cells: number[],
    pairDigits: Digit[],
  ): SolveStep | null {
    const pairMask = pairDigits.reduce((mask, digit) => mask | maskForDigit(digit), 0);
    for (const { floorA, floorB, roofA, roofB } of getUrLayouts(cells)) {
      if (context.getCandidateMask(floorA) !== pairMask || context.getCandidateMask(floorB) !== pairMask) {
        continue;
      }
      for (const strongDigit of pairDigits) {
        const otherDigit = pairDigits.find((digit) => digit !== strongDigit);
        if (!otherDigit) {
          continue;
        }

        const leftStrong = context.getHouseCandidateCells({ type: 'col', index: context.getCellCol(floorA) }, strongDigit);
        if (
          leftStrong.length === 2
          && leftStrong.includes(floorA)
          && leftStrong.includes(roofA)
          && context.isCandidatePresent(roofB, otherDigit)
        ) {
          return this.buildStep(
            cells,
            [floorA, floorB, roofA],
            roofB,
            otherDigit,
            [{ type: 'col', index: context.getCellCol(floorA) }],
            'UR-AIC uses a floor-to-roof strong link to remove the opposite roof candidate.',
          );
        }

        const rightStrong = context.getHouseCandidateCells({ type: 'col', index: context.getCellCol(floorB) }, strongDigit);
        if (
          rightStrong.length === 2
          && rightStrong.includes(floorB)
          && rightStrong.includes(roofB)
          && context.isCandidatePresent(roofA, otherDigit)
        ) {
          return this.buildStep(
            cells,
            [floorA, floorB, roofB],
            roofA,
            otherDigit,
            [{ type: 'col', index: context.getCellCol(floorB) }],
            'UR-AIC uses a floor-to-roof strong link to remove the opposite roof candidate.',
          );
        }
      }
    }
    return null;
  }

  private buildStep(
    rectangleCells: readonly number[],
    reasonCells: readonly number[],
    targetCell: number,
    targetDigit: Digit,
    houses: HouseRef[],
    note: string,
  ): SolveStep {
    return {
      technique: this.id,
      score: this.score,
      actions: [{ type: 'eliminate', cell: targetCell, digit: targetDigit }],
      evidence: {
        houses,
        cells: [
          ...rectangleCells.map((cell) => ({ cell, role: 'reason' as const })),
          ...reasonCells.map((cell) => ({ cell, role: 'link' as const })),
          { cell: targetCell, digit: targetDigit, role: 'target' as const },
        ],
        note,
      },
    };
  }
}

class BugPlusOneTechnique implements SolverTechnique {
  public readonly id: TechniqueId = 'bug-plus-one';
  public readonly score = 210;

  public find(context: SolverContextLike): SolveStep | null {
    const unsolved = Array.from({ length: context.board.length }, (_, cell) => cell)
      .filter((cell) => context.board[cell] === EMPTY_VALUE);
    const triValueCells = unsolved.filter((cell) => context.getCandidateCount(cell) === 3);
    const invalidCells = unsolved.filter((cell) => {
      const count = context.getCandidateCount(cell);
      return count !== 2 && count !== 3;
    });
    if (triValueCells.length !== 1 || invalidCells.length > 0) {
      return null;
    }

    const targetCell = triValueCells[0]!;
    for (const digit of context.getCandidateDigits(targetCell)) {
      const houses: HouseRef[] = [
        { type: 'row', index: context.getCellRow(targetCell) },
        { type: 'col', index: context.getCellCol(targetCell) },
        { type: 'box', index: context.getCellBox(targetCell) },
      ];
      const oddInAllHouses = houses.every((house) => {
        const count = context.getHouseCandidateCells(house, digit).length;
        return count >= 3 && count % 2 === 1;
      });
      if (!oddInAllHouses) {
        continue;
      }
      return {
        technique: this.id,
        score: this.score,
        actions: [{ type: 'place', cell: targetCell, digit }],
        evidence: {
          houses,
          cells: [{ cell: targetCell, digit, role: 'target' }],
          note: 'BUG+1 places the digit that appears odd times in all houses of the only trivalue cell.',
        },
      };
    }
    return null;
  }
}

function placementStep(
  technique: TechniqueId,
  score: number,
  cell: number,
  digit: Digit,
  house: HouseRef | undefined,
  note: string,
): SolveStep {
  const evidence: SolveStep['evidence'] = {
    cells: [
      {
        cell,
        digit,
        role: 'target',
      },
    ],
    note,
  };
  if (house) {
    evidence.houses = [house];
  }

  return {
    technique,
    score,
    actions: [
      {
        type: 'place',
        cell,
        digit,
      },
    ],
    evidence,
  };
}

function eliminationStep(
  technique: TechniqueId,
  score: number,
  targetCells: readonly number[],
  digit: Digit,
  houses: HouseRef[],
  reasonCells: readonly number[],
  note: string,
): SolveStep {
  return {
    technique,
    score,
    actions: targetCells.map((cell) => ({ type: 'eliminate', cell, digit })),
    evidence: {
      houses,
      cells: [
        ...reasonCells.map((cell) => ({ cell, digit, role: 'reason' as const })),
        ...targetCells.map((cell) => ({ cell, digit, role: 'target' as const })),
      ],
      note,
    },
  };
}

function subsetStep(
  technique: TechniqueId,
  score: number,
  house: HouseRef,
  reasonCells: readonly number[],
  actions: SolveStep['actions'],
  note: string,
): SolveStep {
  return {
    technique,
    score,
    actions,
    evidence: {
      houses: [house],
      cells: [
        ...reasonCells.map((cell) => ({ cell, role: 'reason' as const })),
        ...actions.map((action) => ({ cell: action.cell, digit: action.digit, role: 'target' as const })),
      ],
      note,
    },
  };
}

function createCombinations<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  const walk = (start: number, current: T[]): void => {
    if (current.length === size) {
      result.push([...current]);
      return;
    }
    for (let index = start; index <= items.length - (size - current.length); index += 1) {
      current.push(items[index]!);
      walk(index + 1, current);
      current.pop();
    }
  };
  walk(0, []);
  return result;
}

function uniqueNumbers(values: readonly number[]): number[] {
  return [...new Set(values)];
}

function formatCellLabel(cell: number): string {
  return `r${(CELL_TO_ROW[cell] ?? 0) + 1}c${(CELL_TO_COL[cell] ?? 0) + 1}`;
}

function intersectNumbers(left: readonly number[], right: readonly number[]): number[] {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
}

function housesForCellPair(left: number, right: number): HouseRef[] {
  const houses: HouseRef[] = [];
  if ((CELL_TO_ROW[left] ?? -1) === (CELL_TO_ROW[right] ?? -2)) {
    houses.push({ type: 'row', index: CELL_TO_ROW[left]! });
  }
  if ((CELL_TO_COL[left] ?? -1) === (CELL_TO_COL[right] ?? -2)) {
    houses.push({ type: 'col', index: CELL_TO_COL[left]! });
  }
  if ((CELL_TO_BOX[left] ?? -1) === (CELL_TO_BOX[right] ?? -2)) {
    houses.push({ type: 'box', index: CELL_TO_BOX[left]! });
  }
  return houses;
}

function uniqueHouses(houses: readonly HouseRef[]): HouseRef[] {
  const result: HouseRef[] = [];
  const seen = new Set<string>();
  for (const house of houses) {
    const key = `${house.type}:${house.index}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(house);
  }
  return result;
}

function sameHouse(left: HouseRef, right: HouseRef): boolean {
  return left.type === right.type && left.index === right.index;
}

function buildStrongLinkAdjacency(
  context: SolverContextLike,
  digit: Digit,
): Map<number, Array<{ to: number; houses: HouseRef[] }>> {
  const adjacency = new Map<number, Array<{ to: number; houses: HouseRef[] }>>();
  for (const house of ALL_HOUSES) {
    const cells = context.getHouseCandidateCells(house, digit);
    if (cells.length !== 2) {
      continue;
    }
    const [first, second] = cells;
    if (first == null || second == null) {
      continue;
    }
    addStrongLink(first, second, house);
    addStrongLink(second, first, house);
  }
  return adjacency;

  function addStrongLink(from: number, to: number, house: HouseRef): void {
    const links = adjacency.get(from) ?? [];
    const existing = links.find((link) => link.to === to);
    if (existing) {
      existing.houses = uniqueHouses([...existing.houses, house]);
      return;
    }
    links.push({ to, houses: [house] });
    adjacency.set(from, links);
  }
}

function getFourthCornerBox(hingeBox: number, strongBox: number, weakBox: number): number | null {
  const hingeBand = Math.floor(hingeBox / 3);
  const hingeStack = hingeBox % 3;
  const strongBand = Math.floor(strongBox / 3);
  const strongStack = strongBox % 3;
  const weakBand = Math.floor(weakBox / 3);
  const weakStack = weakBox % 3;
  if (hingeBand !== strongBand || hingeStack !== weakStack || hingeBand === weakBand || hingeStack === strongStack) {
    return null;
  }
  return weakBand * 3 + strongStack;
}

function getBasePairDigits(context: SolverContextLike, cells: number[]): Digit[] | null {
  let commonMask = 0x1ff;
  for (const cell of cells) {
    commonMask &= context.getCandidateMask(cell);
  }
  const digits = digitsFromMask(commonMask);
  return digits.length >= 2 ? [digits[0]!, digits[1]!] : null;
}

function enumerateUrCells(context: SolverContextLike): number[][] {
  const result: number[][] = [];
  for (let rowA = 0; rowA < 8; rowA += 1) {
    for (let rowB = rowA + 1; rowB < 9; rowB += 1) {
      for (let colA = 0; colA < 8; colA += 1) {
        for (let colB = colA + 1; colB < 9; colB += 1) {
          const cells = [
            rowA * 9 + colA,
            rowA * 9 + colB,
            rowB * 9 + colA,
            rowB * 9 + colB,
          ];
          if (cells.some((cell) => context.board[cell] !== EMPTY_VALUE)) {
            continue;
          }
          if (new Set(cells.map((cell) => CELL_TO_BOX[cell])).size !== 2) {
            continue;
          }
          result.push(cells);
        }
      }
    }
  }
  return result;
}

function getUrLayouts(cells: readonly number[]): Array<{ floorA: number; floorB: number; roofA: number; roofB: number }> {
  return [
    { floorA: cells[0]!, floorB: cells[1]!, roofA: cells[2]!, roofB: cells[3]! },
    { floorA: cells[2]!, floorB: cells[3]!, roofA: cells[0]!, roofB: cells[1]! },
    { floorA: cells[0]!, floorB: cells[2]!, roofA: cells[1]!, roofB: cells[3]! },
    { floorA: cells[1]!, floorB: cells[3]!, roofA: cells[0]!, roofB: cells[2]! },
  ];
}

function getUrOppositeRoles(
  cells: number[],
  opposite: number,
): { rowMate: number; colMate: number; diagonal: number } | null {
  const row = Math.floor(opposite / 9);
  const col = opposite % 9;
  const rowMate = cells.find((cell) => cell !== opposite && Math.floor(cell / 9) === row);
  const colMate = cells.find((cell) => cell !== opposite && cell % 9 === col);
  const diagonal = cells.find((cell) => cell !== opposite && Math.floor(cell / 9) !== row && cell % 9 !== col);
  if (rowMate == null || colMate == null || diagonal == null) {
    return null;
  }
  return { rowMate, colMate, diagonal };
}

function getCellHouses(context: SolverContextLike, cell: number): HouseRef[] {
  return [
    { type: 'row', index: context.getCellRow(cell) },
    { type: 'col', index: context.getCellCol(cell) },
    { type: 'box', index: context.getCellBox(cell) },
  ];
}

function isConnectedCluster(cells: readonly number[]): boolean {
  if (cells.length === 0) {
    return false;
  }
  const seen = new Set<number>([cells[0]!]);
  const queue = [cells[0]!];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of cells) {
      if (seen.has(next) || next === current) {
        continue;
      }
      if (housesForCellPair(current, next).length > 0) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen.size === cells.length;
}

function isRestrictedDigit(cells: readonly number[]): boolean {
  if (cells.length < 2) {
    return false;
  }
  for (let leftIndex = 0; leftIndex < cells.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < cells.length; rightIndex += 1) {
      if (housesForCellPair(cells[leftIndex]!, cells[rightIndex]!).length === 0) {
        return false;
      }
    }
  }
  return true;
}

function findCoveringHousePair(cells: readonly number[], cellHouses: readonly HouseRef[][]): [HouseRef, HouseRef] | null {
  const houses = uniqueHouses(cellHouses.flat());
  for (let leftIndex = 0; leftIndex < houses.length; leftIndex += 1) {
    for (let rightIndex = leftIndex; rightIndex < houses.length; rightIndex += 1) {
      const left = houses[leftIndex]!;
      const right = houses[rightIndex]!;
      const covered = cells.every((cell) => houseContainsCell(left, cell) || houseContainsCell(right, cell));
      if (covered) {
        return [left, right];
      }
    }
  }
  return null;
}

function houseContainsCell(house: HouseRef, cell: number): boolean {
  if (house.type === 'row') {
    return CELL_TO_ROW[cell] === house.index;
  }
  if (house.type === 'col') {
    return CELL_TO_COL[cell] === house.index;
  }
  return CELL_TO_BOX[cell] === house.index;
}

function houseContainsSolvedDigit(context: SolverContextLike, house: HouseRef, digit: Digit): boolean {
  return context.getHouseCells(house).some((cell) => context.board[cell] === digit);
}

function buildAlsSegments(): AlsSegment[] {
  const segments: AlsSegment[] = [];
  for (let boxIndex = 0; boxIndex < 9; boxIndex += 1) {
    const boxCells = BOX_HOUSES[boxIndex] ?? [];
    const rowIndexes = uniqueNumbers(boxCells.map((cell) => CELL_TO_ROW[cell] ?? -1));
    for (const rowIndex of rowIndexes) {
      const rowCells = ROW_HOUSES[rowIndex] ?? [];
      const intersectionCells = rowCells.filter((cell) => boxCells.includes(cell));
      segments.push({
        primaryHouse: { type: 'row', index: rowIndex },
        secondaryHouse: { type: 'box', index: boxIndex },
        primaryExclusiveCells: rowCells.filter((cell) => !intersectionCells.includes(cell)),
        secondaryExclusiveCells: boxCells.filter((cell) => !intersectionCells.includes(cell)),
        intersectionCells,
      });
    }
    const colIndexes = uniqueNumbers(boxCells.map((cell) => CELL_TO_COL[cell] ?? -1));
    for (const colIndex of colIndexes) {
      const colCells = COL_HOUSES[colIndex] ?? [];
      const intersectionCells = colCells.filter((cell) => boxCells.includes(cell));
      segments.push({
        primaryHouse: { type: 'col', index: colIndex },
        secondaryHouse: { type: 'box', index: boxIndex },
        primaryExclusiveCells: colCells.filter((cell) => !intersectionCells.includes(cell)),
        secondaryExclusiveCells: boxCells.filter((cell) => !intersectionCells.includes(cell)),
        intersectionCells,
      });
    }
  }
  return segments;
}

function collectExocetPatterns(context: SolverContextLike): ExocetPattern[] {
  const patterns: ExocetPattern[] = [];

  for (let box = 0; box < 9; box += 1) {
    const boxCells = context.getHouseCells({ type: 'box', index: box }).filter((cell) => context.board[cell] === EMPTY_VALUE);

    for (let localRow = 0; localRow < 3; localRow += 1) {
      const row = Math.floor(box / 3) * 3 + localRow;
      const segment = boxCells.filter((cell) => CELL_TO_ROW[cell] === row);
      const pattern = tryExocetSegment(context, segment, 'row');
      if (pattern) {
        patterns.push(pattern);
      }
    }

    for (let localCol = 0; localCol < 3; localCol += 1) {
      const col = (box % 3) * 3 + localCol;
      const segment = boxCells.filter((cell) => CELL_TO_COL[cell] === col);
      const pattern = tryExocetSegment(context, segment, 'col');
      if (pattern) {
        patterns.push(pattern);
      }
    }
  }

  return patterns;
}

function tryExocetSegment(
  context: SolverContextLike,
  segment: number[],
  lineType: 'row' | 'col',
): ExocetPattern | null {
  if (segment.length !== 3) {
    return null;
  }

  for (const baseCells of createCombinations(segment, 2)) {
    const spareBaseCell = segment.find((cell) => !baseCells.includes(cell));
    if (spareBaseCell == null) {
      continue;
    }
    const baseDigits = uniqueNumbers(baseCells.flatMap((cell) => context.getCandidateDigits(cell))) as Digit[];
    if (baseDigits.length < 3 || baseDigits.length > 4) {
      continue;
    }

    const targets = findExocetTargets(context, baseCells, spareBaseCell, baseDigits, lineType);
    if (!targets) {
      continue;
    }

    return {
      lineType,
      bandOrStack: lineType === 'row'
        ? Math.floor(CELL_TO_ROW[baseCells[0]!]! / 3)
        : Math.floor(CELL_TO_COL[baseCells[0]!]! / 3),
      baseBox: CELL_TO_BOX[baseCells[0]!]!,
      baseLine: lineType === 'row' ? CELL_TO_ROW[baseCells[0]!]! : CELL_TO_COL[baseCells[0]!]!,
      baseCells: [...baseCells],
      baseDigits,
      targets,
    };
  }

  return null;
}

function findExocetTargets(
  context: SolverContextLike,
  baseCells: number[],
  spareBaseCell: number,
  baseDigits: Digit[],
  lineType: 'row' | 'col',
): [number, number] | null {
  const baseBox = CELL_TO_BOX[baseCells[0]!]!;

  if (lineType === 'row') {
    const band = Math.floor(CELL_TO_ROW[baseCells[0]!]! / 3);
    const candidateBoxes = [band * 3, band * 3 + 1, band * 3 + 2].filter((box) => box !== baseBox);
    const targetLists = candidateBoxes.map((box) =>
      context.getHouseCells({ type: 'box', index: box }).filter((cell) =>
        isValidExocetTargetCell(context, cell, baseCells, spareBaseCell, baseDigits, lineType),
      ),
    );
    if (targetLists.some((list) => list.length !== 1)) {
      return null;
    }
    const left = targetLists[0]?.[0];
    const right = targetLists[1]?.[0];
    if (left == null || right == null) {
      return null;
    }
    if (CELL_TO_ROW[left] !== CELL_TO_ROW[right] && CELL_TO_COL[left] !== CELL_TO_COL[right]) {
      return [left, right];
    }
    return null;
  }

  const stack = Math.floor(CELL_TO_COL[baseCells[0]!]! / 3);
  const candidateBoxes = [stack, stack + 3, stack + 6].filter((box) => box !== baseBox);
  const targetLists = candidateBoxes.map((box) =>
    context.getHouseCells({ type: 'box', index: box }).filter((cell) =>
      isValidExocetTargetCell(context, cell, baseCells, spareBaseCell, baseDigits, lineType),
    ),
  );
  if (targetLists.some((list) => list.length !== 1)) {
    return null;
  }
  const top = targetLists[0]?.[0];
  const bottom = targetLists[1]?.[0];
  if (top == null || bottom == null) {
    return null;
  }
  if (CELL_TO_ROW[top] !== CELL_TO_ROW[bottom] && CELL_TO_COL[top] !== CELL_TO_COL[bottom]) {
    return [top, bottom];
  }
  return null;
}

function isValidExocetTargetCell(
  context: SolverContextLike,
  cell: number,
  baseCells: number[],
  spareBaseCell: number,
  baseDigits: Digit[],
  lineType: 'row' | 'col',
): boolean {
  if (context.board[cell] !== EMPTY_VALUE) {
    return false;
  }
  if (lineType === 'row' && CELL_TO_ROW[cell] === CELL_TO_ROW[baseCells[0]!]) {
    return false;
  }
  if (lineType === 'col' && CELL_TO_COL[cell] === CELL_TO_COL[baseCells[0]!]) {
    return false;
  }

  const digits = context.getCandidateDigits(cell);
  if (!baseDigits.every((digit) => digits.includes(digit))) {
    return false;
  }

  const companion = getExocetCompanionCell(cell, spareBaseCell, lineType);
  if (companion === cell) {
    return false;
  }
  return !cellHasAnyBaseDigit(context, companion, baseDigits);
}

function getExocetCompanionCell(
  targetCell: number,
  spareBaseCell: number,
  lineType: 'row' | 'col',
): number {
  const targetRow = CELL_TO_ROW[targetCell]!;
  const targetCol = CELL_TO_COL[targetCell]!;
  const targetBoxRow = Math.floor(targetRow / 3) * 3;
  const targetBoxCol = Math.floor(targetCol / 3) * 3;
  const spareLocalRow = CELL_TO_ROW[spareBaseCell]! % 3;
  const spareLocalCol = CELL_TO_COL[spareBaseCell]! % 3;

  if (lineType === 'row') {
    return targetRow * 9 + (targetBoxCol + spareLocalCol);
  }
  return (targetBoxRow + spareLocalRow) * 9 + targetCol;
}

function cellHasAnyBaseDigit(
  context: SolverContextLike,
  cell: number,
  baseDigits: Digit[],
): boolean {
  const value = context.board[cell];
  if (value !== EMPTY_VALUE) {
    return baseDigits.includes(value as Digit);
  }
  return baseDigits.some((digit) => context.isCandidatePresent(cell, digit));
}

function collectBranchCells(context: SolverContextLike, maxCandidateCount: number): number[] {
  return Array.from({ length: 81 }, (_, cell) => cell)
    .filter((cell) => context.board[cell] === EMPTY_VALUE)
    .filter((cell) => {
      const count = context.getCandidateCount(cell);
      return count >= 2 && count <= maxCandidateCount;
    })
    .sort((left, right) =>
      context.getCandidateCount(left) - context.getCandidateCount(right)
      || left - right);
}

function collectBranchCandidateSources(context: SolverContextLike): Array<{ cell: number; digit: Digit }> {
  return collectBranchCells(context, 6)
    .flatMap((cell) => context.getCandidateDigits(cell).map((digit) => ({ cell, digit })));
}

function collectUnitBranchSources(context: SolverContextLike): Array<{ house: HouseRef; digit: Digit; cells: number[] }> {
  const result: Array<{ house: HouseRef; digit: Digit; cells: number[] }> = [];
  for (const house of context.getAllHouses()) {
    for (let digit = 1; digit <= 9; digit += 1) {
      const cells = context.getHouseCandidateCells(house, digit as Digit);
      if (cells.length >= 2 && cells.length <= 4) {
        result.push({ house, digit: digit as Digit, cells });
      }
    }
  }
  return result.sort((left, right) =>
    left.cells.length - right.cells.length
    || left.house.index - right.house.index
    || left.digit - right.digit);
}

function evaluateBranchWithPlacement(context: SolverContextLike, cell: number, digit: Digit): BranchOutcome {
  const branch = context.clone();
  branch.placeDigit(cell, digit);
  return runBranchWalkthrough(branch, 12, { type: 'place', cell, digit }, [cell]);
}

function evaluateBranchWithCandidateRemoval(context: SolverContextLike, cell: number, digit: Digit): BranchOutcome {
  const branch = context.clone();
  branch.removeCandidate(cell, digit);
  return runBranchWalkthrough(branch, 12, { type: 'eliminate', cell, digit }, [cell]);
}

function runBranchWalkthrough(
  branch: SolverContextLike,
  maxSteps: number,
  assumption: BranchOutcome['assumption'],
  excludedCells: readonly number[] = [],
): BranchOutcome {
  const excluded = new Set(excludedCells);
  const placements: BranchOutcome['placements'] = [];
  const eliminations: BranchOutcome['eliminations'] = [];
  const seenPlacements = new Set<string>();
  const seenEliminations = new Set<string>();
  const branchTechniques = buildDefaultTechniques().filter((technique) => {
    const definition = TECHNIQUE_DEFINITIONS.find((item) => item.id === technique.id);
    return definition?.stability === 'stable';
  });

  for (let stepIndex = 0; stepIndex < maxSteps; stepIndex += 1) {
    if (branch.hasContradiction()) {
      return {
        assumption,
        contradiction: true,
        exhausted: true,
        contradictionAt: inspectContradiction(branch),
        placements,
        eliminations,
      };
    }
    const step = findBranchStep(branch, branchTechniques);
    if (!step) {
      return { assumption, contradiction: false, exhausted: true, placements, eliminations };
    }
    for (const action of step.actions) {
      const key = `${action.cell}:${action.digit}`;
      if (excluded.has(action.cell)) {
        continue;
      }
      if (action.type === 'place' && !seenPlacements.has(key)) {
        seenPlacements.add(key);
        placements.push({ cell: action.cell, digit: action.digit });
      }
      if (action.type === 'eliminate' && !seenEliminations.has(key)) {
        seenEliminations.add(key);
        eliminations.push({ cell: action.cell, digit: action.digit });
      }
    }
    branch.applyStep(step);
  }

  return {
    assumption,
    contradiction: branch.hasContradiction(),
    exhausted: false,
    ...(branch.hasContradiction() ? { contradictionAt: inspectContradiction(branch) } : {}),
    placements,
    eliminations,
  };
}

function findBranchStep(context: SolverContextLike, techniques: SolverTechnique[]): SolveStep | null {
  for (const technique of techniques) {
    const step = technique.find(context);
    if (step) {
      return step;
    }
  }
  return null;
}

function buildForcingConclusion(
  context: SolverContextLike,
  technique: TechniqueId,
  score: number,
  reasonCells: NonNullable<SolveStep['evidence']['cells']>,
  outcomes: BranchOutcome[],
  excludedCells: readonly number[] = [],
  extraHouses: HouseRef[] = [],
): SolveStep | null {
  if (outcomes.length === 0 || outcomes.some((outcome) => !outcome.contradiction && !outcome.exhausted)) {
    return null;
  }
  const surviving = outcomes.filter((outcome) => !outcome.contradiction);
  if (surviving.length === 0) {
    return null;
  }

  const placement = intersectBranchPlacements(surviving)[0];
  if (placement) {
    return {
      technique,
      score,
      actions: [{ type: 'place', cell: placement.cell, digit: placement.digit }],
      evidence: {
        houses: uniqueHouses([...extraHouses, ...context.getCellHouses(placement.cell)]),
        cells: [
          ...reasonCells,
          { cell: placement.cell, digit: placement.digit, role: 'target' as const },
        ],
        branches: buildBranchEvidence(outcomes),
        note: 'All surviving branches share this placement.',
      },
    };
  }

  const elimination = intersectBranchEliminations(surviving)
    .find((item) => !excludedCells.includes(item.cell) && context.isCandidatePresent(item.cell, item.digit));
  if (elimination) {
    return {
      technique,
      score,
      actions: [{ type: 'eliminate', cell: elimination.cell, digit: elimination.digit }],
      evidence: {
        houses: uniqueHouses([...extraHouses, ...context.getCellHouses(elimination.cell)]),
        cells: [
          ...reasonCells,
          { cell: elimination.cell, digit: elimination.digit, role: 'target' as const },
        ],
        branches: buildBranchEvidence(outcomes),
        note: 'All surviving branches share this elimination.',
      },
    };
  }

  return null;
}

function buildBranchEvidence(outcomes: BranchOutcome[]): NonNullable<SolveStep['evidence']['branches']> {
  return outcomes.map((outcome) => {
    const actions: SolveStep['actions'] = [
      ...outcome.placements.map((placement) => ({
        type: 'place' as const,
        cell: placement.cell,
        digit: placement.digit,
      })),
      ...outcome.eliminations.map((elimination) => ({
        type: 'eliminate' as const,
        cell: elimination.cell,
        digit: elimination.digit,
      })),
    ].slice(0, 24);
    return {
      assumption: outcome.assumption,
      contradiction: outcome.contradiction,
      exhausted: outcome.exhausted,
      ...(outcome.contradictionAt ? { contradictionAt: outcome.contradictionAt } : {}),
      ...(actions.length > 0 ? { actions } : {}),
    };
  });
}

function inspectContradiction(
  context: SolverContextLike,
): NonNullable<SolveStep['evidence']['branches']>[number]['contradictionAt'] | undefined {
  for (let cell = 0; cell < 81; cell += 1) {
    if (context.board[cell] === EMPTY_VALUE && context.getCandidateMask(cell) === 0) {
      return {
        kind: 'cell-empty',
        cell,
      };
    }
  }

  for (const house of context.getAllHouses()) {
    const cells = context.getHouseCells(house);
    for (let digit = 1; digit <= 9; digit += 1) {
      let solvedCount = 0;
      let candidateCount = 0;
      for (const cell of cells) {
        if (context.board[cell] === digit) {
          solvedCount += 1;
        } else if (context.board[cell] === EMPTY_VALUE && context.isCandidatePresent(cell, digit as Digit)) {
          candidateCount += 1;
        }
      }
      if (solvedCount > 1) {
        return {
          kind: 'house-duplicate',
          house,
          digit: digit as Digit,
        };
      }
      if (solvedCount === 0 && candidateCount === 0) {
        return {
          kind: 'house-missing',
          house,
          digit: digit as Digit,
        };
      }
    }
  }
  return undefined;
}

function intersectBranchPlacements(outcomes: BranchOutcome[]): BranchOutcome['placements'] {
  const common = new Map<string, { cell: number; digit: Digit }>();
  for (const placement of outcomes[0]?.placements ?? []) {
    common.set(`${placement.cell}:${placement.digit}`, placement);
  }
  for (const outcome of outcomes.slice(1)) {
    const keys = new Set(outcome.placements.map((item) => `${item.cell}:${item.digit}`));
    for (const key of [...common.keys()]) {
      if (!keys.has(key)) {
        common.delete(key);
      }
    }
  }
  return [...common.values()];
}

function intersectBranchEliminations(outcomes: BranchOutcome[]): BranchOutcome['eliminations'] {
  const common = new Map<string, { cell: number; digit: Digit }>();
  for (const elimination of outcomes[0]?.eliminations ?? []) {
    common.set(`${elimination.cell}:${elimination.digit}`, elimination);
  }
  for (const outcome of outcomes.slice(1)) {
    const keys = new Set(outcome.eliminations.map((item) => `${item.cell}:${item.digit}`));
    for (const key of [...common.keys()]) {
      if (!keys.has(key)) {
        common.delete(key);
      }
    }
  }
  return [...common.values()];
}

function buildExocetStep(
  context: SolverContextLike,
  technique: TechniqueId,
  score: number,
  patterns: ExocetPattern[],
): SolveStep | null {
  const allBaseDigits = uniqueNumbers(patterns.flatMap((pattern) => pattern.baseDigits)) as Digit[];
  const allBaseCells = uniqueNumbers(patterns.flatMap((pattern) => pattern.baseCells));
  const allTargets = uniqueNumbers(patterns.flatMap((pattern) => [...pattern.targets]));
  const actions: SolveStep['actions'] = [];

  for (const target of allTargets) {
    for (const digit of context.getCandidateDigits(target)) {
      if (!allBaseDigits.includes(digit)) {
        actions.push({ type: 'eliminate', cell: target, digit });
      }
    }
  }
  if (actions.length === 0) {
    return null;
  }

  return {
    technique,
    score,
    actions,
    evidence: {
      houses: uniqueHouses([
        ...allBaseCells.flatMap((cell) => context.getCellHouses(cell)),
        ...allTargets.flatMap((cell) => context.getCellHouses(cell)),
      ]),
      cells: [
        ...allBaseCells.map((cell) => ({ cell, role: 'reason' as const })),
        ...allTargets.map((cell) => ({ cell, role: 'pivot' as const })),
        ...actions.map((action) => ({ cell: action.cell, digit: action.digit, role: 'target' as const })),
      ],
      note: technique === 'double-exocet'
        ? 'Double Exocet restricts four target cells to the shared base digits.'
        : 'Exocet restricts both target cells to the base digits.',
    },
  };
}

interface AlmostLockedSet {
  cells: number[];
  mask: number;
  digits: Digit[];
  houses: HouseRef[];
  digitCells: Map<Digit, number[]>;
}

function enumerateAlmostLockedSets(
  context: SolverContextLike,
  minSize = 1,
  maxSize = 4,
): AlmostLockedSet[] {
  const result = new Map<string, AlmostLockedSet>();
  for (const house of context.getAllHouses()) {
    const candidateCells = context.getHouseCells(house).filter((cell) => context.getCandidateCount(cell) >= 2);
    const upperBound = Math.min(maxSize, candidateCells.length);
    for (let size = minSize; size <= upperBound; size += 1) {
      for (const combo of createCombinations(candidateCells, size)) {
        let mask = 0;
        const digitCells = new Map<Digit, number[]>();
        for (const cell of combo) {
          mask |= context.getCandidateMask(cell);
          for (const digit of context.getCandidateDigits(cell)) {
            const cells = digitCells.get(digit) ?? [];
            cells.push(cell);
            digitCells.set(digit, cells);
          }
        }
        if (countMaskBits(mask) !== combo.length + 1) {
          continue;
        }
        const key = [...combo].sort((left, right) => left - right).join(',');
        const existing = result.get(key);
        if (existing) {
          existing.houses = uniqueHouses([...existing.houses, house]);
          continue;
        }
        result.set(key, {
          cells: [...combo],
          mask,
          digits: digitsFromMask(mask),
          houses: [house],
          digitCells,
        });
      }
    }
  }
  return [...result.values()];
}

function areCellSetsDisjoint(...cellSets: number[][]): boolean {
  const seen = new Set<number>();
  for (const cells of cellSets) {
    for (const cell of cells) {
      if (seen.has(cell)) {
        return false;
      }
      seen.add(cell);
    }
  }
  return true;
}

function getCommonAlsDigits(left: AlmostLockedSet, right: AlmostLockedSet): Digit[] {
  return left.digits.filter((digit) => right.digits.includes(digit));
}

function getRestrictedCommonDigits(left: AlmostLockedSet, right: AlmostLockedSet): Digit[] {
  return getCommonAlsDigits(left, right).filter((digit) => isRestrictedCommonDigit(left, right, digit));
}

function isRestrictedCommonDigit(left: AlmostLockedSet, right: AlmostLockedSet, digit: Digit): boolean {
  if (!areCellSetsDisjoint(left.cells, right.cells)) {
    return false;
  }
  const leftCells = left.digitCells.get(digit) ?? [];
  const rightCells = right.digitCells.get(digit) ?? [];
  if (leftCells.length === 0 || rightCells.length === 0) {
    return false;
  }
  return leftCells.every((leftCell) => (
    rightCells.every((rightCell) => (CELL_TO_PEERS[leftCell] ?? []).includes(rightCell))
  ));
}

function collectAlsHouses(...sets: AlmostLockedSet[]): HouseRef[] {
  return uniqueHouses(sets.flatMap((set) => set.houses));
}

function buildAlsPairFragment(context: SolverContextLike, als: AlmostLockedSet): AlsPairFragment | null {
  if (als.cells.length !== 2 || als.digits.length !== 3) {
    return null;
  }
  const [left, right] = als.cells;
  if (left == null || right == null) {
    return null;
  }
  const leftDigits = context.getCandidateDigits(left);
  const rightDigits = context.getCandidateDigits(right);
  const leftSet = new Set(leftDigits);
  const rightSet = new Set(rightDigits);
  const sharedHouses = getSharedHouses(context, left, right);
  if (sharedHouses.length === 0) {
    return null;
  }
  if (leftDigits.length === 3 && rightDigits.length === 2 && rightDigits.every((digit) => leftSet.has(digit))) {
    const extraDigit = leftDigits.find((digit) => !rightSet.has(digit));
    return extraDigit ? {
      als,
      pairCell: right,
      tripleCell: left,
      pairDigits: [...rightDigits],
      extraDigit,
      sharedHouses,
    } : null;
  }
  if (rightDigits.length === 3 && leftDigits.length === 2 && leftDigits.every((digit) => rightSet.has(digit))) {
    const extraDigit = rightDigits.find((digit) => !leftSet.has(digit));
    return extraDigit ? {
      als,
      pairCell: left,
      tripleCell: right,
      pairDigits: [...leftDigits],
      extraDigit,
      sharedHouses,
    } : null;
  }
  return null;
}

function findAlsPairFragments(context: SolverContextLike): AlsPairFragment[] {
  return enumerateAlmostLockedSets(context, 2, 2)
    .map((als) => buildAlsPairFragment(context, als))
    .filter((fragment): fragment is AlsPairFragment => fragment !== null);
}

function findAlsAicEntryLinks(context: SolverContextLike, fragment: AlsPairFragment): AlsAicEntryLink[] {
  const results: AlsAicEntryLink[] = [];
  const seen = new Set<string>();
  for (const house of context.getCellHouses(fragment.tripleCell)) {
    const cells = context.getHouseCandidateCells(house, fragment.extraDigit);
    if (cells.length !== 2 || !cells.includes(fragment.tripleCell)) {
      continue;
    }
    const sourceCell = cells.find((cell) => cell !== fragment.tripleCell);
    if (sourceCell == null || fragment.als.cells.includes(sourceCell)) {
      continue;
    }
    const key = `${sourceCell}:${house.type}:${house.index}:${fragment.extraDigit}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    results.push({ sourceCell, sourceHouse: house, digit: fragment.extraDigit });
  }
  return results;
}

function findAlsInternalStrongLinks(context: SolverContextLike, fragment: AlsPairFragment): AlsInternalStrongLink[] {
  const results: AlsInternalStrongLink[] = [];
  const seen = new Set<string>();
  for (const digit of fragment.pairDigits) {
    for (const house of fragment.sharedHouses) {
      const cells = context.getHouseCandidateCells(house, digit);
      if (cells.length !== 2 || !cells.includes(fragment.pairCell) || !cells.includes(fragment.tripleCell)) {
        continue;
      }
      const key = `${digit}:${house.type}:${house.index}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      results.push({ digit, house });
    }
  }
  return results;
}

function findExternalStrongLinkBridges(
  context: SolverContextLike,
  anchorCell: number,
  digit: Digit,
  excludedCells: readonly number[] = [],
): ExternalStrongLinkBridge[] {
  const excluded = new Set(excludedCells);
  const results: ExternalStrongLinkBridge[] = [];
  const seen = new Set<string>();
  for (const house of context.getCellHouses(anchorCell)) {
    const cells = context.getHouseCandidateCells(house, digit);
    if (cells.length !== 2 || !cells.includes(anchorCell)) {
      continue;
    }
    const bridgeCell = cells.find((cell) => cell !== anchorCell);
    if (bridgeCell == null || excluded.has(bridgeCell) || context.board[bridgeCell] !== EMPTY_VALUE) {
      continue;
    }
    const bridgeDigits = context.getCandidateDigits(bridgeCell);
    if (bridgeDigits.length !== 2 || !bridgeDigits.includes(digit)) {
      continue;
    }
    const key = `${anchorCell}:${bridgeCell}:${digit}:${house.type}:${house.index}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    results.push({ bridgeCell, house });
  }
  return results;
}

function getSharedHouses(context: SolverContextLike, left: number, right: number): HouseRef[] {
  const rightKeys = new Set(context.getCellHouses(right).map((house) => `${house.type}:${house.index}`));
  return context.getCellHouses(left).filter((house) => rightKeys.has(`${house.type}:${house.index}`));
}

function getCommonSeenCellsForDigit(digit: Digit, ...sets: AlmostLockedSet[]): number[] {
  const digitCells = sets.flatMap((set) => set.digitCells.get(digit) ?? []);
  return getCommonSeenCells(digitCells);
}

function getCommonSeenCells(cells: readonly number[]): number[] {
  if (cells.length === 0) {
    return [];
  }
  let common = new Set(CELL_TO_PEERS[cells[0]!] ?? []);
  for (let index = 1; index < cells.length; index += 1) {
    const peers = new Set(CELL_TO_PEERS[cells[index]!] ?? []);
    common = new Set([...common].filter((cell) => peers.has(cell)));
  }
  return [...common];
}

function buildPathHouses(path: readonly number[]): HouseRef[] {
  const houses: HouseRef[] = [];
  for (let index = 0; index < path.length - 1; index += 1) {
    houses.push(...housesForCellPair(path[index]!, path[index + 1]!));
  }
  return uniqueHouses(houses);
}

function collectLinkedHouses(cells: readonly number[], linkHouses: Map<string, HouseRef[]>): HouseRef[] {
  const houses: HouseRef[] = [];
  for (let leftIndex = 0; leftIndex < cells.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < cells.length; rightIndex += 1) {
      houses.push(...(linkHouses.get(buildLinkKey(cells[leftIndex]!, cells[rightIndex]!)) ?? []));
    }
  }
  return uniqueHouses(houses);
}

function buildColorLinks(
  colorMap: Map<number, 0 | 1>,
  digit: Digit,
  linkHouses: Map<string, HouseRef[]>,
): NonNullable<SolveStep['evidence']['links']> {
  const links: NonNullable<SolveStep['evidence']['links']> = [];
  const cells = [...colorMap.keys()];
  for (let leftIndex = 0; leftIndex < cells.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < cells.length; rightIndex += 1) {
      const left = cells[leftIndex]!;
      const right = cells[rightIndex]!;
      if (colorMap.get(left) === colorMap.get(right)) {
        continue;
      }
      for (const house of linkHouses.get(buildLinkKey(left, right)) ?? []) {
        links.push({ from: left, to: right, digit, type: 'strong', house });
      }
    }
  }
  return links;
}

function medusaNodeKey(cell: number, digit: Digit): string {
  return `${cell}:${digit}`;
}

function parseMedusaNode(key: string): MedusaNode {
  const [cellText, digitText] = key.split(':');
  return {
    cell: Number(cellText),
    digit: Number(digitText) as Digit,
  };
}

function buildMedusaLinkKey(left: string, right: string): string {
  return left < right ? `${left}|${right}` : `${right}|${left}`;
}

function buildMedusaLinks(
  component: MedusaComponent,
  linkHouses: Map<string, HouseRef[]>,
): NonNullable<SolveStep['evidence']['links']> {
  const links: NonNullable<SolveStep['evidence']['links']> = [];
  for (const left of component.nodes) {
    const leftNode = parseMedusaNode(left);
    for (const right of component.nodes) {
      if (left >= right) {
        continue;
      }
      const rightNode = parseMedusaNode(right);
      if (component.colorMap.get(left) === component.colorMap.get(right)) {
        continue;
      }
      if (leftNode.cell === rightNode.cell) {
        links.push({ from: leftNode.cell, to: rightNode.cell, type: 'strong' });
        continue;
      }
      if (leftNode.digit !== rightNode.digit) {
        continue;
      }
      for (const house of linkHouses.get(buildMedusaLinkKey(left, right)) ?? []) {
        links.push({ from: leftNode.cell, to: rightNode.cell, digit: leftNode.digit, type: 'strong', house });
      }
    }
  }
  return links;
}

interface ColorComponent {
  cells: number[];
  colorMap: Map<number, 0 | 1>;
}

function buildColorComponents(adjacency: Map<number, Set<number>>): ColorComponent[] {
  const components: ColorComponent[] = [];
  const visited = new Set<number>();
  for (const start of adjacency.keys()) {
    if (visited.has(start)) {
      continue;
    }
    const cells: number[] = [];
    const colorMap = new Map<number, 0 | 1>();
    const queue = [start];
    colorMap.set(start, 0);
    visited.add(start);
    while (queue.length > 0) {
      const current = queue.shift()!;
      cells.push(current);
      const nextColor = colorMap.get(current) === 0 ? 1 : 0;
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!colorMap.has(neighbor)) {
          colorMap.set(neighbor, nextColor);
        }
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    if (cells.length >= 2) {
      components.push({ cells, colorMap });
    }
  }
  return components;
}

function buildXYChainLinks(path: readonly XYNode[]): NonNullable<SolveStep['evidence']['links']> {
  const links: NonNullable<SolveStep['evidence']['links']> = [];
  for (let index = 0; index < path.length; index += 1) {
    const node = path[index]!;
    links.push({ from: node.cell, to: node.cell, digit: node.outDigit, type: 'strong' });
    if (index < path.length - 1) {
      links.push({
        from: node.cell,
        to: path[index + 1]!.cell,
        digit: node.outDigit,
        type: 'weak',
      });
    }
  }
  return links;
}

function buildAicGraph(context: SolverContextLike): {
  nodes: Map<string, AicNode>;
  adjacency: Map<string, AicEdge[]>;
} {
  const nodes = new Map<string, AicNode>();
  const adjacency = new Map<string, AicEdge[]>();
  for (let cell = 0; cell < context.board.length; cell += 1) {
    for (const digit of context.getCandidateDigits(cell)) {
      const node = { key: aicNodeKey(cell, digit), cell, digit };
      nodes.set(node.key, node);
    }
  }
  for (let cell = 0; cell < context.board.length; cell += 1) {
    const digits = context.getCandidateDigits(cell);
    for (let leftIndex = 0; leftIndex < digits.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < digits.length; rightIndex += 1) {
        const left = nodes.get(aicNodeKey(cell, digits[leftIndex]!))!;
        const right = nodes.get(aicNodeKey(cell, digits[rightIndex]!))!;
        addAicEdge(adjacency, left, right, 'weak');
        addAicEdge(adjacency, right, left, 'weak');
        if (digits.length === 2) {
          addAicEdge(adjacency, left, right, 'strong');
          addAicEdge(adjacency, right, left, 'strong');
        }
      }
    }
  }
  for (const house of ALL_HOUSES) {
    for (let digit = 1; digit <= 9; digit += 1) {
      const cells = context.getHouseCandidateCells(house, digit as Digit);
      for (let leftIndex = 0; leftIndex < cells.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < cells.length; rightIndex += 1) {
          const left = nodes.get(aicNodeKey(cells[leftIndex]!, digit as Digit))!;
          const right = nodes.get(aicNodeKey(cells[rightIndex]!, digit as Digit))!;
          addAicEdge(adjacency, left, right, 'weak', house);
          addAicEdge(adjacency, right, left, 'weak', house);
        }
      }
      if (cells.length === 2) {
        const left = nodes.get(aicNodeKey(cells[0]!, digit as Digit))!;
        const right = nodes.get(aicNodeKey(cells[1]!, digit as Digit))!;
        addAicEdge(adjacency, left, right, 'strong', house);
        addAicEdge(adjacency, right, left, 'strong', house);
      }
    }
  }
  return { nodes, adjacency };
}

function aicNodeKey(cell: number, digit: Digit): string {
  return `${cell}:${digit}`;
}

function addAicEdge(
  adjacency: Map<string, AicEdge[]>,
  from: AicNode,
  to: AicNode,
  type: 'strong' | 'weak',
  house?: HouseRef,
): void {
  const edges = adjacency.get(from.key) ?? [];
  if (!edges.some((edge) => edge.to === to.key && edge.type === type && sameHouseOrBothMissing(edge.house, house))) {
    edges.push({ to: to.key, type, ...(house ? { house } : {}) });
    adjacency.set(from.key, edges);
  }
}

function sameHouseOrBothMissing(left: HouseRef | undefined, right: HouseRef | undefined): boolean {
  if (!left && !right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return left.type === right.type && left.index === right.index;
}

function pathReusesAicCandidate(path: string[], nextKey: string, nodes: Map<string, AicNode>): boolean {
  const next = nodes.get(nextKey)!;
  return path.some((key) => {
    const node = nodes.get(key)!;
    return node.cell === next.cell && node.digit === next.digit;
  });
}

function groupedAicSingleNodeKey(cell: number, digit: Digit): string {
  return `c:${cell}:${digit}`;
}

function groupedAicGroupNodeKey(
  digit: Digit,
  lineType: 'row' | 'col',
  box: number,
  lineIndex: number,
  cells: readonly number[],
): string {
  return `g:${digit}:${lineType}:${box}:${lineIndex}:${[...cells].sort((left, right) => left - right).join('-')}`;
}

function groupedAicNodesOverlap(left: GroupedAicNode, right: GroupedAicNode): boolean {
  return left.cells.some((cell) => right.cells.includes(cell));
}

function groupedAicCellsSeeingNode(node: GroupedAicNode): number[] {
  if (node.cells.length === 1) {
    return [node.cells[0]!, ...(CELL_TO_PEERS[node.cells[0]!] ?? [])];
  }
  return getCommonSeenCells(node.cells);
}

function addGroupedAicEdge(
  adjacency: Map<string, GroupedAicEdge[]>,
  from: GroupedAicNode,
  to: GroupedAicNode,
  type: GroupedAicLinkType,
  house?: HouseRef,
): void {
  const edges = adjacency.get(from.key) ?? [];
  if (!edges.some((edge) => edge.to === to.key && edge.type === type && sameHouseOrBothMissing(edge.house, house))) {
    edges.push({ to: to.key, type, ...(house ? { house } : {}) });
    adjacency.set(from.key, edges);
  }
}

function formatGroupedAicPath(path: readonly string[], nodes: Map<string, GroupedAicNode>): string {
  return path.map((key) => {
    const node = nodes.get(key)!;
    if (!node.isGroup) {
      return `${node.digit}@${formatCellLabel(node.cells[0]!)}`;
    }
    return `${node.digit}@组(${node.cells.map((cell) => formatCellLabel(cell)).join('/')})`;
  }).join(' -> ');
}
