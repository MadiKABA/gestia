-- CreateEnum
CREATE TYPE "OtpChannel" AS ENUM ('PHONE', 'EMAIL');

-- AlterTable: otp_codes.phone -> identifier (rename preserves existing rows),
-- + channel backfillé à PHONE (tous les OTP existants ont été envoyés par SMS).
ALTER TABLE "otp_codes" RENAME COLUMN "phone" TO "identifier";
ALTER TABLE "otp_codes" ADD COLUMN "channel" "OtpChannel" NOT NULL DEFAULT 'PHONE';
ALTER TABLE "otp_codes" ALTER COLUMN "channel" DROP DEFAULT;

-- DropIndex
DROP INDEX "otp_codes_phone_purpose_idx";

-- CreateIndex
CREATE INDEX "otp_codes_identifier_channel_purpose_idx" ON "otp_codes"("identifier", "channel", "purpose");

-- AlterTable: users.email devient un identifiant de connexion secondaire (unique quand renseigné)
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
