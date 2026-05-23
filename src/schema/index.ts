import { getTechniqueDefinitions } from '../solver/techniques.js';

export type JsonSchema = Record<string, unknown>;

const TECHNIQUE_ID_ENUM = getTechniqueDefinitions().map((definition) => definition.id);
const TECHNIQUE_ID_SCHEMA: JsonSchema = {
  type: 'string',
  enum: TECHNIQUE_ID_ENUM,
};
const MAX_SEED = 0xffffffff;

const COUNT_RECORD_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: {
    type: 'integer',
    minimum: 0,
  },
};

const TECHNIQUE_COUNT_RECORD_SCHEMA: JsonSchema = {
  ...COUNT_RECORD_SCHEMA,
  propertyNames: {
    enum: TECHNIQUE_ID_ENUM,
  },
};

const CANONICAL_KEY_SCHEMA: JsonSchema = {
  type: 'string',
  minLength: 81,
  maxLength: 81,
  pattern: '^[0-9]{81}$',
};

const RATING_POLICY_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'version', 'techniqueOrder', 'techniqueScores'],
  properties: {
    id: { type: 'string' },
    version: { type: 'string' },
    techniqueOrder: {
      type: 'array',
      minItems: 1,
      items: TECHNIQUE_ID_SCHEMA,
    },
    fallbackTechniques: {
      type: 'array',
      items: TECHNIQUE_ID_SCHEMA,
    },
    techniqueScores: {
      type: 'object',
      propertyNames: {
        enum: TECHNIQUE_ID_ENUM,
      },
      additionalProperties: {
        type: 'number',
      },
    },
    maxSteps: { type: 'integer', minimum: 1 },
    gradeRules: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['grade'],
        $comment: 'minScore <= maxScore 是跨字段动态规则，请通过 validateRatingPolicy() 做运行时校验。',
        properties: {
          grade: { type: 'string' },
          minScore: { type: 'number' },
          maxScore: { type: 'number' },
          allowedTechniques: {
            type: 'array',
            items: TECHNIQUE_ID_SCHEMA,
          },
        },
      },
    },
  },
};

export const BOARD_SCHEMA: JsonSchema = {
  $id: 'https://github.com/RichardCao/classic9-sudoku/schema/board.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: '标准 9x9 数独棋盘',
  type: 'array',
  minItems: 81,
  maxItems: 81,
  items: {
    type: 'integer',
    minimum: 0,
    maximum: 9,
  },
};

const SOLUTION_BOARD_SCHEMA: JsonSchema = {
  type: 'array',
  minItems: 81,
  maxItems: 81,
  items: {
    type: 'integer',
    minimum: 1,
    maximum: 9,
  },
};

export const CANDIDATE_CONSTRAINTS_SCHEMA: JsonSchema = {
  $id: 'https://github.com/RichardCao/classic9-sudoku/schema/candidate-constraints.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: '候选数约束',
  type: 'object',
  additionalProperties: false,
  properties: {
    forbidden: { $ref: '#/$defs/candidateLists' },
    exactCandidates: { $ref: '#/$defs/candidateLists' },
    exactCandidatesMode: {
      enum: ['legal', 'trusted'],
    },
    pencilMarks: { $ref: '#/$defs/candidateLists' },
  },
  $defs: {
    candidateLists: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['cell', 'digits'],
        properties: {
          cell: {
            type: 'integer',
            minimum: 0,
            maximum: 80,
          },
          digits: {
            type: 'array',
            minItems: 1,
            maxItems: 9,
            uniqueItems: true,
            items: {
              type: 'integer',
              minimum: 1,
              maximum: 9,
            },
          },
        },
      },
    },
  },
};

export const PUZZLE_STATE_SCHEMA: JsonSchema = {
  $id: 'https://github.com/RichardCao/classic9-sudoku/schema/puzzle-state.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: '数独题目状态',
  type: 'object',
  additionalProperties: false,
  required: ['board'],
  properties: {
    board: BOARD_SCHEMA,
    candidateMasks: {
      type: 'array',
      minItems: 81,
      maxItems: 81,
      items: {
        type: 'integer',
        minimum: 0,
        maximum: 511,
      },
    },
    givens: {
      type: 'array',
      uniqueItems: true,
      items: {
        type: 'integer',
        minimum: 0,
        maximum: 80,
      },
    },
    constraints: CANDIDATE_CONSTRAINTS_SCHEMA,
    assumptions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['cell', 'digit'],
        properties: {
          cell: {
            type: 'integer',
            minimum: 0,
            maximum: 80,
          },
          digit: {
            type: 'integer',
            minimum: 1,
            maximum: 9,
          },
          reason: {
            type: 'string',
          },
        },
      },
    },
    metadata: {
      type: 'object',
    },
  },
};

