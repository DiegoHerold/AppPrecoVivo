/*
  Warnings:

  - You are about to drop the column `categoryId` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `categoryId` on the `PurchaseItem` table. All the data in the column will be lost.
  - You are about to drop the column `productAccountId` on the `PurchaseItem` table. All the data in the column will be lost.
  - You are about to drop the `Category` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProductAccount` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `planoContaId` to the `PurchaseItem` table without a default value. This is not possible if the table is not empty.
  - Made the column `productId` on table `PurchaseItem` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "PlanoContaTipo" AS ENUM ('GRUPO', 'PRODUTO');

-- Remove triggers/funções do modelo antigo (ProductAccount) que dependem de
-- Product.categoryId e da tabela ProductAccount. CASCADE remove os triggers associados.
DROP FUNCTION IF EXISTS sync_product_account_from_product() CASCADE;
DROP FUNCTION IF EXISTS normalize_product_account() CASCADE;
DROP FUNCTION IF EXISTS ensure_product_account_exists() CASCADE;

-- CHECK constraint manual que referencia productAccountId/productId.
ALTER TABLE "PurchaseItem" DROP CONSTRAINT IF EXISTS "PurchaseItem_product_account_required";

-- DropForeignKey
ALTER TABLE "Category" DROP CONSTRAINT "Category_parentId_fkey";

-- DropForeignKey
ALTER TABLE "Category" DROP CONSTRAINT "Category_userId_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "ProductAccount" DROP CONSTRAINT "ProductAccount_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "ProductAccount" DROP CONSTRAINT "ProductAccount_productId_fkey";

-- DropForeignKey
ALTER TABLE "ProductAccount" DROP CONSTRAINT "ProductAccount_userId_fkey";

-- DropForeignKey
ALTER TABLE "PurchaseItem" DROP CONSTRAINT "PurchaseItem_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "PurchaseItem" DROP CONSTRAINT "PurchaseItem_productAccountId_productId_fkey";

-- DropForeignKey
ALTER TABLE "PurchaseItem" DROP CONSTRAINT "PurchaseItem_productId_fkey";

-- DropIndex
DROP INDEX "Product_userId_categoryId_idx";

-- DropIndex
DROP INDEX "PurchaseItem_productAccountId_idx";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "categoryId";

-- AlterTable
ALTER TABLE "PurchaseItem" DROP COLUMN "categoryId",
DROP COLUMN "productAccountId",
ADD COLUMN     "planoContaId" TEXT NOT NULL,
ALTER COLUMN "productId" SET NOT NULL;

-- DropTable
DROP TABLE "Category";

-- DropTable
DROP TABLE "ProductAccount";

-- DropEnum
DROP TYPE "AccountPlanType";

-- CreateTable
CREATE TABLE "PlanoConta" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "PlanoContaTipo" NOT NULL,
    "parentId" TEXT,
    "produtoId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "icone" TEXT NOT NULL DEFAULT '📁',
    "cor" TEXT NOT NULL DEFAULT '#635BFF',
    "allowedUnits" TEXT[] DEFAULT ARRAY['un', 'pct', 'cx']::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanoConta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanoConta_produtoId_key" ON "PlanoConta"("produtoId");

-- CreateIndex
CREATE INDEX "PlanoConta_userId_parentId_ativo_idx" ON "PlanoConta"("userId", "parentId", "ativo");

-- CreateIndex
CREATE INDEX "PlanoConta_userId_tipo_ativo_idx" ON "PlanoConta"("userId", "tipo", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "PlanoConta_id_produtoId_key" ON "PlanoConta"("id", "produtoId");

-- CreateIndex
CREATE INDEX "Product_userId_active_idx" ON "Product"("userId", "active");

-- CreateIndex
CREATE INDEX "PurchaseItem_planoContaId_idx" ON "PurchaseItem"("planoContaId");

-- AddForeignKey
ALTER TABLE "PlanoConta" ADD CONSTRAINT "PlanoConta_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanoConta" ADD CONSTRAINT "PlanoConta_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PlanoConta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanoConta" ADD CONSTRAINT "PlanoConta_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_planoContaId_productId_fkey" FOREIGN KEY ("planoContaId", "productId") REFERENCES "PlanoConta"("id", "produtoId") ON DELETE RESTRICT ON UPDATE CASCADE;
