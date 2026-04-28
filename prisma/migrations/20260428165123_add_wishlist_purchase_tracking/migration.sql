-- AlterTable
ALTER TABLE "WishlistItem" ADD COLUMN     "purchasedAt" TIMESTAMP(3),
ADD COLUMN     "purchasedOrderId" TEXT;

-- CreateIndex
CREATE INDEX "WishlistItem_purchasedAt_idx" ON "WishlistItem"("purchasedAt");
