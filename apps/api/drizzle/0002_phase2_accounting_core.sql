-- Phase 2: Core Accounting Schema
-- Drop old transactions table (replaced by journal_entries + journal_lines)

DROP TABLE IF EXISTS "documents";
DROP TABLE IF EXISTS "transactions";

-- Add new enums
DO $$ BEGIN
  CREATE TYPE "public"."account_type" AS ENUM('asset', 'liability', 'equity', 'revenue', 'expense');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."currency" AS ENUM('GEL', 'USD', 'EUR', 'GBP', 'TRY', 'RUB');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."journal_status" AS ENUM('draft', 'posted', 'voided');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Alter companies: add base_currency
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "base_currency" "currency" NOT NULL DEFAULT 'GEL';

-- Recreate accounts table with hierarchy
DROP TABLE IF EXISTS "accounts";
CREATE TABLE "accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" text NOT NULL,
  "name" text NOT NULL,
  "name_ka" text NOT NULL,
  "type" "account_type" NOT NULL,
  "parent_id" uuid,
  "level" integer NOT NULL DEFAULT 1,
  "is_group" boolean NOT NULL DEFAULT false,
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "is_active" boolean NOT NULL DEFAULT true
);

CREATE INDEX "accounts_company_code_idx" ON "accounts" ("company_id", "code");
CREATE INDEX "accounts_parent_idx" ON "accounts" ("parent_id");

-- Journal entries
CREATE TABLE "journal_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entry_number" text NOT NULL,
  "date" timestamp NOT NULL,
  "description" text NOT NULL,
  "status" "journal_status" NOT NULL DEFAULT 'draft',
  "currency" "currency" NOT NULL DEFAULT 'GEL',
  "exchange_rate" decimal(12, 6) NOT NULL DEFAULT '1.000000',
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "created_by_id" text NOT NULL REFERENCES "user"("id"),
  "posted_by_id" text REFERENCES "user"("id"),
  "posted_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "je_company_date_idx" ON "journal_entries" ("company_id", "date");
CREATE INDEX "je_company_number_idx" ON "journal_entries" ("company_id", "entry_number");

-- Journal lines
CREATE TABLE "journal_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "journal_entry_id" uuid NOT NULL REFERENCES "journal_entries"("id") ON DELETE CASCADE,
  "account_id" uuid NOT NULL REFERENCES "accounts"("id"),
  "description" text,
  "debit" decimal(15, 2) NOT NULL DEFAULT '0.00',
  "credit" decimal(15, 2) NOT NULL DEFAULT '0.00',
  "company_id" uuid NOT NULL REFERENCES "companies"("id")
);

CREATE INDEX "jl_entry_idx" ON "journal_lines" ("journal_entry_id");
CREATE INDEX "jl_account_idx" ON "journal_lines" ("account_id");
CREATE INDEX "jl_company_idx" ON "journal_lines" ("company_id");

-- Recreate documents with journal_entry reference
CREATE TABLE "documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "file_name" text NOT NULL,
  "file_url" text NOT NULL,
  "mime_type" text NOT NULL,
  "journal_entry_id" uuid REFERENCES "journal_entries"("id"),
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "uploaded_by_id" text NOT NULL REFERENCES "user"("id"),
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "docs_company_idx" ON "documents" ("company_id");

-- Audit log
CREATE TABLE "audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "table_name" text NOT NULL,
  "record_id" text NOT NULL,
  "action" text NOT NULL CHECK ("action" IN ('INSERT', 'UPDATE', 'DELETE')),
  "old_data" jsonb,
  "new_data" jsonb,
  "company_id" uuid REFERENCES "companies"("id"),
  "user_id" text REFERENCES "user"("id"),
  "ip_address" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "audit_table_record_idx" ON "audit_log" ("table_name", "record_id");
CREATE INDEX "audit_company_idx" ON "audit_log" ("company_id");
CREATE INDEX "audit_created_idx" ON "audit_log" ("created_at");

-- ==================== CHECK CONSTRAINT ====================
-- Ensure each line has either debit OR credit, not both
ALTER TABLE "journal_lines"
  ADD CONSTRAINT "jl_debit_or_credit_check"
  CHECK (("debit" > 0 AND "credit" = 0) OR ("debit" = 0 AND "credit" > 0));

-- ==================== AUDIT TRIGGER ====================
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, record_id, action, new_data, company_id)
    VALUES (TG_TABLE_NAME, NEW.id::text, 'INSERT', to_jsonb(NEW),
            CASE WHEN TG_TABLE_NAME IN ('journal_entries', 'journal_lines', 'accounts', 'documents')
                 THEN NEW.company_id ELSE NULL END);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, company_id)
    VALUES (TG_TABLE_NAME, NEW.id::text, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW),
            CASE WHEN TG_TABLE_NAME IN ('journal_entries', 'journal_lines', 'accounts', 'documents')
                 THEN NEW.company_id ELSE NULL END);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, company_id)
    VALUES (TG_TABLE_NAME, OLD.id::text, 'DELETE', to_jsonb(OLD),
            CASE WHEN TG_TABLE_NAME IN ('journal_entries', 'journal_lines', 'accounts', 'documents')
                 THEN OLD.company_id ELSE NULL END);
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to core tables
CREATE TRIGGER audit_journal_entries AFTER INSERT OR UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_journal_lines AFTER INSERT OR UPDATE OR DELETE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_accounts AFTER INSERT OR UPDATE OR DELETE ON accounts
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_documents AFTER INSERT OR UPDATE OR DELETE ON documents
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- ==================== ROW-LEVEL SECURITY ====================
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policies: isolate by company_id via session variable
CREATE POLICY accounts_company_isolation ON accounts
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

CREATE POLICY je_company_isolation ON journal_entries
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

CREATE POLICY jl_company_isolation ON journal_lines
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

CREATE POLICY docs_company_isolation ON documents
  USING (company_id = current_setting('app.current_company_id', true)::uuid);

CREATE POLICY audit_company_isolation ON audit_log
  USING (company_id = current_setting('app.current_company_id', true)::uuid);
