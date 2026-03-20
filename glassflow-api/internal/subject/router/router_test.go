package router

import (
	"fmt"
	"strings"
	"testing"
)

func TestSubject_PodIndex(t *testing.T) {
	r, err := New(RoutingConfig{
		OutputSubject: "events",
		SubjectCount:  5,
		Type:          RoutingTypePodIndex,
		PodIndex:      &PodIndexConfig{Index: 2},
	})
	if err != nil {
		t.Fatal(err)
	}

	got := r.Subject(nil)

	if got != "events.2" {
		t.Fatalf("expected events.2, got %s", got)
	}
}

func TestSubject_Random(t *testing.T) {
	r, err := New(RoutingConfig{
		OutputSubject: "events",
		SubjectCount:  10,
		Type:          RoutingTypeRandom,
	})
	if err != nil {
		t.Fatal(err)
	}

	got := r.Subject(nil)

	if !strings.HasPrefix(got, "events.") {
		t.Fatalf("expected events.<N>, got %s", got)
	}
	var n int
	fmt.Sscanf(got, "events.%d", &n)
	if n < 0 || n >= 10 {
		t.Fatalf("subject index %d out of range [0, 10)", n)
	}
}

func TestSubject_MessageHash(t *testing.T) {
	msg := []byte(`{"id":1}`)
	subjectCount := 4

	r, err := New(RoutingConfig{
		OutputSubject: "events",
		SubjectCount:  subjectCount,
		Type:          RoutingTypeHash,
	})
	if err != nil {
		t.Fatal(err)
	}

	got := r.Subject(msg)

	expected := "events.3"
	if got != expected {
		t.Fatalf("expected %s, got %s", expected, got)
	}
}

func TestSubject_Dedup(t *testing.T) {
	msg := []byte(`{"user_id":"abc123","value":42}`)
	field := "user_id"
	subjectCount := 4

	r, err := New(RoutingConfig{
		OutputSubject: "events",
		SubjectCount:  subjectCount,
		Type:          RoutingTypeField,
		Field:         &Field{Name: field},
	})
	if err != nil {
		t.Fatal(err)
	}

	got := r.Subject(msg)

	expected := "events.3"
	if got != expected {
		t.Fatalf("expected %s, got %s", expected, got)
	}
}
