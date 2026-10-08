import type { InfiniteData, QueryKey } from '@tanstack/react-query';

export type PageParamFn<TPage, TPageParam> = (
  edgePage: TPage,
  pages: TPage[],
) => TPageParam | undefined;

export type UseSlidingWindowQueryOptions<TPage, TPageParam> = {
  /** Ключ идентичности выборки в кеше. */
  queryKey: QueryKey;
  /** Параметр первой страницы окна. */
  initialPageParam: TPageParam;
  /** Загружает страницу по параметру и сигналу отмены. */
  queryFn: (pageParam: TPageParam, signal: AbortSignal) => Promise<TPage>;
  /** Возвращает параметр следующей страницы. */
  getNextPageParam: PageParamFn<TPage, TPageParam>;
  /** Возвращает параметр предыдущей страницы. */
  getPreviousPageParam: PageParamFn<TPage, TPageParam>;
  /** Максимальное число страниц в окне. */
  maxPages: number;
  /** Данные для отображения при смене queryKey до загрузки нового окна. */
  placeholderData?:
    | InfiniteData<TPage, TPageParam>
    | ((
        previousData: InfiniteData<TPage, TPageParam> | undefined,
      ) => InfiniteData<TPage, TPageParam> | undefined);
  /** Вызывается при ошибке загрузки страницы. */
  onError?: (error: Error) => void;
};

/** Данные и операции для отображения и управления скользящим окном страниц. */
export interface UseSlidingWindowQueryResult<TPage, TPageParam> {
  /** Отображаемое окно, placeholderData или undefined, если данных ещё нет. */
  data: InfiniteData<TPage, TPageParam> | undefined;
  /** Есть ли следующая страница. */
  hasNextPage: boolean;
  /** Есть ли предыдущая страница. */
  hasPreviousPage: boolean;
  /** Загружает следующую страницу. */
  fetchNextPage: () => Promise<void>;
  /** Загружает предыдущую страницу. */
  fetchPreviousPage: () => Promise<void>;
  /** Параллельно загружает страницы окна; данные обновляются по мере изменения кеша. */
  refresh: () => Promise<void>;
  /** Сразу показывает состояние обновления без запуска запросов. */
  markRefreshScheduled: () => void;
  /** Загружается ли следующая страница. */
  isFetchingNextPage: boolean;
  /** Загружается ли предыдущая страница. */
  isFetchingPreviousPage: boolean;
  /** Обновляются ли страницы текущего окна. */
  isRefreshing: boolean;
  /** Загружается ли начальная страница текущего queryKey. */
  isLoading: boolean;
}
