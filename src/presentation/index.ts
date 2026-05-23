import type { SolveStep, TechniqueDefinition, TechniqueId } from '../solver/types.js';
import { getTechniqueDefinitions } from '../solver/techniques.js';

export interface FormatStepOptions {
  locale?: 'zh-CN' | 'en-US';
  style?: 'short' | 'teaching';
  stepNumber?: number;
}

const techniqueById = new Map<TechniqueId, TechniqueDefinition>(
  getTechniqueDefinitions().map((definition) => [definition.id, definition]),
);

export function formatStep(step: SolveStep, options: FormatStepOptions = {}): string {
  const locale = options.locale ?? 'en-US';
  const style = options.style ?? 'short';
  const stepNumber = typeof options.stepNumber === 'number' ? options.stepNumber : null;
  const definition = techniqueById.get(step.technique);
  const techniqueName = locale === 'zh-CN'
    ? (definition?.nameZh ?? step.technique)
    : (definition?.nameEn ?? step.technique);

  const prefix = stepNumber === null
    ? techniqueName
    : locale === 'zh-CN'
      ? `第 ${stepNumber} 步 ${techniqueName}`
      : `Step ${stepNumber} ${techniqueName}`;

  const actionText = formatActions(step, locale);
  const reasonText = formatReason(step, locale, style);

  const colon = locale === 'zh-CN' ? '：' : ': ';
  const actionSentence = appendSentence(`${prefix}${colon}${actionText}`, locale);
  if (reasonText) {
    return locale === 'zh-CN'
      ? `${actionSentence}${appendSentence(reasonText, locale)}`
      : `${actionSentence} ${appendSentence(reasonText, locale)}`;
  }
  return actionSentence;
}

function formatActions(step: SolveStep, locale: 'zh-CN' | 'en-US'): string {
  const parts = step.actions.map((action) => formatAction(action, locale));
  return parts.join(locale === 'zh-CN' ? '，' : ', ');
}

function formatAction(action: SolveStep['actions'][number], locale: 'zh-CN' | 'en-US'): string {
  const rawAction = action as { type?: unknown; cell?: unknown; digit?: unknown };
  const cell = typeof rawAction.cell === 'number' ? formatCell(rawAction.cell) : String(rawAction.cell);
  switch (rawAction.type) {
    case 'place':
      return locale === 'zh-CN'
        ? `${cell} 填 ${rawAction.digit}`
        : `${cell} = ${rawAction.digit}`;
    case 'eliminate':
      return locale === 'zh-CN'
        ? `${cell} 删除候选 ${rawAction.digit}`
        : `remove ${rawAction.digit} from ${cell}`;
    default:
      return locale === 'zh-CN'
        ? `[无效动作：${String(rawAction.type)}]`
        : `[invalid action: ${String(rawAction.type)}]`;
  }
}

function formatReason(
  step: SolveStep,
  locale: 'zh-CN' | 'en-US',
  style: 'short' | 'teaching',
): string {
  const cells = step.evidence.cells ?? [];
  const houses = step.evidence.houses ?? [];
  const reasonCells = cells.filter((cell) => cell.role === 'reason').map((cell) => formatCell(cell.cell));
  const targetCells = cells.filter((cell) => cell.role === 'target').map((cell) => formatCell(cell.cell));
  const houseLabels = houses.map((house) => formatHouse(house.type, house.index, locale));
  const templateReason = formatTechniqueReason(step, locale, {
    reasonCells,
    targetCells,
    houseLabels,
  });

  if (style === 'short') {
    if (templateReason) {
      return locale === 'zh-CN' ? `依据：${templateReason}` : `Reason: ${templateReason}`;
    }
    if (step.evidence.note) {
      return locale === 'zh-CN' ? '依据：见结构化证据' : `Reason: ${step.evidence.note}`;
    }
    return '';
  }

  const fragments: string[] = [];
  if (templateReason) {
    fragments.push(locale === 'zh-CN' ? `说明：${templateReason}` : `Explanation: ${templateReason}`);
  }
  if (houseLabels.length > 0) {
    fragments.push(
      locale === 'zh-CN'
        ? `相关区域：${houseLabels.join('、')}`
        : `Related houses: ${houseLabels.join(', ')}`,
    );
  }
  if (reasonCells.length > 0) {
    fragments.push(
      locale === 'zh-CN'
        ? `依据格：${reasonCells.join('、')}`
        : `Reason cells: ${reasonCells.join(', ')}`,
    );
  }
  const branchSummary = formatBranchSummary(step, locale);
  if (branchSummary) {
    fragments.push(branchSummary);
  }
  if (!templateReason && step.evidence.note) {
    fragments.push(locale === 'zh-CN' ? '备注：见结构化证据。' : `Note: ${step.evidence.note}`);
  }
  return fragments.join(locale === 'zh-CN' ? '；' : '. ');
}

