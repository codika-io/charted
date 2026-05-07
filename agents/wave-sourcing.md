# Wave sourcing — agent prompt

This document is the source of truth for the paper-sourcing pipeline that
backs the Charted GTM flywheel. It encodes the rules we agreed on so any
future autonomous run produces consistent output.

## What the agent does

For each seed topic in a wave:

1. Pull paper candidates from OpenAlex (see `scripts/source-wave.mjs`).
2. Apply the **filter stack** (deterministic, locked).
3. For each candidate, apply the **methodology-vs-application judge**.
4. For each kept paper, apply the **topic-attribution rule** to decide between
   citing under an existing topic or minting a new one.
5. Author resolution: OpenAlex → ORCID → PDF email parse → Hunter verify.
6. Emit a wave plan: topic-page diffs, new topic frontmatter+body, lead CSV.
7. Open one PR per topic (or one PR per wave, with a section per topic).

## Filter stack (locked, do not adjust silently)

| Filter | Threshold |
|---|---|
| Recency | publication date ≥ 3 years ago |
| Citation count | 10 ≤ N ≤ 300 |
| First-author h-index | < 15 |
| First-author years active | < 8 (years since first publication) |
| Topic concept overlap | matches the seed topic's OpenAlex concept tag |

Filters intentionally **not** applied — see `agents/sourcing-decisions.md`
or recover from prior conversation: no venue filter, no language/region,
no co-author count cap, no peer-review requirement, no open-access
requirement, no must-have-email, no senior-coauthor exclusion.

## Methodology-vs-application judge

A paper passes if it contributes a **method, architecture, training
recipe, evaluation framework, or genuine phenomenon finding** that
informs how language models / the seed-topic's discipline works.

A paper fails if it primarily applies an existing method to a new
domain (medicine, finance, customer reviews, etc.) without contributing
methodology that future readers of the seed topic need to know about.

When in doubt, drop. Quality floor matters more than throughput. The
inline-citation validator (below) is a final filter.

## Inline-citation validator (hard rule)

A paper may **only** appear in `sources[]` of a topic page if there is
**at least one paragraph in the topic body that meaningfully references
the paper's contribution**. No orphan citations. Surface this as an
explicit step in the agent's planning: write the paragraph first, then
add the source row.

## Topic-attribution rule (locked)

The user-locked granularity heuristic is:

> **Is the main topic of this paper genuinely part of a node we already
> have? If not, create the topic — but make it self-contained.**
>
> Don't name a new topic `<existing-topic>-and-X` if the existing topic
> is already a node — that's a wedge under an existing node and signals
> the paper actually belongs *inside* the existing topic.
>
> The new topic should be **a coherent specific correlate that doesn't
> sensibly fit inside the existing topic**: it has its own methodology,
> its own conferences/community, its own ~30–100-paper cluster.

Operationally:

1. Score each existing topic's fit against the paper.
2. If the best fit > threshold and the paper's contribution is a natural
   extension of that topic's body, attach as a source there.
3. Otherwise, propose a new topic. Name it as a **noun phrase that
   stands on its own** — `retrieval-augmented-generation`, not
   `language-models-and-retrieval`. `language-model-fairness`, not
   `bias-in-language-models`.
4. New topic must nest under an existing branch. The agent does not
   create new branches; promote that decision to a human review step.
5. Default to *share* when in doubt: one topic with two sources beats
   two near-duplicate topics. Split only when a future paper makes the
   broader topic a *bag* of unrelated work, not a *cluster*.

## Author resolution priority

1. PDF email parse (LaTeX header/footnote — highest confidence).
2. OpenAlex `orcid` field on the author.
3. ORCID API record (sometimes has email).
4. Affiliation directory lookup.
5. Hunter.io guess + verify (lowest confidence).

Always store `email_source` and `email_confidence` in the lead CSV.

## Outputs

- `src/content/topics/.../<new-topic>.mdx` — frontmatter + body + sources.
- `authors.yml` — one entry per cited author, keyed `<lastname>-<paper-year>`.
- `.docs/leads/YYYY-MM-wave-NN.csv` — one row per author per paper, schema
  defined in this directory.
- One PR per wave with a section summarising each topic added/extended.

## Per-wave dashboard fields to track

After each wave, log:

- candidates_scanned
- candidates_kept_after_filters
- methodology_drop_rate
- new_topics_minted
- existing_topics_extended
- author_email_resolution_rate (by source)
- inline_validator_drop_rate

If `methodology_drop_rate` is climbing wave over wave, the seed query is
drifting toward applications and needs sharpening. If `new_topics_minted`
is more than ~15% of the candidates kept, the seed graph is too narrow
and we should expand seeds before the next wave.
