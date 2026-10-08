import { boundMethod } from '../decorators/boundMethod';

/** Хранит снимок состояния и уведомляет подписчиков о его замене. */
export class BaseStore<TState> {
  /** Текущий снимок; при изменениях заменяется целиком, без мутации прежнего объекта. */
  protected state: TState;
  /** Подписчики на изменения состояния. */
  private readonly listeners = new Set<() => void>();

  /** Принимает начальное состояние без подписок и других побочных эффектов. */
  constructor(initialState: TState) {
    this.state = initialState;
  }

  /** Возвращает стабильный снимок для чтения, в том числе через useSyncExternalStore. */
  @boundMethod
  getSnapshot(): TState {
    return this.state;
  }

  /** Добавляет подписчика и возвращает функцию отписки. */
  @boundMethod
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Заменяет состояние и уведомляет подписчиков; повторная передача того же снимка игнорируется. */
  protected setState(nextState: TState): void {
    if (Object.is(this.state, nextState)) return;

    this.state = nextState;

    this.listeners.forEach((listener) => listener());
  }
}