export const SOLVE_STEP_SCHEMA: JsonSchema = {
  $id: 'https://github.com/RichardCao/classic9-sudoku/schema/solve-step.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: '结构化解题步骤',
  type: 'object',
  additionalProperties: false,
  required: ['technique', 'actions', 'evidence', 'score'],
  properties: {
    technique: TECHNIQUE_ID_SCHEMA,
    score: {
      type: 'number',
    },
    actions: {
      type: 'array',
      minItems: 1,
      items: {
        oneOf: [
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'cell', 'digit'],
            properties: {
              type: { const: 'place' },
              cell: { type: 'integer', minimum: 0, maximum: 80 },
              digit: { type: 'integer', minimum: 1, maximum: 9 },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'cell', 'digit'],
            properties: {
              type: { const: 'eliminate' },
              cell: { type: 'integer', minimum: 0, maximum: 80 },
              digit: { type: 'integer', minimum: 1, maximum: 9 },
            },
          },
        ],
      },
    },
    evidence: {
      type: 'object',
      additionalProperties: true,
      properties: {
        houses: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'index'],
            properties: {
              type: {
                enum: ['row', 'col', 'box'],
              },
              index: {
                type: 'integer',
                minimum: 0,
                maximum: 8,
              },
            },
          },
        },
        cells: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['cell', 'role'],
            properties: {
              cell: { type: 'integer', minimum: 0, maximum: 80 },
              digit: { type: 'integer', minimum: 1, maximum: 9 },
              role: {
                enum: ['target', 'reason', 'link', 'pivot'],
              },
            },
          },
        },
        links: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['from', 'to', 'type'],
            properties: {
              from: { type: 'integer', minimum: 0, maximum: 80 },
              to: { type: 'integer', minimum: 0, maximum: 80 },
              digit: { type: 'integer', minimum: 1, maximum: 9 },
              type: { enum: ['strong', 'weak'] },
              house: {
                type: 'object',
                additionalProperties: false,
                required: ['type', 'index'],
                properties: {
                  type: {
                    enum: ['row', 'col', 'box'],
                  },
                  index: {
                    type: 'integer',
                    minimum: 0,
                    maximum: 8,
                  },
                },
              },
            },
          },
        },
        branches: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['assumption', 'contradiction', 'exhausted'],
            properties: {
              assumption: {
                type: 'object',
                additionalProperties: false,
                required: ['type', 'cell', 'digit'],
                properties: {
                  type: {
                    enum: ['place', 'eliminate'],
                  },
                  cell: { type: 'integer', minimum: 0, maximum: 80 },
                  digit: { type: 'integer', minimum: 1, maximum: 9 },
                },
              },
              contradiction: {
                type: 'boolean',
              },
              exhausted: {
                type: 'boolean',
              },
              contradictionAt: {
                type: 'object',
                additionalProperties: false,
                required: ['kind'],
                properties: {
                  kind: {
                    enum: ['cell-empty', 'house-duplicate', 'house-missing'],
                  },
                  cell: { type: 'integer', minimum: 0, maximum: 80 },
                  digit: { type: 'integer', minimum: 1, maximum: 9 },
                  house: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['type', 'index'],
                    properties: {
                      type: {
                        enum: ['row', 'col', 'box'],
                      },
                      index: {
                        type: 'integer',
                        minimum: 0,
                        maximum: 8,
                      },
                    },
                  },
                },
              },
              actions: {
                type: 'array',
                items: {
                  oneOf: [
                    {
                      type: 'object',
                      additionalProperties: false,
                      required: ['type', 'cell', 'digit'],
                      properties: {
                        type: { const: 'place' },
                        cell: { type: 'integer', minimum: 0, maximum: 80 },
                        digit: { type: 'integer', minimum: 1, maximum: 9 },
                      },
                    },
                    {
                      type: 'object',
                      additionalProperties: false,
                      required: ['type', 'cell', 'digit'],
                      properties: {
                        type: { const: 'eliminate' },
                        cell: { type: 'integer', minimum: 0, maximum: 80 },
                        digit: { type: 'integer', minimum: 1, maximum: 9 },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
        note: {
          type: 'string',
        },
      },
    },
  },
};

export const TECHNIQUE_DEFINITION_SCHEMA: JsonSchema = {
  $id: 'https://github.com/RichardCao/classic9-sudoku/schema/technique-definition.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: '技巧定义',
  type: 'object',
  additionalProperties: false,
  required: ['id', 'nameZh', 'nameEn', 'family', 'defaultScore', 'stability'],
  properties: {
    id: TECHNIQUE_ID_SCHEMA,
    nameZh: {
      type: 'string',
    },
    nameEn: {
      type: 'string',
    },
    family: {
      type: 'string',
    },
    defaultScore: {
      type: 'number',
    },
    stability: {
      enum: ['stable', 'experimental'],
    },
  },
};

export const TECHNIQUE_LIST_SCHEMA: JsonSchema = {
  $id: 'https://github.com/RichardCao/classic9-sudoku/schema/technique-list.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: '技巧定义列表',
  type: 'array',
  $comment: 'JSON Schema uniqueItems 只能检查完整 object 是否重复；技巧 id 唯一性由内置 getTechniqueDefinitions() 与运行时测试保证。',
  items: TECHNIQUE_DEFINITION_SCHEMA,
};

export const CANONICAL_TRANSFORM_SCHEMA: JsonSchema = {
  $id: 'https://github.com/RichardCao/classic9-sudoku/schema/canonical-transform.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'canonical 变换描述',
  type: 'object',
  additionalProperties: false,
  required: ['transposed', 'rowOrder', 'colOrder', 'digitMap'],
  properties: {
    transposed: {
      type: 'boolean',
    },
    rowOrder: {
      type: 'array',
      minItems: 9,
      maxItems: 9,
      uniqueItems: true,
      items: {
        type: 'integer',
        minimum: 0,
        maximum: 8,
      },
    },
    colOrder: {
      type: 'array',
      minItems: 9,
      maxItems: 9,
      uniqueItems: true,
      items: {
        type: 'integer',
        minimum: 0,
        maximum: 8,
      },
    },
    digitMap: {
      type: 'array',
      minItems: 10,
      maxItems: 10,
      uniqueItems: true,
      prefixItems: [
        { const: 0 },
      ],
      items: {
        type: 'integer',
        minimum: 1,
        maximum: 9,
      },
    },
  },
};

export const CANONICAL_RESULT_SCHEMA: JsonSchema = {
  $id: 'https://github.com/RichardCao/classic9-sudoku/schema/canonical-result.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'canonical 结果',
  type: 'object',
  additionalProperties: false,
  required: ['algorithm', 'version', 'key', 'board', 'transform'],
  properties: {
    algorithm: {
      const: 'canonical.classic9',
    },
    version: {
      const: '1',
    },
    key: CANONICAL_KEY_SCHEMA,
    board: BOARD_SCHEMA,
    transform: CANONICAL_TRANSFORM_SCHEMA,
  },
};

export const CANONICAL_PAIR_RESULT_SCHEMA: JsonSchema = {
  $id: 'https://github.com/RichardCao/classic9-sudoku/schema/canonical-pair-result.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: '题面与答案同步 canonical 结果',
  type: 'object',
  additionalProperties: false,
  required: ['algorithm', 'version', 'key', 'board', 'transform', 'solution'],
  properties: {
    algorithm: {
      const: 'canonical.classic9',
    },
    version: {
      const: '1',
    },
    key: CANONICAL_KEY_SCHEMA,
    board: BOARD_SCHEMA,
    solution: SOLUTION_BOARD_SCHEMA,
    transform: CANONICAL_TRANSFORM_SCHEMA,
  },
};

export const RATING_RESULT_SCHEMA: JsonSchema = {
  $id: 'https://github.com/RichardCao/classic9-sudoku/schema/rating-result.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: '评分结果',
  type: 'object',
  additionalProperties: true,
  required: [
    'solved',
    'score',
    'grade',
    'hardestTechnique',
    'hardestScore',
    'techniqueCounts',
    'steps',
    'ratingPolicyId',
    'ratingPolicyVersion',
  ],
  properties: {
    solved: { type: 'boolean' },
    score: { type: 'number' },
    grade: { type: ['string', 'null'] },
    hardestTechnique: {
      anyOf: [
        TECHNIQUE_ID_SCHEMA,
        { type: 'null' },
      ],
    },
    hardestScore: { type: 'number' },
    techniqueCounts: {
      ...TECHNIQUE_COUNT_RECORD_SCHEMA,
    },
    steps: {
      type: 'array',
      items: SOLVE_STEP_SCHEMA,
    },
    stuckReason: {
      enum: ['contradiction', 'no-technique-match', 'step-limit'],
    },
    ratingPolicyId: { type: 'string' },
    ratingPolicyVersion: { type: 'string' },
  },
};

const SEARCH_ONLY_REQUEST_PROPERTIES: Record<string, unknown> = {
  maxResults: {
    type: 'integer',
    minimum: 1,
    description: 'search-only 字段；generateOne 会忽略。',
  },
  scoreBucketSize: {
    type: 'integer',
    minimum: 1,
    description: 'search-only 字段；generateOne 会忽略。',
  },
};

const GENERATION_REQUEST_PROPERTIES: Record<string, unknown> = {
  seed: { type: 'integer', minimum: 1, maximum: MAX_SEED },
  ratingPolicy: RATING_POLICY_SCHEMA,
  canonicalize: { type: 'boolean' },
  minimality: {
    enum: ['none', 'strict'],
  },
  relaxation: {
    type: 'object',
    additionalProperties: false,
    required: ['enabled'],
    properties: {
      enabled: { type: 'boolean' },
      maxRounds: { type: 'integer', minimum: 0 },
      scoreExpansionPerRound: { type: 'number', minimum: 0 },
      clueExpansionPerRound: { type: 'integer', minimum: 0, maximum: 81 },
      attemptMultiplierPerRound: { type: 'number', minimum: 1 },
    },
  },
  constraints: {
    type: 'object',
    additionalProperties: false,
    properties: {
      score: {
        type: 'object',
        additionalProperties: false,
        properties: {
          min: { type: 'number' },
          max: { type: 'number' },
          target: { type: 'number' },
          tolerance: { type: 'number', minimum: 0 },
        },
      },
      clues: {
        type: 'object',
        additionalProperties: false,
        properties: {
          min: { type: 'integer', minimum: 0, maximum: 81 },
          max: { type: 'integer', minimum: 17, maximum: 81 },
          target: { type: 'integer', minimum: 17, maximum: 81 },
        },
      },
      allowedTechniques: {
        type: 'array',
        minItems: 1,
        items: TECHNIQUE_ID_SCHEMA,
      },
      forbiddenTechniques: {
        type: 'array',
        items: TECHNIQUE_ID_SCHEMA,
      },
      requiredTechniques: {
        type: 'array',
        items: {
          oneOf: [
            {
              type: 'object',
              additionalProperties: false,
              required: ['type', 'techniques'],
              properties: {
                type: { const: 'appears' },
                techniques: {
                  type: 'array',
                  minItems: 1,
                  items: TECHNIQUE_ID_SCHEMA,
                },
                minCount: { type: 'integer', minimum: 1 },
              },
            },
            {
              type: 'object',
              additionalProperties: false,
              required: ['type', 'techniques'],
              properties: {
                type: { const: 'hardest-in' },
                techniques: {
                  type: 'array',
                  minItems: 1,
                  items: TECHNIQUE_ID_SCHEMA,
                },
              },
            },
            {
              type: 'object',
              additionalProperties: false,
              required: ['type', 'families'],
              properties: {
                type: { const: 'family-coverage' },
                families: {
                  type: 'array',
                  minItems: 1,
                  items: { type: 'string' },
                },
              },
            },
          ],
        },
      },
      preferredTechniques: {
        type: 'array',
        items: TECHNIQUE_ID_SCHEMA,
      },
      symmetry: {
        enum: ['none', 'central'],
      },
      uniqueness: {
        enum: ['required'],
      },
    },
  },
  budget: {
    type: 'object',
    additionalProperties: false,
    properties: {
      maxAttempts: { type: 'integer', minimum: 1 },
      maxElapsedMs: { type: 'integer', minimum: 1 },
    },
  },
  ...SEARCH_ONLY_REQUEST_PROPERTIES,
};

export const GENERATION_REQUEST_SCHEMA: JsonSchema = {
  $id: 'https://github.com/RichardCao/classic9-sudoku/schema/generation-request.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: '生成请求',
  type: 'object',
  additionalProperties: false,
  properties: GENERATION_REQUEST_PROPERTIES,
};

export const GENERATION_RESULT_SCHEMA: JsonSchema = {
  $id: 'https://github.com/RichardCao/classic9-sudoku/schema/generation-result.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: '生成结果',
  type: 'object',
  additionalProperties: true,
  required: ['status', 'requestAnalysis', 'diagnostics'],
  properties: {
    status: {
      enum: ['success', 'invalid-request', 'timeout', 'attempt-limit', 'no-match'],
    },
    puzzle: {
      type: 'object',
      additionalProperties: true,
      required: ['puzzle', 'solution', 'seed', 'solved', 'clueCount', 'score', 'grade', 'hardestTechnique', 'techniqueCounts'],
      properties: {
        puzzle: BOARD_SCHEMA,
        solution: SOLUTION_BOARD_SCHEMA,
        seed: { type: 'integer', minimum: 1, maximum: MAX_SEED },
        solved: { type: 'boolean' },
        stuckReason: { enum: ['contradiction', 'no-technique-match', 'step-limit'] },
        clueCount: { type: 'integer', minimum: 0, maximum: 81 },
        score: { type: 'number' },
        grade: { type: ['string', 'null'] },
        hardestTechnique: {
          anyOf: [
            TECHNIQUE_ID_SCHEMA,
            { type: 'null' },
          ],
        },
        techniqueCounts: {
          ...TECHNIQUE_COUNT_RECORD_SCHEMA,
        },
        canonicalKey: CANONICAL_KEY_SCHEMA,
      },
    },
    bestCandidate: {
      type: 'object',
      additionalProperties: true,
      required: ['puzzle', 'solution', 'seed', 'solved', 'clueCount', 'score', 'grade', 'hardestTechnique', 'techniqueCounts'],
      properties: {
        puzzle: BOARD_SCHEMA,
        solution: SOLUTION_BOARD_SCHEMA,
        seed: { type: 'integer', minimum: 1, maximum: MAX_SEED },
        solved: { type: 'boolean' },
        stuckReason: { enum: ['contradiction', 'no-technique-match', 'step-limit'] },
        clueCount: { type: 'integer', minimum: 0, maximum: 81 },
        score: { type: 'number' },
        grade: { type: ['string', 'null'] },
        hardestTechnique: {
          anyOf: [
            TECHNIQUE_ID_SCHEMA,
            { type: 'null' },
          ],
        },
        techniqueCounts: {
          ...TECHNIQUE_COUNT_RECORD_SCHEMA,
        },
        canonicalKey: CANONICAL_KEY_SCHEMA,
      },
    },
    requestAnalysis: {
      type: 'object',
    },
    diagnostics: {
      type: 'object',
    },
    relaxationsApplied: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        required: ['round', 'type', 'message', 'before', 'after'],
        properties: {
          round: { type: 'integer', minimum: 1 },
          type: {
            enum: ['score-range-expanded', 'clue-range-expanded', 'attempt-budget-increased'],
          },
          message: { type: 'string' },
          before: { type: 'object' },
          after: { type: 'object' },
        },
      },
    },
  },
};

