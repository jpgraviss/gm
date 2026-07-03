-- Link tasks to projects and add section grouping for Asana-style project management
ALTER TABLE app_tasks ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE app_tasks ADD COLUMN IF NOT EXISTS section TEXT;
ALTER TABLE app_tasks ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_app_tasks_project_id ON app_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_app_tasks_section ON app_tasks(section);

-- Add sections config to projects (ordered list of section names)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sections JSONB DEFAULT '["To Do", "In Progress", "Done"]'::jsonb;
-- Add color customization per project
ALTER TABLE projects ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#015035';
-- Add description field
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;
