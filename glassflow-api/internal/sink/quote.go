package sink

import "strings"

// quoteIdentifier wraps a ClickHouse identifier in backticks,
// escaping any existing backticks within the name.
func quoteIdentifier(name string) string {
	return "`" + strings.ReplaceAll(name, "`", "``") + "`"
}

// quoteIdentifiers quotes a slice of identifiers and joins with ", ".
func quoteIdentifiers(names []string) string {
	quoted := make([]string, len(names))
	for i, n := range names {
		quoted[i] = quoteIdentifier(n)
	}
	return strings.Join(quoted, ", ")
}
