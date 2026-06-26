import {
  hint,
} from '@sudoku-tools/classic9';

const puzzle = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';

const zh = hint(puzzle, {
  format: { locale: 'zh-CN', style: 'teaching' },
});
const en = hint(puzzle, {
  format: { locale: 'en-US', style: 'short' },
});

console.log(JSON.stringify({
  found: zh.found,
  technique: zh.technique,
  zh: zh.text,
  en: en.text,
  actions: zh.actions,
}, null, 2));
