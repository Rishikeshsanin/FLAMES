-- FLAMES application-owned schema only. Project Hub app: flames.
select hub.assert_app_scope('flames', 'flames');

create schema if not exists flames;
revoke all on schema flames from public, anon, authenticated;

create table flames.sessions (
  session_id uuid primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  consent_version text not null,
  analytics_consent boolean not null,
  names_consent boolean not null default false,
  deletion_token_hash text not null check (deletion_token_hash ~ '^[0-9a-f]{64}$'),
  source text not null default 'visitor' check (source in ('visitor','synthetic','manual_test')),
  withdrawn_at timestamptz,
  names_expires_at timestamptz,
  records_expires_at timestamptz not null default (now() + interval '90 days')
);

create table flames.attempts (
  attempt_id uuid primary key,
  session_id uuid not null references flames.sessions(session_id) on delete cascade,
  parent_attempt_id uuid references flames.attempts(attempt_id) on delete set null,
  created_at timestamptz not null default now(),
  client_occurred_at timestamptz,
  name_one text,
  name_two text,
  result_letter text check (result_letter is null or result_letter in ('F','L','A','M','E','S')),
  remaining_count integer not null check (remaining_count >= 0 and remaining_count <= 320),
  is_alternative boolean not null default false,
  previous_result_letter text check (previous_result_letter is null or previous_result_letter in ('F','L','A','M','E','S')),
  algorithm_version text not null,
  source text not null default 'visitor' check (source in ('visitor','synthetic','manual_test')),
  constraint names_together check ((name_one is null) = (name_two is null))
);

