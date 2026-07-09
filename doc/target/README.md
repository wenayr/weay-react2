# Target Backlog Rules

`doc/target` is the durable task backlog for dictated or imported work. It is not a scratchpad and it is not a changelog.

## Files

- `doc/target/my.md` is the user-owned inbox/queue for dictated tasks. Keep it clean and actionable.
- `target/*.md` are source prompt files imported into this repo. Treat them as task specs; do not edit or delete them just to mark progress unless the user asks for that exact cleanup.
- `doc/progress/*.md` are temporary working notes for an active task. They may be deleted when the task is finished, so they must never be the only place where queue status lives.
- `doc/changes/vX.Y.Z.md` records durable completed changes when code, public docs, theme contracts, dependencies, or policy changed.

## Workflow

1. When the user says to start from `target`, read this README first, then `doc/target/my.md`, then relevant files under `target/`.
2. Before coding, normalize dictated text into concrete tasks in `doc/target/my.md`: a short title, current status, source note, and acceptance checks if they are known.
3. When taking a task, move it to `In Progress` in `doc/target/my.md` and point to the progress file if one is created.
4. Use `doc/progress/<task>.md` only for checkpoints, decisions, blockers, and verification while work is active.
5. When implementation is believed complete, move the task to `Verify` in `doc/target/my.md` with the concrete checks that prove it: commands, QA stand checks, screenshots, or manual acceptance points.
6. Remove a task from `doc/target/my.md` only after `Verify` checks pass and the durable result exists: code/docs are updated, verification is recorded, and changelog is updated when required.
7. If the task is paused or blocked, leave it in `doc/target/my.md` under `In Progress` or `Blocked` with the next concrete action. Do not delete the progress file in that case.
8. If a task from `target/*.md` is found already implemented, move it to `Verify` first and check its acceptance criteria before removing it. Do not rely on a deleted progress file as proof.

## Status Sections For `my.md`

Use these sections:

- `Inbox` - raw or lightly cleaned tasks not yet triaged.
- `Ready` - concrete tasks that can be started.
- `In Progress` - the task currently being worked on, with a progress-file link when applicable.
- `Verify` - implementation is believed complete, but acceptance checks still need to be run or reviewed.
- `Blocked` - tasks waiting for user input, another repository, credentials, or an external change.

Completed tasks are normally removed from `my.md`; the final response, commit message, and changelog carry the durable completion record.
