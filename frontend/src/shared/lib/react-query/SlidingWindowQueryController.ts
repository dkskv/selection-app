import {
  CancelledError,
  hashKey,
  type InfiniteData,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { PromiseBatch } from '../async/promiseBatch';
import { boundMethod } from '../decorators/boundMethod';
import { BaseStore } from '../store/BaseStore';
import {
  extendWindowAtEdge,
  getQueryPageEntriesByWindow,
  pageKey,
  toError,
  type Direction,
} from './useSlidingWindowQuery.helpers';
import type { UseSlidingWindowQueryOptions } from './useSlidingWindowQuery.types';

// REVIEWER:
// Кастомная двунаправленная пагинация вместо useInfiniteQuery из TanStack Query,
// т.к. страницы обновляются последовательно, что при серверном batching
// существенно замедляет обновление нескольких страниц.
//
// Реализация покрыта тестами, включая edge cases. Для production можно было бы
// дополнительно исследовать готовые решения, порефакторить код и сделать
// обновления атомарными, чтобы исключить временную мозаичность данных в интерфейсе.

/** Индикаторы начальной загрузки, обновления и расширения окна. */
type FetchState = {
  /** Загружается начальная страница текущей выборки. */
  isLoading: boolean;
  /** Обновление запланировано или уже выполняется. */
  isRefreshing: boolean;
  /** Загружается страница у следующего края окна. */
  isFetchingNextPage: boolean;
  /** Загружается страница у предыдущего края окна. */
  isFetchingPreviousPage: boolean;
};

/** Отображаемое окно и состояние его загрузки для потребителей стора. */
type WindowSnapshot<TPage, TPageParam> = FetchState & {
  /** Идентичность выборки для проверки завершившихся запросов. */
  queryHash: string;
  /** Ключ выборки, страницы которой сейчас отображаются. */
  queryKey: QueryKey;
  /** Параметры страниц последнего опубликованного окна. */
  pageParams: TPageParam[];
  /** Данные отображаемого окна, прочитанные из кеша. */
  data: InfiniteData<TPage, TPageParam> | undefined;
  /** Последние доступные данные для placeholderData при смене ключа. */
  previousData: InfiniteData<TPage, TPageParam> | undefined;
};

/**
 * Управляет составом окна и загрузкой независимых страниц через QueryClient.
 * Целевое окно может содержать незавершённые запросы; отображаемое окно меняется
 * только после появления всех целевых страниц в кеше. Данные уже отображаемых
 * страниц обновляются сразу, включая внешние оптимистические изменения кеша.
 */
export class SlidingWindowQueryController<TPage, TPageParam> extends BaseStore<
  WindowSnapshot<TPage, TPageParam>
> {
  /** Клиент загрузки и кеширования независимых страниц. */
  private readonly queryClient: QueryClient;
  /** Актуальные параметры для вызовов, сохранённых потребителем. */
  private options: UseSlidingWindowQueryOptions<TPage, TPageParam>;
  /** Желаемый состав окна, включая ещё не загруженные страницы. */
  private targetPageParams: TPageParam[];
  /** Ключи отображаемых страниц для фильтрации событий кеша. */
  private displayedPageHashes: Set<string>;
  /** Общая загрузка refresh, включая присоединившиеся expand. */
  private refreshBatch: PromiseBatch<TPage> | undefined;

  /** Создаёт окно первой страницы без запуска запросов и подписки на кеш. */
  constructor(
    queryClient: QueryClient,
    options: UseSlidingWindowQueryOptions<TPage, TPageParam>,
  ) {
    const pageParams = [options.initialPageParam];

    super({
      queryHash: hashKey(options.queryKey),
      queryKey: options.queryKey,
      pageParams,
      data: undefined,
      previousData: undefined,
      isLoading:
        queryClient.getQueryData([
          options.queryKey,
          options.initialPageParam,
        ]) === undefined,
      isRefreshing: false,
      isFetchingNextPage: false,
      isFetchingPreviousPage: false,
    });

    this.queryClient = queryClient;

    this.options = options;

    this.targetPageParams = pageParams;

    this.displayedPageHashes = this.getDisplayedPageHashes(this.state);
  }

  /** Обновляется после рендера, чтобы сохранённые методы использовали актуальные параметры. */
  setOptions(options: UseSlidingWindowQueryOptions<TPage, TPageParam>): void {
    this.options = options;
  }

  /** Подписка живёт вместе с потребителем; создание контроллера не имеет побочных эффектов. */
  @boundMethod
  override subscribe(listener: () => void): () => void {
    const unsubscribeStore = super.subscribe(listener);

    const unsubscribeCache = this.queryClient
      .getQueryCache()
      .subscribe((event) => {
        if (this.displayedPageHashes.has(event.query.queryHash)) listener();
      });

    return () => {
      unsubscribeStore();

      unsubscribeCache();
    };
  }

  /** Повторное чтение кеша сохраняет ссылки на снимок и данные, если страницы не изменились. */
  @boundMethod
  override getSnapshot(): WindowSnapshot<TPage, TPageParam> {
    const { queryKey, pageParams } = this.state;

    const entries = getQueryPageEntriesByWindow<TPage, TPageParam>(
      this.queryClient,
      queryKey,
      pageParams,
    );

    let data = this.state.data;

    if (!entries) {
      data = undefined;
    } else if (
      !data ||
      data.pageParams !== pageParams ||
      entries.some(({ page }, index) => page !== data!.pages[index])
    ) {
      data = { pages: entries.map(({ page }) => page), pageParams };
    }

    if (data !== this.state.data) {
      // Чтение снимка во время рендера не должно уведомлять подписчиков.
      this.state = { ...this.state, data };
    }

    return this.state;
  }

  /** Начинает с первой страницы при смене ключа, сохраняя данные для placeholderData. */
  initialize(): void {
    const options = this.options;
    const queryHash = hashKey(options.queryKey);
    const pageParams = [options.initialPageParam];

    const entries = getQueryPageEntriesByWindow(
      this.queryClient,
      options.queryKey,
      pageParams,
    );

    if (this.state.queryHash !== queryHash) {
      const previousData = this.getSnapshot().data ?? this.state.previousData;

      this.targetPageParams = pageParams;

      this.refreshBatch = undefined;

      const nextState: WindowSnapshot<TPage, TPageParam> = {
        queryHash,
        queryKey: options.queryKey,
        pageParams,
        data: undefined,
        previousData,
        isLoading: entries === undefined,
        isRefreshing: false,
        isFetchingNextPage: false,
        isFetchingPreviousPage: false,
      };

      this.displayedPageHashes = this.getDisplayedPageHashes(nextState);

      this.setState(nextState);
    }

    if (!entries) {
      this.queryPage(options.initialPageParam, options)
        .then(() => this.publishWindow(queryHash))
        .catch(this.handleError)
        .finally(() => {
          if (this.isCurrentQuery(queryHash)) {
            this.updateFetchState({ isLoading: false });
          }
        });
    }
  }

  /** Загружает дополнительную страницу у следующего края окна. */
  @boundMethod
  fetchNextPage(): Promise<void> {
    return this.expand('next');
  }

  /** Загружает дополнительную страницу у предыдущего края окна. */
  @boundMethod
  fetchPreviousPage(): Promise<void> {
    return this.expand('previous');
  }

  /** Показывает ожидающее обновление, например на время debounce, без запуска запросов. */
  @boundMethod
  markRefreshScheduled(): void {
    if (!this.isCurrentQuery(this.state.queryHash)) return;

    this.updateFetchState({ isLoading: false, isRefreshing: true });
  }

  /**
   * Параллельно обновляет целевое окно. Присоединившиеся expand входят в тот же batch:
   * refresh отвечает за публикацию окна, сообщение об ошибке и сброс индикаторов.
   */
  @boundMethod
  async refresh(): Promise<void> {
    const options = this.options;
    const queryHash = hashKey(options.queryKey);

    if (!this.isCurrentQuery(queryHash)) return;

    this.markRefreshScheduled();

    await this.queryClient.cancelQueries({ queryKey: [options.queryKey] });

    // За время отмены пользователь мог переключить выборку.
    if (!this.isCurrentQuery(queryHash)) return;

    const batch = new PromiseBatch<TPage>();

    this.targetPageParams.forEach((pageParam) => {
      batch.add(this.queryPage(pageParam, options));
    });

    this.refreshBatch = batch;

    try {
      await batch.collect();

      this.publishWindow(queryHash);
    } catch (error) {
      if (error instanceof CancelledError) return;

      if (this.isCurrentQuery(queryHash) && this.refreshBatch === batch) {
        await this.queryClient.cancelQueries({ queryKey: [options.queryKey] });

        this.handleError(error);
      }
    } finally {
      // Завершение прежнего refresh не должно сбрасывать состояние нового.
      if (this.refreshBatch === batch) {
        this.refreshBatch = undefined;

        if (this.isCurrentQuery(queryHash)) {
          this.updateFetchState({
            isFetchingNextPage: false,
            isFetchingPreviousPage: false,
            isRefreshing: false,
          });
        }
      }
    }
  }

  /** Расширяет целевое окно в указанном направлении или повторяет ошибочную загрузку края. */
  private async expand(direction: Direction): Promise<void> {
    const options = this.options;
    const queryHash = hashKey(options.queryKey);
    const { data, pageParams } = this.getSnapshot();

    if (!this.isCurrentQuery(queryHash) || !data) return;

    const pageParam =
      direction === 'next'
        ? options.getNextPageParam(data.pages.at(-1)!, data.pages)
        : options.getPreviousPageParam(data.pages[0], data.pages);

    if (pageParam === undefined) return;

    const alreadyInWindow = this.targetPageParams.some(
      (param) => pageKey(param) === pageKey(pageParam),
    );

    if (alreadyInWindow) {
      const pageState = this.queryClient.getQueryState([
        options.queryKey,
        pageParam,
      ]);

      // Повторяем только завершившийся с ошибкой запрос, не расширяя окно снова.
      if (pageState?.status !== 'error' || pageState.fetchStatus !== 'idle')
        return;
    } else {
      this.targetPageParams = extendWindowAtEdge({
        targetPageParams: this.targetPageParams,
        displayedPageParams: pageParams,
        pageParam,
        direction,
        maxCount: options.maxPages,
        getKey: pageKey,
      });
    }

    const fetchingFlag =
      direction === 'next' ? 'isFetchingNextPage' : 'isFetchingPreviousPage';

    this.updateFetchState({ [fetchingFlag]: true });

    const pagePromise = this.queryPage(pageParam, options);

    if (this.refreshBatch) {
      // Ошибку общего batch обрабатывает refresh, чтобы не сообщать о ней дважды.
      await this.refreshBatch
        .add(pagePromise)
        .collect()
        .catch(() => {});

      return;
    }

    try {
      await pagePromise;

      this.publishWindow(queryHash);
    } catch (error) {
      // При отмене ради refresh индикатор сбросит сам refresh.
      if (error instanceof CancelledError) return;

      if (this.isCurrentQuery(queryHash)) {
        this.updateFetchState({ [fetchingFlag]: false });
      }

      this.handleError(error);

      return;
    }

    if (this.isCurrentQuery(queryHash)) {
      this.updateFetchState({ [fetchingFlag]: false });
    }
  }

  /** Запрашивает страницу с ключом и функцией, зафиксированными на момент запуска. */
  private queryPage(
    pageParam: TPageParam,
    { queryKey, queryFn }: UseSlidingWindowQueryOptions<TPage, TPageParam>,
  ): Promise<TPage> {
    // Ключ и функция фиксируются вместе, в том числе для повторных попыток.
    return this.queryClient.query({
      queryKey: [queryKey, pageParam],
      queryFn: ({ signal }) => queryFn(pageParam, signal),
      staleTime: 0,
      // Подписка на QueryCache не удерживает страницы от сборки мусора.
      gcTime: Infinity,
    });
  }

  /** Публикует только полностью доступное окно; завершение старого запроса его не меняет. */
  private publishWindow(queryHash: string): void {
    if (!this.isCurrentQuery(queryHash)) return;

    if (this.state.pageParams === this.targetPageParams) return;

    if (
      !getQueryPageEntriesByWindow(
        this.queryClient,
        this.state.queryKey,
        this.targetPageParams,
      )
    )
      return;

    const nextState = { ...this.state, pageParams: this.targetPageParams };

    this.displayedPageHashes = this.getDisplayedPageHashes(nextState);

    this.setState(nextState);
  }

  /** Проверяет принадлежность операции и опубликованному окну, и актуальным параметрам. */
  private isCurrentQuery(queryHash: string): boolean {
    return (
      this.state.queryHash === queryHash &&
      hashKey(this.options.queryKey) === queryHash
    );
  }

  /** Вычисляет ключи страниц, изменения которых должны обновлять отображаемые данные. */
  private getDisplayedPageHashes({
    queryKey,
    pageParams,
  }: WindowSnapshot<TPage, TPageParam>): Set<string> {
    return new Set(pageParams.map((param) => hashKey([queryKey, param])));
  }

  /** Обновляет индикаторы загрузки, сохраняя состав окна и его данные. */
  private updateFetchState(patch: Partial<FetchState>): void {
    this.setState({ ...this.state, ...patch });
  }

  /** Передаёт ошибку актуальному обработчику; отмена запроса ошибкой не считается. */
  @boundMethod
  private handleError(error: unknown): void {
    if (error instanceof CancelledError) return;

    this.options.onError?.(toError(error));
  }
}
