-- ë • office — prérequis PROD pour importer les relevés bancaires EUR.
-- Idempotent : ré-exécutable sans risque, ne touche aucune donnée existante.
-- À lancer dans le SQL editor Supabase (ou par Codex avec DATABASE_URL).
--
-- Pose les 2 données qui manquent pour qu'un relevé EUR passe le preview :
--   1) un taux de change EUR -> MUR (sinon: issue amount_mur_missing_for_foreign_currency)
--   2) un compte bancaire EUR actif (sinon: issue account_not_found)

begin;

-- 1) Taux EUR -> MUR.
--    rate_e10 = taux × 10^10. Ex. 53.941005 -> 539410050000 (ajuste si besoin).
--    effective_date '2020-01-01' = couvre tout l'historique ; le cron quotidien
--    (refresh-fx.mjs) ajoutera ensuite les taux du jour. L'import prend le taux le
--    plus récent <= date de l'opération.
insert into exchange_rates (from_currency, to_currency, rate_e10, effective_date)
values ('EUR', 'MUR', 539410050000, date '2020-01-01')
on conflict (from_currency, to_currency, effective_date)
do update set rate_e10 = excluded.rate_e10;

-- 2) Compte bancaire EUR actif, dans le MÊME workspace que les comptes office
--    existants (workspace_id dérivé d'un compte existant -> pas de risque d'erreur).
--    Si aucun compte office n'existe encore, voir la variante manuelle plus bas.
insert into office_bank_accounts
  (workspace_id, bank_name, account_label, account_reference_hash, currency,
   current_balance_minor, current_balance_mur_minor, is_active)
select workspace_id, 'MCB', 'MCB EUR', 'mcb-eur-000455164509', 'EUR', 0, 0, true
from office_bank_accounts
order by created_at
limit 1
on conflict (workspace_id, account_reference_hash) do nothing;

commit;

-- Vérification (doit montrer 1 taux EUR->MUR et 1 compte EUR actif) :
select 'rate'    as kind, from_currency || '->' || to_currency as detail,
       rate_e10::text as value, effective_date::text as info
from exchange_rates where from_currency = 'EUR' and to_currency = 'MUR'
union all
select 'account' as kind, account_label as detail,
       currency as value, workspace_id || ' active=' || is_active::text as info
from office_bank_accounts where currency = 'EUR';

-- ----------------------------------------------------------------------------
-- VARIANTE MANUELLE (uniquement si la requête 2) n'a rien inséré parce qu'aucun
-- compte office n'existe encore) : remplace <WORKSPACE_ID> par l'id réel du
-- workspace office en prod, puis exécute :
--
-- insert into office_bank_accounts
--   (workspace_id, bank_name, account_label, account_reference_hash, currency,
--    current_balance_minor, current_balance_mur_minor, is_active)
-- values ('<WORKSPACE_ID>', 'MCB', 'MCB EUR', 'mcb-eur-000455164509', 'EUR', 0, 0, true)
-- on conflict (workspace_id, account_reference_hash) do nothing;