export const GENERATED_PUZZLE_SCHEMA: JsonSchema = {
  $id: 'https://github.com/RichardCao/classic9-sudoku/schema/generated-puzzle.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: '生成题目',
  type: 'object',
  additionalProperties: true,
  required: ['puzzle', 'solution', 'seed', 'solved', 'clueCount', 'score', 'grade', 'hardestTechnique', 'techniqueCounts'],
  properties: {
    puzzle: BOARD_SCHEMA,
    solution: SOLUTION_BOARD_SCHEMA,
    seed: { type: 'integer', minimum: 1, maximum: MAX_SEED },
    solved: { type: 'boolean' },
    stuckReason: { enum: ['contradiction', 'no-technique-match', 'step-limit'] },
    clueCount: { type: 'integer', minimum: 0, maximum: 81 },
    score: { type: 'number' },
    grade: { type: ['string', 'null'] },
    hardestTechnique: {
      anyOf: [
        TECHNIQUE_ID_SCHEMA,
        { type: 'null' },
      ],
    },
    techniqueCounts: {
      ...TECHNIQUE_COUNT_RECORD_SCHEMA,
    },
    canonicalKey: {
      ...CANONICAL_KEY_SCHEMA,
    },
  },
};

export const SEARCH_REQUEST_SCHEMA: JsonSchema = {
  $id: 'https://github.com/RichardCao/classic9-sudoku/schema/search-request.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: '批量搜索请求',
  type: 'object',
  additionalProperties: false,
  properties: {
    ...GENERATION_REQUEST_PROPERTIES,
  },
};

