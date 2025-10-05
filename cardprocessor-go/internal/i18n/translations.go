package i18n

// Translations holds all text translations for the application
type Translations struct {
	// Unsubscribe page
	UnsubscribeTitle             string
	UnsubscribeHeading           string
	UnsubscribeMessage           string
	UnsubscribeReason            string
	UnsubscribeReasonPlaceholder string
	UnsubscribeButton            string

	// Success messages
	SuccessTitle               string
	SuccessHeading             string
	UnsubscribeSuccessMessage  string
	AlreadyUnsubscribedMessage string
	ResubscribeSuccessMessage  string
	ResubscribeButton          string

	// Error messages
	ErrorTitle             string
	ErrorHeading           string
	InvalidTokenError      string
	TokenMissingError      string
	TokenNotFoundError     string
	ProcessingError        string
	ContactNotFoundError   string
	AlreadyUsedError       string
	UnsubscribeFailedError string
	InvalidRequestError    string
	TokenRequiredError     string
}

// SupportedLanguages maps language codes to their translations
var SupportedLanguages = map[string]Translations{
	"en": {
		UnsubscribeTitle:             "Unsubscribe from Birthday Cards",
		UnsubscribeHeading:           "🎂 Unsubscribe from Birthday Cards",
		UnsubscribeMessage:           "We're sorry to see you go! If you no longer wish to receive birthday card notifications, you can unsubscribe below.",
		UnsubscribeReason:            "Reason (optional):",
		UnsubscribeReasonPlaceholder: "Tell us why you're unsubscribing...",
		UnsubscribeButton:            "Unsubscribe",

		SuccessTitle:               "Success",
		SuccessHeading:             "✅ Success",
		UnsubscribeSuccessMessage:  "You have been successfully unsubscribed from birthday emails.",
		AlreadyUnsubscribedMessage: "You have already been unsubscribed from birthday emails.",
		ResubscribeSuccessMessage:  "You have been successfully resubscribed to birthday emails.",
		ResubscribeButton:          "Resubscribe",

		ErrorTitle:             "Error",
		ErrorHeading:           "❌ Error",
		InvalidTokenError:      "Invalid unsubscribe link. Token is missing.",
		TokenMissingError:      "Invalid unsubscribe link. Token is missing.",
		TokenNotFoundError:     "Invalid unsubscribe link. Token not found.",
		ProcessingError:        "Failed to process unsubscribe request. Please try again later.",
		ContactNotFoundError:   "Failed to find contact information.",
		AlreadyUsedError:       "This unsubscribe link has already been used.",
		UnsubscribeFailedError: "Failed to unsubscribe from birthday emails.",
		InvalidRequestError:    "Invalid request data.",
		TokenRequiredError:     "Token is required.",
	},
	"es": {
		UnsubscribeTitle:             "Cancelar Suscripción de Tarjetas de Cumpleaños",
		UnsubscribeHeading:           "🎂 Cancelar Suscripción de Tarjetas de Cumpleaños",
		UnsubscribeMessage:           "¡Lamentamos verte partir! Si ya no deseas recibir notificaciones de tarjetas de cumpleaños, puedes cancelar tu suscripción a continuación.",
		UnsubscribeReason:            "Razón (opcional):",
		UnsubscribeReasonPlaceholder: "Cuéntanos por qué cancelas tu suscripción...",
		UnsubscribeButton:            "Cancelar Suscripción",

		SuccessTitle:               "Éxito",
		SuccessHeading:             "✅ Éxito",
		UnsubscribeSuccessMessage:  "Has cancelado exitosamente tu suscripción a correos de cumpleaños.",
		AlreadyUnsubscribedMessage: "Ya has cancelado tu suscripción a correos de cumpleaños.",
		ResubscribeSuccessMessage:  "Te has reincorporado exitosamente a los correos de cumpleaños.",
		ResubscribeButton:          "Reincorporarse",

		ErrorTitle:             "Error",
		ErrorHeading:           "❌ Error",
		InvalidTokenError:      "Enlace de cancelación inválido. Falta el token.",
		TokenMissingError:      "Enlace de cancelación inválido. Falta el token.",
		TokenNotFoundError:     "Enlace de cancelación inválido. Token no encontrado.",
		ProcessingError:        "No se pudo procesar la solicitud de cancelación. Por favor, inténtalo más tarde.",
		ContactNotFoundError:   "No se pudo encontrar la información de contacto.",
		AlreadyUsedError:       "Este enlace de cancelación ya ha sido utilizado.",
		UnsubscribeFailedError: "No se pudo cancelar la suscripción a correos de cumpleaños.",
		InvalidRequestError:    "Datos de solicitud inválidos.",
		TokenRequiredError:     "Se requiere el token.",
	},
	"fr": {
		UnsubscribeTitle:             "Se Désabonner des Cartes d'Anniversaire",
		UnsubscribeHeading:           "🎂 Se Désabonner des Cartes d'Anniversaire",
		UnsubscribeMessage:           "Nous sommes désolés de vous voir partir ! Si vous ne souhaitez plus recevoir de notifications de cartes d'anniversaire, vous pouvez vous désabonner ci-dessous.",
		UnsubscribeReason:            "Raison (optionnel) :",
		UnsubscribeReasonPlaceholder: "Dites-nous pourquoi vous vous désabonnez...",
		UnsubscribeButton:            "Se Désabonner",

		SuccessTitle:               "Succès",
		SuccessHeading:             "✅ Succès",
		UnsubscribeSuccessMessage:  "Vous avez été désabonné avec succès des e-mails d'anniversaire.",
		AlreadyUnsubscribedMessage: "Vous avez déjà été désabonné des e-mails d'anniversaire.",
		ResubscribeSuccessMessage:  "Vous avez été réabonné avec succès aux e-mails d'anniversaire.",
		ResubscribeButton:          "Se Réabonner",

		ErrorTitle:             "Erreur",
		ErrorHeading:           "❌ Erreur",
		InvalidTokenError:      "Lien de désabonnement invalide. Le jeton est manquant.",
		TokenMissingError:      "Lien de désabonnement invalide. Le jeton est manquant.",
		TokenNotFoundError:     "Lien de désabonnement invalide. Jeton introuvable.",
		ProcessingError:        "Impossible de traiter la demande de désabonnement. Veuillez réessayer plus tard.",
		ContactNotFoundError:   "Impossible de trouver les informations de contact.",
		AlreadyUsedError:       "Ce lien de désabonnement a déjà été utilisé.",
		UnsubscribeFailedError: "Échec du désabonnement des e-mails d'anniversaire.",
		InvalidRequestError:    "Données de demande invalides.",
		TokenRequiredError:     "Le jeton est requis.",
	},
	"de": {
		UnsubscribeTitle:             "Geburtstagskarten Abbestellen",
		UnsubscribeHeading:           "🎂 Geburtstagskarten Abbestellen",
		UnsubscribeMessage:           "Es tut uns leid, Sie gehen zu sehen! Wenn Sie keine Benachrichtigungen über Geburtstagskarten mehr erhalten möchten, können Sie sich unten abmelden.",
		UnsubscribeReason:            "Grund (optional):",
		UnsubscribeReasonPlaceholder: "Sagen Sie uns, warum Sie sich abmelden...",
		UnsubscribeButton:            "Abbestellen",

		SuccessTitle:               "Erfolg",
		SuccessHeading:             "✅ Erfolg",
		UnsubscribeSuccessMessage:  "Sie haben sich erfolgreich von Geburtstags-E-Mails abgemeldet.",
		AlreadyUnsubscribedMessage: "Sie haben sich bereits von Geburtstags-E-Mails abgemeldet.",
		ResubscribeSuccessMessage:  "Sie haben sich erfolgreich wieder für Geburtstags-E-Mails angemeldet.",
		ResubscribeButton:          "Erneut Abonnieren",

		ErrorTitle:             "Fehler",
		ErrorHeading:           "❌ Fehler",
		InvalidTokenError:      "Ungültiger Abmeldelink. Token fehlt.",
		TokenMissingError:      "Ungültiger Abmeldelink. Token fehlt.",
		TokenNotFoundError:     "Ungültiger Abmeldelink. Token nicht gefunden.",
		ProcessingError:        "Abmeldeanfrage konnte nicht verarbeitet werden. Bitte versuchen Sie es später erneut.",
		ContactNotFoundError:   "Kontaktinformationen konnten nicht gefunden werden.",
		AlreadyUsedError:       "Dieser Abmeldelink wurde bereits verwendet.",
		UnsubscribeFailedError: "Abmeldung von Geburtstags-E-Mails fehlgeschlagen.",
		InvalidRequestError:    "Ungültige Anfragedaten.",
		TokenRequiredError:     "Token ist erforderlich.",
	},
}

