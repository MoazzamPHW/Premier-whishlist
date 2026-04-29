import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

type OrderWebhookPayload = {
  id?: number | string;
  email?: string | null;
  customer?: {
    id?: number | string | null;
    email?: string | null;
  } | null;
  line_items?: Array<{
    product_id?: number | string | null;
    variant_id?: number | string | null;
  }>;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, topic, shop } = await authenticate.webhook(request);
  console.log(`[PW][webhook] Received ${topic} for ${shop}`);

  const order = payload as OrderWebhookPayload;
  const orderId = order?.id ? String(order.id) : null;
  const customerId = order?.customer?.id ? String(order.customer.id) : null;
  const customerEmail = (order?.customer?.email || order?.email || "").trim().toLowerCase();
  const lineItems = Array.isArray(order?.line_items) ? order.line_items : [];

  const normalizedItems = lineItems
    .map((line) => ({
      productId: line?.product_id ? String(line.product_id) : null,
      variantId: line?.variant_id ? String(line.variant_id) : null,
    }))
    .filter((line) => !!line.productId);

  if (!normalizedItems.length) {
    console.log("[PW][webhook.orders.create] no product line items");
    return new Response();
  }

  const shopRow = await db.shop.findUnique({ where: { shopDomain: shop } });
  if (!shopRow) {
    console.log("[PW][webhook.orders.create] shop not found in DB");
    return new Response();
  }

  let customer = null;
  if (customerId) {
    customer = await db.customer.findFirst({
      where: {
        shopId: shopRow.id,
        shopifyCustomerId: customerId,
      },
    });
  }
  if (!customer && customerEmail) {
    customer = await db.customer.findFirst({
      where: {
        shopId: shopRow.id,
        email: { equals: customerEmail, mode: "insensitive" },
      },
    });
  }

  if (!customer) {
    console.log("[PW][webhook.orders.create] customer not found", {
      shop,
      customerId,
      customerEmail: customerEmail || null,
    });
    return new Response();
  }

  const wishlist = await db.wishlist.findFirst({
    where: {
      shopId: shopRow.id,
      customerId: customer.id,
      isDefault: true,
    },
  });
  if (!wishlist) {
    console.log("[PW][webhook.orders.create] default wishlist not found");
    return new Response();
  }

  const productIds = Array.from(
    new Set(
      normalizedItems
        .map((entry) => entry.productId)
        .filter((value): value is string => !!value),
    ),
  );
  const variantIds = Array.from(
    new Set(
      normalizedItems
        .map((entry) => entry.variantId)
        .filter((value): value is string => !!value),
    ),
  );

  const candidates = await db.wishlistItem.findMany({
    where: {
      wishlistId: wishlist.id,
      purchasedAt: null,
      productId: { in: productIds },
    },
  });

  const toUpdateIds = candidates
    .filter((item) => {
      const variantMatch = normalizedItems.some(
        (line) =>
          line.productId === item.productId &&
          line.variantId &&
          item.variantId &&
          line.variantId === item.variantId,
      );
      if (variantMatch) return true;

      const productOnlyMatch = normalizedItems.some(
        (line) =>
          line.productId === item.productId &&
          (!line.variantId || !item.variantId),
      );
      return productOnlyMatch;
    })
    .map((item) => item.id);

  if (!toUpdateIds.length) {
    console.log("[PW][webhook.orders.create] no matching wishlist items");
    return new Response();
  }

  const updates = await db.$transaction(
    toUpdateIds.map((id) =>
      db.wishlistItem.update({
        where: { id },
        data: {
          purchasedAt: new Date(),
          purchasedOrderId: orderId,
          purchaseCount: { increment: 1 },
        },
      }),
    ),
  );

  console.log("[PW][webhook.orders.create] marked purchased", {
    orderId,
    updatedCount: updates.length,
    customerId: customer.id,
    matchedVariants: variantIds.length,
  });

  return new Response();
};