function formatBranchSummary(step: SolveStep, locale: 'zh-CN' | 'en-US'): string {
  const branches = step.evidence.branches ?? [];
  if (branches.length === 0) {
    return '';
  }
  const contradictionCount = branches.filter((branch) => branch.contradiction).length;
  const branchItems = branches.slice(0, 4).map((branch) => {
    const status = branch.contradiction
      ? (locale === 'zh-CN' ? '矛盾' : 'contradiction')
      : branch.exhausted
        ? (locale === 'zh-CN' ? '穷尽' : 'exhausted')
        : (locale === 'zh-CN' ? '达到预算上限' : 'budget limit');
    const actionCount = branch.actions?.length ?? 0;
    const contradictionAt = formatBranchContradiction(branch, locale);
    if (locale === 'zh-CN') {
      return `${formatAction(branch.assumption, locale)} -> ${status}${contradictionAt ? `（${contradictionAt}）` : ''}${actionCount > 0 ? `，摘要 ${actionCount} 步` : ''}`;
    }
    return `${formatAction(branch.assumption, locale)} -> ${status}${contradictionAt ? ` (${contradictionAt})` : ''}${actionCount > 0 ? `, ${actionCount} summarized actions` : ''}`;
  });
  const suffix = branches.length > branchItems.length
    ? (locale === 'zh-CN' ? `等 ${branches.length} 条` : `and ${branches.length - branchItems.length} more`)
    : '';
  if (locale === 'zh-CN') {
    return `分支：共 ${branches.length} 条，${contradictionCount} 条导向矛盾；${[...branchItems, suffix].filter(Boolean).join('；')}`;
  }
  return `Branches: ${branches.length} total, ${contradictionCount} contradictions; ${[...branchItems, suffix].filter(Boolean).join('; ')}`;
}

function formatBranchContradiction(
  branch: NonNullable<SolveStep['evidence']['branches']>[number],
  locale: 'zh-CN' | 'en-US',
): string {
  const contradictionAt = branch.contradictionAt;
  if (!contradictionAt) {
    return '';
  }
  if (locale === 'zh-CN') {
    if (contradictionAt.kind === 'cell-empty' && contradictionAt.cell !== undefined) {
      return `${formatCell(contradictionAt.cell)} 候选耗尽`;
    }
    if (contradictionAt.house && contradictionAt.digit !== undefined) {
      const house = formatHouse(contradictionAt.house.type, contradictionAt.house.index, locale);
      if (contradictionAt.kind === 'house-duplicate') {
        return `${house} 中数字 ${contradictionAt.digit} 重复`;
      }
      return `${house} 中数字 ${contradictionAt.digit} 无处可放`;
    }
    return '出现矛盾';
  }
  if (contradictionAt.kind === 'cell-empty' && contradictionAt.cell !== undefined) {
    return `${formatCell(contradictionAt.cell)} has no candidates`;
  }
  if (contradictionAt.house && contradictionAt.digit !== undefined) {
    const house = formatHouse(contradictionAt.house.type, contradictionAt.house.index, locale);
    if (contradictionAt.kind === 'house-duplicate') {
      return `digit ${contradictionAt.digit} repeats in ${house}`;
    }
    return `digit ${contradictionAt.digit} has no position in ${house}`;
  }
  return 'contradiction reached';
}

