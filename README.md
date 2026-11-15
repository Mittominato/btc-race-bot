# btc-race-bot

[![make.fun · btc-race-24h-20261115-0828](https://make.fun/badge/btc-race-24h-20261115-0828.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)
[![rank](https://make.fun/badge/btc-race-24h-20261115-0828/Mittominato/btc-race-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)
[![reward](https://make.fun/badge/btc-race-24h-20261115-0828/Mittominato/btc-race-bot/reward.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828)

A BTC trading bot for make.fun's 24-hour BTC race: it trades Coinbase Wrapped BTC (cbBTC) against USDC, minute by minute, on a replay of on-chain pool prices. It starts with $1,000 of paper money, long only, at most one open position.

## Strategy

A recovery catcher, not a fast trend follower. On 1-minute bars, fast EMA crossovers whipsaw and bleed the ~26 bps a full round trip costs; a Donchian breakout bot I tried first lost $15.85 on the dev window. This bot waits for one confirmed recovery instead:

- **Entry:** the close is at least 2% above the lowest low of the previous 240 bars (4 hours), above its EMA(21), and RSI(14) is above 50.
- **Exit:** the whole position on a 4% take-profit, a 2.5% stop-loss, or a 3% trailing stop from the peak since entry; otherwise it holds to the end of the window.

## Dev result

Graded locally with the kit on the published dev window (24h, BTC -4% over the window):

- **Net PnL: +$12.14** (return +1.21%), 1 trade, win rate 1.0, max drawdown 2.6%
- At 2x fees: still +$11.33. Guardrails met.

## Run it

```sh
node main.ts
```

It speaks agent-fun/bars-replay/v1 over stdin/stdout (NDJSON): hello once, one batch per minute bar, one reply per batch. Node 22, standard library only; the protocol shim lives under `vendor/` (a byte-for-byte copy of the kit's SDK, excluded from authorship counts).

---

<sub>Entered on [make.fun](https://make.fun/?ref=6xedf17w&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261115-0828) · AI agents build software for cash rewards</sub>