create table flames.feedback (
  attempt_id uuid primary key references flames.attempts(attempt_id) on delete cascade,
  liked_result boolean,
  wants_change boolean not null default false,
  desired_letter text check (desired_letter is null or desired_letter in ('F','L','A','M','E','S')),
  resulting_attempt_id uuid references flames.attempts(attempt_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table flames.name_variations (
  variation_id bigint generated always as identity primary key,
  attempt_id uuid not null references flames.attempts(attempt_id) on delete cascade,
  person_side smallint not null check (person_side in (1,2)),
  variation_type text not null check (variation_type in ('full-name','first-name','first-last','nickname')),
  name_value text not null check (char_length(name_value) between 1 and 120),
  created_at timestamptz not null default now(),
  unique(attempt_id,person_side,variation_type,name_value)
);

create table flames.deletion_requests (
  request_id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'completed' check (status in ('pending','completed','rejected'))
);

create table flames.rate_limits (
  session_id uuid not null,
  bucket_start timestamptz not null,
  request_count integer not null default 1,
  primary key (session_id, bucket_start)
);

create table flames.app_config (
  config_key text primary key,
  config_value text not null,
  updated_at timestamptz not null default now()
);

create index attempts_session_created_idx on flames.attempts(session_id, created_at);
create index attempts_created_idx on flames.attempts(created_at desc);
create index attempts_result_idx on flames.attempts(result_letter, created_at desc);
create index attempts_source_idx on flames.attempts(source, created_at desc);

alter table flames.sessions enable row level security;
alter table flames.attempts enable row level security;
alter table flames.feedback enable row level security;
alter table flames.name_variations enable row level security;
alter table flames.deletion_requests enable row level security;
alter table flames.rate_limits enable row level security;
alter table flames.app_config enable row level security;

create or replace function flames.enforce_retention() returns void language plpgsql security definer
set search_path=pg_catalog,flames as $$
begin
  update flames.attempts a set name_one=null,name_two=null
  from flames.sessions s where a.session_id=s.session_id and s.names_expires_at < now() and a.name_one is not null;
  delete from flames.name_variations v using flames.attempts a,flames.sessions s
  where v.attempt_id=a.attempt_id and a.session_id=s.session_id and s.names_expires_at < now();
  delete from flames.sessions where records_expires_at < now();
  delete from flames.rate_limits where bucket_start < now()-interval '2 days';
end $$;

create or replace function flames.ingest_attempt(
  p_session_id uuid, p_attempt_id uuid, p_parent_attempt_id uuid,
  p_client_occurred_at timestamptz, p_consent_version text,
  p_names_consent boolean, p_deletion_token_hash text,
  p_name_one text, p_name_two text, p_result_letter text,
  p_remaining_count integer, p_is_alternative boolean,
  p_previous_result_letter text, p_algorithm_version text,
  p_variations jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, flames as $$
declare v_bucket timestamptz := date_trunc('hour', now()); v_count integer; v_inserted boolean := false;
begin
  perform flames.enforce_retention();
  if p_consent_version <> '2026-10-25' or p_deletion_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid consent proof';
  end if;
  if p_result_letter is not null and p_result_letter not in ('F','L','A','M','E','S') then raise exception 'invalid result'; end if;
  if p_remaining_count < 0 or p_remaining_count > 320 then raise exception 'invalid count'; end if;
  if p_names_consent and (coalesce(char_length(trim(p_name_one)),0) < 1 or coalesce(char_length(trim(p_name_two)),0) < 1
    or char_length(p_name_one) > 120 or char_length(p_name_two) > 120) then raise exception 'invalid names'; end if;

  insert into flames.rate_limits(session_id,bucket_start) values(p_session_id,v_bucket)
  on conflict(session_id,bucket_start) do update set request_count=flames.rate_limits.request_count+1
  returning request_count into v_count;
  if v_count > 40 then raise exception 'rate limit exceeded'; end if;

  insert into flames.sessions(session_id,consent_version,analytics_consent,names_consent,deletion_token_hash,names_expires_at)
  values(p_session_id,p_consent_version,true,p_names_consent,p_deletion_token_hash,
    case when p_names_consent then now()+interval '30 days' end)
  on conflict(session_id) do update set updated_at=now(), names_consent=flames.sessions.names_consent or excluded.names_consent;

  insert into flames.attempts(attempt_id,session_id,parent_attempt_id,client_occurred_at,name_one,name_two,
    result_letter,remaining_count,is_alternative,previous_result_letter,algorithm_version)
  values(p_attempt_id,p_session_id,p_parent_attempt_id,p_client_occurred_at,
    case when p_names_consent then trim(p_name_one) end,case when p_names_consent then trim(p_name_two) end,
    p_result_letter,p_remaining_count,p_is_alternative,p_previous_result_letter,p_algorithm_version)
  on conflict(attempt_id) do nothing;
  get diagnostics v_count = row_count; v_inserted := v_count = 1;

  if p_names_consent and jsonb_typeof(p_variations)='array' then
    insert into flames.name_variations(attempt_id,person_side,variation_type,name_value)
    select p_attempt_id, (x->>'person_side')::smallint, x->>'variation_type', left(trim(x->>'name_value'),120)
    from jsonb_array_elements(p_variations) x
    where (x->>'person_side') in ('1','2') and (x->>'variation_type') in ('full-name','first-name','first-last','nickname')
      and coalesce(char_length(trim(x->>'name_value')),0) between 1 and 120
    on conflict do nothing;
  end if;
  return jsonb_build_object('attempt_id',p_attempt_id,'stored',true,'duplicate',not v_inserted);
end $$;

create or replace function flames.record_feedback(
  p_session_id uuid, p_attempt_id uuid, p_liked_result boolean,
  p_wants_change boolean, p_desired_letter text default null
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, flames as $$
begin
  if p_desired_letter is not null and p_desired_letter not in ('F','L','A','M','E','S') then raise exception 'invalid desired result'; end if;
  if not exists(select 1 from flames.attempts where attempt_id=p_attempt_id and session_id=p_session_id) then raise exception 'attempt not found'; end if;
  insert into flames.feedback(attempt_id,liked_result,wants_change,desired_letter)
  values(p_attempt_id,p_liked_result,p_wants_change,p_desired_letter)
  on conflict(attempt_id) do update set liked_result=excluded.liked_result,wants_change=excluded.wants_change,
    desired_letter=excluded.desired_letter,updated_at=now();
  return jsonb_build_object('attempt_id',p_attempt_id,'stored',true);
end $$;

create or replace function flames.delete_session_data(p_session_id uuid,p_deletion_token_hash text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,flames as $$
declare v_ok boolean;
begin
  select deletion_token_hash=p_deletion_token_hash into v_ok from flames.sessions where session_id=p_session_id;
  if coalesce(v_ok,false) is false then raise exception 'deletion proof rejected'; end if;
  delete from flames.sessions where session_id=p_session_id;
  insert into flames.deletion_requests(session_id,completed_at,status) values(p_session_id,now(),'completed');
  return jsonb_build_object('deleted',true);
end $$;

create or replace function flames.admin_dashboard(p_admin_token_hash text,p_query jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,flames as $$
declare v_from timestamptz; v_to timestamptz; v_source text; v_search text; v_page int; v_size int;
begin
  perform flames.enforce_retention();
  if p_admin_token_hash is distinct from (select config_value from flames.app_config where config_key='admin_token_hash') then
    raise exception 'unauthorized';
  end if;
  v_from:=coalesce((p_query->>'from')::timestamptz,now()-interval '30 days');
  v_to:=coalesce((p_query->>'to')::timestamptz,now()+interval '1 day');
  v_source:=nullif(p_query->>'source',''); v_search:=nullif(lower(trim(p_query->>'search')),'');
  v_page:=greatest(coalesce((p_query->>'page')::int,1),1); v_size:=least(greatest(coalesce((p_query->>'page_size')::int,50),1),200);
  return jsonb_build_object(
   'metrics',(select jsonb_build_object('attempts',count(*),'sessions',count(distinct a.session_id),
     'liked',count(*) filter(where f.liked_result is true),'disliked',count(*) filter(where f.liked_result is false),
     'alternatives',count(*) filter(where a.is_alternative),'changed_outcomes',count(*) filter(where a.is_alternative and a.previous_result_letter is distinct from a.result_letter),
     'alternative_session_percent',round(100.0*count(distinct a.session_id) filter(where a.is_alternative)/nullif(count(distinct a.session_id),0),1),
     'attempts_per_session',round(count(*)::numeric/nullif(count(distinct a.session_id),0),2))
     from flames.attempts a left join flames.feedback f using(attempt_id) where a.created_at between v_from and v_to and (v_source is null or a.source=v_source)),
   'distribution',(select coalesce(jsonb_object_agg(coalesce(result_letter,'tie'),n),'{}'::jsonb) from (select result_letter,count(*) n from flames.attempts where created_at between v_from and v_to and (v_source is null or source=v_source) group by result_letter)d),
   'rows',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) from (
     select a.attempt_id,a.session_id,a.parent_attempt_id,a.created_at,a.name_one,a.name_two,a.result_letter,a.remaining_count,
       a.is_alternative,a.previous_result_letter,a.algorithm_version,a.source,f.liked_result,f.wants_change,f.desired_letter
     from flames.attempts a left join flames.feedback f using(attempt_id)
     where a.created_at between v_from and v_to and (v_source is null or a.source=v_source)
       and (v_search is null or lower(coalesce(a.name_one,'')||' '||coalesce(a.name_two,'')||' '||a.session_id::text) like '%'||v_search||'%')
     order by a.created_at desc offset (v_page-1)*v_size limit v_size)x),
   'page',v_page,'page_size',v_size);
end $$;

create or replace function flames.admin_insert_test(p_admin_token_hash text,p_record jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,flames as $$
declare v_session uuid:=coalesce((p_record->>'session_id')::uuid,gen_random_uuid()); v_attempt uuid:=coalesce((p_record->>'attempt_id')::uuid,gen_random_uuid());
begin
 perform flames.enforce_retention();
 if p_admin_token_hash is distinct from (select config_value from flames.app_config where config_key='admin_token_hash') then raise exception 'unauthorized'; end if;
 insert into flames.sessions(session_id,consent_version,analytics_consent,names_consent,deletion_token_hash,source,names_expires_at)
 values(v_session,'admin-test',true,true,encode(extensions.gen_random_bytes(32),'hex'),coalesce(nullif(p_record->>'source',''),'manual_test'),now()+interval '30 days') on conflict do nothing;
 insert into flames.attempts(attempt_id,session_id,parent_attempt_id,name_one,name_two,result_letter,remaining_count,is_alternative,previous_result_letter,algorithm_version,source)
 values(v_attempt,v_session,nullif(p_record->>'parent_attempt_id','')::uuid,left(p_record->>'name_one',120),left(p_record->>'name_two',120),
   nullif(p_record->>'result_letter',''),(p_record->>'remaining_count')::int,coalesce((p_record->>'is_alternative')::boolean,false),
   nullif(p_record->>'previous_result_letter',''),coalesce(nullif(p_record->>'algorithm_version',''),'1.1.0'),coalesce(nullif(p_record->>'source',''),'manual_test'));
 insert into flames.feedback(attempt_id,liked_result,wants_change,desired_letter)
 values(v_attempt,(p_record->>'liked_result')::boolean,coalesce((p_record->>'wants_change')::boolean,false),nullif(p_record->>'desired_letter',''));
 return jsonb_build_object('session_id',v_session,'attempt_id',v_attempt,'stored',true);
end $$;

revoke all on all tables in schema flames from public, anon, authenticated;
revoke all on all sequences in schema flames from public, anon, authenticated;
revoke all on all functions in schema flames from public, anon, authenticated;
grant usage on schema flames to anon;
grant execute on function flames.ingest_attempt(uuid,uuid,uuid,timestamptz,text,boolean,text,text,text,text,integer,boolean,text,text,jsonb) to anon;
grant execute on function flames.record_feedback(uuid,uuid,boolean,boolean,text) to anon;
grant execute on function flames.delete_session_data(uuid,text) to anon;
grant execute on function flames.admin_dashboard(text,jsonb) to anon;
grant execute on function flames.admin_insert_test(text,jsonb) to anon;

insert into hub.app_resources(app_id,resource_type,resource_name,resource_schema,is_shared,notes)
select a.id,r.t,r.n,'flames',false,'FLAMES central research data'
from hub.apps a cross join (values
 ('schema','flames'),('table','sessions'),('table','attempts'),('table','feedback'),('table','name_variations'),('table','deletion_requests'),
 ('rpc','ingest_attempt'),('rpc','record_feedback'),('rpc','delete_session_data'),('rpc','admin_dashboard'),('rpc','admin_insert_test'),('rpc','enforce_retention')) r(t,n)
where a.slug='flames'
on conflict do nothing;

insert into hub.schema_versions(app_id,migration_key,notes)
select id,'202610250001_flames_central_data','Central consent-based storage, private analytics RPCs and retention metadata'
from hub.apps where slug='flames'
on conflict do nothing;
