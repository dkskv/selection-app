/** Привязывает метод к экземпляру при первом чтении, сохраняя this и стабильную ссылку. */
export function boundMethod<TThis, TArgs extends unknown[], TResult>(
  target: object,
  name: string | symbol,
  descriptor: TypedPropertyDescriptor<(this: TThis, ...args: TArgs) => TResult>,
): TypedPropertyDescriptor<(this: TThis, ...args: TArgs) => TResult> {
  const method = descriptor.value!;

  return {
    configurable: true,
    get(this: TThis) {
      if (this === target) return method;

      const bound = method.bind(this);

      // Вызов super.method не должен заменять уже привязанный метод наследника.
      if (!Object.prototype.hasOwnProperty.call(this, name)) {
        Object.defineProperty(this, name, {
          configurable: true,
          writable: true,
          value: bound,
        });
      }

      return bound;
    },
  };
}
