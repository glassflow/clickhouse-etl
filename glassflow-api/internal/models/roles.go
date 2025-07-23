package models

type Role string

const (
	RoleSink     Role = "sink"
	RoleJoin     Role = "join"
	RoleIngestor Role = "ingestor"
	RoleETL      Role = ""
)

func (r Role) Valid() bool {
	switch r {
	case RoleSink, RoleJoin, RoleIngestor, RoleETL:
		return true
	default:
		return false
	}
}

func (r Role) String() string {
	if r == RoleETL {
		return "ETL Pipeline"
	}
	return string(r)
}

func AllRoles() []string {
	return []string{
		RoleIngestor.String(),
		RoleJoin.String(),
		RoleSink.String(),
		RoleETL.String(),
	}
}
