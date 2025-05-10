/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * © Copyright Outburn Ltd. 2022-2025 All Rights Reserved
 *   Project name: fhir-snapshot-generator
 */

import { ExplorerConfig } from 'fhir-package-explorer';

export interface ElementDefinition {
    id: string;                     // e.g., 'Extension.value[x]'
    path: string;                    // e.g., 'Extension.value[x]'
  
    min?: number;                    // Cardinality minimum
    max?: string;                    // Cardinality maximum (e.g., '1', '*')
  
    type?: ElementDefinitionType[];  // Possible types for this element (for polymorphics)
  
    slicing?: ElementDefinitionSlicing;  // Slicing definition if applicable
    sliceName?: string;              // If this element is a slice
  
    fixedUri?: string;               // Fixed value (if constrained)
    binding?: ElementDefinitionBinding;  // Value set binding for coded types
  
    // Other common constraint-related fields:
    short?: string;
    definition?: string;
    comment?: string;
  
    // Placeholder for additional optional fields we may not be using yet:
    [key: string]: any;
  }
  
export interface ElementDefinitionType {
    code: string;                     // e.g., 'string', 'CodeableConcept', 'Quantity', etc.
    profile?: string[];               // URLs of constrained profiles
    targetProfile?: string[];         // For references, allowed target profiles
    extension?: any;               // Extensions for the type (e.g., FHIRPath type)
  }
  
export interface ElementDefinitionSlicing {
    discriminator: SlicingDiscriminator[];
    rules: 'closed' | 'open' | 'openAtEnd';
    description?: string;
    ordered?: boolean;
  }
  
export interface SlicingDiscriminator {
    type: 'value' | 'exists' | 'pattern' | 'type' | 'profile';
    path: string;
  }
  
export interface ElementDefinitionBinding {
    strength: 'required' | 'extensible' | 'preferred' | 'example';
    valueSet?: string;                // Canonical URL of the ValueSet
  }
  
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

export type BaseFhirVersion = '3.0.2' | '4.0.1' | '4.3.0' | '5.0.0' | '3.0' | '4.0' | '4.3' | '5.0' | 'R3' | 'STU3' | 'R4' | 'R4B' | 'R5';

export type SnapshotGeneratorConfig = Omit<ExplorerConfig, 'skipExamples'> & {
  /**
   * Determines how snapshot caching is handled.
   * Defaults to `'lazy'` if not specified.
   */
  cacheMode?: SnapshotCacheMode;
  /**
   * The FHIR version to use for the snapshot generation.
   * This is used to determine the FHIR core package to use when fetching base FHIR types.
   * Defaults to 4.0.1 if not specified.
   */
  fhirVersion?: BaseFhirVersion;
};