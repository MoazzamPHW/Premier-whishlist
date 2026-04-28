import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import type { ReportingRow } from "../types/reporting";

type ReportingParams = {
  admin: AdminApiContext;
  shopDomain: string;
  query: string;
  sort: string;
};

const chunk = (list: string[], size: number) => {
  const result: string[][] = [];
  for (let i = 0; i < list.length; i += size) {
    result.push(list.slice(i, i + size));
  }
  return result;
};

export async function getReportingRows({
  admin,
  shopDomain,
  query,
  sort,
}: ReportingParams): Promise<ReportingRow[]> {
  const shop =
    (await prisma.shop.findUnique({ where: { shopDomain } })) ||
    (await prisma.shop.findFirst());
  if (!shop) return [];

  const items = await prisma.wishlistItem.findMany({
    where: { wishlist: { shopId: shop.id } },
    include: {
      wishlist: {
        select: {
          customer: { select: { email: true } },
        },
      },
    },
  });

  const productMap = new Map<
    string,
    { users: Set<string>; count: number; purchasedUsers: Set<string>; purchasedCount: number }
  >();

  items.forEach((item) => {
    const entry =
      productMap.get(item.productId) || {
        users: new Set(),
        count: 0,
        purchasedUsers: new Set(),
        purchasedCount: 0,
      };
    const email = item.wishlist.customer?.email;
    if (email && !item.purchasedAt) {
      entry.users.add(email);
    }
    if (!item.purchasedAt) {
      entry.count += 1;
    }
    if (item.purchasedAt) {
      entry.purchasedCount += 1;
      if (email) entry.purchasedUsers.add(email);
    }
    productMap.set(item.productId, entry);
  });

  const productIds = Array.from(productMap.keys());
  const rows: ReportingRow[] = [];

  type ProductNode = {
    id: string;
    title: string;
    handle: string;
    featuredImage?: { url: string } | null;
    totalInventory?: number | null;
    variants?: {
      edges?: Array<{ node?: { sku?: string | null; inventoryQuantity?: number | null } }>;
    };
  };

  for (const ids of chunk(productIds, 50)) {
    const gids = ids.map((id) => `gid://shopify/Product/${id}`);
    const response = await admin.graphql(
      `#graphql
        query ReportingProducts($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product {
              id
              title
              handle
              featuredImage { url }
              totalInventory
              variants(first: 1) {
                edges {
                  node {
                    sku
                    inventoryQuantity
                  }
                }
              }
            }
          }
        }`,
      { variables: { ids: gids } },
    );
    const data = await response.json();
    const nodes = data?.data?.nodes || [];
    (nodes as Array<ProductNode | null>).forEach((node) => {
      if (!node) return;
      const numericId = node.id.split("/").pop() || "";
      const stats = productMap.get(numericId);
      if (!stats) return;
      const variant = node.variants?.edges?.[0]?.node;
      const inventory =
        typeof variant?.inventoryQuantity === "number"
          ? variant.inventoryQuantity
          : typeof node.totalInventory === "number"
            ? node.totalInventory
            : null;
      rows.push({
        productId: numericId,
        title: node.title,
        sku: variant?.sku || null,
        inventory,
        imageUrl: node.featuredImage?.url || null,
        users: Array.from(stats.users),
        count: stats.count,
        purchasedUsers: Array.from(stats.purchasedUsers),
        purchasedCount: stats.purchasedCount,
        bought: stats.purchasedCount > 0,
      });
    });
  }

  const filtered = query
    ? rows.filter((row) => {
        const q = query.toLowerCase();
        return (
          row.title.toLowerCase().includes(q) ||
          (row.sku || "").toLowerCase().includes(q)
        );
      })
    : rows;

  const sorted = filtered.sort((a, b) => {
    switch (sort) {
      case "title_desc":
        return b.title.localeCompare(a.title);
      case "inventory_asc":
        return (a.inventory ?? 0) - (b.inventory ?? 0);
      case "inventory_desc":
        return (b.inventory ?? 0) - (a.inventory ?? 0);
      case "count_desc":
        return b.count - a.count;
      case "count_asc":
        return a.count - b.count;
      case "purchased_desc":
        return b.purchasedCount - a.purchasedCount;
      case "purchased_asc":
        return a.purchasedCount - b.purchasedCount;
      default:
        return a.title.localeCompare(b.title);
    }
  });

  return sorted;
}
