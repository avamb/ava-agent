# Workers Paid Plan Pricing Snapshot

Date saved: 2026-02-14
Source: manual paste from user
Currency: USD

## Included monthly quotas

- Workers and Pages Functions:
  - First 10,000,000 requests
  - 30,000,000 CPU milliseconds
- Workers Logs observability:
  - 20,000,000 events per month
  - 7 days retention
- D1:
  - First 5 GB storage
  - 25,000,000,000 rows read
  - 50,000,000 rows written
- KV:
  - First 1 GB storage
  - 10,000,000 read operations
  - 1,000,000 write/delete/list operations
- Durable Objects:
  - First 1,000,000 requests
  - 400,000 GB-second duration
  - 1 GB stored data
  - 1,000,000 read units
  - 1,000,000 write units
  - 1,000,000 delete operations
- Workers Trace event logs:
  - First 10,000,000 logs
- Queues:
  - First 1,000,000 standard operations
- AI Gateway logs stored:
  - First 200,000 logs

## Overage pricing

- Workers and Pages Functions:
  - $0.30 per additional 1,000,000 billable requests
  - $0.02 per additional 1,000,000 CPU milliseconds
- D1:
  - $0.75 per additional 1 GB storage
  - $0.001 per additional 1,000,000 rows read
  - $1.00 per additional 1,000,000 rows written
- Durable Objects:
  - $0.15 per additional 1,000,000 requests
  - $12.50 per additional 1,000,000 GB-second duration
  - $0.20 per additional 1 GB storage
  - $0.00 per additional 1,000,000 rows read
  - $1.00 per additional 1,000,000 rows written
- KV Storage:
  - $0.50 per additional 1 GB storage
  - $0.50 per additional 1,000,000 read operations
  - $5.00 per additional 1,000,000 write/delete/list operations
- Logpush:
  - $0.05 per additional 1,000,000 Workers Trace event logs
- Queues:
  - $0.40 per additional 1,000,000 standard operations

## Notes

- This is a static snapshot and may become outdated.
- Before final budgeting, verify current prices in Cloudflare Billing.
