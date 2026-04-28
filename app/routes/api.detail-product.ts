import type { LoaderFunctionArgs } from "react-router";
import { sessionStorage } from "../shopify.server";
import { corsResponse, handleCorsPreflight } from "../utils/cors.server";
import prisma from "../db.server";

function inferShopFromRequest(request: Request): string | null {
  const direct = request.headers.get("x-shopify-shop-domain");
  if (direct) return direct;

  const origin = request.headers.get("Origin");
  if (origin) {
    try {
      const host = new URL(origin).host;
      if (host.endsWith(".myshopify.com")) return host;
    } catch {
      // ignore
    }
  }

  const referer = request.headers.get("Referer");
  if (referer) {
    try {
      const host = new URL(referer).host;
      if (host.endsWith(".myshopify.com")) return host;
    } catch {
      // ignore
    }
  }

  return null;
}

// Detail endpoint to fetch a product via Admin GraphQL API.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;

  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");
  const shop = url.searchParams.get("shop") || inferShopFromRequest(request);
  console.log("[PW][api.detail-product] incoming", {
    productId: productId || null,
    shop: shop || null,
  });
  if (!productId) {
    return corsResponse({ error: "Missing productId" }, request, { status: 400 });
  }
  if (!shop) {
    return corsResponse({ error: "Missing shop" }, request, { status: 400 });
  }

  const offlineSessionId = `offline_${shop}`;
  const offlineSession = await sessionStorage.loadSession(offlineSessionId);
  const sessions = await sessionStorage.findSessionsByShop(shop);
  const fallbackSession =
    sessions.find((entry) => entry.id?.startsWith("offline_")) ||
    sessions[0];
  const shopRow = await prisma.shop.findUnique({ where: { shopDomain: shop } });
  const accessToken =
    offlineSession?.accessToken || fallbackSession?.accessToken;
  const resolvedAccessToken = accessToken || shopRow?.accessToken;
  if (!resolvedAccessToken) {
    return corsResponse(
      { error: "Missing access token for shop" },
      request,
      { status: 401 },
    );
  }

  const gid = `gid://shopify/Product/${productId}`;
  const response = await fetch(
    `https://${shop}/admin/api/2024-01/graphql.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": resolvedAccessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `#graphql
          query DetailProduct($id: ID!) {
            product(id: $id) {
              id
              title
              handle
              status
              totalInventory
              featuredImage { url altText }
              variants(first: 5) {
                edges {
                  node {
                    id
                    title
                    price
                    inventoryQuantity
                  }
                }
              }
            }
          }`,
        variables: { id: gid },
      }),
    },
  );

  const data = await response.json();
  console.log("[PW][api.detail-product] response", {
    productId,
    shop,
    status: response.status,
    hasProduct: !!data?.data?.product,
  });

  return corsResponse({ status: response.status, data }, request, {
    status: 200,
  });
};