export const SEARCH_SUMMARY_SCHEMA: JsonSchema = {
  $id: 'https://github.com/RichardCao/classic9-sudoku/schema/search-summary.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: '批量搜索汇总',
  type: 'object',
  additionalProperties: false,
  required: ['accepted', 'rejected', 'rejectedByReason', 'scoreBuckets', 'techniqueHits', 'bestScore', 'worstScore'],
  properties: {
    accepted: {
      type: 'integer',
      minimum: 0,
    },
    rejected: {
      type: 'integer',
      minimum: 0,
    },
    rejectedByReason: {
      ...COUNT_RECORD_SCHEMA,
    },
    scoreBuckets: {
      ...COUNT_RECORD_SCHEMA,
    },
    techniqueHits: {
      ...TECHNIQUE_COUNT_RECORD_SCHEMA,
    },
    bestScore: {
      type: ['number', 'null'],
    },
    worstScore: {
      type: ['number', 'null'],
    },
  },
};

export const SEARCH_EVENT_SCHEMA: JsonSchema = {
  $id: 'https://github.com/RichardCao/classic9-sudoku/schema/search-event.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: '批量搜索事件',
  oneOf: [
    {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'index', 'result', 'puzzle'],
      properties: {
        type: { const: 'accepted' },
        index: { type: 'integer', minimum: 0 },
        result: GENERATION_RESULT_SCHEMA,
        puzzle: GENERATED_PUZZLE_SCHEMA,
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'index', 'result', 'reason'],
      properties: {
        type: { const: 'rejected' },
        index: { type: 'integer', minimum: 0 },
        result: GENERATION_RESULT_SCHEMA,
        reason: { type: 'string' },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'accepted', 'rejected', 'summary'],
      properties: {
        type: { const: 'done' },
        accepted: { type: 'integer', minimum: 0 },
        rejected: { type: 'integer', minimum: 0 },
        summary: SEARCH_SUMMARY_SCHEMA,
      },
    },
  ],
};

