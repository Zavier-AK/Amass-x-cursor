# LLM Quick Reference

Are you an LLM? Start here. This page is self-contained.

```

Base URL:       [https://api.amass.tech/api/v1](https://api.amass.tech/api/v1)

Auth:           Authorization: Bearer amass_YOUR_KEY  (required on every request)

Content-Type:   application/json  (for POST bodies)

Rate limit:     60 requests / 60 seconds

Response shape: { "data": ... }

Errors:         { "error": { "status", "code", "message" } }

OpenAPI spec:   [https://api.amass.tech/api/doc/openapi.json](https://api.amass.tech/api/doc/openapi.json)

```

---

## CRITICAL — Read First

1. **Responses are wrapped in `{"data": ...}`.** Always read from the `data` key, not the top-level object. Errors use a different shape: `{"error": {...}}`.

2. **Every request needs auth.** No anonymous access. Omitting `Authorization` -> 401.

3. **Amass IDs are canonical.** The get-by-ID endpoints take Amass IDs only `AMBC_...`, `AMTC_...`, `AMDC_...`, `AMRC_...`, `AMGC_...`, `AMPC_...`). If you have PMIDs/DOIs/NCTs/ChEMBL IDs, gene identifiers, publication numbers, or FDA/EMA identifiers, convert them via the lookup endpoints first.

4. **Batch lookup items can fail independently.** Always check each item for `error` before reading `amassIds`. Each item takes exactly one identifier (e.g. `pmid` or `doi`, not both).

5. **Don't request `fulltext` unless you need it.** It massively increases response size. Use the `include` param only when required.

6. **Rate limits are per user+org, not per key.** Multiple keys for the same user share the same quota. On 429, read `Retry-After` and back off exponentially.

---

## Cores

Cores are domain-specific datasets. Each Core lives under `/v1/cores/{coreName}/`. All Cores share auth, error format, and rate limits. Endpoints and schemas are Core-specific.

| Core | Path | Status |

| --- | --- | --- |

| **BiomedCore** | `/v1/cores/biomedcore/` | Available |

| **TrialCore** | `/v1/cores/trialcore/` | Available |

| **DrugCore** | `/v1/cores/drugcore/` | Available |

| **RegulatoryCore** | `/v1/cores/regulatorycore/` | Available |

| **GeneCore** | `/v1/cores/genecore/` | Available |

| **PatentCore** | `/v1/cores/patentcore/` | Preview |

---

## BiomedCore Endpoints

### 1. Search

```

GET /v1/cores/biomedcore/records?query={text}

```

| Param | Required | Type | Notes |

| --- | --- | --- | --- |

| `query` | yes | string | Search across titles, abstracts, fulltext, metadata |

| `limit` | no | int | 1–300, default 20 |

| `include` | no | string | One or more of: `fulltext`, `authorsMetadata`, `meshIds`, `substanceIds`, `referencesTrialCore`, `references`, `citedBy`. Repeat for multiple: `include=fulltext&include=authorsMetadata` |

| `minPublicationDate` | no | ISO date | e.g. `2023-01-01` |

| `maxPublicationDate` | no | ISO date | e.g. `2026-01-01` |

| `minLastUpdateDate` / `maxLastUpdateDate` | no | ISO date | When Amass last wrote the record. Moves on ANY ingested change — citation content, PMC fulltext, citation-count refresh, cross-core links. Not "recently revised". Excludes records with no such date |

| `minCreateDate` | no | ISO date | When Amass ingested the record, not when it was published. Excludes records with no create date. No `max` counterpart |

| `minCitationCount` | no | int | 0–100000 |

| `minJournalQualityJufo` | no | enum | `0`, `1`, `2`, or `3` (3 = top-tier) |

| `isRetracted` | no | bool | `true` or `false` |

| `authorOrcids` | no | string | Repeat for multiple. OR within param. Bare `0000-...`) or URL form. |

| `authorNames` | no | string | Repeat for multiple. OR within param. Free-text token (PubMed indexes as `LastName Initials`). |

| `institutionRors` | no | string | Repeat for multiple. OR within param. Bare `03vek6s52`) or URL form. |

| `institutionNames` | no | string | Repeat for multiple. OR within param. Free-text token. |

Author/institution filters: **OR within one filter, AND across filters.** `?authorNames=Hassabis&institutionNames=DeepMind` means *(any Hassabis author) AND (any DeepMind affiliation)* — they don't have to be the same author. Pair with `include=authorsMetadata` to verify the match.

```bash

curl "[https://api.amass.tech/api/v1/cores/biomedcore/records?query=CRISPR&limit=5&minJournalQualityJufo=2](https://api.amass.tech/api/v1/cores/biomedcore/records?query=CRISPR&limit=5&minJournalQualityJufo=2)" \

  -H "Authorization: Bearer amass_YOUR_KEY"

```

### 2. Get by Amass ID

```

GET /v1/cores/biomedcore/records/{amassId}

```

Returns 404 if not found.

### 3. Batch Lookup (PMID/DOI -> Amass ID)

```

POST /v1/cores/biomedcore/records/lookup

```

Each item must have exactly one of `pmid` or `doi`. Not both.

```json

{"items": [{"pmid": "38123456"}, {"doi": "10.1038/s41586-024-00001-x"}]}

```

Returns `[{"amassIds": ["AMBC_..."]}, {"error": "..."}]` — one entry per input item.

### 4. Change feed

```

GET /v1/cores/biomedcore/changes?since={ISO date}

```

| Param | Required | Type | Notes |

| --- | --- | --- | --- |

| `since` | yes | ISO date | Start of window, inclusive |

| `limit` | no | int | 1–1000, default 100 |

| `cursor` | no | string | Opaque `nextCursor` from the previous page. Bound to the `amassId` set it was issued under |

| `amassId` | no | string | Repeat (max 100) to follow only those records. Omit for the whole corpus |

Returns `{"data": [{"amassId", "updateType", "updateDate", "createDate"}], "nextCursor": string|null}`.

- `updateType` is `created`, `updated`, or `deleted`. It describes the delivery, not the record: a publication that entered and then changed again inside one window arrives once, as `updated`. One cursor, so events apply in date order; two feeds could disagree about a record deleted then re-created.

- `createDate` is always `null` when `updateType` is `deleted`; `updateDate` is then the removal date. Otherwise it matches the record's own `createDate` — compare it against your window to spot a genuinely new publication, which is more reliable than branching on `updateType`.

- **A retraction is not a deletion.** Retracted papers stay indexed and arrive as `updated` with `isRetracted: true`. `deleted` means NCBI withdrew the citation outright.

- Page by passing `nextCursor` back as `cursor`. *`nextCursor: null` is the only signal you are caught up** — a short page still needs following. `limit` bounds rows scanned, not items returned, so day boundaries and same-day dedup both under-fill.

- At-least-once delivery: apply as an upsert, an `amassId` may repeat.

- The most recent day is withheld until its ingest completes, so changes surface about a day late.

- **Resume from a day or two before your last `since`, never from "now".** `nextCursor: null` means caught up through the last fully-ingested day, not through today, so advancing your next `since` to the current date silently skips the withheld day for good. Re-asking an overlapping window is safe: delivery is at-least-once and you upsert by `amassId`.

- There is no `until` and no `throughDate`. Both read as a second resume token next to the cursor and are held back pending consumer demand.

- **Watching a fixed set? Repeat `amassId` (max 100).** The feed then reports only those records, with every guarantee intact, deletions included. Prefer this over polling `minCreateDate` on search, which cannot see deletions at all. Repeat the parameter; a comma-joined list is read as one id and 400s. A bad, foreign, or empty `amassId` is a 400, never a silent skip.

