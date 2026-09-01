# wenay-react2

Documentation index only.

- Brief API guide: [doc/wenay-react2.md](doc/wenay-react2.md)
- React Native/headless entrypoint: [doc/native.md](doc/native.md)
- Detailed / rare API guide: [doc/wenay-react2-rare.md](doc/wenay-react2-rare.md)
- Project functionality map: [doc/PROJECT_FUNCTIONALITY.md](doc/PROJECT_FUNCTIONALITY.md)
- Example usage standards: [doc/EXAMPLE_USAGE.md](doc/EXAMPLE_USAGE.md)
- wenay-react2 rename map: [doc/WENAY_REACT2_RENAMES.md](doc/WENAY_REACT2_RENAMES.md)
- Project rules for maintainers and AI agents: [doc/PROJECT_RULES.md](doc/PROJECT_RULES.md)
- Recent version changes: [doc/changes/](doc/changes/)

`wenay-common2` is an external dependency. Read its current docs from the installed module/package when needed; keep this README focused on `wenay-react2` documentation.

Feature-specific docs may also live next to their code, for example agGrid4 docs under `src/internal/grid/agGrid4/`.

## Shipped examples

- [doc/examples/peer-call-media.tsx](doc/examples/peer-call-media.tsx) — Peer calls, presence, camera and microphone relay with server-owned ACL (`wenay-react2/demo/peer-media`).
- [doc/examples/conference-server.mjs](doc/examples/conference-server.mjs) + client — real-backend conference bridge (`wenay-react2/demo/peer-conference` is the in-process world).
- The interactive QA stand is not published since 2.0.0; run it from the repository with `npm run testReact` (`src/stand/`).
