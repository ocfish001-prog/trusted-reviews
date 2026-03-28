"""
Supabase client initialization.

Two clients are created:
  - `supabase`: service-role client (bypasses RLS) — for admin ops like signup, marking invites used
  - `supabase_anon`: anon client — for user-scoped queries with RLS enforced via JWT
"""
from supabase import create_client, Client
from config import settings

# Service-role client: use for privileged operations
supabase: Client = create_client(settings.supabase_url, settings.supabase_key)

# Anon client factory: use for user-scoped operations
def get_user_client(token: str) -> Client:
    """Return a Supabase client with the user's JWT set for RLS enforcement."""
    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    client.auth.set_session(token, "")
    return client