- **Over 100 records: chunk into 100s, the same way every run.** Each chunk pages independently and its cursor is bound to its exact id set, so re-partitioning invalidates every cursor at once.

- **Cursors are sweep-local.** Persist your own `since`, not the cursor — the next sweep starts from `since` with no cursor, so a watchlist edited between sweeps costs nothing. Changing the set *mid-sweep* 400s; page to `nextCursor: null` first, or restart from your stored `since`.

---

## BiomedCore Record Schema

**Default fields:**

```

amassId           string       AMBC_... (canonical ID)

pmid              string|null  PubMed ID

pmcid             string|null  PubMed Central ID

doi               string|null  Digital Object Identifier

title             string|null

abstract          string|null

authors           string[]     e.g. ["Smith J", "Doe A"]

journal           string|null

issn              string|null

volumeIssue       string|null

publicationDate   string|null  ISO date

lastUpdateDate    string|null  ISO date Amass last wrote the record; moves on ANY ingested change

createDate        string|null  ISO date the record entered Amass (not the publication date); matches the change feed's value

publicationTypes  string[]     e.g. ["Journal Article", "Review"]

language          string|null  e.g. "eng"

citationCount     number|null

journalQualityJufo number|null 0=low, 1=peer-reviewed, 2=domain-leading, 3=highest, null=not evaluated

meshTerms         string[]

keywords          string[]

substances        string[]

hasFulltext       boolean|null

isRetracted       boolean|null

```

**Optional fields `include` param):** `fulltext`, `authorsMetadata`, `meshIds`, `substanceIds`, `referencesTrialCore`, `references`, `citedBy`

Reference fields:

- `references`, `citedBy` — **intra-core links within BiomedCore.** Arrays of `AMBC_...` IDs pointing to other publications.

- `referencesTrialCore` — **cross-core link to TrialCore.** Array of `AMTC_...` IDs pointing to associated clinical trials.

```

intra-core (within BiomedCore):

   AMBC_aaa ─cites─┐                  ┌─► AMBC_p001

                   │                  ├─► AMBC_p002

                   │   ┌──────────┐   │

                   ├──►│  AMBC_X  │───┤      ⋮

                   │   └──────────┘   │

                   │                  ├─► AMBC_p051

   AMBC_bbb ─cites─┘                  └─► AMBC_p052

   AMBC_X.citedBy    = [AMBC_aaa, AMBC_bbb]            ← 2 IDs

   AMBC_X.references = [AMBC_p001, …, AMBC_p052]      ← 52 IDs

cross-core (BiomedCore → TrialCore):

                          ┌─► AMTC_t01

                          ├─► AMTC_t02

   ┌──────────┐           │

   │  AMBC_X  │ ─────────►┤      ⋮

   └──────────┘           │

                          ├─► AMTC_t04

                          └─► AMTC_t05

   AMBC_X.referencesTrialCore = [AMTC_t01, …, AMTC_t05]    ← 5 IDs

```

---

## TrialCore Endpoints

### 1. Search

```

GET /v1/cores/trialcore/records?query={text}

```

| Param | Required | Type | Notes |

| --- | --- | --- | --- |

