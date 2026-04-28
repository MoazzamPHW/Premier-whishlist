import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import type {
  AddToWishlistRequest,
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
    const body = (await request.json()) as AddToWishlistRequest;
    const {
      customerId: shopifyCustomerId,
      productId,
      variantId,
      email,
      shopDomain,
    } = body;
    console.log("[PW][api.wishlist.add] incoming", {
      hasCustomerId: !!shopifyCustomerId,
      hasEmail: !!email,
      productId: productId ? String(productId) : null,
      variantId: variantId ? String(variantId) : null,
      shopDomain: shopDomain || null,
    });
    if (!productId) {
      return corsResponse(
        { success: false, error: "Missing productId" },
        request,
        { status: 400 },
      );
    }
    const normalizedProductId = String(productId);
    const normalizedVariantId =
      variantId === undefined || variantId === null
        ? null
        : String(variantId);
    if (!normalizedVariantId) {
      return corsResponse(
        { success: false, error: "Missing variantId" },
        request,
        { status: 400 },
      );
    }

    if (!shopifyCustomerId) {
      return corsResponse(
        { success: false, error: "Missing customerId" },
        request,
        { status: 400 },
      );
    }

    let wishlist;
    if (shopifyCustomerId) {
      // Map Shopify customer ID to our internal Customer + Shop
      const { shop, customer } = await getOrCreateCustomerForShopifyId(
        shopifyCustomerId,
        email,
        shopDomain,
      );

      // Find customer's default wishlist or create it
      wishlist = await prisma.wishlist.findFirst({
        where: {
          customerId: customer.id,
          isDefault: true,
        },
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
    }

    if (!wishlist) {
      return corsResponse(
        { success: false, error: "Failed to resolve wishlist" },
        request,
        { status: 500 },
      );
    }

    // Prevent duplicates per wishlist
    const existing = await prisma.wishlistItem.findFirst({
      where: {
        wishlistId: wishlist.id,
        productId: normalizedProductId,
        variantId: normalizedVariantId,
        purchasedAt: null,
      },
    });
    if (existing) {
      console.log("[PW][api.wishlist.add] duplicate-hit", { wishlistItemId: existing.id });
      return corsResponse({
        success: true,
        wishlistItemId: existing.id,
        example: { id: existing.id },
      }, request);
    }

    const purchasedExisting = await prisma.wishlistItem.findFirst({
      where: {
        wishlistId: wishlist.id,
        productId: normalizedProductId,
        variantId: normalizedVariantId,
        purchasedAt: { not: null },
      },
    });
    if (purchasedExisting) {
      const reactivated = await prisma.wishlistItem.update({
        where: { id: purchasedExisting.id },
        data: {
          purchasedAt: null,
          purchasedOrderId: null,
          addedAt: new Date(),
        },
      });
      console.log("[PW][api.wishlist.add] reactivated-purchased", {
        wishlistItemId: reactivated.id,
      });
      return corsResponse({
        success: true,
        wishlistItemId: reactivated.id,
        example: { id: reactivated.id },
      }, request);
    }

    const newItem = await prisma.wishlistItem.create({
      data: {
        wishlistId: wishlist.id,
        productId: normalizedProductId,
        variantId: normalizedVariantId,
      },
    });
    console.log("[PW][api.wishlist.add] created", { wishlistItemId: newItem.id });

    // Example data for dev/front
    const example: WishlistItem = {
      id: newItem.id,
      productId: normalizedProductId,
      variantId: newItem.variantId || undefined,
      addedAt: newItem.addedAt.toISOString(),
    };

    return corsResponse({
      success: true,
      wishlistItemId: newItem.id,
      example,
    }, request);
  } catch (error: unknown) {
    console.error("[PW][api.wishlist.add] failed", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return corsResponse(
      { success: false, error: errorMessage },
      request,
      { status: 500 },
    );
  }
};
