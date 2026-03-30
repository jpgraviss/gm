CREATE TABLE IF NOT EXISTS signature_requests (
  id text PRIMARY KEY,
  contract_id text NOT NULL,
  token text UNIQUE NOT NULL,
  signer_email text NOT NULL,
  signer_name text,
  type text NOT NULL DEFAULT 'client',
  status text NOT NULL DEFAULT 'pending',
  signed_at timestamptz,
  signer_ip text,
  signature_data text,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  company_name text,
  signature_date text
);
ALTER TABLE signature_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read" ON signature_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert" ON signature_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "anon_read_by_token" ON signature_requests FOR SELECT TO anon USING (true);
CREATE POLICY "anon_update_by_token" ON signature_requests FOR UPDATE TO anon USING (true);
