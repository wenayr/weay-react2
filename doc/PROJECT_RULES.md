# Project Rules

These rules are mandatory for maintainers and AI agents working in this repository.

## README

`README.md` is a documentation index only.

It should say where the important files are, not teach the API, duplicate examples, or contain release history. Keep API explanations in the brief/rare docs and keep version notes in `doc/changes/`.

Canonical documentation locations:

- `doc/wenay-react2.md` - brief everyday API for this package.
- `doc/wenay-react2-rare.md` - detailed, rare, compatibility, and migration notes for this package.
- `doc/PROJECT_FUNCTIONALITY.md` - project functionality map: what each subsystem is for and what belongs outside the library.
- `doc/EXAMPLE_USAGE.md` - example usage standards: which primitive to choose, how to use it, and why.
- `doc/WENAY_REACT2_RENAMES.md` - breaking rename map for this package.
- `doc/changes/` - recent version changes.

`wenay-common2` documentation is not canonical in this repository. When common2 behavior matters, read the installed package/module docs and summarize only the React-facing impact in `doc/wenay-react2.md` or `doc/wenay-react2-rare.md`.

## wenay-common2 / common2 Updates

In this repository, `common2` is the short name for `wenay-common2`. If a request says to check updates, update common/common2, read what changed in common, or similar, and no other dependency is named, assume it means `wenay-common2`.

Before summarizing or acting on such an update, read:

- `node_modules/wenay-common2/package.json` for the installed version.
- `node_modules/wenay-common2/doc/changes/README.md` and the newest files in `node_modules/wenay-common2/doc/changes/` for what changed.

If the package is updated, read the changelog from the newly installed package before changing React-facing docs or code. Keep local docs focused on the React-facing impact.

## Target Backlog

- `doc/target/` is the durable queue for dictated tasks and imported task direction. Read `doc/target/README.md` before acting on a request that starts from `target`.
- `doc/target/my.md` must show task status. Before implementation, move/normalize the selected item into `In Progress`; when implementation is believed complete, move it to `Verify`; remove it from the queue only after acceptance checks pass and durable results are recorded.
- `doc/progress/` is temporary and must not be used as the only task-status record. If a progress file is deleted at completion, `doc/target/my.md` must already be cleaned, moved to `Verify`, or otherwise updated with the next required check.
- `target/*.md` files are source specs/prompts. Do not edit or delete them merely for progress tracking unless the user explicitly asks.
## Work Progress Files

- For any task that is more than a tiny/local edit, create a temporary progress file before starting broad changes.
- Put progress files under `doc/progress/`. This is the working-doc area, separate from public docs, roadmap docs, and release notes.
- Name them by task, for example `doc/progress/replay-route-handoff.md`.
- Keep the file short: goal, current checkpoints, notable decisions, blockers, and verification already run or still needed.
- Update the progress file as checkpoints are completed, especially before switching context or making broad edits.
- When the task is finished, delete the progress file.
- Preserve only the durable outcome: final response, commit message, and, for publishable changes, the matching changelog/release-note entry.
- If work is paused or blocked locally, leave the progress file in place and make the next required action explicit.
- If the paused state must be committed or handed off, promote the useful part into a durable doc such as `ROADMAP`, `RECOMMENDATIONS`, `doc/target`, or `doc/changes`, instead of relying on an ignored progress file.

## Recent Changes Catalog

Every meaningful code, public API, dependency, migration, or documentation-policy change must add or update a file in `doc/changes/`.

Rules:

- Use one file per version: `doc/changes/vX.Y.Z.md`.
- The version name is mandatory and must be visible in the file title.
- Write the entry like a commit summary: what changed, why it matters, and how it was checked.
- If several related changes land before the next publish, append them to the same version file.
- Keep only the latest 10 version files in `doc/changes/`; when adding the 11th, delete the oldest version file.
- Do not move old release notes into `README.md`.

Recommended entry shape:

```md
# vX.Y.Z

Date: YYYY-MM-DD

- Changed: ...
- Reason: ...
- Verification: ...
```

## Style / Theme / Cleanup Notes

When changing shared styles, tokens, theme contracts, QA stand behavior, or cleanup decisions, update `doc/wenay-react2-rare.md`. Keep README as an index and keep broad API examples in `doc/wenay-react2.md`.

Do not delete public exports as cleanup in the same pass that identifies them. First document suspicious exports in the rare-doc cleanup inventory, then remove or move them only in a deliberate breaking change.
