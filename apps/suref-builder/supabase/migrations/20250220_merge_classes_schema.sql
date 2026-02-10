-- Merge Classes Schema Migration
-- Migrate suentities from classes.core, classes.advanced, and classes.hybrid to unified 'classes' schema

-- Update all existing class entities to use the unified 'classes' schema
UPDATE suentities
SET schema_name = 'classes'
WHERE schema_name IN ('classes.core', 'classes.advanced', 'classes.hybrid');

-- Verify the migration
-- SELECT COUNT(*) FROM suentities WHERE schema_name = 'classes';
-- Should return the count of all class entities (core + advanced + hybrid)




