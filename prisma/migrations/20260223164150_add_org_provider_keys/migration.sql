-- CreateTable
CREATE TABLE "OrgProviderKey" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Default',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgProviderKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgProviderKey_organizationId_idx" ON "OrgProviderKey"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgProviderKey_organizationId_provider_key" ON "OrgProviderKey"("organizationId", "provider");

-- AddForeignKey
ALTER TABLE "OrgProviderKey" ADD CONSTRAINT "OrgProviderKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
