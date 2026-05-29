# 状态和候选约束

## 棋盘

棋盘使用 81 长度数组表示。

规则：

1. `0` 表示空格。
2. `1-9` 表示已填数字。
3. 下标范围是 `0-80`。
4. 行列转换规则是 `index = row * 9 + col`。

## PuzzleState

`PuzzleState` 表示一个可求解的题目状态。

字段：

1. `board`：当前盘面。
2. `candidateMasks`：可选，直接提供 81 个候选 mask，用于表达已经求解到中途的可信候选态。
3. `givens`：可选，表示题面给定数。
4. `constraints`：可选，表示候选数约束。
5. `assumptions`：可选，表示假设分支。当前默认会被规范化为候选约束的一部分，并参与求解。
6. `metadata`：可选，供外部系统携带信息，核心逻辑不依赖它。

### candidateMasks

`candidateMasks` 是最低层的候选态入口，用于表达由外部流程维护的完整候选表。

规则：

1. 必须包含 81 个整数 mask。
2. mask 使用低 9 位表示候选 `1-9`。
3. 已填格上的 mask 会被忽略并置为 `0`。
4. 它不会重新按当前盘面过滤候选，因此可以表达教学、假设链、forcing、AIC 等中间状态。
5. 普通题面输入不应使用它；只有调用方确信候选态已经由外部过程维护正确时才应使用。

### assumptions

`assumptions` 表示外部推理过程已经确认的假设分支。

语义：

1. 假设格必须是空格，或已经填入同一个数字。
2. 如果假设数字与目标格、同行、同列或同宫中的已填数字冲突，会返回矛盾。
3. 如果目标格当前候选表中没有该数字，会返回矛盾；`assumptions` 不会静默覆盖调用方提供的可信候选表。
4. 通过校验后，假设格会收敛到单一候选，并从同行、同列和同宫的其他空格候选中删除该数字。
5. `assumptions` 不会直接修改 `board`，但会作为候选约束参与后续求解。
6. 这不是纯元数据。
7. 当前 `normalizeState()` 会收缩候选态，但不会单独回显“哪些候选是由 assumptions 压缩出来的”。如果调用方需要完整审计，应自行保存原始假设输入。

## CandidateConstraints

当前支持三类候选约束。

### forbidden

`forbidden` 表示某些格子禁止保留某些候选数。

语义：

1. 先按当前盘面计算合法候选。
2. 再删除 `forbidden` 指定的候选。
3. 如果删除后某个空格没有候选，会报告矛盾。

### exactCandidates

`exactCandidates` 表示调用方直接提供某格完整候选集合。

语义：

1. 它会影响求解。
2. 默认必须是当前盘面合法候选的子集。
3. 如果包含非法候选，会报告矛盾。
4. 如果 `exactCandidatesMode` 设置为 `trusted`，则不再按当前盘面合法候选过滤，用于表达外部中间态或教学候选态。

`trusted` 模式适合“我已经有一份可信候选表，只希望 solver 在这份候选表上找技巧”的场景；不适合直接校验原始题面。

### pencilMarks

`pencilMarks` 表示玩家笔记。

当前默认行为：

1. 不影响求解。
2. 只作为输入信息保留。
3. 会返回一条提示，说明它未参与求解。

## 设计原则

候选约束不是原始题目的新规则，而是中间求解状态的表达。

公开库后续接入更复杂的假设链、forcing、AIC 时，仍应先通过 `normalizeState` 统一语义。

Sudoku Explainer 兼容计划中的 dynamic / nested forcing 也必须遵守这一原则：分支、假设和候选约束先进入统一 `PuzzleState` / `NormalizedState` 模型，再交给具体技巧 finder。相关阶段见 [SE_COMPATIBILITY.md](./SE_COMPATIBILITY.md)。
