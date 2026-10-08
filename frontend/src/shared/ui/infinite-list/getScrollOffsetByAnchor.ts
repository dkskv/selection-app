import type { Key } from 'react';
import clamp from 'lodash/clamp';

type GetScrollOffsetByAnchorArgs = {
  previousKeys: readonly Key[];
  nextKeys: readonly Key[];
  previousOffset: number;
  rowHeight: number;
  viewportHeight: number;
};

/** Вычисляет смещение прокрутки по строке-якорю с учётом новых границ списка. */
export function getScrollOffsetByAnchor({
  previousKeys,
  nextKeys,
  previousOffset,
  rowHeight,
  viewportHeight,
}: GetScrollOffsetByAnchorArgs): number {
  const maxOffset = Math.max(0, nextKeys.length * rowHeight - viewportHeight);

  if (
    previousKeys === nextKeys ||
    (previousKeys.length === nextKeys.length &&
      previousKeys.every((key, index) => key === nextKeys[index]))
  ) {
    return clamp(previousOffset, 0, maxOffset);
  }

  const firstVisibleIndex = clamp(
    Math.floor(previousOffset / rowHeight),
    0,
    Math.max(0, previousKeys.length - 1),
  );

  const nextIndexes = new Map(nextKeys.map((key, index) => [key, index]));
  let nextOffset = previousOffset;

  for (let distance = 0; distance < previousKeys.length; distance++) {
    /** Индексы на текущем расстоянии от видимой строки; при равенстве предпочитаем нижнюю. */
    const candidates =
      distance === 0
        ? [firstVisibleIndex]
        : [firstVisibleIndex + distance, firstVisibleIndex - distance];

    const previousIndex = candidates.find(
      (index) =>
        index >= 0 &&
        index < previousKeys.length &&
        nextIndexes.has(previousKeys[index]!),
    );

    if (previousIndex !== undefined) {
      nextOffset +=
        (nextIndexes.get(previousKeys[previousIndex]!)! - previousIndex) *
        rowHeight;

      break;
    }
  }

  return clamp(nextOffset, 0, maxOffset);
}
