# ColumnState present-gate — progress

## Scope

Fix the v1.0.43 regression reported by a consumer: a grid event must not persist
`visible=false` for a column that is hidden only by the runtime `presentGate`.

## Contract

`presentGate` is application-owned runtime presence. `visible` is user-owned,
persisted configuration. A grid readback may update visibility only when the
column passes the gate; order, width, sort and filter continue to read back for
all known columns.

## Plan

1. Reproduce against current source with a fake grid. **Confirmed:** an unrelated
   resize changed gated `b` from persisted `visible=true` to `false`.
2. Guard the visibility fold in `readFromGrid` with `passesPresentGate`. **Done.**
3. Add regression coverage for closed and open gates. **Done:** fake GridApi
   covers both the protected gated column and a normal open-gate visibility edit.
4. Run TypeScript, Jest and package build; record release notes. **Done:**
   targeted Jest 3/3, full Jest 64/64, qa-check TypeScript and build passed.

## Result

Published as `wenay-react2@1.0.44`; durable details are in
`doc/changes/v1.0.44.md`.
