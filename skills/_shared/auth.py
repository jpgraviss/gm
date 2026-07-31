"""Credential loading shared by every Graviss SEO data connector.

Resolution order:
  1. GRAVISS_GA_CREDENTIALS env var — path to a service-account JSON key
  2. ~/.config/graviss/analytics-key.json
  3. Fail with an actionable message naming both locations checked

Credentials are never read from inside this repo — the key file lives
outside version control entirely, not just gitignored. `.gitignore` still
carries the credential filename patterns as defense in depth.
"""
from __future__ import annotations

import os
from pathlib import Path

ENV_VAR = "GRAVISS_GA_CREDENTIALS"
DEFAULT_KEY_PATH = Path.home() / ".config" / "graviss" / "analytics-key.json"

# One service account currently covers both GA4 and Search Console reads.
SERVICE_ACCOUNT_SCOPES = [
    "https://www.googleapis.com/auth/analytics.readonly",
    "https://www.googleapis.com/auth/webmasters.readonly",
]


class CredentialsNotFoundError(RuntimeError):
    """Raised when no usable service-account key can be located."""


def resolve_key_path() -> Path:
    """Return the path to the service-account key, or raise a clear error
    naming every location checked. Callers should invoke this before doing
    any other work, so a missing-credentials run fails immediately with a
    readable message instead of a traceback from deeper in a script."""
    env_path = os.environ.get(ENV_VAR)
    if env_path:
        path = Path(env_path).expanduser()
        if path.exists():
            return path
        raise CredentialsNotFoundError(
            f"No Google service-account credentials found.\n"
            f"Checked:\n"
            f"  1. {ENV_VAR}={path} — set, but no file exists there\n"
            f"  2. {DEFAULT_KEY_PATH} — not checked ({ENV_VAR} takes priority when set)\n"
            f"Fix the path in {ENV_VAR}, or unset it to fall back to {DEFAULT_KEY_PATH}."
        )

    if DEFAULT_KEY_PATH.exists():
        return DEFAULT_KEY_PATH

    raise CredentialsNotFoundError(
        "No Google service-account credentials found.\n"
        "Checked:\n"
        f"  1. {ENV_VAR} env var — not set\n"
        f"  2. {DEFAULT_KEY_PATH} — not found\n"
        "Set one of the above to a service-account JSON key with GA4 and "
        "Search Console access. See skills/google-analytics/SKILL.md and "
        "skills/google-search-console/SKILL.md for setup details."
    )


def get_credentials():
    """Return a google.oauth2.service_account.Credentials for GA4 + GSC.

    Imports google-auth lazily so resolve_key_path()'s clean failure path
    can run — and be tested — without the dependency installed.
    """
    from google.oauth2 import service_account

    key_path = resolve_key_path()
    return service_account.Credentials.from_service_account_file(
        str(key_path), scopes=SERVICE_ACCOUNT_SCOPES,
    )


def get_gbp_credentials():
    """Google Business Profile credential path — not yet implemented.

    GBP typically requires an OAuth user-consent flow rather than a
    service account, and access is separately pending Google's approval
    queue. This stub exists so callers can be written against a stable
    interface now; see skills/google-business-profile/README.md.
    """
    raise NotImplementedError(
        "Google Business Profile access is pending approval and has no "
        "credential path yet — see skills/google-business-profile/README.md."
    )
