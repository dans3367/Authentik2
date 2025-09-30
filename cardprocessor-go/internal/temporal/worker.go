package temporal

import (
	"go.temporal.io/sdk/worker"
)

// registerActivities registers all activities with the worker
func registerActivities(w worker.Worker) {
	// Register birthday test activities
	w.RegisterActivity(PrepareBirthdayTestEmail)
	w.RegisterActivity(PrepareBirthdayTestEmailWithPromotion)
	w.RegisterActivity(SendBirthdayTestEmail)
	w.RegisterActivity(UpdateBirthdayTestStatus)
	w.RegisterActivity(FetchPromotionData)

	// Register birthday invitation activities
	w.RegisterActivity(PrepareBirthdayInvitationEmail)
	w.RegisterActivity(SendBirthdayInvitationEmail)
	w.RegisterActivity(GenerateBirthdayInvitationToken)
	w.RegisterActivity(UpdateContactInvitationStatus)

	// Register unsubscribe token generation
	w.RegisterActivity(GenerateBirthdayUnsubscribeToken)

	// Register workflows
	w.RegisterWorkflow(BirthdayTestWorkflow)
	w.RegisterWorkflow(BirthdayInvitationWorkflow)
}
