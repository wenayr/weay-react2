# Task progress

This directory is for short-lived checkpoint files during active non-trivial tasks.

Rules:
- create one file per task, named `doc/progress/<task>.md`;
- keep it short: goal, checkpoints, decisions, blockers, and verification;
- update it when checkpoints are completed or before switching context;
- delete it when the task is finished;
- keep durable history elsewhere: changelog/release notes for publishable changes,
  roadmap/recommendations/target docs for long-lived project direction,
  and the commit message or final response for the immediate summary.

Progress files are working notes, not API docs, release notes, or the durable target queue. When a task comes from `doc/target/my.md`, update that file before deleting the progress file: move completed work to `Verify` until checks pass, or remove it only after verification is recorded.