export const CANDIDATE_SELECTION_PLAN_SCHEMA: JsonSchema = {
  $id: 'https://github.com/RichardCao/classic9-sudoku/schema/candidate-selection-plan.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: '候选池选择计划',
  type: 'object',
  additionalProperties: false,
  required: ['maxResults'],
  properties: {
    maxResults: {
      type: 'integer',
      minimum: 1,
    },
    dedupeCanonical: {
      type: 'boolean',
    },
    preferredTechniques: {
      type: 'array',
      items: TECHNIQUE_ID_SCHEMA,
    },
    scoreBuckets: {
      type: 'array',
      $comment: 'min <= max 和 bucket 不重叠是跨项动态规则，请通过 selectFromCandidates() 做运行时校验。',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['min', 'max'],
        properties: {
          min: {
            type: 'number',
          },
          max: {
            type: 'number',
          },
          limit: {
            type: 'integer',
            minimum: 1,
          },
        },
      },
    },
  },
};

export const CANDIDATE_SELECTION_RESULT_SCHEMA: JsonSchema = {
  $id: 'https://github.com/RichardCao/classic9-sudoku/schema/candidate-selection-result.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: '候选池选择结果',
  type: 'object',
  additionalProperties: false,
  required: ['selected', 'rejected', 'diagnostics'],
  properties: {
    selected: {
      type: 'array',
      items: GENERATED_PUZZLE_SCHEMA,
    },
    rejected: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['puzzle', 'reason'],
        properties: {
          puzzle: GENERATED_PUZZLE_SCHEMA,
          reason: {
            type: 'string',
          },
        },
      },
    },
    diagnostics: {
      type: 'object',
      additionalProperties: false,
      required: ['selected', 'rejected', 'rejectedByReason', 'scoreBucketCounts', 'preferredTechniqueHits'],
      properties: {
        selected: {
          type: 'integer',
          minimum: 0,
        },
        rejected: {
          type: 'integer',
          minimum: 0,
        },
        rejectedByReason: {
          ...COUNT_RECORD_SCHEMA,
        },
        scoreBucketCounts: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['min', 'max', 'selected'],
            properties: {
              min: { type: 'number' },
              max: { type: 'number' },
              limit: {
                type: 'integer',
                minimum: 1,
              },
              selected: {
                type: 'integer',
                minimum: 0,
              },
            },
          },
        },
        preferredTechniqueHits: {
          ...COUNT_RECORD_SCHEMA,
        },
      },
    },
  },
};

