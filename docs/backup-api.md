# Cookbook backup v1

`GET /api/backup/export` downloads formatted JSON as
`heirloom-backup-YYYY-MM-DD.json` with `Cache-Control: no-store`.
The envelope has exactly `version: 1`, an ISO `exportedAt`, `recipes`, and
`pantry`. Recipes include complete stored parent rows plus `ingredients`,
`steps`, and `equipment`; IDs, timestamps, ordering, nulls, and inline card
photos are preserved. Pantry contains complete stored pantry rows.

`POST /api/backup/import` accepts that envelope directly as JSON. It merges
by ID: imported recipe fields and their child collections replace the same
recipe's stored values; matching pantry rows are restored, not added to
their current quantities. Entries absent from the backup remain unchanged.
Repeated imports are idempotent. An empty backup is a no-op.

Success is HTTP 200 with `{"imported":{"recipes":N,"pantry":N}}`.
Invalid schemas, versions, duplicate IDs, duplicate step numbers, and
mismatched parent IDs return 400. A child ID already owned by a different
recipe returns 409. All validation precedes writes; all writes share one
SQLite transaction, including rollback on database failures.

These endpoints use the existing Host and same-origin middleware. Settings,
guests, memories, cooking sessions, and grocery lists are outside the v1
file format and are not changed by import. Import overwrites matching IDs;
download a current backup first if those values need to be retained.

Verification: `pnpm test tests/backup.test.ts` and `pnpm typecheck`.

## Settings UI handoff

Jev reviewed the restore policy and recommended keeping merge-by-ID. The
backend already implements this; no policy change is needed.

Suggested text beside Restore Backup:

> Restoring overwrites recipes and pantry items that match entries in the
> backup. Other entries stay unchanged. Download a current backup first to
> keep their latest versions. If the backup is invalid or restoration fails,
> nothing is changed.

The settings UI is owned separately; this handoff does not change Vue files.
