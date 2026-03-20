package router

import "fmt"

type RoutingType string

const (
	// RoutingTypeName - just returns OutputSubject without any logic
	RoutingTypeName     RoutingType = "name"
	RoutingTypeField    RoutingType = "field"
	RoutingTypeHash     RoutingType = "message_hash"
	RoutingTypeRandom   RoutingType = "random"
	RoutingTypePodIndex RoutingType = "pod_index"
)

type RoutingConfig struct {
	OutputSubject string          `json:"output_subject"`
	SubjectCount  int             `json:"subject_count"`
	Type          RoutingType     `json:"type"`
	Field         *Field          `json:"field,omitempty"`
	PodIndex      *PodIndexConfig `json:"pod_index,omitempty"`
}

type Field struct {
	Name string `json:"name"`
}

type PodIndexConfig struct {
	Index int `json:"index"`
}

func (c RoutingConfig) Validate() error {
	if c.OutputSubject == "" {
		return fmt.Errorf("output_subject_prefix is required")
	}
	if c.SubjectCount < 0 {
		return fmt.Errorf("subject_count must be positive")
	}
	switch c.Type {
	case RoutingTypePodIndex:
		if c.PodIndex == nil {
			return fmt.Errorf("pod_index config is required for type %q", c.Type)
		}
		if c.PodIndex.Index < 0 || c.PodIndex.Index >= c.SubjectCount {
			return fmt.Errorf("pod_index.index must be in [0, subject_count)")
		}
	case RoutingTypeRandom, RoutingTypeHash, RoutingTypeName:
		// no extra config needed
	case RoutingTypeField:
		if c.Field == nil {
			return fmt.Errorf("dedup config is required for type %q", c.Type)
		}
		if c.Field.Name == "" {
			return fmt.Errorf("dedup.field is required")
		}
	default:
		return fmt.Errorf("unknown routing type %q", c.Type)
	}
	return nil
}
