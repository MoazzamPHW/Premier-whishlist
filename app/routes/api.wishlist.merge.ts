import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import type {
  MergeWishlistRequest,
  WishlistItem,
} from "../types/wishlist";
import { corsResponse, handleCorsPreflight } from "../utils/cors.server";
import { getOrCreateCustomerForShopifyId } from "../utils/wishlist.server";

// Handle OPTIONS preflight requests
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;
  return corsResponse({ message: "Method not allowed" }, request, { status: 405 });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const body = (await request.json()) as MergeWishlistRequest;
    const { customerId: shopifyCustomerId, guestItems } = body;
    if (!shopifyCustomerId || !Array.isArray(guestItems)) {
      return corsResponse(
        { wishlist: [], error: "Missing customerId or guestItems" },
        request,
        { status: 400 },
      );
    }

    // Map Shopify customer ID to our internal Customer + Shop
    const { shop, customer } =
      await getOrCreateCustomerForShopifyId(shopifyCustomerId);

    // Find or create default wishlist for user
    let wishlist = await prisma.wishlist.findFirst({
      where: { customerId: customer.id, isDefault: true },
      include: {
        items: {
          where: { purchasedAt: null },
        },
      },
    });
    if (!wishlist) {
      wishlist = await prisma.wishlist.create({
        data: {
          name: "Default Wishlist",
          customerId: customer.id,
          isDefault: true,
          shopId: shop.id,
          shareToken: crypto.randomUUID(),
        },
        include: {
          items: {
            where: { purchasedAt: null },
          },
        },
      });
    }

    const combinedItems = guestItems.map((item) => ({
      productId: String(item.productId),
      variantId:
        item.variantId === undefined || item.variantId === null
          ? null
          : String(item.variantId),
    }));

    // Gather productIds/variantIds already present
    const existingItems = wishlist.items;
    for (const guestItem of combinedItems) {
      const normalizedProductId = String(guestItem.productId);
      const normalizedVariantId =
        guestItem.variantId === undefined || guestItem.variantId === null
          ? null
          : String(guestItem.variantId);
      const isDuplicate = existingItems.some(
        (item: { productId: string; variantId: string | null }) =>
          item.productId === normalizedProductId &&
          (item.variantId || null) === normalizedVariantId,
      );
      if (!isDuplicate) {
        const purchasedExisting = await prisma.wishlistItem.findFirst({
          where: {
            wishlistId: wishlist.id,
            productId: normalizedProductId,
            variantId: normalizedVariantId,
            purchasedAt: { not: null },
          },
        });
        if (purchasedExisting) {
          await prisma.wishlistItem.update({
            where: { id: purchasedExisting.id },
            data: {
              purchasedAt: null,
              purchasedOrderId: null,
              addedAt: new Date(),
            },
          });
        } else {
          await prisma.wishlistItem.create({
            data: {
              wishlistId: wishlist.id,
              productId: normalizedProductId,
              variantId: normalizedVariantId,
            },
          });
        }
      }
    }

    // Refetch updated list
    const updated = await prisma.wishlist.findUnique({
      where: { id: wishlist.id },
      include: {
        items: {
          where: { purchasedAt: null },
        },
      },
    });
    const items: WishlistItem[] = (updated?.items ?? []).map(
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

    return corsResponse({ wishlist: items, example: items }, request);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return corsResponse(
      { wishlist: [], error: errorMessage },
      request,
      { status: 500 },
    );
  }
};
