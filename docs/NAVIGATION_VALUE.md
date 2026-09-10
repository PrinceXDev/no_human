# Navigation value — measured before building (issue #114 phase 3, 2026-09-10)

Phase 3 of [issue #114](https://github.com/no-human-ai/no_human/issues/114) is a
gate, not a feature: *"measure navigation value before building"*. Phases 1 and
2 each shipped a signal — net-new type diagnostics at the review gate, then the
same signal one turn earlier at edit time. Phase 3 ships an **instrument and a
verdict**, and the thing it gates — an in-process SDK MCP server exposing
read-only `definition`/`references`/`hover` — is deliberately **not** built
here.

The issue's own reason for the gate: three years of LSP-for-agents development
has produced no published controlled experiment showing that navigation tools
improve resolve rates, independent benchmarks show frontier models underusing
them, and the Claude Agent SDK exposes no LSP tool while cloud sessions start no
language server. A symbol server is infrastructure this product would own and
carry, polyglot, indefinitely. The case for paying for it has to come from this
project's own recorded behaviour.

The instrument is [`scripts/navigation_value.py`](../scripts/navigation_value.py).
It writes nothing, imports nothing from the product, and prints no path, Grep
pattern, session id or file content — only aggregates.

## The question

Of the characters the coder spends on file reads, how many sit in reads that a
`definition`/`references`/`hover` call could have answered instead — **net of
what the symbol call would itself have cost to answer**?

## The decision rule, pre-registered

Stated before the script was first run against any corpus, so it could not be
tuned to the answer. A reader is invited to disagree with it in the open.

**PROCEED to the A/B** only if all three hold:

1. the corpus clears its floor — ≥ 200 sized reads across ≥ 20 sessions;
2. net addressable read mass is ≥ **15%** in **both** units (see below);
3. the two units agree in direction. If they straddle the gate the answer is
   INCONCLUSIVE, because which unit is right would decide the phase.

Otherwise **HALT**. Phase 3's terms are explicit that negative results halt
development, and phase 4 (polyglot wiring evidence) is contingent on phase 3.

Why 15%: the ceiling on any fix is the mass it can address, and the lever this
one competes with is already measured — lowering the coder's SDK compaction
window cut modelled burn **30.9%** ([COST_LEVERS.md](COST_LEVERS.md)) by
configuring something the SDK already owns. A net addressable share below 15%
cannot pay for owned infrastructure when a configuration change moved twice
that.

## What gets counted, and what does not

| class | rule | why it is separate |
|---|---|---|
| `symbol_lookup` | a read within 3 tool calls of a Grep whose **pattern** is a symbol query (a bare identifier, optionally behind `def`/`class`/`function`/`interface`/…) | go-to-definition done by hand; the substitute tool is exact |
| `whole_file` | a read with no `offset`/`limit` whose result is ≥ 12,000 chars | the issue's own wording, "large-file reads"; weaker, because a whole-file read is sometimes right |
| `navigable` | the union of the two, **and only for a language a symbol server serves** | the number the verdict uses |
| `non_code` | a read of a file no symbol call can answer at any size — README, JSON fixture, log, lockfile | see the refutation below |
| `repeat` | a read of a file the same context window already read | orthogonal; a re-read is a compaction question, not a symbol-tool one |

Two rules keep the number honest rather than flattering:

- **Net of the fix's own cost.** A `definition` call returns a symbol body, so
  the addressable mass is `max(0, read_chars − 2,000)`, not the read. The
  2,000-char figure is an estimate — no symbol server exists here to measure
  one from — and `--symbol-response-chars` re-derives the table under any other
  assumption.
- **The cost unit is not the read.** COST_LEVERS measured 95.6% of the bill as
  cache **read**: the conversation re-sent every turn. So a read's cost is its
  size times how long it then sits in context. `chars` is a fact; `weighted`
  (chars × tool calls remaining in the same context window) is a **model**, and
  the verdict requires both.

Weighting is per **context window**, not per session: an `attempt_start` and a
compaction each reset what gets re-sent. Subagent reads carry raw chars and
zero weighted mass, because a subagent's result is re-read in the subagent's
context, whose remaining turns neither source records.

## The refutation that flipped the verdict

The first run of the instrument returned **PROCEED at 27.6%**. It was wrong.

`.md` was the largest single extension in the corpus by read mass — 31.7% of
every character read — and no `definition`/`references`/`hover` call answers a
question about a README. Markdown, JSON, logs, text and lockfiles were all
being counted as addressable. With a closed allowlist of languages a symbol
server actually serves (`CODE_EXTENSIONS`), the same corpus reads **10.4% raw /
13.7% weighted** and the verdict is HALT.

One constant, and the phase gate inverted. That class is now reported as its
own `non_code` row, and
[`tests/test_navigation_value.py`](../tests/test_navigation_value.py) pins it
with a pair of fixtures identical except for the file extension: the same read
mass reads PROCEED in `.py` and HALT in `.md`.

## The measurement (2026-09-10)

`python scripts/navigation_value.py --source transcripts` over 112 Claude Code
sessions / 114 context windows / 828 reads on one contributor's machine:

```
         class   reads         chars   %chars          weighted     %wtd
------------------------------------------------------------------------
           all     828     2,914,283   100.0%       293,218,423   100.0%
 symbol_lookup      15        70,426     2.4%         5,719,223     2.0%
    whole_file      17       307,137    10.5%        42,964,293    14.7%
     navigable      31       359,766    12.3%        46,939,410    16.0%
          both       1        17,797     0.6%         1,744,106     0.6%
      non_code     438     1,487,908    51.1%       108,173,281    36.9%
        repeat     248       606,935    20.8%        68,162,865    23.2%
      windowed     315       689,346    23.7%        71,230,577    24.3%
     sidechain       0             0     0.0%                 0     0.0%

net addressable: 302,550 chars (10.4% of read mass), 40,133,641 weighted (13.7%)
```

**VERDICT: HALT** — 10.4% raw and 13.7% weighted, both below the pre-registered
15% gate.

Three facts in that table matter more than the headline:

1. **Half the read mass is not code at all** (`non_code`, 51.1%). Nothing a
   symbol server does touches it.
2. **The strongest class is tiny.** Only 15 of 828 reads followed a
   symbol-shaped search — 2.4% of read mass. The agent mostly is not asking
   "where is S" by the one means the record can see.
3. **Re-reads are eight times the size of the addressable class** (`repeat`,
   20.8% against 2.4%). If any lever is visible in this table it is context
   retention, not navigation — and that is the compaction lever COST_LEVERS
   already measured, not a new tool.

## The verdict is not robust, and the instrument says so

Re-deciding at half and double the large-read threshold:

| large-read threshold | navigable reads | raw | weighted | decision |
|---|---:|---:|---:|---|
| 6,000 chars | 74 | 19.1% | 24.3% | **PROCEED** |
| **12,000 chars** (pre-registered) | 31 | 10.4% | 13.7% | **HALT** |
| 24,000 chars | 18 | 4.3% | 2.6% | **HALT** |

Same data, one constant, opposite decisions. The instrument re-takes every
verdict at both probes and prints a `CAUTION` line whenever the answer changes,
because pre-registering a threshold stops the number being tuned to the answer
— it does not make the answer a property of the data, and only the probe can
tell the two apart.

Sensitivity to the other estimated parameter, for completeness:

| `--symbol-response-chars` | raw | weighted | decision |
|---|---:|---:|---|
| 0 | 12.3% | 16.0% | INCONCLUSIVE (units straddle the gate) |
| 1,000 | 11.3% | 14.8% | HALT |
| **2,000** (default) | 10.4% | 13.7% | HALT |
| 4,000 | 8.8% | 11.6% | HALT |

## What this does not know

- **This is the wrong population, and it is the only one available.** The
  authoritative source is `task_events` — no_human's own unattended coder. It
  is **empty** in this checkout, so the figures above come from interactive
  Claude Code sessions instead. That is the same substitution
  `agent/tool_result_cap.py` made, with the same caveat: the directional shape
  is likely to carry, the absolute percentages are not transferable. An
  interactive session reads differently from an unattended coder — more
  markdown, more one-off inspection, a human steering it away from dead ends.
- **Purpose is not recorded.** Neither source stores *why* a read happened, so
  every class is a proxy. `symbol_lookup` errs in both directions: it counts a
  Grep followed by an unrelated read, and it cannot see a symbol question
  answered from memory with no Grep at all. Neither error's size is known.
- **`symbol_lookup` is adjacency, not causation.** Whether the read's path was
  among the Grep's hits cannot be checked on both sources — the product records
  a search result's size and never its text, by design — so one rule that works
  on both sources was preferred to a sharper rule that would silently do
  something else on the DB.
- **The language allowlist is closed.** A repo in a language outside it reads as
  entirely non-addressable, which understates rather than overstates the case
  for building. Widening it is exactly the polyglot question phase 4 defers.
- **`n=1` machine.** 112 sessions, one contributor, one set of repos, mostly
  TypeScript and Go.

## Decision

**Phase 3 halts here, and does not close.** No symbol server is built, no A/B
is launched, and phase 4 stays contingent. The HALT is the answer the
pre-registered rule gives on the only corpus available — but it is fragile to
one threshold and it was taken on a substitute population, so it is not a
finding this phase should be closed on.

**What would settle it**, in order:

1. Run the instrument on a `task_events` database with real coder volume:
   `python scripts/navigation_value.py --source events --db ~/.no_human/no_human.db`.
   That is the population the phase is about, and it needs no credential and no
   token spend — the product already recorded everything required.
2. If that run clears the gate in both units and holds at both robustness
   probes, the issue's A/B is authorised: an in-process SDK MCP server with
   read-only symbol tools, scored on success rate, cost and wall-clock against
   a control. Nothing beyond it — the benchmark is an instrument, not a target.
3. If it does not clear the gate, the `repeat` row is where the next lever
   plausibly is, and it belongs to the compaction work COST_LEVERS already
   started rather than to this issue.