// GetTranslations returns translations for the specified language
// Falls back to English if language is not supported
func GetTranslations(lang string) Translations {
	if translations, ok := SupportedLanguages[lang]; ok {
		return translations
	}
	// Default to English
	return SupportedLanguages["en"]
}

// DetectLanguage detects language from Accept-Language header
// Returns language code (e.g., "en", "es", "fr", "de")
func DetectLanguage(acceptLanguage string) string {
	if acceptLanguage == "" {
		return "en"
	}
	for _, lang := range []string{"en", "es", "fr", "de"} {
		if len(acceptLanguage) >= 2 && acceptLanguage[:2] == lang {
			return lang
		}
	}
	if len(acceptLanguage) >= 2 {
		langCode := acceptLanguage[:2]
		if _, ok := SupportedLanguages[langCode]; ok {
			return langCode
		}
	}
	return "en"
}

// Additional template text translations
type TemplateText struct {
	// Error page
	ErrorPageSubtitle   string
	ErrorDetailsHeading string
	WhatYouCanDoHeading string
	WhatYouCanDo1       string
	WhatYouCanDo2       string
	WhatYouCanDo3       string
	WhatYouCanDo4       string
	TryAgainButton      string
	CloseWindowButton   string
	ContinueIssuesText  string

	// Unsubscribe form page
	UnsubEmail      string
	UnsubscribeNote string

	// Success page
	SuccessMessage      string
	ResubscribeMessage  string
	UnsubscribedAtLabel string

	// Form labels and options
	SelectReason          string
	ReasonTooManyEmails   string
	ReasonNotInterested   string
	ReasonWrongEmail      string
	ReasonPrivacyConcerns string
	ReasonOther           string
	FeedbackLabel         string
	FeedbackPlaceholder   string
	CancelButton          string

	// Update profile page
	UpdateProfileTitle    string
	UpdateProfileHeading  string
	UpdateProfileSubtitle string
	ProfileEmailLabel     string
	ProfileFirstNameLabel string
	ProfileLastNameLabel  string
	ProfileBirthdayLabel  string
	ProfileLanguageLabel  string
	SaveChangesButton     string
	ProfileUpdatedSuccess string
	ProfileUpdateError    string
}

