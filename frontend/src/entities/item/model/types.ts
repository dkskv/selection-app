export type Item = {
  id: number;
};

export type ItemsPage = {
  items: Item[];
  offset: number;
  limit: number;
};
