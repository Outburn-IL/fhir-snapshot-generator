# FHIR Snapshot Generator

> Retrieve, generate and cache StructureDefinition snapshots from any valid FHIR package context  
> Part of the [FUME](https://github.com/Outburn-IL/fume-community) open-source initiative · Apache 2.0 License

## Overview

`fhir-snapshot-generator` applies differential profiles to their respective base definitions and returns full snapshot expansions. Supports caching of the generated snapshots in the FHIR package cache.

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

### 2. Fetch a snapshot

```ts
const snapshot = await fsg.getSnapshot('http://hl7.org/fhir/StructureDefinition/bp');
```

Supports:
- Canonical URL  
- ID  
- Name  

## Context
You must provide an array of FHIR packages in `context`. Any missing package or its dependencies will be installed.

Supports `<id>#<version>`, `<id>@<version>`, `<id>` (latest version) and a package identifier object e.g:
```
{
    id: 'hl7.fhir.us.core',
    version: '6.1.0'
}
```

## Cache Modes

| Mode      | Behavior                                                                        |
|-----------|---------------------------------------------------------------------------------|
| `lazy`    | *Default*. Generates and caches snapshots on-demand.                            |
| `ensure`  | Ensures all profiles in context have snapshots in cache. Generates missing ones.|
| `rebuild` | Clears cache and regenerates all snapshots from scratch.                        |
| `none`    | Disables caching completely. Always generates in memory.                        |

Cached snapshots are stored under:

```
<cachePath>/<packageId>#<packageVersion>/.fsg.snapshots/<FSG version>/
```
- The filename is identical to the original StructureDefinition filename in `<cachePath>/<packageId>#<packageVersion>/package`.
- FSG Version is the major and minor version parts, followed by `x`, e.g `1.0.x`

**DEVELOPER NOTICE** - This means that any change that affects the outcome of the snapshot generation must trigger a change of the minor version number, otherwise cached snapshots from previous versions will be re-used.

## Cache Path
`cachePath` defines the FHIR package cache directory to be used. This is passed through to [`fhir-package-explorer`](https://github.com/Outburn-IL/fhir-package-explorer) and [`fhir-package-installer`](https://github.com/Outburn-IL/fhir-package-installer).  
If not provided, the default cache location will be used.  
See: [Package Cache Directory section](https://github.com/Outburn-IL/fhir-package-installer/blob/main/README.md#package-cache-directory) in FPI's readme for details.

## FHIR Version

Specify the default FHIR version with the `fhirVersion` option. This determines which base definitions are used when none are explicitly imported through dependencies.
If not specified, defaults to `4.0.1` (FHIR R4).

## License

Apache License 2.0  
© Outburn Ltd. 2022–2025. All Rights Reserved.