| `query` | yes | string | Search text. A trial ID in the query returns that trial first (see [Searching by trial ID](#searching-by-trial-id-trialcore)) |

| `limit` | no | int | 1–300, default 20 |

| `include` | no | string | One or more of: `detailedDescription`, `outcomes`, `referencesBiomedCore`, `referencesDrugCore`. Repeat for multiple: `include=outcomes&include=referencesDrugCore` |

| `phase` | no | enum | `EARLY_PHASE1`, `PHASE1`, `PHASE1/PHASE2`, `PHASE2`, `PHASE2/PHASE3`, `PHASE3`, `PHASE4`, `NA` |

| `overallStatus` | no | enum | `RECRUITING`, `NOT_YET_RECRUITING`, `ENROLLING_BY_INVITATION`, `ACTIVE_NOT_RECRUITING`, `SUSPENDED`, `TERMINATED`, `COMPLETED`, `WITHDRAWN`, `UNKNOWN`, `WITHHELD`, `AVAILABLE`, `NO_LONGER_AVAILABLE`, `TEMPORARILY_NOT_AVAILABLE`, `APPROVED_FOR_MARKETING` |

| `studyType` | no | enum | `INTERVENTIONAL`, `OBSERVATIONAL`, `EXPANDED_ACCESS` |

| `sponsorType` | no | enum | `NIH`, `FED`, `INDUSTRY`, `OTHER`, `OTHER_GOV`, `INDIV`, `NETWORK` |

| `interventionType` | no | enum | `DRUG`, `DEVICE`, `BIOLOGICAL`, `PROCEDURE`, `RADIATION`, `BEHAVIORAL`, `GENETIC`, `DIETARY_SUPPLEMENT`, `DIAGNOSTIC_TEST`, `COMBINATION_PRODUCT`, `OTHER` |

| `facilityCountries` | no | string | Comma-separated ISO codes, e.g. `DE,US` |

| `hasResults` | no | bool | `true` or `false` |

| `minStartDate` | no | ISO date | e.g. `2020-01-01` |

| `maxStartDate` | no | ISO date | |

| `minCompletionDate` | no | ISO date | |

| `maxCompletionDate` | no | ISO date | |

| `minEnrollment` | no | int | Minimum participants |

| `minLastUpdateDate` | no | ISO date | When Amass last wrote the row — observed, not the registry's own claim, which is no longer served. Records with no such date are excluded |

| `maxLastUpdateDate` | no | ISO date | Close the window. Search is a ranked top-K, so slice long spans and union |

| `minCreateDate` | no | ISO date | When the record entered Amass. No `max` counterpart |

```bash

curl "[https://api.amass.tech/api/v1/cores/trialcore/records?query=breast+cancer&phase=PHASE3&overallStatus=RECRUITING&limit=10](https://api.amass.tech/api/v1/cores/trialcore/records?query=breast+cancer&phase=PHASE3&overallStatus=RECRUITING&limit=10)" \

  -H "Authorization: Bearer amass_YOUR_KEY"

```

#### Searching by trial ID (TrialCore)

A trial identifier in `query` returns that trial first, ahead of the keyword results. The rest of the query still runs as a search.

Casing is ignored; the `JPRN-` prefix is optional.

| Registry | Example |

| --- | --- |

| [ClinicalTrials.gov](http://ClinicalTrials.gov) | `NCT01264315` |

| EU CTR (EudraCT) | `EUCTR2007-001061-14-CZ` |

| EU CTIS | `CTIS2024-517677-25-00` |

| ChiCTR | `ChiCTR2400080025`, `ChiCTR-IOR-16008869` |

| ISRCTN | `ISRCTN17848241` |

| ANZCTR | `ACTRN12619000517178` |

| JPRN | `JPRN-UMIN000025287`, `jRCT1091220264`, `jRCTs032220649` |

| CRIS (Korea) | `KCT0012423` |

| NTR (Netherlands) | `NL-OMON21122` |

| IRCT (Iran) | `IRCT20190312043032N1` |

| CTRI (India) | `CTRI/2019/09/021427` |

| DRKS (Germany) | `DRKS00008308` |

| ReBEC (Brazil) | `RBR-5khzxz` |

| RPCEC (Cuba) | `RPCEC00000135` |

| PACTR | `PACTR202410526786105` |

| SLCTR (Sri Lanka) | `SLCTR/2021/028` |

| TCTR (Thailand) | `TCTR20250828002` |

| LBCTR (Lebanon) | `LBCTR2022035014` |

| REPEC (Peru) | `PER-075-13` |

| ITMCTR | `ITMCTR1900002740` |

EUCTR trials register once per participating country (up to 32), and those records differ on enrollment, sponsor, status and `hasResults`. Search shows **at most five** — use Lookup for every registration. `EUCTR2013-000487-28-CZ` returns one.

### 2. Get by Amass ID

```

GET /v1/cores/trialcore/records/{amassId}

```

Returns 404 if not found.

### 3. Batch Lookup (NCT ID -> Amass ID)

```

POST /v1/cores/trialcore/records/lookup

```

Each item must have exactly one of `nctId` or `registryId`. Use `registryId` (the source-registry native id) to resolve non-US (ICTRP) trials, which have no `nctId`. It takes any format in the table above, casing ignored.

```json

{"items": [{"nctId": "NCT04303507"}, {"registryId": "ChiCTR2400080025"}]}

```

Returns `[{"amassIds": ["AMTC_..."]}, {"error": "..."}]` — one entry per input item. A EudraCT number without its country suffix returns one ID per participating country.

### 4. Change feed

```

GET /v1/cores/trialcore/changes?since={ISO date}

```

| Param | Required | Type | Notes |

| --- | --- | --- | --- |

| `since` | yes | ISO date | Start of window, inclusive |

| `limit` | no | int | 1–1000, default 100 |

| `cursor` | no | string | Opaque `nextCursor` from the previous page. Bound to the `amassId` set it was issued under |

| `amassId` | no | string | Repeat (max 100) to follow only those records. Omit for the whole corpus |

Returns `{"data": [{"amassId", "updateType", "updateDate", "createDate"}], "nextCursor": string|null}`.

- `updateType` is `created`, `updated`, or `deleted`. **Deletions are on this feed — there is no separate deletions endpoint.** It describes the delivery, not the record: a trial that entered and then changed again inside one window arrives once, as `updated`. One cursor, so events apply in date order; two feeds could disagree about a record deleted then re-created.

- `createDate` is always `null` when `updateType` is `deleted`; `updateDate` is then the removal date. Otherwise it matches the record's own `createDate` — compare it against your window to spot a genuinely new trial, which is more reliable than branching on `updateType`.

- Current state, not a complete event log: a record deleted and later re-registered ends as `created`, and the intervening `deleted` may or may not be delivered. Applying the feed in order always leaves you holding the record.

- Page by passing `nextCursor` back as `cursor`. *`nextCursor: null` is the only signal you are caught up** — a short page still needs following. `limit` bounds rows scanned, not items returned, so day boundaries and same-day dedup both under-fill.

- At-least-once delivery: apply as an upsert, an `amassId` may repeat.

- The most recent day is withheld until its ingest completes, so changes surface about a day late.

- **Resume from a day or two before your last `since`, never from "now".** `nextCursor: null` means caught up through the last fully-ingested day, not through today, so advancing your next `since` to the current date silently skips the withheld day for good. Re-asking an overlapping window is safe: delivery is at-least-once and you upsert by `amassId`.

- There is no `until` and no `throughDate`. Both read as a second resume token next to the cursor and are held back pending consumer demand.

- Covers results revisions too, which do **not** move a record's `lastUpdateDate`. `updateDate` is the change that caused the delivery and can therefore be newer. Results being *removed* counts: the trial arrives as `updated`, not `deleted`.

- Withdrawn/terminated trials stay indexed — they appear as an `overallStatus` change with `updateType: updated`, never as `deleted`.

- **Watching a fixed set? Repeat `amassId` (max 100).** The feed then reports only those trials, with every guarantee intact — deletions, results revisions and removed outcomes included. Prefer this over polling `minLastUpdateDate` on search, which catches none of the three. Repeat the parameter; a comma-joined list is read as one id and 400s. A bad, foreign, or empty `amassId` is a 400, never a silent skip.

- **Over 100 trials: chunk into 100s, the same way every run.** Each chunk pages independently and its cursor is bound to its exact id set, so re-partitioning invalidates every cursor at once.

- **Cursors are sweep-local.** Persist your own `since`, not the cursor — the next sweep starts from `since` with no cursor, so a watchlist edited between sweeps costs nothing. Changing the set *mid-sweep* 400s; page to `nextCursor: null` first, or restart from your stored `since`.

---

## TrialCore Record Schema

**Default fields:**

```

amassId                   string       AMTC_... (canonical ID)

nctId                     string|null  [ClinicalTrials.gov](http://ClinicalTrials.gov) ID (null for non-US trials)

registryId                string|null  Source-registry native ID; == nctId for [CT.gov](http://CT.gov), else ICTRP id (e.g. EUCTR2013-000487-28-DE, ChiCTR…). EUCTR values always carry a country suffix. Always populated

sourceRegistry            string|null  clinicaltrials_gov | euctr | ctis | chictr | isrctn | anzctr | jprn | ctri | drks | …

sourceUrl                 string|null  Link to the trial on its source registry

briefTitle                string|null

officialTitle             string|null

briefSummary              string|null

acronym                   string|null  e.g. KEYNOTE-189

phase                     string|null  e.g. PHASE3

overallStatus             string|null  e.g. RECRUITING

studyType                 string|null  e.g. INTERVENTIONAL

startDate                 string|null  ISO date

completionDate            string|null  ISO date

lastUpdateDate            string|null  ISO date Amass last wrote the record (does not move for results-only revisions — see the change feed)

createDate                string|null  ISO date the record entered Amass

hasResults                boolean

enrollment                number|null

enrollmentType            string|null  ACTUAL or ESTIMATED

sponsorName               string|null

sponsorType               string|null

collaborators             string[]

conditions                string[]

conditionMeshTerms        string[]

interventionTypes         string[]

interventionNames         string[]

interventionMeshTerms     string[]

facilityCountries         string[]     ISO country codes

keywords                  string[]

orgStudyId                string|null

secondaryIds              string[]

primaryOutcomeMeasures    string[]

secondaryOutcomeMeasures  string[]

designAllocation          string|null  RANDOMIZED, NON_RANDOMIZED, NA

designInterventionModel   string|null  SINGLE_GROUP, PARALLEL, CROSSOVER, FACTORIAL, SEQUENTIAL

designPrimaryPurpose      string|null  TREATMENT, PREVENTION, DIAGNOSTIC, etc.

designMasking             string|null  NONE, SINGLE, DOUBLE, TRIPLE, QUADRUPLE

resultsFirstPostDate      string|null  ISO date

whyStopped                string|null

isFdaRegulatedDrug        boolean|null

isFdaRegulatedDevice      boolean|null

armGroups                 object[]     [{type, title, description}]

oversightHasDmc           boolean|null

```

**Optional fields `include` param):** `detailedDescription`, `outcomes`, `referencesBiomedCore`, `referencesDrugCore`

- `referencesBiomedCore` — **cross-core link to BiomedCore.** Array of `AMBC_...` IDs for referenced publications, ordered results-first: papers whose PubMed record registers this trial's id lead, background literature follows. Take the first entries when you want the trial's results papers.

- `referencesDrugCore` — **cross-core link to DrugCore.** Array of `AMDC_...` IDs for the drugs studied by the trial.

---

## DrugCore Endpoints

### 1. Search

```

GET /v1/cores/ddrugsrugcore/records?query={text}

```

| Param | Required | Type | Notes |

| --- | --- | --- | --- |

| `query` | yes | string | Search across drug names, trade names, synonyms, descriptions, and mechanism-of-action targets (gene symbols, synonyms, names, action/target types, mechanism text) |

| `limit` | no | int | 1–300, default 20 |

| `include` | no | string | One or more of: `parent`, `children`, `referencesTrialCore`, `referencesBiomedCore`, `referencesRegulatoryCore`, `referencesGeneCore`. Repeat for multiple: `include=parent&include=children` |

| `drugType` | no | enum | `SMALL_MOLECULE`, `ANTIBODY`, `PROTEIN`, `OLIGONUCLEOTIDE`, `GENE`, `ENZYME`, `ANTIBODY_DRUG_CONJUGATE`, `VACCINE_COMPONENT`, `CELL`, `OLIGOSACCHARIDE`, `VACCINE`, `UNKNOWN` |

| `maxClinicalStage` | no | enum | `PRECLINICAL`, `IND`, `EARLY_PHASE1`, `PHASE1`, `PHASE1/PHASE2`, `PHASE2`, `PHASE2/PHASE3`, `PHASE3`, `PREAPPROVAL`, `APPROVAL`, `UNKNOWN` |

```bash

curl "[https://api.amass.tech/api/v1/cores/drugcore/records?query=pembrolizumab&drugType=ANTIBODY&limit=5](https://api.amass.tech/api/v1/cores/drugcore/records?query=pembrolizumab&drugType=ANTIBODY&limit=5)" \

  -H "Authorization: Bearer amass_YOUR_KEY"

```

### 2. Get by Amass ID

```

GET /v1/cores/drugcore/records/{amassId}

```

Returns 404 if not found, 400 if the Amass ID is malformed.

### 3. Batch Lookup (ChEMBL ID -> Amass ID)

```

POST /v1/cores/drugcore/records/lookup

```

Each item must have `chemblId`.

```json

{"items": [{"chemblId": "CHEMBL1201583"}, {"chemblId": "CHEMBL9999999"}]}

```

Returns `[{"amassIds": ["AMDC_..."]}, {"error": "..."}]` — one entry per input item. A single ChEMBL ID can resolve to multiple Amass IDs, so `amassIds` is always an array.

---

## DrugCore Record Schema

**Default fields:**

```

amassId           string       AMDC_... (canonical ID)

chemblId          string|null  ChEMBL molecule ID

name              string|null  Primary drug name

description       string|null  A short free-text description of the drug, its clinical stage, and/or its indications

synonyms          string[]     Alternative names

tradeNames        string[]     Brand / trade names

drugType          string|null  e.g. SMALL_MOLECULE, ANTIBODY

maxClinicalStage  string|null  Highest stage reached, e.g. PHASE3, APPROVAL

inchiKey          string|null  InChIKey structure hash

canonicalSmiles   string|null  Canonical SMILES string

mechanismsOfAction object[]    [{actionType, mechanismOfAction, targetType, targets[]}] — see below

```

`mechanismsOfAction[].targets[]` shape: `{ensemblId, symbol, name, synonyms[]}` — ChEMBL targets (Ensembl gene IDs) enriched with HGNC gene metadata. Targets resolve to GeneCore records via `referencesGeneCore`.

**Optional fields `include` param):** `parent`, `children`, `referencesTrialCore`, `referencesBiomedCore`, `referencesRegulatoryCore`, `referencesGeneCore`

Reference fields:

- `parent`, `children` — **intra-core links within DrugCore.** `parent` is a single `AMDC_...` ID; `children` is an array of `AMDC_...` IDs (drug hierarchy).

- `referencesTrialCore` — **cross-core link to TrialCore.** Array of `AMTC_...` IDs for associated clinical trials.

- `referencesBiomedCore` — **cross-core link to BiomedCore.** Array of `AMBC_...` IDs for associated publications.

- `referencesRegulatoryCore` — **cross-core link to RegulatoryCore.** Array of `AMRC_...` IDs for associated FDA/EMA authorizations.

- `referencesGeneCore` — **cross-core link to GeneCore.** Array of `AMGC_...` IDs for the genes this drug targets (resolved from MoA target Ensembl gene IDs).

---

## RegulatoryCore Endpoints

Cross-agency drug regulatory authorizations from the FDA (US) and EMA (EU), normalized onto a shared schema. One record = one authorization. Updated weekly.

### 1. Search

```

GET /v1/cores/regulatorycore/records?query={text}

```

| Param | Required | Type | Notes |

| --- | --- | --- | --- |

| `query` | yes | string | Product name, active substance, indication, or holder |

| `limit` | no | int | 1–300, default 20 |

| `include` | no | string | One or more of: `emaDetails`, `fdaDetails`, `referencesDrugCore`. Repeat for multiple. |

| `agency` | no | enum | `FDA`, `EMA`. Repeat for multiple (OR). |

| `moleculeType` | no | enum | `SMALL_MOLECULE`, `ANTIBODY`, `PROTEIN`, `ENZYME`, `OLIGONUCLEOTIDE`, `GENE`, `CELL`, `ANTIBODY_DRUG_CONJUGATE`, `VACCINE_COMPONENT`, `VACCINE`, `OLIGOSACCHARIDE`, `UNKNOWN`. Repeat for multiple (OR). |

| `authorizationStatus` | no | enum | `ACTIVE`, `APPROVED_NOT_MARKETED`, `CONDITIONAL`, `SUSPENDED`, `WITHDRAWN_VOLUNTARY`, `WITHDRAWN_FORCED`, `REVOKED`, `LAPSED_SUNSET`, `REFUSED`, `WITHDRAWN_DURING_REVIEW`, `EXPIRED`, `UNKNOWN`. Repeat for multiple (OR). Case-insensitive on input. |

| `hasDesignation` | no | enum | `PRIORITY_REVIEW`, `BREAKTHROUGH_THERAPY`, `FAST_TRACK`, `RMAT`, `ACCELERATED_APPROVAL`, `ACCELERATED_ASSESSMENT`, `PRIME`, `CONDITIONAL_MA`, `EXCEPTIONAL_CIRCUMSTANCES`. Repeat for multiple (OR). Each applies only to the agency that owns it. |

| `isOrphan` | no | bool | `truefalse`. Cross-walk: FDA Orphan Drug / EMA Orphan Medicine. |

| `minAuthorizationDate` | no | ISO date | e.g. `2020-01-01` |

| `maxAuthorizationDate` | no | ISO date | e.g. `2026-01-01` |

| `minLastUpdateDate` | no | ISO date | Earliest date **Amass** last wrote the record. Not an agency date. |

| `maxLastUpdateDate` | no | ISO date | Latest date Amass last wrote the record. Search is top-K, so slice long spans and union. |

| `minCreateDate` | no | ISO date | Earliest date the record entered Amass. No `max` counterpart — a create date never moves. |

Enum filters combine **OR within one filter, AND across filters**.

```bash

curl "[https://api.amass.tech/api/v1/cores/regulatorycore/records?query=pembrolizumab&agency=FDA&agency=EMA&limit=10](https://api.amass.tech/api/v1/cores/regulatorycore/records?query=pembrolizumab&agency=FDA&agency=EMA&limit=10)" \

  -H "Authorization: Bearer amass_YOUR_KEY"

```

### 2. Get by Amass ID

```

GET /v1/cores/regulatorycore/records/{amassId}

```

Returns 404 if not found.

### 3. Batch Lookup (FDA/EMA identifier -> Amass ID)

```

POST /v1/cores/regulatorycore/records/lookup

```

Each item must have **exactly one** of `fdaApplicationNumber`, `emaProductNumber`, `ndc`, or `splSetId`.

```json

{"items": [{"fdaApplicationNumber": "BLA125514"}, {"emaProductNumber": "EMEA/H/C/003820"}, {"ndc": "0169-4404"}, {"splSetId": "ee06186f-2aa3-4990-a760-757579d8f77b"}]}

```

Returns one entry per input item — `amassIds` (always an array; one identifier can resolve to multiple) or `error`.

### 4. Change feed

```

GET /v1/cores/regulatorycore/changes?since={ISO date}

```

| Param | Required | Type | Notes |

| --- | --- | --- | --- |

| `since` | yes | ISO date | Start of window, inclusive |

| `limit` | no | int | 1–1000, default 100 |

| `cursor` | no | string | Opaque `nextCursor` from the previous page. Bound to the `amassId` set it was issued under |

| `amassId` | no | string | Repeat (max 100) to follow only those records. Omit for the whole corpus |

Returns `{"data": [{"amassId", "updateType", "updateDate", "createDate", "documentSections"}], "nextCursor": string|null}`. Every object reports its own dates: the entry describes the record, each `documentSections` element describes that section.

- `updateType` is `created`, `updated`, `deleted`, or `unchanged` about the **record itself**. `unchanged` means the authorization is byte-identical and the whole change is in the `documentSections` listed alongside it. Re-fetch `GET /records/{amassId}` for anything but `unchanged`. One cursor, so events apply in date order; two feeds could disagree about a record deleted then re-created.

- **FDA and EMA share one feed and one cursor.** They are one identifier space; filter delivered ids on `agency` after a fetch if you track only one market. There is no per-agency feed.

- `updateDate` is the **record's own** last write and **can predate your `since`**  when `updateType` is `unchanged` it is months old and the in-window dates are on the sections. Never filter returned items on it; page on `nextCursor`. `createDate` is always `null` when `updateType` is `deleted`, and `updateDate` is then the removal date.

- Current state, not a complete event log: a record deleted and later re-registered ends as `created`, and the intervening `deleted` may or may not be delivered. Applying the feed in order always leaves you holding the record.

- Page by passing `nextCursor` back as `cursor`. *`nextCursor: null` is the only signal you are caught up**. `limit` bounds rows scanned, not items returned, so day boundaries and same-day dedup both under-fill.

- At-least-once delivery: apply as an upsert, an `amassId` may repeat.

- The most recent day is withheld until its ingest completes, so changes surface about a day late.

- **Resume from a day or two before your last `since`, never from "now".** `nextCursor: null` means caught up through the last fully-ingested day, not through today, so advancing your next `since` to the current date silently skips the withheld day for good. Re-asking an overlapping window is safe: delivery is at-least-once and you upsert by `amassId`.

- Covers revisions to a record's parsed source documents (label, review, SmPC, EPAR), which do **not** move the record's `lastUpdateDate`, the record row is byte-identical, which is what `updateType: unchanged` reports. Each entry is `{documentSectionId, updateType, updateDate, createDate}`: an `AMRCDS_`* id fetchable at `/records/{amassId}/document-sections/{documentSectionId}`, that section's own `createdupdateddeleted`, and its own dates. Sections *removed* from a document are reported too, as `deleted` with a null `createDate`.

- **A `deleted` section is not a deleted record.** The record stays live and fetchable,  drop that one section and keep the rest. Only the entry's own `updateType` describes the record, and a record-level `deleted` carries no `documentSections` at all.

- *`documentSections` is per page, not per record.** It lists what surfaced the record on that page; a record whose changed sections straddle a page arrives twice with different subsets. Don't accumulate it into a section list, read the table of contents on `GET /records/{amassId}` for the current set.

- *`updateType` describes the record, not the page.** A record whose row and sections moved together reads the same on every page carrying part of that change. Arrivals covering different days can still differ — `updated` for the day the row moved, `unchanged` for a day only its sections did. Process every arrival rather than keeping only the last, and re-fetch the record if any of them says other than `unchanged`.

- Withdrawn/suspended/revoked authorizations stay indexed, they appear as an `authorizationStatus` change with `updateType: updated`, never as `deleted`. A `deleted` means the record left Drugs@FDA or the EMA register outright.

- **Watching a fixed set? Repeat `amassId` (max 100).** The feed then reports only those records, with every guarantee intact,  deletions and document revisions included. Repeat the parameter; a comma-joined list is read as one id and 400s. A bad, foreign, or empty `amassId` is a 400, never a silent skip.

- **Over 100 records: chunk into 100s, the same way every run.** Each chunk pages independently and its cursor is bound to its exact id set, so re-partitioning invalidates every cursor at once.

- **Cursors are sweep-local.** Persist your own `since`, not the cursor, the next sweep starts from `since` with no cursor, so a watchlist edited between sweeps costs nothing. Changing the set *mid-sweep* 400s; page to `nextCursor: null` first, or restart from your stored `since`.

---

## RegulatoryCore Record Schema

**Default fields:**

```

amassId                       string       AMRC_... (canonical ID)

agency                        string       FDA or EMA

name                          string|null  Primary product / brand name

activeSubstance               string|null

moleculeType                  string|null  Projected from DrugCore

authorizationStatus           string|null  Unified FDA + EMA status

procedureType                 string|null  FDA: NDA/BLA/ANDA; EMA: CENTRALISED_HUMAN, etc.

therapeuticIndication         string|null

marketingAuthorisationHolder  string|null

authorizationDate             string|null  ISO date

firstAuthorizationDate        string|null  ISO date

lastUpdateDate                string|null  ISO date. When AMASS last wrote the record, not an agency date

createDate                    string|null  ISO date. When the record entered Amass; matches the change feed's createDate

sourceUrl                     string|null

isOrphan                      boolean|null

designations                  object[]     {axis, type, agency, nativeName, basis, indication, postMarketingObligation}

authorizationsByAgency        object[]     Cross-market link, always populated: {amassId, agency, name, authorizationStatus}

```

**Optional fields `include` param):** `fdaDetails`, `emaDetails`, `referencesDrugCore`

