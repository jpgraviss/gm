-- AUDIT.md #168 — accepting a contract addendum (Value Change / Term
-- Extension, carrying a value_delta/term_delta_months) flipped its own
-- status to Accepted and the UI showed "Client accepted," but nothing ever
-- applied that delta to the parent contract's value/duration/renewal_date.
-- The contract's real value used everywhere else (dashboards, MRR math,
-- renewals) never reflected an addendum a rep believed was signed off on.
--
-- Decision applied here: auto-apply on Accept. Term extensions push
-- renewal_date forward by term_delta_months AND update duration; value
-- changes update contract value; multiple accepted addendums stack
-- cumulatively (each acceptance adds its delta on top of whatever's
-- already there).
--
-- `delta_applied` tracks, per addendum, whether its delta has ever been
-- pushed to the parent contract. This is deliberately a one-shot flag
-- rather than a re-derivable "is status Accepted" check: contract_addendums
-- PATCH has no VALID_TRANSITIONS guard (unlike contracts), so status can be
-- flipped back and forth (Accepted -> Declined -> Accepted). Gating on this
-- flag (claimed atomically, see the function below) guarantees a given
-- addendum's delta is ever applied to the contract at most once, even
-- under concurrent PATCH calls or repeated re-saves.
alter table public.contract_addendums
  add column if not exists delta_applied boolean not null default false;

-- Applies one addendum's value_delta/term_delta_months to its parent
-- contract, atomically and exactly once. Modeled on this codebase's
-- established atomic-RPC pattern for "update parent based on child action"
-- (adjust_sequence_counts, adjust_course_enrolled_count,
-- increment_tracked_email_counts) — a plain JS select-then-write here would
-- reopen the same lost-update race those were written to close, and
-- multiple accepted addendums need to stack on top of each other's results,
-- not the original base value.
--
-- Returns true if the delta was applied by this call, false if the
-- addendum's delta had already been applied previously (no-op, so callers
-- can tell a genuine apply from a harmless retry).
create or replace function apply_addendum_delta_to_contract(
  p_addendum_id       text,
  p_contract_id       text,
  p_value_delta       numeric,
  p_term_delta_months integer
) returns boolean as $$
declare
  v_claimed      text;
  v_start_date   text;
  v_duration     integer;
  v_new_duration integer;
begin
  -- Claim this addendum's delta application first. The WHERE delta_applied
  -- = false makes this UPDATE itself the atomic compare-and-set: if two
  -- PATCH requests for the same addendum race, only one of them can flip
  -- the row and get a non-null id back.
  update public.contract_addendums
  set delta_applied = true
  where id = p_addendum_id and delta_applied = false
  returning id into v_claimed;

  if v_claimed is null then
    return false;
  end if;

  select start_date, duration into v_start_date, v_duration
  from public.contracts
  where id = p_contract_id
  for update;

  if not found then
    return false;
  end if;

  v_new_duration := least(120, greatest(1, v_duration + coalesce(p_term_delta_months, 0)));

  update public.contracts
  set value = least(100000000, greatest(0, value + coalesce(p_value_delta, 0))),
      duration = v_new_duration,
      -- Contracts are otherwise always kept as renewal_date = start_date +
      -- duration months (see NewContractPanel / app/contracts/page.tsx
      -- handleNewContract / handleSaveContractEdit) — recomputing from
      -- start_date + the new duration keeps that invariant rather than
      -- letting renewal_date and duration drift apart. Falls back to
      -- pushing the existing renewal_date forward by term_delta_months
      -- when there's no start_date to recompute from.
      renewal_date = case
        when p_term_delta_months is null or p_term_delta_months = 0 then renewal_date
        when v_start_date is not null and v_start_date <> ''
          then (v_start_date::date + make_interval(months => v_new_duration))::text
        when renewal_date is not null and renewal_date <> ''
          then (renewal_date::date + make_interval(months => p_term_delta_months))::text
        else renewal_date
      end
  where id = p_contract_id;

  return true;
end;
$$ language plpgsql;
