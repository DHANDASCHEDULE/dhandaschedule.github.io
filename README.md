# DHANDA — Set Calendar

A standalone, responsive DJ schedule for DHANDA. The calendar starts with the October 2026 work-set times supplied by the director.

## GitHub Pages

This is a buildless static site. Publish from the `main` branch root in the repository's **Settings → Pages**.

## Schedule data and private editor

The public calendar reads its schedule from Supabase when configured. See [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for the one-time setup, the SQL security rules, and the October seed data. The sticky menu includes a private DHANDA login and tools for adding or removing scheduled times. Keep the Supabase service-role key out of all website files; only the public project URL and publishable/anon key belong in `supabase-config.js`.

Until the Supabase project is configured, the site displays its bundled October 2026 schedule and keeps remote editing unavailable. Set times use Pacific Time / SLT and the next-set card follows the same schedule.