export const CANDIDATE_POOL_STATS_SCHEMA: JsonSchema = {
  $id: 'https://github.com/RichardCao/classic9-sudoku/schema/candidate-pool-stats.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: '候选池统计结果',
  type: 'object',
  additionalProperties: false,
  required: ['total', 'score', 'clues', 'gradeCounts', 'hardestTechniqueCounts', 'techniqueHits', 'canonical', 'seeds'],
  properties: {
    total: { type: 'integer', minimum: 0 },
    score: {
      type: 'object',
      additionalProperties: false,
      required: ['min', 'max', 'average', 'buckets'],
      properties: {
        min: { type: ['number', 'null'] },
        max: { type: ['number', 'null'] },
        average: { type: ['number', 'null'] },
        buckets: {
          ...COUNT_RECORD_SCHEMA,
        },
      },
    },
    clues: {
      type: 'object',
      additionalProperties: false,
      required: ['min', 'max', 'average', 'buckets'],
      properties: {
        min: { type: ['number', 'null'] },
        max: { type: ['number', 'null'] },
        average: { type: ['number', 'null'] },
        buckets: {
          ...COUNT_RECORD_SCHEMA,
        },
      },
    },
    gradeCounts: {
      ...COUNT_RECORD_SCHEMA,
    },
    hardestTechniqueCounts: {
      ...COUNT_RECORD_SCHEMA,
    },
    techniqueHits: {
      ...COUNT_RECORD_SCHEMA,
    },
    canonical: {
      type: 'object',
      additionalProperties: false,
      required: ['withKey', 'withoutKey', 'uniqueKeys', 'duplicateKeys'],
      properties: {
        withKey: { type: 'integer', minimum: 0 },
        withoutKey: { type: 'integer', minimum: 0 },
        uniqueKeys: { type: 'integer', minimum: 0 },
        duplicateKeys: { type: 'integer', minimum: 0 },
      },
    },
    seeds: {
      type: 'object',
      additionalProperties: false,
      required: ['min', 'max', 'duplicates'],
      properties: {
        min: { type: ['integer', 'null'] },
        max: { type: ['integer', 'null'] },
        duplicates: { type: 'integer', minimum: 0 },
      },
    },
  },
};

