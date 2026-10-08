# Connexion du sondage à Supabase

1. Appliquer `migrations/20261008000000_create_survey_responses.sql` au projet Supabase.
2. Si Supabase CLI et une base locale sont disponibles, exécuter le test pgTAP avec `supabase test db`.
3. Renseigner l’URL du projet et sa clé **publishable** dans `assets/supabase-config.js`.

La clé publishable est destinée au navigateur. Ne jamais placer de clé `sb_secret_…` ou `service_role` dans ce projet public.

Le navigateur appelle uniquement le RPC `submit_survey_response`. Les rôles `anon` et `authenticated` ne peuvent ni lire, ni insérer directement, ni modifier, ni supprimer les lignes de `survey_responses`.

Chaque navigateur conserve un `surveySubmissionId` UUID. La clé primaire de la table et `on conflict do nothing` rendent les nouvelles tentatives idempotentes : une coupure réseau ou un double clic ne crée pas de doublon. Tant que l’envoi échoue, les réponses et l’état `pending_sync` restent dans `localStorage`; une nouvelle tentative est faite au rechargement ou au retour de la connexion.
