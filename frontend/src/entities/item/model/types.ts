export type Item = {
  id: number;
  title: string;
};

export type ItemsPage = {
  products: Item[];
  total: number;
  skip: number;
};