// GetTemplateText returns template-specific translations
func GetTemplateText(lang string) TemplateText {
	switch lang {
	case "es":
		return TemplateText{
			ErrorPageSubtitle:   "Encontramos un problema al procesar tu solicitud de cancelación.",
			ErrorDetailsHeading: "Detalles del error:",
			WhatYouCanDoHeading: "Qué puedes hacer:",
			WhatYouCanDo1:       "Verifica que el enlace de cancelación esté completo y no se haya truncado",
			WhatYouCanDo2:       "Asegúrate de usar el enlace de cancelación más reciente de tu correo",
			WhatYouCanDo3:       "Intenta actualizar la página e intentar de nuevo",
			WhatYouCanDo4:       "Contacta a nuestro equipo de soporte si el problema persiste",
			TryAgainButton:      "Intentar de Nuevo",
			CloseWindowButton:   "Cerrar Ventana",
			ContinueIssuesText:  "Si continúas experimentando problemas, por favor contacta a nuestro equipo de soporte para obtener ayuda.",
			UnsubEmail:          "Correo Electrónico:",
			UnsubscribeNote:     "Dejarás de recibir correos de cumpleaños de nuestra parte.",
			SuccessMessage:      "¡Tu solicitud ha sido procesada exitosamente!",
			ResubscribeMessage:  "Si cambias de opinión, puedes reincorporarte en cualquier momento.",
			UnsubscribedAtLabel: "Cancelado el:",
			SelectReason:          "Selecciona un motivo...",
			ReasonTooManyEmails:   "Demasiados correos",
			ReasonNotInterested:   "No me interesan las tarjetas de cumpleaños",
			ReasonWrongEmail:      "Correo electrónico incorrecto",
			ReasonPrivacyConcerns: "Preocupaciones de privacidad",
			ReasonOther:           "Otro",
			FeedbackLabel:         "Comentarios adicionales (Opcional)",
			FeedbackPlaceholder:   "Ayúdanos a mejorar compartiendo tus ideas...",
			CancelButton:          "Cerrar",

			// Update profile page
			UpdateProfileTitle:    "Actualizar Perfil",
			UpdateProfileHeading:  "📝 Actualiza tu Perfil",
			UpdateProfileSubtitle: "Puedes actualizar tu información y preferencias a continuación.",
			ProfileEmailLabel:     "Correo electrónico",
			ProfileFirstNameLabel: "Nombre",
			ProfileLastNameLabel:  "Apellido",
			ProfileBirthdayLabel:  "Fecha de nacimiento",
			ProfileLanguageLabel:  "Idioma preferido",
			SaveChangesButton:     "Guardar cambios",
			ProfileUpdatedSuccess: "Tu perfil se ha actualizado correctamente.",
			ProfileUpdateError:    "No se pudo actualizar tu perfil. Inténtalo de nuevo.",
		}
	case "fr":
		return TemplateText{
			ErrorPageSubtitle:   "Nous avons rencontré un problème lors du traitement de votre demande de désabonnement.",
			ErrorDetailsHeading: "Détails de l'erreur :",
			WhatYouCanDoHeading: "Ce que vous pouvez faire :",
			WhatYouCanDo1:       "Vérifiez que le lien de désabonnement est complet et n'a pas été tronqué",
			WhatYouCanDo2:       "Assurez-vous d'utiliser le lien de désabonnement le plus récent de votre e-mail",
			WhatYouCanDo3:       "Essayez de rafraîchir la page et de réessayer",
			WhatYouCanDo4:       "Contactez notre équipe d'assistance si le problème persiste",
			TryAgainButton:      "Réessayer",
			CloseWindowButton:   "Fermer la Fenêtre",
			ContinueIssuesText:  "Si vous continuez à rencontrer des problèmes, veuillez contacter notre équipe d'assistance pour obtenir de l'aide.",
			UnsubEmail:          "E-mail :",
			UnsubscribeNote:     "Vous ne recevrez plus d'e-mails d'anniversaire de notre part.",
			SuccessMessage:      "Votre demande a été traitée avec succès !",
			ResubscribeMessage:  "Si vous changez d'avis, vous pouvez vous réabonner à tout moment.",
			UnsubscribedAtLabel: "Désabonné le :",
			SelectReason:          "Sélectionnez une raison...",
			ReasonTooManyEmails:   "Trop d'e-mails",
			ReasonNotInterested:   "Pas intéressé par les cartes d'anniversaire",
			ReasonWrongEmail:      "Adresse e-mail incorrecte",
			ReasonPrivacyConcerns: "Préoccupations de confidentialité",
			ReasonOther:           "Autre",
			FeedbackLabel:         "Commentaires supplémentaires (Optionnel)",
			FeedbackPlaceholder:   "Aidez-nous à nous améliorer en partageant vos idées...",
			CancelButton:          "Fermer",

			// Update profile page
			UpdateProfileTitle:    "Mettre à jour le profil",
			UpdateProfileHeading:  "📝 Mettez à jour votre profil",
			UpdateProfileSubtitle: "Vous pouvez mettre à jour vos informations et préférences ci-dessous.",
			ProfileEmailLabel:     "E-mail",
			ProfileFirstNameLabel: "Prénom",
			ProfileLastNameLabel:  "Nom",
			ProfileBirthdayLabel:  "Date d'anniversaire",
			ProfileLanguageLabel:  "Langue préférée",
			SaveChangesButton:     "Enregistrer les modifications",
			ProfileUpdatedSuccess: "Votre profil a été mis à jour avec succès.",
			ProfileUpdateError:    "Échec de la mise à jour de votre profil. Veuillez réessayer.",
		}
	case "de":
		return TemplateText{
			ErrorPageSubtitle:   "Bei der Verarbeitung Ihrer Abmeldeanfrage ist ein Problem aufgetreten.",
			ErrorDetailsHeading: "Fehlerdetails:",
			WhatYouCanDoHeading: "Was Sie tun können:",
			WhatYouCanDo1:       "Überprüfen Sie, ob der Abmeldelink vollständig ist und nicht abgeschnitten wurde",
			WhatYouCanDo2:       "Stellen Sie sicher, dass Sie den neuesten Abmeldelink aus Ihrer E-Mail verwenden",
			WhatYouCanDo3:       "Versuchen Sie, die Seite zu aktualisieren und es erneut zu versuchen",
			WhatYouCanDo4:       "Kontaktieren Sie unser Support-Team, wenn das Problem weiterhin besteht",
			TryAgainButton:      "Erneut Versuchen",
			CloseWindowButton:   "Fenster Schließen",
			ContinueIssuesText:  "Wenn Sie weiterhin Probleme haben, wenden Sie sich bitte an unser Support-Team.",
			UnsubEmail:          "E-Mail:",
			UnsubscribeNote:     "Sie erhalten keine Geburtstags-E-Mails mehr von uns.",
			SuccessMessage:      "Ihre Anfrage wurde erfolgreich bearbeitet!",
			ResubscribeMessage:  "Wenn Sie Ihre Meinung ändern, können Sie sich jederzeit wieder anmelden.",
			UnsubscribedAtLabel: "Abgemeldet am:",
			SelectReason:          "Wählen Sie einen Grund...",
			ReasonTooManyEmails:   "Zu viele E-Mails",
			ReasonNotInterested:   "Kein Interesse an Geburtstagskarten",
			ReasonWrongEmail:      "Falsche E-Mail-Adresse",
			ReasonPrivacyConcerns: "Datenschutzbedenken",
			ReasonOther:           "Andere",
			FeedbackLabel:         "Zusätzliches Feedback (Optional)",
			FeedbackPlaceholder:   "Helfen Sie uns, indem Sie Ihre Gedanken teilen...",
			CancelButton:          "Schließen",

			// Update profile page
			UpdateProfileTitle:    "Profil aktualisieren",
			UpdateProfileHeading:  "📝 Aktualisieren Sie Ihr Profil",
			UpdateProfileSubtitle: "Sie können unten Ihre Informationen und Einstellungen aktualisieren.",
			ProfileEmailLabel:     "E-Mail-Adresse",
			ProfileFirstNameLabel: "Vorname",
			ProfileLastNameLabel:  "Nachname",
			ProfileBirthdayLabel:  "Geburtsdatum",
			ProfileLanguageLabel:  "Bevorzugte Sprache",
			SaveChangesButton:     "Änderungen speichern",
			ProfileUpdatedSuccess: "Ihr Profil wurde erfolgreich aktualisiert.",
			ProfileUpdateError:    "Ihr Profil konnte nicht aktualisiert werden. Bitte versuchen Sie es erneut.",
		}
	default:
		return TemplateText{
			ErrorPageSubtitle:   "We encountered an issue while processing your unsubscribe request.",
			ErrorDetailsHeading: "Error Details:",
			WhatYouCanDoHeading: "What you can do:",
			WhatYouCanDo1:       "Check if the unsubscribe link is complete and hasn't been truncated",
			WhatYouCanDo2:       "Make sure you're using the most recent unsubscribe link from your email",
			WhatYouCanDo3:       "Try refreshing the page and attempting again",
			WhatYouCanDo4:       "Contact our support team if the problem persists",
			TryAgainButton:      "Try Again",
			CloseWindowButton:   "Close Window",
			ContinueIssuesText:  "If you continue to experience issues, please contact our support team for assistance.",
			UnsubEmail:          "Email:",
			UnsubscribeNote:     "You will no longer receive birthday emails from us.",
			SuccessMessage:      "Your request has been processed successfully!",
			ResubscribeMessage:  "If you change your mind, you can resubscribe at any time.",
			UnsubscribedAtLabel: "Unsubscribed on:",
			SelectReason:          "Select a reason...",
			ReasonTooManyEmails:   "Too many emails",
			ReasonNotInterested:   "Not interested in birthday cards",
			ReasonWrongEmail:      "Wrong email address",
			ReasonPrivacyConcerns: "Privacy concerns",
			ReasonOther:           "Other",
			FeedbackLabel:         "Additional feedback (Optional)",
			FeedbackPlaceholder:   "Help us improve by sharing your thoughts...",
			CancelButton:          "Cancel",

			// Update profile page
			UpdateProfileTitle:    "Update Profile",
			UpdateProfileHeading:  "📝 Update Your Profile",
			UpdateProfileSubtitle: "You can update your information and preferences below.",
			ProfileEmailLabel:     "Email",
			ProfileFirstNameLabel: "First name",
			ProfileLastNameLabel:  "Last name",
			ProfileBirthdayLabel:  "Birthday",
			ProfileLanguageLabel:  "Preferred language",
			SaveChangesButton:     "Save changes",
			ProfileUpdatedSuccess: "Your profile has been updated successfully.",
			ProfileUpdateError:    "Failed to update your profile. Please try again.",
		}
	}
}
