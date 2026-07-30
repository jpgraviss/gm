"""Date-range and comparison-period math shared by both connectors.

Both scripts resolve their date range from the same --days/--start/--end
flags (build spec section 7), but Search Console needs a different default
end date than GA4 because of its reporting lag — that's the
`default_end_offset_days` parameter below, not duplicated per connector.
"""
from __future__ import annotations

from datetime import date, timedelta


def resolve_range(
    days: int = 30,
    start: str | None = None,
    end: str | None = None,
    default_end_offset_days: int = 0,
) -> dict:
    """Returns {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}.

    --end defaults to today minus default_end_offset_days (0 for GA4, 3 for
    GSC's reporting lag) unless given explicitly. --start defaults to
    end - (days - 1) unless given explicitly; when given, it overrides
    --days per the CLI contract.
    """
    if end:
        end_date = date.fromisoformat(end)
    else:
        end_date = date.today() - timedelta(days=default_end_offset_days)

    if start:
        start_date = date.fromisoformat(start)
    else:
        start_date = end_date - timedelta(days=days - 1)

    if start_date > end_date:
        raise ValueError(f"--start ({start_date}) is after --end ({end_date})")

    return {"start": start_date.isoformat(), "end": end_date.isoformat()}


def comparison_range(primary: dict) -> dict:
    """The immediately preceding period of equal length to `primary`, for
    --compare. E.g. primary Jun 1-30 (30 days) -> May 2-31 (30 days)."""
    start_date = date.fromisoformat(primary["start"])
    end_date = date.fromisoformat(primary["end"])
    length_days = (end_date - start_date).days + 1
    comp_end = start_date - timedelta(days=1)
    comp_start = comp_end - timedelta(days=length_days - 1)
    return {"start": comp_start.isoformat(), "end": comp_end.isoformat()}


def is_end_today(range_dict: dict) -> bool:
    return range_dict["end"] == date.today().isoformat()
