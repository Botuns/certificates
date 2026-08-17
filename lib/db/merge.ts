import type { Atfal, Database } from "@/lib/types"

const byId = (list: Atfal[]) => new Map(list.map((a) => [a.id, a]))

/**
 * Union of two rosters, deleting nothing.
 *
 * Used at boot when the cached roster's common ancestor is unknown — after a
 * reload we cannot tell whether a record missing from the server was deleted
 * by someone else or simply never synced from here. Guessing "deleted" would
 * silently wipe unsynced work, so this errs toward keeping everything: a
 * record that reappears is a nuisance, a roster that vanishes on the morning
 * of the Ijtema is not.
 */
export function unionDatabases(local: Database, remote: Database): Database {
  const merged = byId(remote.atfal)
  for (const [id, mine] of byId(local.atfal)) merged.set(id, mine)

  return {
    rev: Math.max(local.rev, remote.rev),
    atfal: [...merged.values()],
    // The layout is a single small object the user may have been editing, and
    // the local copy is the one they last saw.
    fields: local.fields.length ? local.fields : remote.fields,
    updatedAt: Date.now(),
  }
}

const sameAtfal = (a: Atfal | undefined, b: Atfal | undefined) =>
  a?.name === b?.name && a?.dila === b?.dila

/**
 * Three-way merge of the roster.
 *
 * At the event more than one person may be adding names at once. A plain
 * last-writer-wins would throw away whichever tab saved second, so on a
 * conflict we replay our own changes (relative to the last state we synced)
 * on top of whatever is now on the server.
 *
 * @param base   the last state we successfully synced — the common ancestor
 * @param local  our current state, including unsaved edits
 * @param remote the state currently on the server
 */
export function mergeDatabases(
  base: Database,
  local: Database,
  remote: Database
): Database {
  const baseMap = byId(base.atfal)
  const localMap = byId(local.atfal)
  const merged = byId(remote.atfal)

  for (const [id, mine] of localMap) {
    const original = baseMap.get(id)
    if (!original) {
      // We added this record; keep it unless the server already has that id.
      if (!merged.has(id)) merged.set(id, mine)
    } else if (!sameAtfal(original, mine)) {
      // We edited it — our edit wins over an untouched remote copy.
      merged.set(id, mine)
    }
  }

  for (const [id, original] of baseMap) {
    if (localMap.has(id)) continue
    // We deleted it. Only honour that if the server hasn't since changed it.
    if (sameAtfal(merged.get(id), original)) merged.delete(id)
  }

  const layoutChanged =
    JSON.stringify(base.fields) !== JSON.stringify(local.fields)

  return {
    rev: Math.max(local.rev, remote.rev),
    atfal: [...merged.values()],
    fields: layoutChanged ? local.fields : remote.fields,
    updatedAt: Date.now(),
  }
}
