// How a strip of cells that wraps lays its columns out in the room it has. It lays its cells out in full rows only: its
// columns divide its cells, so no row is short and no cell sits beside empty room. A strip is a row of more than one
// cell, so it never stacks to a single column. A column takes the greatest weight of the cells it holds, since a grid's
// column is one width down every row; each cell keeps its weight's share of the least width, so a column needs its
// weight times `least`.

/** What a strip that wraps needs: each cell's weight, in order, the least width of a cell of weight 1, and the gap
 *  between cells, across and down. */
export interface StripWrap { weights: readonly number[]; least: number; gap: number }

/** A wrapping strip's layout: how many columns, the width of each, and the CSS grid template that lays them. */
export interface StripForm { columns: number; width: number; template: string }

const LEAST_COLUMNS = 2;

/** The column counts a strip of `count` cells can take, widest first: every divisor of `count` that keeps a row. A
 *  count with no narrower full-row form can never wrap, so a wrap on it is refused. */
function columnChoices(count: number): number[] {
  const choices = [];
  for (let columns = count; columns >= LEAST_COLUMNS; columns--) if (count % columns === 0) choices.push(columns);
  if (choices.length < LEAST_COLUMNS)
    throw new Error(`A strip of ${count} cells has no narrower form in full rows, so it cannot wrap.`);
  return choices;
}

function formOf(columns: number, { weights, least, gap }: StripWrap): StripForm {
  const columnWeights = Array.from({ length: columns }, (_, column) =>
    Math.max(...weights.filter((_weight, cell) => cell % columns === column)));
  const width = least * columnWeights.reduce((sum, weight) => sum + weight, 0) + gap * (columns - 1);
  return { columns, width, template: columnWeights.map(weight => `minmax(0, ${weight}fr)`).join(' ') };
}

/** The most columns whose cells all keep their least width in `room`, or the narrowest form when none does. */
export function stripForm(room: number, wrap: StripWrap): StripForm {
  const forms = columnChoices(wrap.weights.length).map(columns => formOf(columns, wrap));
  return forms.find(form => form.width <= room) ?? forms[forms.length - 1];
}

/** The least width a wrapping strip needs: its narrowest form's. */
export function stripLeastWidth(wrap: StripWrap): number {
  const choices = columnChoices(wrap.weights.length);
  return formOf(choices[choices.length - 1], wrap).width;
}