Reference fields:

- `authorizationsByAgency`, **cross-market link within RegulatoryCore.** Array of `AMRC_...` IDs for the same product's other-market authorizations (self excluded), each carrying its own `authorizationStatus`. Always present — cannot be requested or suppressed.

- `referencesDrugCore` — **cross-core link to DrugCore.** Array of `AMDC_...` IDs for the product's active ingredients.

---

## GeneCore Endpoints

Harmonized gene records from HGNC + NCBI. One record = one approved gene. 43K+ genes. Drug-target genes add target intelligence (tractability, target class, safety, gnomAD v4.0 constraint, CRISPR essentiality) and an opt-in UniProt protein block.

### 1. Search

```

GET /v1/cores/genecore/records?query={text}

```

| Param | Required | Type | Notes |

| --- | --- | --- | --- |

| `query` | yes | string | Search across gene symbols, names, synonyms, gene families, RefSeq functional summaries, UniProt keywords, and ChEMBL target class |

| `limit` | no | int | 1–300, default 20 |

| `include` | no | enum | `protein`, `referencesDrugCore`. Repeat for multiple. |

| `geneType` | no | enum | `PROTEIN_CODING`, `NCRNA`, `PSEUDO`, `TRNA`, `RRNA`, `SNRNA`, `SCRNA`, `SNORNA`, `MISCRNA`, `BIOLOGICAL_REGION`, `TRANSPOSON`, `OTHER`. Repeat for multiple (OR). |

