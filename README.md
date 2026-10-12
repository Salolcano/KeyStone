# Keystone Deposits

Rental deposit escrow on GenLayer. A tenant locks a deposit, landlord and tenant each post a public evidence page, and GenLayer validators read both pages and set the split. A normal smart contract cannot fetch a live web page or weigh written lease terms against photos and invoices, so GenLayer sits at the center of the workflow.

## Network

- Network: Studio Next (Consensus v0.6)
- RPC: https://studio-next.genlayer.com/api
- Chain ID: 61997
- Explorer: https://explorer-studio-dev.genlayer.com/
- Deployed contract: set after deploying contracts/keystone.py

## Project structure

```
contracts/keystone.py     Keystone Intelligent Contract
frontend/                 Next.js app with Deposits and Dashboard tabs (genlayer-js 2.0.0-rc.1)
deploy/deployScript.ts    Deployment script
tests/unit/               Lifecycle and decision tests
config/network.json       Studio Next settings
```

## Contract

- create_deposit(landlord, property_name, lease_terms): payable, the tenant locks the deposit
- submit_evidence(id, url): tenant or landlord links a public evidence page
- request_ruling(id): either party; validators read the pages and return a tenant share
- cancel_deposit(id): tenant exit before any evidence attempt
- claim_refund(id): tenant exit after an inconclusive attempt
- landlord_release(id): landlord returns the full deposit
- get_deposits(), get_total_locked(): views

A deposit is open, then ends as ruled, refunded, cancelled or returned. Every end state is final and no amount can leave twice.

## Lifecycle and exits

- No evidence attempt yet: the tenant can cancel, unless the landlord has already filed evidence.
- Conclusive verdict: the deposit is split at once by the validators' percentage.
- Inconclusive verdict: counts as one attempt. The tenant can call claim_refund for the full deposit, and either party can add evidence and request another ruling.
- Second inconclusive verdict: the tenant is refunded automatically.
- Unreadable evidence or unusable model output: the call reverts, nothing is recorded, no attempt is used.

An open deposit always has a tenant exit: cancel before any attempt, claim_refund after one.

## Who decides what

Code decides everything about money: who the parties are, the amount locked, who may call what, the attempt limit, and the payout direction. Validators answer one narrow question about the evidence: what percent of the deposit returns to the tenant, or whether the evidence is inconclusive.

## How the decision works

request_ruling reads each evidence page with gl.nondet.web.render and asks the model for a fixed schema:

```
{"conclusive": bool, "tenant_share_pct": int}
```

The output is reduced to one value (a percent rounded to the nearest 10, inconclusive, or invalid), and gl.eq_principle.strict_eq makes validators agree on exactly that value before state changes or money moves.

- Only a real JSON true for conclusive and an integer from 0 to 100 count as a ruling. Strings, booleans in place of numbers, and out-of-range values are treated as inconclusive.
- Lease terms and page text are untrusted. They go to the model as one JSON-escaped data object with instructions placed around it.
- Stored reasons are written by the contract from the agreed verdict. Free-form model text is never stored.

Known limitations: each party chooses its own evidence page, so this demonstrates consensus-based dispute resolution and does not replace a legal process. There are no deadlines.

## Tests

```
pip install pytest
pytest tests/unit -v
```

The tests run the real contract file against a small stand-in for the GenLayer runtime. They cover cancel, split rulings, fund conservation, the inconclusive-then-refund path, automatic refund after a second inconclusive ruling, reverts on unreadable output, role checks, and no calls after settlement. The stand-in checks contract logic, not validator consensus on Studio.

## Frontend

The Deposits tab opens deposits and runs every contract action by role. The Dashboard tab shows totals, GEN held, average tenant share, outcome counts and a case table.

```
cp frontend/.env.example frontend/.env
# set NEXT_PUBLIC_CONTRACT_ADDRESS
cd frontend && npm install && npm run dev
```

A browser wallet such as MetaMask is required. The app adds and switches to Studio Next.
