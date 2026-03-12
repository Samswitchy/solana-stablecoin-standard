# Compliance Considerations

## Core Expectations

- On-chain blacklist enforcement on transfer path (SSS-2)
- Role-based restricted compliance actions
- Consistent audit trail for blacklist and seize operations

## Audit Trail Fields

- `action`
- `actor`
- `target`
- `reason`
- `timestamp`
- `tx_signature` (when connected to chain execution)

## Graceful Failure

Compliance operations MUST fail with explicit errors when compliance modules are disabled.