| `isDruggable` | no | bool | Druggable targets (any small-molecule/antibody tractability bucket). |

| `isEssential` | no | bool | Essential genes (a dependency in ≥ 1 CRISPR screen). |

| `targetClass` | no | enum | Top-level ChEMBL class: `ENZYME`, `MEMBRANE_RECEPTOR`, `ION_CHANNEL`, `TRANSPORTER`, `TRANSCRIPTION_FACTOR`, `EPIGENETIC_REGULATOR`, `SECRETED_PROTEIN`, `SURFACE_ANTIGEN`, `STRUCTURAL_PROTEIN`, `ADHESION`, `OTHER_CYTOSOLIC_PROTEIN`, `OTHER_NUCLEAR_PROTEIN`, `AUXILIARY_TRANSPORT_PROTEIN`, `UNCLASSIFIED_PROTEIN`. Repeat (OR). |

| `tractabilityModality` | no | enum | `SMALL_MOLECULE`, `ANTIBODY`, `PROTAC`, `OTHER_CLINICAL`. Repeat (OR). Alone = any stage. |

| `tractabilityStage` | no | enum | `APPROVED_DRUG`, `ADVANCED_CLINICAL`, `PHASE_1_CLINICAL`. Repeat (OR). Alone = any modality. |

| `hasSafetyLiabilities` | no | bool | Keep only genes with ≥ 1 curated target-safety liability. |

