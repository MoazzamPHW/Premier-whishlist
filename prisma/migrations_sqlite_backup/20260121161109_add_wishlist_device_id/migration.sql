-- AlterTable
ALTER TABLE "Wishlist" ADD COLUMN "deviceId" TEXT;

-- CreateIndex
CREATE INDEX "Wishlist_deviceId_idx" ON "Wishlist"("deviceId");

-- CreateIndex
CREATE INDEX "Wishlist_shopId_deviceId_idx" ON "Wishlist"("shopId", "deviceId");
