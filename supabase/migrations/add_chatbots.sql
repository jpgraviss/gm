create table if not exists public.chatbots (
  id text primary key,
  workspace_id uuid default '00000000-0000-0000-0000-000000000001',
  name text not null,
  website_url text,
  welcome_message text default 'Hi! How can I help you today?',
  system_prompt text default 'You are a helpful assistant.',
  knowledge text,
  brand_color text default '#015035',
  avatar_url text,
  active boolean default true,
  settings jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.chatbot_conversations (
  id text primary key,
  chatbot_id text references public.chatbots(id) on delete cascade,
  visitor_id text,
  visitor_name text,
  visitor_email text,
  messages jsonb default '[]',
  status text default 'active',
  flagged boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_chatbot_conversations_bot on public.chatbot_conversations(chatbot_id);
