// Recovery-catcher bot for btc-race-24h-20261115-0828 (agent-fun/bars-replay/v1).
//
// Own strategy, written for this competition. Long only, one position, full size.
//
// Why this shape: on 1-minute bars Bitcoin whipsaws, so fast EMA crossovers
// bleed fees (a full round trip costs ~26 bps) and a Donchian breakout bot I
// tried first lost $15.85 on the dev window. The dev day fell 4% and then
// recovered 5.4% off its low, so the money is in one patient trade, not in
// many small ones. This bot waits for a confirmed recovery instead:
//   - entry: the close is at least 2% above the lowest low of the previous
//     240 bars, above its EMA(21), and RSI(14) is above 50 (momentum turning
//     up, not a dead-cat bounce inside a falling market);
//   - exit: the whole position on a 4% take-profit, a 2.5% stop-loss, or a
//     3% trailing stop from the peak since entry; otherwise it holds to the
//     end of the window, where the harness flattens it.
// On the dev window it trades once, buying near the day's low and holding the
// recovery, for a net PnL above zero after all fees, slippage and impact.
//
// Deterministic: pure float arithmetic on the bars the harness sends, no clock,
// no environment, no randomness. One reply per batch, at most one order.

import { runBars, type Bar, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const LOOKBACK_BARS = 240; // recovery: lowest low of the previous 240 bars (4 hours)
const RECOVERY = 0.02; // entry: close at least 2% above that low
const EMA_BARS = 21; // entry: close above its EMA(21)
const RSI_BARS = 14; // entry: RSI(14) above 50
const RSI_MIN = 50;
const TAKE_PROFIT = 0.04; // exit when the position is worth 4% over its cost
const STOP_LOSS = 0.025; // exit when the position is worth 2.5% under its cost
const TRAILING_STOP = 0.03; // exit when the close is 3% below the peak since entry
const MAX_SLIPPAGE_BPS = 100; // 1% past the close the order was decided on

/** Rolling state for one symbol: lows, EMA, RSI and the peak since entry. */
class Recovery {
  lows: number[] = [];
  ema: number | null = null;
  emaWarm: number[] = [];
  lastClose: number | null = null;
  firstChanges: number[] = [];
  gain: number | null = null;
  loss: number | null = null;
  peak: number | null = null;

  push(bar: Bar): void {
    const close = Number(bar.c);
    this.lows.push(Number(bar.l));
    if (this.lows.length > LOOKBACK_BARS) this.lows.shift();
    if (this.ema !== null) {
      this.ema += (2 / (EMA_BARS + 1)) * (close - this.ema);
    } else {
      this.emaWarm.push(close);
      if (this.emaWarm.length === EMA_BARS) {
        this.ema = this.emaWarm.reduce((a, x) => a + x, 0) / EMA_BARS;
      }
    }
    if (this.lastClose !== null) {
      const change = close - this.lastClose;
      if (this.gain === null || this.loss === null) {
        this.firstChanges.push(change);
        if (this.firstChanges.length === RSI_BARS) {
          this.gain = this.firstChanges.reduce((a, x) => a + (x > 0 ? x : 0), 0) / RSI_BARS;
          this.loss = this.firstChanges.reduce((a, x) => a + (x < 0 ? -x : 0), 0) / RSI_BARS;
        }
      } else {
        this.gain = (this.gain * (RSI_BARS - 1) + Math.max(change, 0)) / RSI_BARS;
        this.loss = (this.loss * (RSI_BARS - 1) + Math.max(-change, 0)) / RSI_BARS;
      }
    }
    this.lastClose = close;
  }

  rsi(): number | null {
    if (this.gain === null || this.loss === null) return null;
    const moved = this.gain + this.loss;
    return moved === 0 ? 50 : (100 * this.gain) / moved;
  }

  /** True when the close is a confirmed recovery from the 240-bar low. */
  recovery(close: number): boolean {
    if (this.lows.length < LOOKBACK_BARS || this.ema === null) return false;
    const low = Math.min(...this.lows.slice(0, -1));
    const rsi = this.rsi();
    return close / low - 1 >= RECOVERY && close > this.ema && (rsi === null || rsi > RSI_MIN);
  }
}

const recovery = new Recovery();

await runBars({
  onBatch(state: BarsState, batch: { bars: Bar[] }) {
    for (const bar of batch.bars) {
      if (bar.symbol === SYMBOL) recovery.push(bar);
    }
    if (state.warmingUp) return [];
    const bar = state.latest.get(SYMBOL);
    if (bar === undefined) return [];
    const close = Number(bar.c);
    const held = state.positions.get(SYMBOL);

    if (held !== undefined) {
      if (recovery.peak === null || close > recovery.peak) recovery.peak = close;
      const value = state.value(SYMBOL, held.qty);
      const ret = Number(value) / Number(held.cost) - 1;
      const trail = recovery.peak === null ? 0 : close / recovery.peak - 1;
      if (ret >= TAKE_PROFIT || ret <= -STOP_LOSS || trail <= -TRAILING_STOP) {
        recovery.peak = null;
        const sell: SellInput = { side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS };
        return [sell];
      }
      return [];
    }

    if (recovery.recovery(close)) {
      recovery.peak = close;
      if (state.cash <= 0n) return [];
      const buy: BuyInput = { side: 'buy', symbol: SYMBOL, notional_quote_units: state.cash, max_slippage_bps: MAX_SLIPPAGE_BPS };
      return [buy];
    }
    return [];
  },
});
