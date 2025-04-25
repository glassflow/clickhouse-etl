package testutils

import (
	"fmt"
	"log/slog"
	"os"
	"strings"
)

func NewTestLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		AddSource:   true,
		Level:       slog.LevelDebug,
		ReplaceAttr: nil,
	}))
}

func CombineErrors(errs []error) error {
	if len(errs) > 0 {
		var errStr strings.Builder
		errStr.WriteString("cleanup errors: ")
		for i, err := range errs {
			if i > 0 {
				errStr.WriteString("; ")
			}
			errStr.WriteString(err.Error())
		}
		return fmt.Errorf("errors occurred: %s", errStr.String())
	}

	return nil
}
