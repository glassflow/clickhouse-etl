ALTER TABLE transformations DROP CONSTRAINT transformations_type_check;

ALTER TABLE transformations ADD CONSTRAINT transformations_type_check
        CHECK (type IN ('deduplication', 'join', 'filter'));