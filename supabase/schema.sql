-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Recruiters (linked to Supabase auth.users)
create table public.recruiters (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  company_name text not null,
  email text not null unique,
  created_at timestamptz default now()
);

-- Positions
create table public.positions (
  id uuid primary key default uuid_generate_v4(),
  recruiter_id uuid not null references public.recruiters(id) on delete cascade,
  title text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'CLOSED')),
  created_at timestamptz default now()
);

-- Document types required per position
create table public.required_documents (
  id uuid primary key default uuid_generate_v4(),
  position_id uuid not null references public.positions(id) on delete cascade,
  name text not null,
  description text,
  is_mandatory boolean default true
);

-- Candidates
create table public.candidates (
  id uuid primary key default uuid_generate_v4(),
  recruiter_id uuid not null references public.recruiters(id) on delete cascade,
  position_id uuid references public.positions(id),
  full_name text not null,
  rut text,
  email text not null,
  phone text,
  invite_token text unique default uuid_generate_v4()::text,
  status text not null default 'INVITED' check (status in ('INVITED', 'REGISTERED', 'PENDING_DOCS', 'READY', 'REJECTED')),
  created_at timestamptz default now()
);

-- Documents
create table public.documents (
  id uuid primary key default uuid_generate_v4(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  document_type text not null,
  file_name text not null,
  file_path text not null,
  file_size integer,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  rejection_reason text,
  reviewed_by uuid references public.recruiters(id),
  reviewed_at timestamptz,
  expires_at date,
  created_at timestamptz default now()
);

-- RLS Policies
alter table public.recruiters enable row level security;
alter table public.positions enable row level security;
alter table public.required_documents enable row level security;
alter table public.candidates enable row level security;
alter table public.documents enable row level security;

-- Recruiters can only see their own data
create policy "Recruiters see own profile" on public.recruiters for all using (auth.uid() = id);
create policy "Recruiters manage own positions" on public.positions for all using (auth.uid() = recruiter_id);
create policy "Recruiters manage own candidates" on public.candidates for all using (auth.uid() = recruiter_id);
create policy "Recruiters see documents of their candidates" on public.documents for all
  using (exists (select 1 from public.candidates c where c.id = candidate_id and c.recruiter_id = auth.uid()));

-- Storage bucket (run in Supabase dashboard after creating bucket named 'documents')
-- insert into storage.buckets (id, name, public) values ('documents', 'documents', false);
