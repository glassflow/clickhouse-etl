package sink

import "testing"

func TestQuoteIdentifier(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{name: "simple name", input: "users", want: "`users`"},
		{name: "backtick in name", input: "user`s", want: "`user``s`"},
		{name: "reserved word", input: "order", want: "`order`"},
		{name: "empty string", input: "", want: "``"},
		{name: "multiple backticks", input: "a`b`c", want: "`a``b``c`"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := quoteIdentifier(tt.input)
			if got != tt.want {
				t.Errorf("quoteIdentifier(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestQuoteIdentifiers(t *testing.T) {
	tests := []struct {
		name  string
		input []string
		want  string
	}{
		{
			name:  "multiple columns",
			input: []string{"id", "name", "order"},
			want:  "`id`, `name`, `order`",
		},
		{
			name:  "single column",
			input: []string{"id"},
			want:  "`id`",
		},
		{
			name:  "empty slice",
			input: []string{},
			want:  "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := quoteIdentifiers(tt.input)
			if got != tt.want {
				t.Errorf("quoteIdentifiers(%v) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}
