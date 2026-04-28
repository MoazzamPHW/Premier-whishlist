import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import type { WishlistItem } from "../types/wishlist";
import { corsResponse, handleCorsPreflight } from "../utils/cors.server";
import { getOrCreateCustomerForShopifyId } from "../utils/wishlist.server";

// Handle OPTIONS preflight requests
export const action = async ({ request }: ActionFunctionArgs) => {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;
  return corsResponse({ message: "Method not allowed" }, request, { status: 405 });
};

// GET /api/wishlist?customerId=xxx
export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const url = new URL(request.url);
    const shopifyCustomerId = url.searchParams.get("customerId");
    const customerEmail = url.searchParams.get("email");
    const shopDomain = url.searchParams.get("shop");
    let wishlistItems: WishlistItem[] = [];

    if (shopifyCustomerId) {
      const { customer } = await getOrCreateCustomerForShopifyId(
        shopifyCustomerId,
        undefined,
        shopDomain,
      );
      // Find the default wishlist for the customer
      const wishlist = await prisma.wishlist.findFirst({
        where: { customerId: customer.id, isDefault: true },
        include: { items: true },
      });
      wishlistItems = (wishlist?.items ?? []).map(
        (item: {
          id: string;
          productId: string;
          variantId: string | null;
          addedAt: Date;
        }) => ({
          id: item.id,
          productId: item.productId,
          variantId: item.variantId,
          addedAt: item.addedAt.toISOString(),
        }),
      );
    } else if (customerEmail) {
      const normalizedEmail = customerEmail.trim().toLowerCase();
      const shop = shopDomain
        ? await prisma.shop.findUnique({ where: { shopDomain } })
        : await prisma.shop.findFirst();

      if (!shop) {
        return corsResponse(
          { wishlist: [], example: [], error: "Shop not found" },
          request,
          { status: 404 },
        );
      }

      const customer = await prisma.customer.findFirst({
        where: {
          shopId: shop.id,
          email: { equals: normalizedEmail, mode: "insensitive" },
        },
      });

      if (customer) {
        const wishlist = await prisma.wishlist.findFirst({
          where: { customerId: customer.id, isDefault: true },
          include: { items: true },
        });
        wishlistItems = (wishlist?.items ?? []).map((item) => ({
          id: item.id,
          productId: item.productId,
          variantId: item.variantId,
          addedAt: item.addedAt.toISOString(),
        }));
      }
    } else {
      return corsResponse(
        { wishlist: [], example: [], error: "Missing customerId or email" },
        request,
        { status: 400 },
      );
    }

    return corsResponse({ wishlist: wishlistItems, example: wishlistItems }, request);
  } catch (error: unknown) {
    return corsResponse({ wishlist: [], example: [] }, request);
  }
};
