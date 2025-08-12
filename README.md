# FHIR Snapshot Generator

> Retrieve, generate and cache StructureDefinition snapshots & ValueSet expansions from any valid FHIR package context  
> Part of the [FUME](https://github.com/Outburn-IL/fume-community) open-source initiative · Apache 2.0 License

## Overview

`fhir-snapshot-generator`:
- Applies differential StructureDefinitions to their bases and returns full snapshots.
- Expands ValueSets (compose.include / compose.exclude) using CodeSystems from FHIR packages (no terminology server support).
- Caches generated StructureDefinition snapshots and successful (or fallback) ValueSet expansions alongside the source packages.

## Why?
Because:
1. Sometimes you need to programatically use a StructureDefinition that didn't come with a snapshot - only a differential. This is valid, but tools need to find a way to generate the snapshot in order to work with it.
2. There are some variations in representations of element ID's in many common snapshots, including some HL7 ones.
3. Many ValueSets in packages can already be locally expanded given complete CodeSystems; doing this locally avoids round‑trips to a terminology server for common, static sets.

If you don't want to compensate for all of these variations in your code, you may benefit from using snapshots & expansions that were generated using consistent, best-practice conventions.

FSG supports multiple FHIR versions, package-context-aware resolution of cross-profile references & terminology, lazy or full-cache modes, and works hand-in-hand with [`fhir-package-explorer`](https://github.com/Outburn-IL/fhir-package-explorer) and [`fhir-package-installer`](https://github.com/Outburn-IL/fhir-package-installer).

## Installation

```
npm install fhir-snapshot-generator
```

## Usage

### 1. Create an instance

```ts
import { FhirSnapshotGenerator } from 'fhir-snapshot-generator';

const fsg = await FhirSnapshotGenerator.create({
  context: ['hl7.fhir.us.core@6.1.0'],
  cachePath: './.fhir-cache',
  fhirVersion: '4.0.1',
  cacheMode: 'lazy' // 'lazy' | 'ensure' | 'rebuild' | 'none'
});
```

If a base FHIR package is missing from the package context and dependencies, it will be added automatically according to `fhirVersion`.

### 2a. Fetch a StructureDefinition snapshot

```ts
const snapshot = await fsg.getSnapshot('http://hl7.org/fhir/StructureDefinition/bp');
```

### 2b. Expand a ValueSet

```ts
const expansion = await fsg.expandValueSet('administrative-gender'); // id | name | canonical URL
```

Both `getSnapshot` and `expandValueSet` accept any FSH-style identifier: canonical URL, id or name. They also accept a resolved metadata object if you already have one.

## ValueSet Expansion Details

The expansion engine performs a deterministic local expansion when possible:
- Supports: `compose.include` (system + all codes, or explicit concept list), `compose.exclude`, and `include.valueSet` recursion (with cycle detection) plus JSON-style set semantics (union of includes, subtraction of excludes, intersection when combining explicit concepts with referenced ValueSets for the same system).
- Not supported yet: `include.filter` (expansion will throw an error). This intentionally surfaces intensional ValueSets so callers can fallback to an external terminology service if possible.
- Recursion: `include.valueSet` entries are resolved first in the source package; if not found there, a global context fallback is attempted.
- Fallback: If local generation fails but the original ValueSet resource contains an `expansion.contains`, that original expansion is returned and cached (no attempt is made to validate staleness).
- Displays: When an `include.concept` list supplies explicit codes with displays, the associated CodeSystem resource is not loaded (performance optimization).

### CodeSystem Resolution Rules

When expanding ValueSets the generator resolves referenced CodeSystems by canonical URL (may be a versioned URL):
1. Attempt resolution within the originating ValueSet's package (exact version context).
2. If not found, fall back to global [`fhir-package-explorer`](https://github.com/Outburn-IL/fhir-package-explorer) context using semver-aware `resolveMeta` from FPE to pick a single best version (prevents duplicate version conflicts).
3. Only CodeSystems with `content = 'complete'` are eligible. Any other `content` will throw an expansion error.
4. CodeSystems themselves are NOT cached by FSG (they live in their package). Only the derived ValueSet expansion result is cached.

### Expansion Caching

Expanded (or fallback) ValueSets are cached using the same directory strategy as StructureDefinition snapshots (see below). Repeated calls reuse the cached expansion unless `cacheMode` is `none`.

## Context
You must provide an array of FHIR packages in `context`. Any package or its dependencies missing in the local FHIR package cache will be downloaded and installed (by [`fhir-package-installer`](https://github.com/Outburn-IL/fhir-package-installer)).

Supports `<id>#<version>`, `<id>@<version>`, `<id>` (latest version) or a package identifier object e.g:
```
{
    id: 'hl7.fhir.us.core',
    version: '6.1.0'
}
```

## Cache Modes

| Mode      | Behavior                                                                                         |
|-----------|--------------------------------------------------------------------------------------------------|
| `lazy`    | *Default*. Generates and caches snapshots & expansions on demand.                                |
| `ensure`  | Ensures all profiles AND ValueSets have cached snapshots/expansions (missing ones are generated). |
| `rebuild` | Clears cache and regenerates all snapshots & expansions from scratch.                            |
| `none`    | Disables caching completely (snapshots & expansions computed each call, nothing written).        |

Cached artifacts are stored under:

```
<cachePath>/<packageId>#<packageVersion>/.fsg.snapshots/<FSG version>/
```
- Filenames mirror originals in `<cachePath>/<packageId>#<packageVersion>/package`.
- FSG Version directory uses major.minor.x (e.g. `1.4.x`).

**DEVELOPER NOTICE** – Any change that affects snapshot or expansion generation output MUST increment the minor version so previously cached results are not silently reused.

## Cache Path
`cachePath` defines the FHIR package cache directory to be used. This is passed through to [`fhir-package-explorer`](https://github.com/Outburn-IL/fhir-package-explorer) and [`fhir-package-installer`](https://github.com/Outburn-IL/fhir-package-installer).  
If not provided, the default cache location will be used.  
See: [Package Cache Directory section](https://github.com/Outburn-IL/fhir-package-installer/blob/main/README.md#package-cache-directory) in FPI's readme for details.

## FHIR Version

Specify the default FHIR version with the `fhirVersion` option. This determines which base definitions are used when none are explicitly imported through dependencies.
If not specified, defaults to `4.0.1` (FHIR R4).

## Limitations / Roadmap
- `include.filter` (intensional ValueSets) not yet supported for local logical expansion.
- Does not perform terminology validation beyond presence of codes in complete CodeSystems.
- No expansion parameterization (e.g. date constraints) – expansions are purely structural.

## License

Apache License 2.0  
© Outburn Ltd. 2022–2025. All Rights Reserved.
