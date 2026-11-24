# Project notes for Claude

## Code navigation: use Graphify first

This repository is indexed in Graphify (`justinangeloperez327/daily-schedule-tracker`).
For questions about code structure, use the Graphify MCP tools before grep or reading files:

- where something is defined: `graphify_find`
- how a feature works or where behavior lives: `query_graph`
- who calls a function: `graphify_callers`
- what a change affects: `graphify_impact`
- tests linked to code: `graphify_tests_for`
- a file's imports and dependents: `graphify_file_neighbors`

The graph is built from the `main` branch. Compare each result's `commitSha` with
`git rev-parse HEAD`; for files changed since that commit (for example on a feature
branch), read the current file instead. Use grep for literal strings and config values.
