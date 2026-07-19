alter table contract_cost_terms
  add column if not exists category varchar(40) not null default 'other',
  add column if not exists description text,
  add column if not exists incurred_on date;

update contract_cost_terms
set
  incurred_on = coalesce(incurred_on, nullif(scope_id, '')::date),
  description = coalesce(description, 'Contract cost term')
where scope_type = 'operator_expense'
  and (scope_id is null or scope_id ~ '^\d{4}-\d{2}-\d{2}$');

alter table payments
  add column if not exists method varchar(40) not null default 'bank_transfer',
  add column if not exists notes text;

alter table payees
  add column if not exists email text;

alter table releases
  add column if not exists artist_name text not null default 'Unknown artist',
  add column if not exists catalog_status varchar(20) not null default 'released';

alter table tracks
  add column if not exists artist_name text not null default 'Unknown artist',
  add column if not exists catalog_status varchar(20) not null default 'released';
