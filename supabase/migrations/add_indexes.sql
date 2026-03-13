-- ─── Performance Indexes ─────────────────────────────────────────────────────
-- These indexes improve query performance on frequently filtered columns.

-- CRM
CREATE INDEX IF NOT EXISTS idx_crm_companies_owner ON public.crm_companies(owner);
CREATE INDEX IF NOT EXISTS idx_crm_companies_status ON public.crm_companies(status);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_company_id ON public.crm_contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_owner ON public.crm_contacts(owner);
CREATE INDEX IF NOT EXISTS idx_crm_activities_company_id ON public.crm_activities(company_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_contact_id ON public.crm_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_timestamp ON public.crm_activities(timestamp DESC);

-- Deals & Pipeline
CREATE INDEX IF NOT EXISTS idx_deals_stage ON public.deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_assigned_rep ON public.deals(assigned_rep);

-- Proposals & Contracts
CREATE INDEX IF NOT EXISTS idx_proposals_status ON public.proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_assigned_rep ON public.proposals(assigned_rep);
CREATE INDEX IF NOT EXISTS idx_proposals_deal_id ON public.proposals(deal_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_assigned_rep ON public.contracts(assigned_rep);
CREATE INDEX IF NOT EXISTS idx_contracts_proposal_id ON public.contracts(proposal_id);

-- Invoices
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_contract_id ON public.invoices(contract_id);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date);

-- Projects & Operations
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_contract_id ON public.projects(contract_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON public.maintenance_records(status);
CREATE INDEX IF NOT EXISTS idx_renewals_status ON public.renewals(status);
CREATE INDEX IF NOT EXISTS idx_renewals_contract_id ON public.renewals(contract_id);

-- Tasks & Time
CREATE INDEX IF NOT EXISTS idx_app_tasks_assigned_to ON public.app_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_app_tasks_status ON public.app_tasks(status);
CREATE INDEX IF NOT EXISTS idx_app_tasks_due_date ON public.app_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON public.time_entries(date);
CREATE INDEX IF NOT EXISTS idx_time_entries_team_member ON public.time_entries(team_member);

-- Tickets
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON public.tickets(assigned_to);

-- Audit & Sequences
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON public.audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_sequences_status ON public.sequences(status);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_sequence_id ON public.sequence_enrollments(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_status ON public.sequence_enrollments(status);

-- Calendar indexes will be added when calendar_settings table is created
