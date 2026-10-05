/** Сериализует значение с детерминированным порядком ключей объектов. */
export const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).sort(([left], [right]) =>
      left.localeCompare(right),
    );

    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(',')}}`;
  }

  return JSON.stringify(value) ?? 'undefined';
};
