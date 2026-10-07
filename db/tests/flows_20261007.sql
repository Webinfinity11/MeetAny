-- Run after the existing db/tests/run.sh suite, using its t harness, on a throwaway local DB only.
\set ON_ERROR_STOP 1
\ir ../migrations/20261007-offer-terms.sql
\ir ../migrations/20261007-offer-terms.sql
\ir offer_terms_tests.sql
\ir ../migrations/20261007-deals.sql
\ir ../migrations/20261007-deals.sql
\ir deals_tests.sql
\ir ../migrations/20261007-contact-visibility.sql
\ir ../migrations/20261007-contact-visibility.sql
\ir contact_visibility_tests.sql
\ir ../migrations/20261007-matching.sql
\ir ../migrations/20261007-matching.sql
\ir matching_tests.sql
\ir ../migrations/20261007-onboarding.sql
\ir ../migrations/20261007-onboarding.sql
\ir onboarding_tests.sql
-- Reapply with populated rows, preserving completed deals and private grants.
\ir ../migrations/20261007-offer-terms.sql
\ir ../migrations/20261007-deals.sql
\ir ../migrations/20261007-contact-visibility.sql
\ir ../migrations/20261007-matching.sql
\ir ../migrations/20261007-onboarding.sql
select t.ok((select rating=5 and revision=10 from meetany_private.deals where id=t.get('flow_d')),'FLOW populated reapply preserves agreement');
select t.ok(not has_column_privilege('anonymous','public.profiles','phone','SELECT'),'FLOW populated reapply preserves privacy');