export const CANDIDATE_DEDUPE_RESULT_SCHEMA: JsonSchema = {
  $id: 'https://github.com/RichardCao/classic9-sudoku/schema/candidate-dedupe-result.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: '候选池去重结果',
  type: 'object',
  additionalProperties: false,
  required: ['candidates', 'rejected', 'diagnostics'],
  properties: {
    candidates: {
      type: 'array',
      items: GENERATED_PUZZLE_SCHEMA,
    },
    rejected: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['puzzle', 'reason', 'key'],
        properties: {
          puzzle: GENERATED_PUZZLE_SCHEMA,
          reason: {
            enum: ['canonical-duplicate', 'puzzle-duplicate'],
          },
          key: {
            type: 'string',
          },
        },
      },
    },
    diagnostics: {
      type: 'object',
      additionalProperties: false,
      required: ['input', 'kept', 'removed', 'key'],
      properties: {
        input: { type: 'integer', minimum: 0 },
        kept: { type: 'integer', minimum: 0 },
        removed: { type: 'integer', minimum: 0 },
        key: { enum: ['canonical', 'puzzle'] },
      },
    },
  },
};

export const SEARCH_MANIFEST_SUMMARY_SCHEMA: JsonSchema = {
  $id: 'https://github.com/RichardCao/classic9-sudoku/schema/search-manifest-summary.schema.json',
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: '搜索 manifest 汇总',
  type: 'object',
  additionalProperties: false,
  required: [
    'manifests',
    'requestHashes',
    'runs',
    'accepted',
    'rejected',
    'attempts',
    'seedRanges',
    'overlaps',
    'gaps',
    'rejectedByReason',
    'scoreBuckets',
    'techniqueHits',
    'bestScore',
    'worstScore',
  ],
  properties: {
    manifests: { type: 'integer', minimum: 0 },
    requestHashes: {
      ...COUNT_RECORD_SCHEMA,
    },
    runs: { type: 'integer', minimum: 0 },
    accepted: { type: 'integer', minimum: 0 },
    rejected: { type: 'integer', minimum: 0 },
    attempts: { type: 'integer', minimum: 0 },
    seedRanges: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['seedStart', 'seedEndExclusive', 'attempts'],
        properties: {
          seedStart: { type: 'integer' },
          seedEndExclusive: { type: 'integer' },
          attempts: { type: 'integer', minimum: 0 },
        },
      },
    },
    overlaps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['left', 'right'],
        properties: {
          left: {
            type: 'object',
            additionalProperties: false,
            required: ['seedStart', 'seedEndExclusive'],
            properties: {
              seedStart: { type: 'integer' },
              seedEndExclusive: { type: 'integer' },
            },
          },
          right: {
            type: 'object',
            additionalProperties: false,
            required: ['seedStart', 'seedEndExclusive'],
            properties: {
              seedStart: { type: 'integer' },
              seedEndExclusive: { type: 'integer' },
            },
          },
        },
      },
    },
    gaps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['seedStart', 'seedEndExclusive'],
        properties: {
          seedStart: { type: 'integer' },
          seedEndExclusive: { type: 'integer' },
        },
      },
    },
    rejectedByReason: {
      ...COUNT_RECORD_SCHEMA,
    },
    scoreBuckets: {
      ...COUNT_RECORD_SCHEMA,
    },
    techniqueHits: {
      ...COUNT_RECORD_SCHEMA,
    },
    bestScore: { type: ['number', 'null'] },
    worstScore: { type: ['number', 'null'] },
  },
};

