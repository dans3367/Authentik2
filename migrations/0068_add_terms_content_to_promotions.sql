-- Add terms_content column to promotions for legal terms shown via a public blog-style page
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS terms_content TEXT;
