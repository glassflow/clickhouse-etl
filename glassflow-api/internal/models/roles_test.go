package models

import (
	"testing"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
)

func TestRoleValid(t *testing.T) {
	tests := []struct {
		roleString string
		valid      bool
	}{
		{"sink", true},
		{"join", true},
		{"ingestor", true},
		{"", true},      // RoleETL
		{"dedup", true}, // RoleETL
		{"invalid", false},
	}
	for _, tt := range tests {
		t.Run(tt.roleString, func(t *testing.T) {
			role := Role(tt.roleString)
			if role.Valid() != tt.valid {
				t.Errorf("Role(%s).Valid() = %v, want %v", tt.roleString, role.Valid(), tt.valid)
			}
		})
	}
}

func TestRoleString(t *testing.T) {
	tests := []struct {
		role Role
		want string
	}{
		{internal.RoleSink, "sink"},
		{internal.RoleJoin, "join"},
		{internal.RoleIngestor, "ingestor"},
		{internal.RoleETL, "ETL Pipeline"},
		{internal.RoleDeduplicator, "dedup"},
	}
	for _, tt := range tests {
		t.Run(tt.role.String(), func(t *testing.T) {
			if got := tt.role.String(); got != tt.want {
				t.Errorf("Role.String() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestAllRoles(t *testing.T) {
	expected := []string{
		"ingestor",
		"join",
		"sink",
		"dedup",
		"ETL Pipeline",
	}
	roles := AllRoles()
	if len(roles) != len(expected) {
		t.Errorf("AllRoles() = %v, want %v", roles, expected)
		return
	}
	for i, role := range roles {
		if role != expected[i] {
			t.Errorf("AllRoles()[%d] = %v, want %v", i, role, expected[i])
		}
	}
}
