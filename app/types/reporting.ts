export type ReportingRow = {
  productId: string;
  title: string;
  sku: string | null;
  inventory: number | null;
  imageUrl: string | null;
  users: string[];
  count: number;
  purchasedUsers: string[];
  purchasedCount: number;
  purchasedTimes: number;
  bought: boolean;
};

export type LoaderData = {
  rows: ReportingRow[];
  page: number;
  totalPages: number;
  sort: string;
  q: string;
};
