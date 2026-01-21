package models

type KVBatchReference struct {
	BucketID string `json:"bucket_id"`
	KeyID    string `json:"key_id"`
	Size     int64  `json:"size"`
}

type KVBatch struct {
	Messages []Msg `json:"messages"`
}

type Msg []byte

var (
	Buckets = []string{
		"bucket-1",
		"bucket-2",
		"bucket-3",
		"bucket-4",
		"bucket-5",
		"bucket-6",
		"bucket-7",
		"bucket-8",
		"bucket-9",
		"bucket-10",
		"bucket-11",
		"bucket-12",
		"bucket-13",
		"bucket-14",
		"bucket-15",
		"bucket-16",
	}
)