export function getJsonSchemas(): Record<string, JsonSchema> {
  return {
    board: cloneJsonSchema(BOARD_SCHEMA),
    candidateConstraints: cloneJsonSchema(CANDIDATE_CONSTRAINTS_SCHEMA),
    puzzleState: cloneJsonSchema(PUZZLE_STATE_SCHEMA),
    solveStep: cloneJsonSchema(SOLVE_STEP_SCHEMA),
    techniqueDefinition: cloneJsonSchema(TECHNIQUE_DEFINITION_SCHEMA),
    techniqueList: cloneJsonSchema(TECHNIQUE_LIST_SCHEMA),
    canonicalTransform: cloneJsonSchema(CANONICAL_TRANSFORM_SCHEMA),
    canonicalResult: cloneJsonSchema(CANONICAL_RESULT_SCHEMA),
    canonicalPairResult: cloneJsonSchema(CANONICAL_PAIR_RESULT_SCHEMA),
    ratingPolicy: cloneJsonSchema(RATING_POLICY_SCHEMA),
    ratingResult: cloneJsonSchema(RATING_RESULT_SCHEMA),
    generationRequest: cloneJsonSchema(GENERATION_REQUEST_SCHEMA),
    generationResult: cloneJsonSchema(GENERATION_RESULT_SCHEMA),
    generatedPuzzle: cloneJsonSchema(GENERATED_PUZZLE_SCHEMA),
    searchRequest: cloneJsonSchema(SEARCH_REQUEST_SCHEMA),
    searchSummary: cloneJsonSchema(SEARCH_SUMMARY_SCHEMA),
    searchEvent: cloneJsonSchema(SEARCH_EVENT_SCHEMA),
    candidateSelectionPlan: cloneJsonSchema(CANDIDATE_SELECTION_PLAN_SCHEMA),
    candidateSelectionResult: cloneJsonSchema(CANDIDATE_SELECTION_RESULT_SCHEMA),
    candidatePoolStats: cloneJsonSchema(CANDIDATE_POOL_STATS_SCHEMA),
    candidateDedupeResult: cloneJsonSchema(CANDIDATE_DEDUPE_RESULT_SCHEMA),
    searchManifestSummary: cloneJsonSchema(SEARCH_MANIFEST_SUMMARY_SCHEMA),
  };
}

function cloneJsonSchema(schema: JsonSchema): JsonSchema {
  return JSON.parse(JSON.stringify(schema)) as JsonSchema;
}

function deepFreezeJson(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreezeJson(child);
  }
  return Object.freeze(value);
}

for (const schema of [
  BOARD_SCHEMA,
  CANDIDATE_CONSTRAINTS_SCHEMA,
  PUZZLE_STATE_SCHEMA,
  SOLVE_STEP_SCHEMA,
  TECHNIQUE_DEFINITION_SCHEMA,
  TECHNIQUE_LIST_SCHEMA,
  CANONICAL_TRANSFORM_SCHEMA,
  CANONICAL_RESULT_SCHEMA,
  CANONICAL_PAIR_RESULT_SCHEMA,
  RATING_POLICY_SCHEMA,
  RATING_RESULT_SCHEMA,
  GENERATION_REQUEST_SCHEMA,
  GENERATION_RESULT_SCHEMA,
  GENERATED_PUZZLE_SCHEMA,
  SEARCH_REQUEST_SCHEMA,
  SEARCH_SUMMARY_SCHEMA,
  SEARCH_EVENT_SCHEMA,
  CANDIDATE_SELECTION_PLAN_SCHEMA,
  CANDIDATE_SELECTION_RESULT_SCHEMA,
  CANDIDATE_POOL_STATS_SCHEMA,
  CANDIDATE_DEDUPE_RESULT_SCHEMA,
  SEARCH_MANIFEST_SUMMARY_SCHEMA,
]) {
  deepFreezeJson(schema);
}
