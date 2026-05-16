CREATE TABLE IF NOT EXISTS automation_runs (
  id              text PRIMARY KEY,
  automation_id   text NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  trigger_type    text NOT NULL,
  trigger_data    jsonb DEFAULT '{}'::jsonb,
  status          text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  steps           jsonb DEFAULT '[]'::jsonb,
  error           text
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_automation_id ON automation_runs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_status ON automation_runs(status);
CREATE INDEX IF NOT EXISTS idx_automation_runs_started_at ON automation_runs(started_at DESC);

ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_automation_runs" ON automation_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_manage_automation_runs" ON automation_runs FOR ALL TO authenticated USING (true);
CREATE POLICY "anon_read_automation_runs" ON automation_runs FOR SELECT TO anon USING (true);
CREATE POLICY "service_manage_automation_runs" ON automation_runs FOR ALL TO service_role USING (true);

CREATE TABLE IF NOT EXISTS automation_pending_steps (
  id                text PRIMARY KEY,
  automation_id     text NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  run_id            text NOT NULL,
  resume_at         timestamptz NOT NULL,
  remaining_actions jsonb DEFAULT '[]'::jsonb,
  context           jsonb DEFAULT '{}'::jsonb,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resumed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_automation_pending_resume ON automation_pending_steps(resume_at) WHERE status = 'pending';

ALTER TABLE automation_pending_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read_pending" ON automation_pending_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_manage_pending" ON automation_pending_steps FOR ALL TO authenticated USING (true);
CREATE POLICY "service_manage_pending" ON automation_pending_steps FOR ALL TO service_role USING (true);
