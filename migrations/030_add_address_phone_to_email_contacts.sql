-- Migration: Add address and phone number fields to email_contacts table
-- Description: Adds optional customer address (address, city, state, zip_code, country) and phone_number fields

ALTER TABLE email_contacts
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS zip_code TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Add comments for documentation
COMMENT ON COLUMN email_contacts.address IS 'Customer street address';
COMMENT ON COLUMN email_contacts.city IS 'Customer city';
COMMENT ON COLUMN email_contacts.state IS 'Customer state/province';
COMMENT ON COLUMN email_contacts.zip_code IS 'Customer zip/postal code';
COMMENT ON COLUMN email_contacts.country IS 'Customer country';
COMMENT ON COLUMN email_contacts.phone_number IS 'Customer telephone number';
