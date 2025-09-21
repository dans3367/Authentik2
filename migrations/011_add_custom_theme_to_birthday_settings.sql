-- Add custom theme data fields to birthday_settings table
ALTER TABLE birthday_settings 
ADD COLUMN custom_theme_data TEXT DEFAULT NULL;

-- Add comment to document the new field
COMMENT ON COLUMN birthday_settings.custom_theme_data IS 'JSON data for custom theme including title, message, signature, imageUrl, imagePosition, imageScale, etc.';

-- Update existing records to have default custom_theme_data if they have customMessage
UPDATE birthday_settings 
SET custom_theme_data = JSON_BUILD_OBJECT(
  'title', '',
  'message', custom_message,
  'signature', '',
  'imageUrl', null,
  'customImage', false,
  'imagePosition', JSON_BUILD_OBJECT('x', 0, 'y', 0),
  'imageScale', 1
)::text
WHERE custom_message IS NOT NULL AND custom_message != '';
