# Birthday Unsubscribe Page - Multi-Language Support

## Overview
This document outlines the implementation of multi-language support for birthday unsubscribe pages.

## Implementation Status
✅ Translation file created: `/cardprocessor-go/internal/i18n/translations.go`
⏳ Handler updates pending manual review

## Supported Languages
- **en** - English (default)
- **es** - Spanish
- **fr** - French  
- **de** - German

## Translation File Structure

Location: `/cardprocessor-go/internal/i18n/translations.go`

The translation system includes:
1. **Translations struct** - Holds all translatable strings
2. **SupportedLanguages map** - Maps language codes to translations
3. **GetTranslations()** - Returns translations for a given language code
4. **DetectLanguage()** - Detects language from Accept-Language header

## Usage in Handlers

### 1. Add Import
```go
import (
    "cardprocessor-go/internal/i18n"
)
```

### 2. Detect Language
```go
// In each handler function:
lang := c.Query("lang")  // Allow manual override via ?lang=es
if lang == "" {
    acceptLang := c.GetHeader("Accept-Language")
    lang = i18n.DetectLanguage(acceptLang)
}
t := i18n.GetTranslations(lang)
```

### 3. Use Translations in Responses
```go
// Error example:
c.HTML(http.StatusBadRequest, "unsubscribe_error.html", gin.H{
    "ErrorMessage": t.TokenMissingError,
    "ErrorTitle":   t.ErrorTitle,
    "ErrorHeading": t.ErrorHeading,
    "Lang":         lang,
})

// Success example:
c.HTML(http.StatusOK, "unsubscribe_success.html", gin.H{
    "Message":        t.UnsubscribeSuccessMessage,
    "SuccessTitle":   t.SuccessTitle,
    "SuccessHeading": t.SuccessHeading,
    "Lang":           lang,
    "Translations":   t,  // Pass entire struct for template use
})
```

## Functions to Update

### ShowBirthdayUnsubscribePage
- Add language detection at function start
- Replace hardcoded error messages with `t.TokenMissingError`, `t.ProcessingError`, etc.
- Add `Lang` and `Translations` to all gin.H maps

### ProcessBirthdayUnsubscribe
- Add language detection (check query, form, and header)
- Replace hardcoded error messages
- Add `Lang` and `Translations` to responses

### ProcessBirthdayResubscribe
- Add language detection
- Replace hardcoded messages with `t.ResubscribeSuccessMessage`
- Add `Lang` and `Translations` to responses

## URL Examples

```
# Auto-detect from browser:
/api/unsubscribe/birthday?token=abc123

# Force Spanish:
/api/unsubscribe/birthday?token=abc123&lang=es

# Force French:
/api/unsubscribe/birthday?token=abc123&lang=fr

# Force German:
/api/unsubscribe/birthday?token=abc123&lang=de
```

## Testing

1. **English (default)**:
   ```bash
   curl http://localhost:5004/api/unsubscribe/birthday?token=TEST_TOKEN
   ```

2. **Spanish**:
   ```bash
   curl http://localhost:5004/api/unsubscribe/birthday?token=TEST_TOKEN&lang=es
   ```

3. **French**:
   ```bash
   curl -H "Accept-Language: fr-FR" http://localhost:5004/api/unsubscribe/birthday?token=TEST_TOKEN
   ```

4. **German**:
   ```bash
   curl -H "Accept-Language: de-DE" http://localhost:5004/api/unsubscribe/birthday?token=TEST_TOKEN
   ```

## HTML Template Updates (Optional)

If you want to update the HTML templates to use the translations:

```html
<!-- In unsubscribe.html -->
<h1>{{.Translations.UnsubscribeHeading}}</h1>
<p>{{.Translations.UnsubscribeMessage}}</p>

<!-- In unsubscribe_success.html -->
<title>{{.SuccessTitle}}</title>
<h1>{{.SuccessHeading}}</h1>
<p>{{.Message}}</p>

<!-- In unsubscribe_error.html -->
<title>{{.ErrorTitle}}</title>
<h1>{{.ErrorHeading}}</h1>
<p>{{.ErrorMessage}}</p>
```

## Adding New Languages

To add a new language (e.g., Italian "it"):

1. Open `/cardprocessor-go/internal/i18n/translations.go`
2. Add new entry to `SupportedLanguages` map:
   ```go
   "it": {
       UnsubscribeTitle: "Annulla l'iscrizione alle Cartoline di Compleanno",
       // ... all other fields
   },
   ```
3. Update `DetectLanguage()` to include "it" in the loop
4. Rebuild: `go build -o cardprocessor-go main.go`

## Benefits

- ✅ **User Experience**: Users see messages in their preferred language
- ✅ **Compliance**: Better adherence to regional regulations
- ✅ **Accessibility**: Reaches wider audience
- ✅ **Maintainability**: Centralized translations
- ✅ **Extensibility**: Easy to add new languages

## Next Steps

1. Manually update the handler functions in `birthday.go`
2. Test with different language codes
3. Update HTML templates if needed
4. Add more languages as required
5. Consider adding language selector UI on unsubscribe page
