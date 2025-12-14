# FHIR Snapshot Generator

> Retrieve, generate and cache StructureDefinition snapshots from any valid FHIR package context  
> Part of the [FUME](https://github.com/Outburn-IL/fume-community) open-source initiative · Apache 2.0 License

## Overview

`fhir-snapshot-generator`:
- Applies differential StructureDefinitions to their bases and returns full snapshots.
- Caches generated StructureDefinition snapshots alongside the source packages.

## Why?
Because:
1. Sometimes you need to programatically use a StructureDefinition that didn't come with a snapshot - only a differential. This is valid, but tools need to find a way to generate the snapshot in order to work with it.
2. There are some variations in representations of element ID's in many common snapshots, including some HL7 ones.

If you don't want to compensate for all of these variations in your code, you may benefit from using snapshots that were generated using consistent, best-practice conventions.

FSG supports multiple FHIR versions, package-context-aware resolution of cross-profile references, lazy or full-cache modes, and works hand-in-hand with [`fhir-package-explorer`](https://github.com/Outburn-IL/fhir-package-explorer) and [`fhir-package-installer`](https://github.com/Outburn-IL/fhir-package-installer).

## Installation

```
npm install fhir-snapshot-generator
```

## Usage

### 1. Create a FhirPackageExplorer instance

```ts
import { FhirPackageExplorer } from 'fhir-package-explorer';
import { FhirSnapshotGenerator } from 'fhir-snapshot-generator';

// First, create a FhirPackageExplorer instance
const fpe = await FhirPackageExplorer.create({
  context: ['hl7.fhir.us.core@6.1.0'],
  cachePath: './.fhir-cache',
  fhirVersion: '4.0.1',
  skipExamples: true // recommended for better performance
});

// Then, pass it to the FhirSnapshotGenerator
const fsg = await FhirSnapshotGenerator.create({
  fpe, // required: FhirPackageExplorer instance
  fhirVersion: '4.0.1', // optional: will be inferred from FPE if not provided
  cacheMode: 'lazy', // optional: 'lazy' | 'ensure' | 'rebuild' | 'none'
  logger: customLogger // optional: provide your own logger
});
```

> **Note:** The `fpe` instance is required and must be created first. This allows sharing a single FPE instance across multiple modules (e.g., when using both `fhir-snapshot-generator` and `fhir-terminology-runtime`).

> **Note:** The underlying `fhir-package-explorer` automatically adds a FHIR core package (e.g., `hl7.fhir.r4.core@4.0.1`) to the context if none is found, based on the specified `fhirVersion`.

### 2. Fetch a StructureDefinition snapshot

```ts
const snapshot = await fsg.getSnapshot('http://hl7.org/fhir/StructureDefinition/bp');
```

`getSnapshot` accepts any FSH-style identifier: canonical URL, id or name. It also accepts a resolved metadata object if you already have one.

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
| `lazy`    | *Default*. Generates and caches snapshots on demand.                                             |
| `ensure`  | Ensures all profiles have cached snapshots (missing ones are generated).                         |
| `rebuild` | Clears cache and regenerates all snapshots from scratch.                                         |
| `none`    | Disables caching completely (snapshots computed each call, nothing written).                     |

Cached artifacts are stored under:

```
<cachePath>/<packageId>#<packageVersion>/.fsg.snapshots/<FSG version>/
```
- Filenames mirror originals in `<cachePath>/<packageId>#<packageVersion>/package`.
- FSG Version directory uses major.minor.x (e.g. `1.4.x`).

**DEVELOPER NOTICE** – Any change that affects snapshot generation output MUST increment the minor version so previously cached results are not silently reused.

## Cache Path
`cachePath` defines the FHIR package cache directory to be used. This is passed through to [`fhir-package-explorer`](https://github.com/Outburn-IL/fhir-package-explorer) and [`fhir-package-installer`](https://github.com/Outburn-IL/fhir-package-installer).  
If not provided, the default cache location will be used.  
See: [Package Cache Directory section](https://github.com/Outburn-IL/fhir-package-installer/blob/main/README.md#package-cache-directory) in FPI's readme for details.

## FHIR Version

Specify the default FHIR version with the `fhirVersion` option. This determines which base definitions are used when none are explicitly imported through dependencies.
If not specified, defaults to `4.0.1` (FHIR R4).

## Sharing FPE with Other Modules

As of version 2.0, FSG accepts a `FhirPackageExplorer` instance via dependency injection rather than creating its own. This enables efficient resource sharing across multiple FHIR modules.

For example, if you're using both `fhir-snapshot-generator` and `fhir-terminology-runtime`:

```ts
import { FhirPackageExplorer } from 'fhir-package-explorer';
import { FhirSnapshotGenerator } from 'fhir-snapshot-generator';
import { FhirTerminologyRuntime } from 'fhir-terminology-runtime';

// Create a single FPE instance
const fpe = await FhirPackageExplorer.create({
  context: ['hl7.fhir.us.core@6.1.0'],
  cachePath: './.fhir-cache',
  fhirVersion: '4.0.1',
  skipExamples: true
});

// Share it across both modules
const fsg = await FhirSnapshotGenerator.create({ fpe, fhirVersion: '4.0.1', cacheMode: 'lazy' });
const ftr = await FhirTerminologyRuntime.create({ fpe });
```

This approach:
- Avoids duplicate package loading and parsing
- Reduces memory footprint
- Ensures consistent package resolution across modules
- Simplifies configuration (set context and cache path once)

## Terminology Support

ValueSet expansion and CodeSystem resolution functionality has been moved to the separate [`fhir-terminology-runtime`](https://github.com/Outburn-IL/fhir-terminology-runtime) module. If you need terminology services, please use that package (and share the same FPE instance as shown above).

## License

Apache License 2.0  
© Outburn Ltd. 2022–2025. All Rights Reserved.
