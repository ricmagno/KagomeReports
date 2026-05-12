# ADR 0001: Use Retry Strategy for OPC UA Connections

- **Status**: Accepted
- **Date**: 2026-02-28
- **Author**: AI Assistant

## Context
Industrial OPC UA servers (e.g., AVEVA Historian) can be unstable due to network constraints, resulting in "premature disconnection" errors during the initial handshake.

## Decision
We decided to wrap all OPC UA `connect()` and `createSession()` calls in a `RetryHandler` with exponential backoff.

## Consequences
- **Positive**: Improved connection stability in unstable network environments.
- **Negative**: Initial connection attempts takes longer if the server is slow to respond.
- **Dependency**: Requires the `RetryHandler` utility.