function formatTechniqueReason(
  step: SolveStep,
  locale: 'zh-CN' | 'en-US',
  context: {
    reasonCells: string[];
    targetCells: string[];
    houseLabels: string[];
  },
): string {
  const firstAction = step.actions[0];
  const digit = firstAction?.digit;
  const reasonCells = context.reasonCells.join(locale === 'zh-CN' ? '、' : ', ');
  const targetCells = context.targetCells.join(locale === 'zh-CN' ? '、' : ', ');
  const houses = context.houseLabels.join(locale === 'zh-CN' ? '、' : ', ');

  if (locale === 'zh-CN') {
    switch (step.technique) {
      case 'full-house':
        return houses ? `${houses}只剩一个空格，因此可以直接确定该格数字` : '某个区域只剩一个空格，因此可以直接确定该格数字';
      case 'naked-single':
        return '目标格只剩一个候选数，因此可以直接落子';
      case 'hidden-single':
        return houses ? `数字 ${digit} 在${houses}中只可能出现在目标格` : `数字 ${digit} 只可能出现在目标格`;
      case 'locked-candidates':
        return reasonCells
          ? `候选 ${digit} 被锁定在 ${reasonCells} 所在的交叉区域，因此可从目标格删除`
          : `候选 ${digit} 被锁定在同一交叉区域，因此可从目标格删除`;
      case 'naked-pair':
      case 'naked-triple':
      case 'naked-quad':
        return reasonCells
          ? `${reasonCells} 构成显性数组，因此同一区域其他格不能再保留这些候选数`
          : '显性数组会排除同一区域其他格中的相同候选数';
      case 'hidden-pair':
      case 'hidden-triple':
      case 'hidden-quad':
        return reasonCells
          ? `这些数字只会出现在 ${reasonCells}，因此这些格子的其他候选数可以删除`
          : '隐性数组会删除数组格中的其他候选数';
      case 'x-wing':
        return `候选 ${digit} 在两条基线和两条覆盖线之间形成 X-Wing，因此可删除覆盖线上其他位置的候选`;
      case 'swordfish':
        return `候选 ${digit} 在三条基线和三条覆盖线之间形成剑鱼，因此可删除覆盖线上其他位置的候选`;
      case 'franken-swordfish':
        return `候选 ${digit} 在混合基线和三条覆盖线之间形成 Franken Swordfish，因此可删除覆盖线上基线之外的候选`;
      case 'jellyfish':
        return `候选 ${digit} 在四条基线和四条覆盖线之间形成水母，因此可删除覆盖线上其他位置的候选`;
      case 'finned-x-wing':
        return `候选 ${digit} 形成带鳍 X-Wing，因此可删除与鱼鳍同宫且落在覆盖线上的候选`;
      case 'finned-swordfish':
        return `候选 ${digit} 形成带鳍剑鱼，因此可删除与鱼鳍同宫且落在覆盖线上的候选`;
      case 'finned-jellyfish':
        return `候选 ${digit} 形成带鳍水母，因此可删除与鱼鳍同宫且落在覆盖线上的候选`;
      case 'sashimi-swordfish':
        return `候选 ${digit} 形成刺身剑鱼，因此可删除与缺角鱼鳍同宫且落在覆盖线上的候选`;
      case 'sashimi-jellyfish':
        return `候选 ${digit} 形成刺身水母，因此可删除与缺角鱼鳍同宫且落在覆盖线上的候选`;
      case 'xy-wing':
        return reasonCells
          ? `${reasonCells} 构成 XY-Wing，因此共同影响范围内的候选 ${digit} 可以删除`
          : `XY-Wing 会删除共同影响范围内的候选 ${digit}`;
      case 'xyz-wing':
        return reasonCells
          ? `${reasonCells} 构成 XYZ-Wing，因此同时看到枢轴和两个翼的候选 ${digit} 可以删除`
          : `XYZ-Wing 会删除共同影响范围内的候选 ${digit}`;
      case 'wxyz-wing':
        return `四格集合构成 WXYZ-Wing，因此共同影响范围内的受限候选可以删除`;
      case 'w-wing':
        return reasonCells
          ? `${reasonCells} 构成 W-Wing，因此共同影响范围内的候选 ${digit} 可以删除`
          : `W-Wing 会删除共同影响范围内的候选 ${digit}`;
      case 'big-wings':
        return `BigWings 将 ALS 与双值 stem 连接起来，因此受限候选可以删除`;
      case 'chute-remote-pairs':
        return `同一 chute 中的远程数对使第三宫 yellow cells 缺少一个数字，因此公共可见区可删除另一候选`;
      case 'almost-locked-pair':
      case 'almost-locked-triple':
        return `准锁定数组与交叉区域形成限制关系，因此可以删除目标候选`;
      case 'als-xz':
        return `两个 ALS 通过限制公共候选相连，因此可以删除目标候选`;
      case 'als-xy-wing':
        return `枢轴 ALS 与两个翼 ALS 形成 ALS-XY-Wing，因此可以删除目标候选`;
      case 'aic-als':
        return `ALS-AIC 通过外部共轭链和 ALS 内部强链接形成端点夹击，因此可以删除目标候选`;
      case 'fireworks':
        return `Fireworks 将交点和两个翼格锁成隐藏组，因此这些格中的其它候选可以删除`;
      case 'twinned-xy-chains':
        return `双生 XY-Chains 将六个数字锁在 2x3 或 3x2 六格结构中，因此成对数字可向外删除公共可见候选`;
      case 'sue-de-coq':
        return `Sue-de-Coq 将行宫交集拆成行翼和宫翼独占数字，因此对应区域其它格可删除这些候选`;
      case 'death-blossom':
        return `Death Blossom 将 pivot 的每个候选分别连接到不同 ALS 花瓣，因此共同外部候选可以删除`;
      case 'aligned-pair-exclusion':
        return `对齐数对的所有相关数字配对都会被同数冲突或可见 ALS 排除，因此无支持的目标候选可以删除`;
      case 'exocet':
        return `Exocet 的两枚 base cells 与两个 target cells 形成受限模式，因此 target 中非 base 数字候选可以删除`;
      case 'double-exocet':
        return `两组 Exocet 在同一 band 或 stack 中共享 base 数字，因此四个 target cells 中非 base 数字候选可以删除`;
      case 'pattern-overlay':
        return `枚举某个数字的全部合法模板后，所有模板共同保留或共同排除的位置可以直接落子或删候选`;
      case 'tridagons':
        return `Tridagons 的四宫奇偶结构把 guardian 格限定为宫外数字，因此该格中的 Tridagon 数字候选可以删除`;
      case 'sk-loops':
        return `SK Loop 将若干数字锁入八段闭环，因此相关行列宫中的外部候选可以删除`;
      case 'forcing-nets':
        return `对枢轴的所有有效分支分别展开后，共同推出的落子或删候选可以直接成立`;
      case 'digit-forcing-chains':
        return `把某个候选视为成立或不成立，两条分支共同推出的结论可以直接采用`;
      case 'nishio-forcing-chains':
        return `若某个候选一旦假设成立就立即导向矛盾，则该候选可以删除`;
      case 'cell-forcing-chains':
        return `同一格所有候选分支共同推出的外部结论可以直接采用`;
      case 'unit-forcing-chains':
        return `同一区域内某数字的所有位置分支共同推出的外部结论可以直接采用`;
      case 'table-chain':
        return `Table Chain 汇总静态分支推出的矛盾或共同结论，因此可以采用该目标动作`;
      case 'bowmans-bingo':
        return `对某个候选做有界试探后若稳定导向矛盾，则该候选可以删除`;
      case 'simple-coloring':
        return `候选 ${digit} 的强链形成简单染色，因此可删除违反染色结论的候选`;
      case 'x-coloring':
        return `候选 ${digit} 的强链经扩展染色后形成矛盾或夹击，因此可删除目标候选`;
      case 'multi-colors':
        return `候选 ${digit} 的多组强链形成多重染色，因此可删除同时受两组颜色约束的候选`;
      case 'three-d-medusa':
        return `3D Medusa 在跨数字着色图中形成冲突或夹击，因此可以删除目标候选`;
      case 'grouped-x-cycles':
        return `候选 ${digit} 形成分组 X-Cycles，因此链端共同看到的位置可以删除该候选`;
      case 'grouped-aic':
        return `候选之间形成分组 AIC，因此可根据链端关系删除目标候选`;
      case 'x-chain':
        return `候选 ${digit} 形成 X-Chain，因此链端共同看到的位置可以删除该候选`;
      case 'xy-chain':
        return `双值格形成 XY-Chain，因此链端共同看到的位置可以删除候选 ${digit}`;
      case 'aic':
        return `交替强弱链形成 AIC，因此可根据链端关系删除目标候选`;
      case 'aic-exotic':
        return `把 ALS 等异构强链接纳入交替推理链后，可以根据链端关系删除目标候选`;
      case 'skyscraper':
        return `候选 ${digit} 形成摩天楼结构，因此两个屋顶格共同看到的位置可以删除该候选`;
      case 'two-string-kite':
        return `候选 ${digit} 形成双线风筝，因此远端行列交叉位置可以删除该候选`;
      case 'turbot-fish':
        return `候选 ${digit} 形成涡轮鱼短链，因此两个端点共同看到的位置可以删除该候选`;
      case 'empty-rectangle':
        return `候选 ${digit} 形成空矩形并配合共轭对，因此目标格可以删除该候选`;
      case 'unique-rectangle':
        return `唯一矩形结构要求避免致命矩形，因此可以删除目标候选`;
      case 'avoidable-rectangle':
        return `可避免矩形的三个角已固定，若目标角取该候选会形成可交换矩形，因此该候选必须删除`;
      case 'rectangle-elimination':
        return `矩形删减利用强弱链接避免覆盖第四宫，因此可以删除目标候选`;
      case 'extended-rectangle':
        return `扩展矩形结构要求避免 2x3 或 3x2 致命模式，因此可以删除目标候选`;
      case 'hidden-unique-rectangle':
        return `隐藏唯一矩形利用强链接暴露致命矩形风险，因此可以删除目标候选`;
      case 'aic-ur':
        return `UR-AIC 将唯一矩形作为链节点，因此可以删除会导致致命矩形的候选`;
      case 'bug-plus-one':
        return `当前盘面接近 BUG 形态，因此唯一三值格可确定为 ${digit}`;
      default:
        return targetCells ? `可对 ${targetCells} 执行本步骤` : '';
    }
  }

  switch (step.technique) {
    case 'full-house':
      return houses ? `${houses} has only one empty cell.` : 'A house has only one empty cell.';
    case 'naked-single':
      return 'The target cell has only one candidate.';
    case 'hidden-single':
      return houses ? `${digit} can only appear in the target cell in ${houses}.` : `${digit} can only appear in the target cell.`;
    case 'locked-candidates':
      return `${digit} is locked to the intersection, so it can be removed from the targets.`;
    case 'naked-pair':
    case 'naked-triple':
    case 'naked-quad':
      return 'The naked subset removes the same digits from other cells in the house.';
    case 'hidden-pair':
    case 'hidden-triple':
    case 'hidden-quad':
      return 'The hidden subset removes other candidates from the subset cells.';
    case 'x-wing':
      return `${digit} forms an X-Wing, removing other cover-line candidates.`;
    case 'swordfish':
      return `${digit} forms a Swordfish, removing other cover-line candidates.`;
    case 'franken-swordfish':
      return `${digit} forms a Franken Swordfish with mixed basis houses, removing cover-line candidates outside the basis houses.`;
    case 'jellyfish':
      return `${digit} forms a Jellyfish, removing other cover-line candidates.`;
    case 'finned-x-wing':
      return `${digit} forms a Finned X-Wing, removing candidates that see the fin.`;
    case 'finned-swordfish':
      return `${digit} forms a Finned Swordfish, removing candidates that see the fin.`;
    case 'finned-jellyfish':
      return `${digit} forms a Finned Jellyfish, removing candidates that see the fin.`;
    case 'sashimi-swordfish':
      return `${digit} forms a Sashimi Swordfish, removing candidates that see the fin.`;
    case 'sashimi-jellyfish':
      return `${digit} forms a Sashimi Jellyfish, removing candidates that see the fin.`;
    case 'xy-wing':
      return `The XY-Wing removes ${digit} from cells seeing both wings.`;
    case 'xyz-wing':
      return `The XYZ-Wing removes ${digit} from cells seeing pivot and both wings.`;
    case 'wxyz-wing':
      return 'The WXYZ-Wing removes restricted common candidates seen outside the wing.';
    case 'w-wing':
      return `The W-Wing removes ${digit} from cells seeing both bivalue endpoints.`;
    case 'big-wings':
      return 'BigWings connects an ALS with a bivalue stem, removing linked candidates and, when both stem digits are linked, ALS-exclusive candidates.';
    case 'chute-remote-pairs':
      return 'Chute Remote Pairs remove the opposite digit when the yellow cells in the third box miss one digit of the remote pair.';
    case 'almost-locked-pair':
    case 'almost-locked-triple':
      return 'Almost locked candidates eliminate targets through an ALS/AHS intersection.';
    case 'als-xz':
      return 'ALS-XZ removes target candidates through restricted common digits.';
    case 'als-xy-wing':
      return 'ALS-XY-Wing removes target candidates through a pivot ALS and two wing ALSs.';
    case 'aic-als':
      return 'ALS-AIC removes target candidates through an external conjugate link and an ALS internal strong link.';
    case 'fireworks':
      return 'Fireworks locks the intersection and two wing cells into a hidden subset, removing other candidates from those cells.';
    case 'twinned-xy-chains':
      return 'Twinned XY-Chains lock six digits into a 2x3 or 3x2 pattern, allowing paired digits to eliminate common peers.';
    case 'sue-de-coq':
      return 'Sue-de-Coq splits a line-box intersection into line and box exclusive digit sets, removing those digits from the corresponding regions.';
    case 'death-blossom':
      return 'Death Blossom connects each pivot digit to a different ALS petal, allowing the shared external digit to be eliminated.';
    case 'aligned-pair-exclusion':
      return 'Aligned Pair Exclusion removes candidates unsupported after all pair assignments are checked.';
    case 'exocet':
      return 'Exocet restricts both target cells to the base digits, so other target candidates are removed.';
    case 'double-exocet':
      return 'Double Exocet restricts all four target cells to the shared base digits, so other target candidates are removed.';
    case 'pattern-overlay':
      return 'Pattern Overlay enumerates all legal templates for one digit and applies their shared placements or eliminations.';
    case 'tridagons':
      return 'Tridagons uses a four-box parity structure to eliminate the guarded Tridagon digits.';
    case 'sk-loops':
      return 'SK Loops lock digits into an eight-link loop, allowing linked outside candidates to be removed.';
    case 'forcing-nets':
      return 'Forcing Nets keeps only conclusions shared by every surviving branch.';
    case 'digit-forcing-chains':
      return 'Digit Forcing Chains compares the ON and OFF branches of one candidate and keeps only their shared conclusion.';
    case 'nishio-forcing-chains':
      return 'Nishio removes a candidate whose assumption leads to contradiction.';
    case 'cell-forcing-chains':
      return 'Cell Forcing Chains keeps only the shared conclusion from all candidate branches of one cell.';
    case 'unit-forcing-chains':
      return 'Unit Forcing Chains keeps only the shared conclusion from all position branches of one digit in one house.';
    case 'table-chain':
      return 'Table Chain keeps a contradiction or shared conclusion from static implication branches.';
    case 'bowmans-bingo':
      return 'Bowman\'s Bingo removes a candidate whose bounded trial branch reaches contradiction.';
    case 'simple-coloring':
      return `${digit} forms a coloring chain, eliminating candidates that violate the coloring result.`;
    case 'x-coloring':
      return `${digit} forms an extended coloring chain, eliminating candidates by contradiction or trap.`;
    case 'multi-colors':
      return `${digit} forms multiple coloring chains, eliminating candidates constrained by both components.`;
    case 'three-d-medusa':
      return '3D Medusa colors a multi-digit strong-link graph to eliminate candidates through contradictions or traps.';
    case 'grouped-x-cycles':
      return `${digit} forms a Grouped X-Cycles chain, removing candidates seen by both endpoints.`;
    case 'grouped-aic':
      return 'The Grouped AIC alternates strong and weak links, removing candidates from endpoint implications.';
    case 'x-chain':
      return `${digit} forms an X-Chain, removing candidates seen by both endpoints.`;
    case 'xy-chain':
      return `The XY-Chain removes ${digit} from cells seeing both endpoints.`;
    case 'aic':
      return 'The AIC alternates strong and weak links, removing candidates from endpoint implications.';
    case 'aic-exotic':
      return 'AIC with Exotic Links extends the alternating inference chain through exotic strong links such as ALS relationships.';
    case 'skyscraper':
      return `${digit} forms a Skyscraper, removing candidates seen by both roof cells.`;
    case 'two-string-kite':
      return `${digit} forms a Two-String Kite, removing the remote intersection candidate.`;
    case 'turbot-fish':
      return `${digit} forms a Turbot Fish chain, removing candidates seen by both endpoints.`;
    case 'empty-rectangle':
      return `${digit} forms an Empty Rectangle with a conjugate pair, removing the target candidate.`;
    case 'unique-rectangle':
      return 'The Unique Rectangle avoids a deadly pattern by removing the target candidates.';
    case 'avoidable-rectangle':
      return 'Avoidable Rectangle removes the candidate that would complete a swappable rectangle with three solved corners.';
    case 'rectangle-elimination':
      return 'Rectangle Elimination removes the target candidate to avoid covering the fourth box.';
    case 'extended-rectangle':
      return 'The Extended Rectangle avoids a 2x3 or 3x2 deadly pattern.';
    case 'hidden-unique-rectangle':
      return 'The Hidden Unique Rectangle removes a candidate exposed by strong links.';
    case 'aic-ur':
      return 'UR-AIC treats a Unique Rectangle as a chain node to remove the deadly-pattern candidate.';
    case 'bug-plus-one':
      return `BUG+1 places ${digit} in the only trivalue cell.`;
    default:
      return '';
  }
}

function formatCell(cell: number): string {
  const row = Math.floor(cell / 9) + 1;
  const col = (cell % 9) + 1;
  return `r${row}c${col}`;
}

function appendSentence(text: string, locale: 'zh-CN' | 'en-US'): string {
  const trimmed = text.trim().replace(locale === 'zh-CN' ? /[。！？]+$/u : /[.!?]+$/u, '');
  return `${trimmed}${locale === 'zh-CN' ? '。' : '.'}`;
}

function formatHouse(type: 'row' | 'col' | 'box', index: number, locale: 'zh-CN' | 'en-US'): string {
  const number = index + 1;
  if (locale === 'zh-CN') {
    if (type === 'row') {
      return `第 ${number} 行`;
    }
    if (type === 'col') {
      return `第 ${number} 列`;
    }
    return `第 ${number} 宫`;
  }
  if (type === 'row') {
    return `row ${number}`;
  }
  if (type === 'col') {
    return `column ${number}`;
  }
  return `box ${number}`;
}
