-- Add parent_entity_id column to suentities table
-- This allows entities to have parent-child relationships (e.g., granted equipment)

-- Add the column
ALTER TABLE suentities
ADD COLUMN parent_entity_id UUID REFERENCES suentities(id) ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX idx_suentities_parent_entity_id ON suentities(parent_entity_id);

-- Add comment
COMMENT ON COLUMN suentities.parent_entity_id IS 'Optional reference to parent entity (e.g., ability that granted this equipment)';

