-- ë • HQ — pose les rôles eHQ dans le JWT Supabase (corrige « Workspace locked »).
--
-- L'UI ET l'API lisent le rôle depuis le token (`app_metadata.ehq_role`). Sans ce claim,
-- un utilisateur retombe sur "viewer" → aucun workspace → verrouillé (et, depuis le
-- correctif d'autorisation API, refusé en 403 partout). Poser `raw_app_meta_data.ehq_role`
-- fait que Supabase l'inclut dans chaque token émis ensuite.
--
-- Idempotent. ⚠️ Les utilisateurs doivent SE RECONNECTER après (le claim arrive au
-- prochain token). Rôles valides : administrator, office, distribution, bot_office,
-- bot_distribution, operator.

begin;

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('ehq_role',
       case
         when email ilike 'd@%'            then 'administrator'
         when email ilike 'david@%'        then 'administrator'
         when email ilike 'office@%'       then 'office'
         when email ilike 'distribution@%' then 'distribution'
         when email ilike 'operator@%'     then 'operator'
         else 'operator'
       end)
where email in ('d@eeee.mu', 'david@eeee.mu', 'office@eeee.mu', 'distribution@eeee.mu', 'operator@eeee.mu');

commit;

-- Vérification (chaque compte doit avoir son ehq_role) :
select email, raw_app_meta_data->>'ehq_role' as ehq_role
from auth.users
where email in ('d@eeee.mu', 'david@eeee.mu', 'office@eeee.mu', 'distribution@eeee.mu', 'operator@eeee.mu')
order by email;

-- ----------------------------------------------------------------------------
-- Compte agent/automate (la "Sophie" côté Office, si elle existe) : rôle bot_office.
-- Adapter l'email réel, puis exécuter :
--
-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb) || '{"ehq_role":"bot_office"}'::jsonb
-- where email = '<email-du-bot-office>';
--
-- ----------------------------------------------------------------------------
-- Alternative durable + scalable (recommandée si beaucoup de comptes) : un
-- Custom Access Token Hook Supabase (Dashboard → Authentication → Hooks) qui lit une
-- table de rôles et injecte `ehq_role` à chaque émission de token — au lieu de poser
-- le claim par utilisateur. Pour 4 comptes fixes, le UPDATE ci-dessus suffit.
