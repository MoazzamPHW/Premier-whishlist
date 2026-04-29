import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getReportingRows } from "../utils/reporting.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const sort = url.searchParams.get("sort") || "title_asc";
  const q = url.searchParams.get("q") || "";

  const rows = await getReportingRows({
    admin,
    shopDomain: session.shop,
    query: q,
    sort,
  });

  const header = ["title", "sku", "inventory", "users", "bought", "purchased_users", "purchased_count", "purchased_times"].join(",");
  const lines = rows.map((row) => {
    const users = row.users.join(";");
    const purchasedUsers = row.purchasedUsers.join(";");
    return [
      `"${row.title.replace(/"/g, '""')}"`,
      `"${(row.sku || "").replace(/"/g, '""')}"`,
      row.inventory ?? "",
      `"${users.replace(/"/g, '""')}"`,
      row.bought ? "yes" : "no",
      `"${purchasedUsers.replace(/"/g, '""')}"`,
      row.purchasedCount,
      row.purchasedTimes,
    ].join(",");
  });
  const csv = [header, ...lines].join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=wishlist-report.csv",
    },
  });
};
