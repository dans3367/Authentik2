package logger

import (
	"context"
	"log/slog"
	"os"
)

type Logger struct {
	*slog.Logger
}

func New(level string, format string) *Logger {
	var handler slog.Handler
	var logLevel slog.Level

	// Parse log level
	switch level {
	case "debug":
		logLevel = slog.LevelDebug
	case "info":
		logLevel = slog.LevelInfo
	case "warn":
		logLevel = slog.LevelWarn
	case "error":
		logLevel = slog.LevelError
	default:
		logLevel = slog.LevelInfo
	}

	// Create handler based on format
	opts := &slog.HandlerOptions{
		Level: logLevel,
	}

	if format == "json" {
		handler = slog.NewJSONHandler(os.Stdout, opts)
	} else {
		handler = slog.NewTextHandler(os.Stdout, opts)
	}

	return &Logger{
		Logger: slog.New(handler),
	}
}

func (l *Logger) WithEmail(emailID string) *Logger {
	return &Logger{
		Logger: l.Logger.With("email_id", emailID),
	}
}

func (l *Logger) WithWorkflow(workflowID string) *Logger {
	return &Logger{
		Logger: l.Logger.With("workflow_id", workflowID),
	}
}

func (l *Logger) WithContext(ctx context.Context) *Logger {
	return &Logger{
		Logger: l.Logger.With("trace_id", getTraceID(ctx)),
	}
}

func getTraceID(ctx context.Context) string {
	if traceID := ctx.Value("trace_id"); traceID != nil {
		if str, ok := traceID.(string); ok {
			return str
		}
	}
	return ""
}
