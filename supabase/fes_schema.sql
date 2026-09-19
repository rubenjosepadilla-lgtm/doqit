-- ══════════════════════════════════════════════════════
-- FES Fase 0 — Modelo de datos para Firma Electrónica Simple
-- Alcance Doqit: carta_oferta (N2) y contrato (N2)
-- N2 = sesión autenticada + OTP por email + hash SHA-256 + sello de tiempo (Fase 2)
-- ══════════════════════════════════════════════════════

-- 1. Cláusulas de consentimiento versionadas
-- La cláusula nunca se edita; se crea una nueva versión.
create table public.fes_clauses (
  id            uuid primary key default uuid_generate_v4(),
  version       text unique not null,              -- ej: 'CL-FES-DOQIT-2026-01'
  document_types text[] not null,                  -- ['carta_oferta','contrato']
  content_text  text not null,                     -- texto exacto mostrado al firmante
  sha256        text not null,                     -- SHA-256 del content_text (normalizado)
  active        boolean not null default true,
  created_at    timestamptz default now()
);

-- Solo una cláusula activa por tipo de documento
create unique index fes_clauses_active_carta  on public.fes_clauses (active) where active = true and 'carta_oferta' = any(document_types);
create unique index fes_clauses_active_contrato on public.fes_clauses (active) where active = true and 'contrato' = any(document_types);

-- 2. Documentos FES
-- El recruiter crea el documento; el candidato lo firma.
create table public.fes_documents (
  id              uuid primary key default uuid_generate_v4(),
  recruiter_id    uuid not null references public.recruiters(id) on delete restrict,
  candidate_id    uuid not null references public.candidates(id) on delete restrict,
  document_type   text not null check (document_type in ('carta_oferta', 'contrato')),
  signature_level text not null default 'N2' check (signature_level in ('N1','N2')),
  title           text not null,
  content_html    text not null,                   -- contenido del documento (congelado al enviar)
  content_hash    text,                            -- SHA-256(content_html) calculado al congelar
  status          text not null default 'DRAFT'
                    check (status in ('DRAFT','SENT','VIEWED','SIGNED','EXPIRED','CANCELLED')),
  clause_id       uuid references public.fes_clauses(id),
  invite_token    text unique default uuid_generate_v4()::text,  -- link único para firmante
  expires_at      timestamptz,                     -- default: now() + 72h al enviar
  sent_at         timestamptz,
  signed_at       timestamptz,
  created_at      timestamptz default now()
);

-- 3. Evento de firma (un registro por acto de firma)
create table public.fes_signatures (
  id                    uuid primary key default uuid_generate_v4(),
  document_id           uuid not null references public.fes_documents(id) on delete restrict,
  -- Identidad del firmante
  signer_name           text not null,
  signer_email          text not null,
  -- Sesión
  ip_address            text,
  user_agent            text,
  -- Lectura del documento
  document_viewed_at    timestamptz,
  scrolled_to_end       boolean default false,
  seconds_on_document   integer,
  -- Consentimiento (texto exacto versionado)
  clause_id             uuid not null references public.fes_clauses(id),
  clause_version        text not null,
  clause_sha256         text not null,
  checkbox_prechecked   boolean not null default false,  -- siempre false
  consent_accepted_at   timestamptz,
  -- OTP (N2)
  otp_channel           text default 'email',
  otp_sent_at           timestamptz,
  otp_verified_at       timestamptz,
  -- Resultado
  signed_at             timestamptz,
  manifest_hash         text,                     -- SHA-256 del manifiesto JSON
  -- Sello de tiempo RFC 3161 (Fase 2 — PSC acreditado)
  tsa_provider          text,
  tsa_token_b64         text,
  tsa_timestamp         timestamptz,
  created_at            timestamptz default now()
);

-- 4. Cadena de auditoría append-only
-- Cada evento incluye el hash del evento anterior → cadena encadenada.
-- NUNCA actualizar ni borrar filas de esta tabla.
create table public.fes_events (
  id              uuid primary key default uuid_generate_v4(),
  document_id     uuid not null references public.fes_documents(id) on delete restrict,
  event_type      text not null check (event_type in (
                    'document_created',
                    'document_sent',
                    'document_viewed',
                    'otp_sent',
                    'otp_verified',
                    'consent_accepted',
                    'document_signed',
                    'document_expired',
                    'document_cancelled',
                    'tsa_stamped'
                  )),
  actor           text,                            -- 'recruiter:<id>' o 'candidate:<email>'
  event_data      jsonb,                           -- datos del evento (sin PII innecesaria)
  prev_event_hash text,                            -- hash del evento anterior en esta cadena
  event_hash      text,                            -- SHA-256(id + event_type + event_data + prev_event_hash + created_at)
  created_at      timestamptz default now()
);

-- Índices
create index fes_documents_candidate    on public.fes_documents (candidate_id);
create index fes_documents_recruiter    on public.fes_documents (recruiter_id);
create index fes_documents_invite_token on public.fes_documents (invite_token);
create index fes_signatures_document    on public.fes_signatures (document_id);
create index fes_events_document        on public.fes_events (document_id);
create index fes_events_created         on public.fes_events (created_at);

-- RLS
alter table public.fes_clauses    enable row level security;
alter table public.fes_documents  enable row level security;
alter table public.fes_signatures enable row level security;
alter table public.fes_events     enable row level security;

-- Cláusulas: solo lectura para todos los autenticados
create policy "Cláusulas legibles para autenticados"
  on public.fes_clauses for select
  using (auth.role() = 'authenticated');

-- Documentos: recruiter ve los suyos
create policy "Recruiter gestiona sus documentos FES"
  on public.fes_documents for all
  using (auth.uid() = recruiter_id);

-- Documentos: acceso anónimo por invite_token (para firmante)
create policy "Firmante accede por invite_token"
  on public.fes_documents for select
  using (true);  -- filtro real por invite_token en la query con service role

-- Firmas: recruiter ve las de sus documentos
create policy "Recruiter ve firmas de sus documentos"
  on public.fes_signatures for select
  using (exists (
    select 1 from public.fes_documents d
    where d.id = document_id and d.recruiter_id = auth.uid()
  ));

-- Eventos: recruiter ve los de sus documentos
create policy "Recruiter ve eventos de sus documentos"
  on public.fes_events for select
  using (exists (
    select 1 from public.fes_documents d
    where d.id = document_id and d.recruiter_id = auth.uid()
  ));


-- ══════════════════════════════════════════════════════
-- CLÁUSULA INICIAL — versión CL-FES-DOQIT-2026-01
-- Aplica a: carta_oferta y contrato
-- ══════════════════════════════════════════════════════
insert into public.fes_clauses (
  version,
  document_types,
  content_text,
  sha256,
  active
) values (
  'CL-FES-DOQIT-2026-01',
  array['carta_oferta', 'contrato'],
  'Declaro que he leído íntegramente el documento presentado en esta pantalla, que comprendo su contenido y que manifiesto mi voluntad de aceptarlo. Al marcar esta casilla y confirmar con el código enviado a mi correo electrónico, estoy aplicando mi firma electrónica simple conforme a la Ley 19.799 de la República de Chile, la que produce los mismos efectos jurídicos que una firma manuscrita. Reconozco que este acto queda registrado con fecha, hora, dirección IP y el código de verificación utilizado. Tengo derecho a solicitar una copia de este documento firmado, la que me será enviada al correo declarado.',
  '14a674fe7a124217812769a9247b1cd3cdea539e50721e7dd978c5cdf0cbf32d',
  true
);
