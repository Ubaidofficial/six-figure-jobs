# v2.9 migration notes

Railway/prod uses Postgres. Historical migrations contain SQLite-era SQL (DATETIME/PRAGMA) so `prisma migrate dev` against Railway fails (shadow DB).
For prod changes, we generated additive migrations via `prisma migrate diff` and applied with `prisma migrate deploy`.

There are multiple v2.9 migration folders with identical names due to repeated diff runs; they are no-op/empty and already applied on prod.
Do not edit or delete already-applied migration folders.
