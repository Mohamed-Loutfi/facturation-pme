-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "entreprise" (
    "id" UUID NOT NULL,
    "raison_sociale" TEXT NOT NULL,
    "forme_juridique" TEXT,
    "ice" VARCHAR(15) NOT NULL,
    "if_fiscal" TEXT NOT NULL,
    "rc" TEXT NOT NULL,
    "rc_ville" TEXT,
    "tp" TEXT,
    "cnss" TEXT,
    "adresse" TEXT NOT NULL,
    "ville" TEXT NOT NULL,
    "telephone" TEXT,
    "email" TEXT,
    "capital_social" DECIMAL(14,2),
    "logo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entreprise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utilisateur" (
    "id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mot_de_passe_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client" (
    "id" UUID NOT NULL,
    "type_client" TEXT NOT NULL DEFAULT 'entreprise',
    "nom_raison_sociale" TEXT NOT NULL,
    "ice" VARCHAR(15),
    "if_fiscal" TEXT,
    "rc" TEXT,
    "adresse" TEXT,
    "ville" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compteur_facture" (
    "annee" INTEGER NOT NULL,
    "dernier_numero" INTEGER NOT NULL DEFAULT 0,
    "prefixe" TEXT NOT NULL DEFAULT 'FACT',

    CONSTRAINT "compteur_facture_pkey" PRIMARY KEY ("annee")
);

-- CreateTable
CREATE TABLE "compteur_avoir" (
    "annee" INTEGER NOT NULL,
    "dernier_numero" INTEGER NOT NULL DEFAULT 0,
    "prefixe" TEXT NOT NULL DEFAULT 'AV',

    CONSTRAINT "compteur_avoir_pkey" PRIMARY KEY ("annee")
);

-- CreateTable
CREATE TABLE "compteur_devis" (
    "annee" INTEGER NOT NULL,
    "dernier_numero" INTEGER NOT NULL DEFAULT 0,
    "prefixe" TEXT NOT NULL DEFAULT 'DEV',

    CONSTRAINT "compteur_devis_pkey" PRIMARY KEY ("annee")
);

-- CreateTable
CREATE TABLE "facture" (
    "id" UUID NOT NULL,
    "type_document" TEXT NOT NULL DEFAULT 'facture',
    "numero" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "facture_reference_id" UUID,
    "motif_avoir" TEXT,
    "client_id" UUID NOT NULL,
    "client_snapshot" JSONB NOT NULL,
    "entreprise_snapshot" JSONB NOT NULL,
    "date_emission" DATE,
    "date_echeance" DATE,
    "mode_paiement" TEXT,
    "sous_total_ht" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_tva" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_ttc" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "montant_en_lettres" TEXT,
    "date_validite" DATE,
    "devis_reference_id" UUID,
    "pdf_url" TEXT,
    "pdf_hash_sha256" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emise_at" TIMESTAMP(3),

    CONSTRAINT "facture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "description" TEXT,
    "photo" BYTEA,
    "photo_type" TEXT,
    "unite" TEXT NOT NULL,
    "prix_unitaire_ht" DECIMAL(14,2) NOT NULL,
    "taux_tva" DECIMAL(4,2) NOT NULL DEFAULT 20,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ligne_facture" (
    "id" UUID NOT NULL,
    "facture_id" UUID NOT NULL,
    "article_id" UUID,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "quantite" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "prix_unitaire_ht" DECIMAL(14,2) NOT NULL,
    "taux_tva" DECIMAL(4,2) NOT NULL DEFAULT 20,
    "montant_ht" DECIMAL(14,2) NOT NULL,
    "montant_tva" DECIMAL(14,2) NOT NULL,
    "montant_ttc" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "ligne_facture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "utilisateur_email_key" ON "utilisateur"("email");

-- CreateIndex
CREATE INDEX "client_nom_raison_sociale_idx" ON "client"("nom_raison_sociale");

-- CreateIndex
CREATE UNIQUE INDEX "facture_numero_key" ON "facture"("numero");

-- CreateIndex
CREATE INDEX "facture_client_id_idx" ON "facture"("client_id");

-- CreateIndex
CREATE INDEX "facture_statut_idx" ON "facture"("statut");

-- CreateIndex
CREATE INDEX "facture_date_emission_idx" ON "facture"("date_emission");

-- CreateIndex
CREATE INDEX "facture_type_document_idx" ON "facture"("type_document");

-- CreateIndex
CREATE UNIQUE INDEX "article_reference_key" ON "article"("reference");

-- CreateIndex
CREATE INDEX "article_designation_idx" ON "article"("designation");

-- CreateIndex
CREATE INDEX "ligne_facture_facture_id_idx" ON "ligne_facture"("facture_id");

-- CreateIndex
CREATE UNIQUE INDEX "ligne_facture_facture_id_article_id_key" ON "ligne_facture"("facture_id", "article_id");

-- AddForeignKey
ALTER TABLE "facture" ADD CONSTRAINT "facture_devis_reference_id_fkey" FOREIGN KEY ("devis_reference_id") REFERENCES "facture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facture" ADD CONSTRAINT "facture_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facture" ADD CONSTRAINT "facture_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facture" ADD CONSTRAINT "facture_facture_reference_id_fkey" FOREIGN KEY ("facture_reference_id") REFERENCES "facture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ligne_facture" ADD CONSTRAINT "ligne_facture_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "facture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ligne_facture" ADD CONSTRAINT "ligne_facture_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "article"("id") ON DELETE SET NULL ON UPDATE CASCADE;
