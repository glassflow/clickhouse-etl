package models

import "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"

type Role string

func (r Role) Valid() bool {
	switch r {
	case internal.RoleSink, internal.RoleJoin, internal.RoleIngestor, internal.RoleETL:
		return true
	default:
		return false
	}
}

func (r Role) String() string {
	if r == internal.RoleETL {
		return "ETL Pipeline"
	}
	return string(r)
}

func AllRoles() []string {
	return []string{
		Role(internal.RoleIngestor).String(),
		Role(internal.RoleJoin).String(),
		Role(internal.RoleSink).String(),
		Role(internal.RoleETL).String(),
	}
}
