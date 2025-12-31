/* eslint-disable no-unused-vars */
/**
 * © Copyright Outburn Ltd. 2022-2025 All Rights Reserved
 *   Project name: fhir-snapshot-generator
 */

import { FhirPackageExplorer } from 'fhir-package-explorer';
import { 
  FhirVersion, 
  ElementDefinition,
  Logger
} from '@outburn/types';


export type Prethrower = (msg: Error | any) => Error;
  
export interface FhirTreeNode {
    id: string;
    path: string;
    definition?: ElementDefinition;
    children: FhirTreeNode[];
    idSegments: string[];
    pathSegments: string[];
    nodeType: 'element' | 'array' | 'poly' | 'slice' | 'resliced' | 'headslice';
    sliceName?: string;
  }

/**
 * Snapshot caching strategy.
 *
 * - `'lazy'`: Default. Generate each snapshot on demand and cache it afterward.
 * - `'ensure'`: Proactively generate and cache all **missing** snapshots.
 * - `'rebuild'`: Regenerate **all** snapshots and overwrite existing cache entries.
 * - `'none'`: Fully bypass the cache. Always regenerate snapshots and do not write to cache.
 */
export type SnapshotCacheMode = 'lazy' | 'ensure' | 'rebuild' | 'none';

export type SnapshotGeneratorConfig = {
  /**
   * The FhirPackageExplorer instance to use for resolving FHIR resources.
   * This allows sharing a single FPE instance across multiple modules (e.g., FSG and FTR).
   */
  fpe: FhirPackageExplorer;
  /**
   * The FHIR version to use for the snapshot generation.
   * This is used to determine the FHIR core package to use when fetching base FHIR types.
   */
  fhirVersion: FhirVersion;
  /**
   * Determines how snapshot caching is handled.
   * Defaults to `'lazy'` if not specified.
   */
  cacheMode?: SnapshotCacheMode;
  /**
   * Optional logger instance for custom logging.
   */
  logger?: Logger;
};

export type SnapshotFetcher = (url: string) => Promise<ElementDefinition[]>;