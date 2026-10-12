# DHANDA — Set Calendar

A standalone, responsive DJ schedule for DHANDA. The calendar starts with the October 2026 work-set times supplied by the director.

## GitHub Pages

This is a buildless static site. Publish from the `main` branch root in the repository's **Settings → Pages**.

## Schedule data

Edit the `schedule` object at the top of `script.js`. Use ISO dates (`YYYY-MM-DD`) and 24-hour start times (`HH:MM`). The featured **UP NEXT** set updates from the browser's current Pacific Time / SLT clock. Entries are start times only; durations, venues, styles, and teleport links are not included unless supplied.