| `maxConstraintLoeuf` | no | number | Keep genes with gnomAD v4.0 LOEUF ≤ value (lower = more LoF-constrained; gnomAD recommends < 0.6). |

Filters combine with AND; repeated values for one param match ANY (OR). `targetClass` matches the top level only (deeper path still returned). `tractabilityModality` × `tractabilityStage` is a cross-product where an omitted dimension means "any". The target-intelligence filters only match genes that have target intelligence recorded.

```bash

curl "[https://api.amass.tech/api/v1/cores/genecore/records?query=GLP1R&geneType=PROTEIN_CODING&limit=5](https://api.amass.tech/api/v1/cores/genecore/records?query=GLP1R&geneType=PROTEIN_CODING&limit=5)" \

  -H "Authorization: Bearer amass_YOUR_KEY"

```

### 2. Get by Amass ID

```

GET /v1/cores/genecore/records/{amassId}

```

Returns 404 if not found, 400 if the Amass ID is malformed.

### 3. Batch Lookup (public gene ID -> Amass ID)

```

POST /v1/cores/genecore/records/lookup

```

Each item carries exactly one identifier key: `ensemblGeneId`, `hgncId`, `entrezGeneId`, `uniprotId`, `symbol`, `omimId`, `orphanet`, or `iuphar`.

```json

{"items": [{"ensemblGeneId": "ENSG00000146648"}, {"symbol": "EGFR"}, {"uniprotId": "P00533"}]}

```

Returns one entry per input item — `amassIds` (always an array) or `error`. Most IDs resolve to a single gene; a shared `uniprotIdomimId` may return several.

---

## GeneCore Record Schema

**Default fields:**

```

amassId        string       AMGC_... (canonical ID)

ensemblGeneId  string|null  Ensembl stable gene ID, e.g. ENSG00000141510

symbol         string|null  Approved gene symbol, e.g. TP53

name           string|null  Full gene name

synonyms       string[]     Alternative symbols / aliases

geneType       string|null  NCBI gene type / biotype, e.g. PROTEIN_CODING

summary        string|null  NCBI RefSeq curated functional description

location       string|null  Cytogenetic band, e.g. 17p13.1

chromosome     string|null  Chromosome, e.g. 17 / X (Ensembl)

strand         string|null  Genomic strand + or - (Ensembl)

entrezGeneId   string|null  NCBI Entrez gene ID

hgncId         string|null  HGNC ID, e.g. HGNC:11998

uniprotIds     string[]     UniProt accession(s)

hgncGeneGroups object[]     HGNC gene groups (families): { id, name } per group

maneSelect     string[]     MANE Select transcript id(s) (RefSeq + Ensembl)

omimId         string[]     OMIM disease/phenotype id(s)

orphanet       string|null  Orphanet rare-disease ID

iuphar         string|null  IUPHAR/Guide to Pharmacology target ID

tractability      object|null    OT druggability buckets by modality (clinical + predictive lanes)

safetyLiabilities object[]|null  Curated OT target-safety signals

targetClass       object|null    ChEMBL class path (broadest→leaf) + leaf class id

gnomadConstraint  object|null    gnomAD v4.0 gene constraint by variant class; LOEUF + pLI under lossOfFunction

depmapEssentiality object|null   CRISPR essentiality summary + most-dependent cell lines

```

**Target intelligence** (the five objects above; returned by default, `null` when the gene has none):

- `tractability` — keyed by modality `smallMolecule` / `antibody` / `protac` / `otherClinical`, each `{ clinical: string[], predictive: string[] }`. Clinical buckets: `Approved Drug`, `Advanced Clinical`, `Phase 1 Clinical`. Filter via `tractabilityModality` / `tractabilityStage` (clinical lane only) or `isDruggable`.

- `targetClass` — `{ path: string[] (broadest→leaf), leafChemblClassId: number|null }`. Filter via `targetClass` (top level only).

- `safetyLiabilities` — array of `{ event, datasource, url, effects:[{direction,dosing}], biosamples:string[], sources:[{name,type}] }`. Filter via `hasSafetyLiabilities` (presence only; events are free text).

- `gnomadConstraint` — keyed by variant class `synonymousmissenselossOfFunction`). `lossOfFunction.loeuf` is **LOEUF** (mirrors `lossOfFunction.oeUpper`), `lossOfFunction.pli` is **pLI**; also `lossOfFunction.loeufDecile`, `lossOfFunction.loeufRank` (syn/missense carry a constraint Z-score under `constraintZ`). Use LOEUF continuously where possible; gnomAD recommends **LOEUF < 0.6** for v4.0 (was < 0.35 for v2.1.1), with LOEUF decile or pLI ≥ 0.9 as alternatives. Filter via `maxConstraintLoeuf`.

- `depmapEssentiality` — `{ isEssential, cellLinesTested, dependentCellLines, mean/median/minGeneEffect, topDependencies:[{cellLineName,depmapId,tissue,disease,geneEffect,expression}] }` (top dependencies capped at 10). Filter via `isEssential`.

**Optional fields `include` param):** `protein`, `referencesDrugCore`

- `protein` `include=protein`) — representative UniProt Swiss-Prot entry: `{ identity:{canonicalAccession,entryName,annotationScore,evidenceLevel,mappedAccessions[]}, function:{functionSummary,associatedDiseases,tissueSpecificity,keywords[],subcellularLocations[]}, biophysics:{sequenceLength,molecularMassDa,ecNumbers[],ptmSummary,ptmTypes[]}, structure:{has3dStructure,pdbIds[],pfamIds[],interproIds[]} }`. `null` when the gene encodes no reviewed protein.

- `referencesDrugCore` `include=referencesDrugCore`) — **cross-core link to DrugCore.** Array of `AMDC_...` IDs for drugs that target this gene.

---

## PatentCore Endpoints

**Preview.** Patent publications served from the Amass index. One record = one publication. Retrieval is full-text search over title, abstract, claims, and description, combined with structured filters. Schema may change while in preview.

### 1. Search

```

GET /v1/cores/patentcore/records?query={text}

```

