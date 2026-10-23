# DHANDA — Host & Manager Schedule

A responsive professional site for DHANDA as a host and manager. Public information is organized into separate Schedule, About, Services, and Booking pages. The calendar starts with the October 2026 work hours supplied for her schedule.

## GitHub Pages

This is a buildless multi-page static site. Publish from the `main` branch root in the repository's **Settings → Pages**. The public menu links to `index.html`, `about.html`, `services.html`, and `booking.html`.

## Schedule data and private editor

The public availability calendar and booking form read from Supabase when configured. The dedicated public flyers page has been removed; flyer records and the private flyer editor remain available in the Schedule dashboard. See [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for setup and migration details. Clubs can request a booking; only DHANDA can view the inquiry inbox, manage time slots, and publish or remove flyers from the private dashboard on the Schedule page. Keep the Supabase service-role key out of all website files; only the public project URL and publishable/anon key belong in `supabase-config.js`.

Until the Supabase project is configured, the site displays its bundled October 2026 schedule and keeps remote editing unavailable. Shift times use Pacific Time / SLT and the upcoming-shift card follows the same schedule.
