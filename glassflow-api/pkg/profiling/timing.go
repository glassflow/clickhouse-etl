package profiling

import (
	"context"
	"log/slog"
	"time"
)

// TimeOperation times a function execution and logs the result
func TimeOperation(ctx context.Context, log *slog.Logger, operationName string, fn func() error) error {
	start := time.Now()
	err := fn()
	duration := time.Since(start)

	log.InfoContext(ctx, "Operation timing",
		"operation", operationName,
		"duration_ms", duration.Milliseconds(),
		"duration_ns", duration.Nanoseconds(),
		"error", err != nil,
	)

	return err
}

// TimeOperationWithResult times a function execution that returns a value and logs the result
func TimeOperationWithResult[T any](ctx context.Context, log *slog.Logger, operationName string, fn func() (T, error)) (T, error) {
	start := time.Now()
	result, err := fn()
	duration := time.Since(start)

	log.InfoContext(ctx, "Operation timing",
		"operation", operationName,
		"duration_ms", duration.Milliseconds(),
		"duration_ns", duration.Nanoseconds(),
		"error", err != nil,
	)

	return result, err
}

// LogTiming logs timing information for an operation
func LogTiming(ctx context.Context, log *slog.Logger, operationName string, duration time.Duration, additionalAttrs ...slog.Attr) {
	attrs := []slog.Attr{
		slog.String("operation", operationName),
		slog.Int64("duration_ms", duration.Milliseconds()),
		slog.Int64("duration_ns", duration.Nanoseconds()),
	}
	attrs = append(attrs, additionalAttrs...)

	log.LogAttrs(ctx, slog.LevelInfo, "Operation timing", attrs...)
}