| Param | Required | Type | Notes |

| --- | --- | --- | --- |

| `query` | yes | string | search over title, abstract, claims, description, assignees, inventors |

| `limit` | no | int | 1–200, default 20 |

| `include` | no | string | One or more of: `claims`, `description`, `nplCitations`, `citedByPatents`, `referencesDrugCore`, `referencesBiomedCore`. Repeat for multiple. |

| `countryCode` | no | string | Comma-separated jurisdiction codes, match any, e.g. `US,EP,WO` |

| `kindCode` | no | string | Comma-separated kind codes, match any, e.g. `B2,A1` |

| `language` | no | string | Comma-separated language codes, match any |

| `cpcCodes` | no | string | Comma-separated CPC codes, match any |

| `ipcCodes` | no | string | Comma-separated IPC codes, match any |

| `assignee` | no | string | Comma-separated assignee names, match any. **Partial token match** — `Moderna` matches the normalized `MODERNATX INC` (last token treated as a prefix), so the exact legal name isn't required. |

| `inventor` | no | string | Comma-separated inventor names, match any. Partial token match, same rules as `assignee` (e.g. `Ciaramella` → `CIARAMELLA GIUSEPPE`). |

| `hasClaims` | no | bool | `truefalse` — patents that have claims text |

| `hasDescription` | no | bool | `truefalse` — patents that have a description |

| `minPublicationDate` / `maxPublicationDate` | no | ISO date | e.g. `2020-01-01` |

| `minFilingDate` / `maxFilingDate` | no | ISO date | |

| `minGrantDate` / `maxGrantDate` | no | ISO date | |

| `minPriorityDate` / `maxPriorityDate` | no | ISO date | |

| `minCitedByCount` | no | int | Minimum forward-citation (cited-by) count |

Multi-value filters: **OR within one filter (comma-separated), AND across filters.** `?countryCode=US,EP&hasClaims=true` returns US or EP patents that also have claims text.

**Family collapsing:** search always returns one result per patent family (the same invention filed across jurisdictions/stages is collapsed to its most relevant publication). The other siblings' Amass IDs are surfaced on the kept row in `familyMembers` (fetch them via the get/batch endpoint). To get every member of a family, including any not surfaced by the search, resolve the family through the lookup endpoint `{"familyId": "<id>"}`), which returns the Amass ID of each member publication.

```bash

curl "[https://api.amass.tech/api/v1/cores/patentcore/records?query=lipid+nanoparticle+mRNA+delivery&countryCode=US&limit=5](https://api.amass.tech/api/v1/cores/patentcore/records?query=lipid+nanoparticle+mRNA+delivery&countryCode=US&limit=5)" \

  -H "Authorization: Bearer amass_YOUR_KEY"

```

### 2. Get by Amass ID

```

GET /v1/cores/patentcore/records/{amassId}

```

Returns 404 if not found. Use `?include=claims,description,nplCitations,citedByPatents,referencesDrugCore,referencesBiomedCore` to expand opt-in fields.

### 3. Batch Lookup (publication/application number or family id -> Amass ID)

```

POST /v1/cores/patentcore/records/lookup

```

Each item must have exactly one of `publicationNumber`, `applicationNumber`, or `familyId`. `publicationNumber` resolves to one Amass ID; `applicationNumber` and `familyId` are one-to-many (they resolve to every member publication), so their `amassIds` array may hold several IDs.

```json

{"items": [{"publicationNumber": "US-10266485-B2"}, {"applicationNumber": "US-15-123456"}, {"familyId": "12345678"}]}

```

Returns `[{"amassIds": ["AMPC_..."]}, {"error": "..."}]` — one entry per input item.

---

## PatentCore Record Schema

**Default fields:**

```

amassId                   string       AMPC_... (canonical ID)

publicationNumber         string|null  Source-neutral identity key, e.g. US-10266485-B2

applicationNumber         string|null

countryCode               string|null  Jurisdiction / patent-office code, e.g. US, EP, WO

kindCode                  string|null  Document type/stage, e.g. A1, B2

familyId                  string|null  Patent family identifier

familyMembers             string[]     AMPC_... IDs of collapsed same-family siblings (empty when collapse is off; dereference via get/batch)

title                     string|null  English-preferred

abstract                  string|null  English-preferred

language                  string|null  Language of the full text

nonEnglishFallback        boolean|null True when text is the original non-English language

cpcCodes                  string[]     CPC classification codes

ipcCodes                  string[]     IPC classification codes

inventors                 string[]

assignees                 string[]     Assignee / applicant names

publicationDate           string|null  ISO date

filingDate                string|null  ISO date

grantDate                 string|null  ISO date

priorityDate              string|null  ISO date (earliest priority)

citedPatents              string[]     Backward: AMPC_... IDs of prior patents this one cites (dereference via get/batch; out-of-corpus cites dropped).

priorityClaimNumbers      string[]     Publication numbers claimed as priority

parentPublicationNumbers  string[]     Lineage

childPublicationNumbers   string[]     Lineage

hasClaims                 boolean|null

hasDescription            boolean|null

nplCount                  number|null  Backward count: non-patent-literature refs this patent cites (list opt-in as nplCitations)

citedByCount              number|null  Forward count: later patents citing this one (list opt-in as citedByPatents, whose entries are AMPC_... IDs; citedByCount always exact even though that list drops out-of-corpus cites)

```

Citation fields split by **direction**: *backward* = what this patent cites (prior art, fixed at publication); *forward* = what cites this patent (impact, grows over time). The opt-in lists `nplCitations`, `citedByPatents`) each have a default-returned count `nplCount`, `citedByCount`) so you can judge magnitude before expanding them.

**Optional fields `include` param):** `claims`, `description`, `nplCitations`, `citedByPatents`, `referencesDrugCore`, `referencesBiomedCore`

`referencesDrugCore` (opt-in) resolves the patent's linked drugs to verified `AMDC_*` DrugCore Amass IDs.

`referencesBiomedCore` (opt-in) resolves patent's non-patent-literature citations to verified `AMBC_*` BiomedCore Amass IDs (papers the patent cites).

---

## Common Patterns

**Find recent high-impact papers on a topic:**

```bash

curl "[https://api.amass.tech/api/v1/cores/biomedcore/records\](https://api.amass.tech/api/v1/cores/biomedcore/records\)

?query=CAR-T+therapy\

&minPublicationDate=2024-01-01\

&minCitationCount=10\

&minJournalQualityJufo=2\

&limit=20" \

  -H "Authorization: Bearer amass_YOUR_KEY"

```

**Find recruiting Phase 3 drug trials:**

```bash

curl "[https://api.amass.tech/api/v1/cores/trialcore/records\](https://api.amass.tech/api/v1/cores/trialcore/records\)

?query=lung+cancer\

&phase=PHASE3\

&overallStatus=RECRUITING\

&interventionType=DRUG\

&limit=20" \

  -H "Authorization: Bearer amass_YOUR_KEY"

```

**Find trials with results in a specific country:**

```bash

curl "[https://api.amass.tech/api/v1/cores/trialcore/records\](https://api.amass.tech/api/v1/cores/trialcore/records\)

?query=diabetes\

&hasResults=true\

&facilityCountries=US\

&limit=50" \

  -H "Authorization: Bearer amass_YOUR_KEY"

```

**Find approved drugs of a given modality:**

```bash

curl "[https://api.amass.tech/api/v1/cores/drugcore/records\](https://api.amass.tech/api/v1/cores/drugcore/records\)

?query=checkpoint+inhibitor\

&drugType=ANTIBODY\

&maxClinicalStage=APPROVAL\

&limit=20" \

  -H "Authorization: Bearer amass_YOUR_KEY"

```

**Find drugs that act on a given target gene:**

```bash

curl "[https://api.amass.tech/api/v1/cores/drugcore/records\](https://api.amass.tech/api/v1/cores/drugcore/records\)

?query=anti-inflammatory+PTGS1\

&limit=20" \

  -H "Authorization: Bearer amass_YOUR_KEY"

# The query matches target gene symbols; read mechanismsOfAction on each

# record for the target metadata.

```

**Compare a drug's US vs EU authorization status:**

```bash

curl "[https://api.amass.tech/api/v1/cores/regulatorycore/records\](https://api.amass.tech/api/v1/cores/regulatorycore/records\)

?query=pembrolizumab\

&limit=50" \

  -H "Authorization: Bearer amass_YOUR_KEY"

# Read authorizationsByAgency on each record for the cross-market status.

```

**Find expedited-pathway approvals across both agencies:**

```bash

curl "[https://api.amass.tech/api/v1/cores/regulatorycore/records\](https://api.amass.tech/api/v1/cores/regulatorycore/records\)

?query=oncology\

&hasDesignation=BREAKTHROUGH_THERAPY\

&hasDesignation=ACCELERATED_APPROVAL\

&hasDesignation=PRIME\

&limit=100" \

  -H "Authorization: Bearer amass_YOUR_KEY"

```

**Prioritize druggable, LoF-constrained target genes:**

```bash

curl "[https://api.amass.tech/api/v1/cores/genecore/records\](https://api.amass.tech/api/v1/cores/genecore/records\)

?query=kinase\

&isDruggable=true\

&targetClass=ENZYME\

&maxConstraintLoeuf=0.6\

&limit=20" \

  -H "Authorization: Bearer amass_YOUR_KEY"

# Each record carries target intelligence: tractability, targetClass,

# gnomadConstraint (LOEUF under lossOfFunction.loeuf), and depmapEssentiality.

```

**Prior-art search for a technology by assignee and jurisdiction (PatentCore, preview):**

```bash

curl "[https://api.amass.tech/api/v1/cores/patentcore/records\](https://api.amass.tech/api/v1/cores/patentcore/records\)

?query=mRNA+vaccine\

&countryCode=US,EP\

&assignee=Moderna\

&minPublicationDate=2020-01-01\

&limit=20" \

  -H "Authorization: Bearer amass_YOUR_KEY"

# assignee is a partial token match: "Moderna" finds the normalized "MODERNATX INC".

# Add include=claims to expand the full claims text on each record.

```

**Convert PMIDs to Amass IDs, then fetch full records:**

```bash

# Step 1: lookup

curl -X POST "[https://api.amass.tech/api/v1/cores/biomedcore/records/lookup](https://api.amass.tech/api/v1/cores/biomedcore/records/lookup)" \

  -H "Authorization: Bearer amass_YOUR_KEY" \

  -H "Content-Type: application/json" \

  -d '{"items": [{"pmid": "38123456"}]}'

# Step 2: fetch details

curl "[https://api.amass.tech/api/v1/cores/biomedcore/records/{amassId}\](https://api.amass.tech/api/v1/cores/biomedcore/records/{amassId}\)

?include=authorsMetadata" \

  -H "Authorization: Bearer amass_YOUR_KEY"

```

**Convert NCT IDs to Amass IDs, then fetch trial details:**

```bash

# Step 1: lookup

curl -X POST "[https://api.amass.tech/api/v1/cores/trialcore/records/lookup](https://api.amass.tech/api/v1/cores/trialcore/records/lookup)" \

  -H "Authorization: Bearer amass_YOUR_KEY" \

  -H "Content-Type: application/json" \

  -d '{"items": [{"nctId": "NCT04303507"}]}'

# Step 2: fetch details with outcomes

curl "[https://api.amass.tech/api/v1/cores/trialcore/records/{amassId}\](https://api.amass.tech/api/v1/cores/trialcore/records/{amassId}\)

?include=outcomes" \

  -H "Authorization: Bearer amass_YOUR_KEY"

```

**Cross-reference trials with publications:**

```bash

# Step 1: get trial with referencesBiomedCore IDs

curl "[https://api.amass.tech/api/v1/cores/trialcore/records/{amassId}\](https://api.amass.tech/api/v1/cores/trialcore/records/{amassId}\)

?include=referencesBiomedCore" \

  -H "Authorization: Bearer amass_YOUR_KEY"

# Step 2: fetch a referenced publication (BiomedCore record)

# Use one of the AMBC_ IDs from referencesBiomedCore in the response above.

curl "[https://api.amass.tech/api/v1/cores/biomedcore/records/{biomedCoreAmassId}](https://api.amass.tech/api/v1/cores/biomedcore/records/{biomedCoreAmassId})" \

  -H "Authorization: Bearer amass_YOUR_KEY"

```

**Link a target gene to the drugs that hit it:**

```bash

# Step 1: search a gene and request its linked DrugCore IDs

curl "[https://api.amass.tech/api/v1/cores/genecore/records\](https://api.amass.tech/api/v1/cores/genecore/records\)

?query=EGFR\

&include=referencesDrugCore\

&limit=1" \

  -H "Authorization: Bearer amass_YOUR_KEY"

# Step 2: fetch a targeting drug (use an AMDC_ ID from referencesDrugCore above)

# to read its structure, modality, and clinical stage.

curl "[https://api.amass.tech/api/v1/cores/drugcore/records/{drugCoreAmassId}](https://api.amass.tech/api/v1/cores/drugcore/records/{drugCoreAmassId})" \

  -H "Authorization: Bearer amass_YOUR_KEY"

```

**Resolve FDA/EMA identifiers to Amass IDs, then fetch authorizations:**

```bash

# Step 1: lookup (each item carries exactly one identifier)

curl -X POST "[https://api.amass.tech/api/v1/cores/regulatorycore/records/lookup](https://api.amass.tech/api/v1/cores/regulatorycore/records/lookup)" \

  -H "Authorization: Bearer amass_YOUR_KEY" \

  -H "Content-Type: application/json" \

  -d '{"items": [{"fdaApplicationNumber": "BLA125514"}, {"ndc": "0169-4404"}, {"splSetId": "ee06186f-2aa3-4990-a760-757579d8f77b"}]}'

# Step 2: fetch details with the agency-specific block

curl "[https://api.amass.tech/api/v1/cores/regulatorycore/records/{amassId}\](https://api.amass.tech/api/v1/cores/regulatorycore/records/{amassId}\)

?include=fdaDetails" \

  -H "Authorization: Bearer amass_YOUR_KEY"

```

For full walkthroughs of these patterns with real response data, see [API Workflows](examples/use-cases).

---

## Error Handling

```

200  Success

400  Bad request — check error.fields for per-field details

401  Missing or invalid API key

403  Valid key, insufficient permissions

404  Record not found (GET by ID only)

422  Semantically invalid input

429  Rate limited — read Retry-After header, back off exponentially

500  Server error — retry with backoff

```

Error shape:

```json

{"error": {"status": 429, "code": "TOO_MANY_REQUESTS", "message": "Too many requests"}}

```

---

```

Docs: [https://api.amass.tech/api/doc](https://api.amass.tech/api/doc)

Spec: [https://api.amass.tech/api/doc/openapi.json](https://api.amass.tech/api/doc/openapi.json)

Maintained for: LLM agents, AI applications, and automated tools

```

