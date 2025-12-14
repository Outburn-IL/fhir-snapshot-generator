/**
 * © Copyright Outburn Ltd. 2022-2025 All Rights Reserved
 *   Project name: fhir-snapshot-generator
 */

import { FhirPackageExplorer } from 'fhir-package-explorer';
import { SnapshotFetcher } from '../../../types';
import { ElementDefinition, FhirPackageIdentifier } from '@outburn/types';
import { migrateElements } from '../element';

/**
 * A class dedicated to fetching FHIR definitions in the correct context for a specific snapshot generation process.
 * We use a class to encapsulate the context and expose methods that need fewer arguments/injections.
 */
export class DefinitionFetcher {
  // Package from which the StructureDefinition is from. Used as context for all mid-process type/profile resolutions
  private sourcePackage: FhirPackageIdentifier;
  // The base FHIR package (e.g., "hl7.fhir.r4.core@4.0.1") used for resolving FHIR base types.
  private corePackage: FhirPackageIdentifier;
  // An instance of the FhirPackageExplorer class. Used to resolve FHIR types and profiles.
  private fpe: FhirPackageExplorer;
  // A map to cache previously fetched element arrays for base types, profiles and contentReference.
  private elementCache: Map<string, ElementDefinition[]> = new Map<string, ElementDefinition[]>();
  // A function to fetch the snapshot of a profile using its URL. This is used when the URL points to a profile.
  // Depending on the FSG cache mode, it may return a pre-generated cached snapshot or generate a new one.
  private snapshotFetcher: SnapshotFetcher;
  
  public constructor(sourcePackage: FhirPackageIdentifier, corePackage: FhirPackageIdentifier, fpe: FhirPackageExplorer, snapshotFetcher: SnapshotFetcher) {
    this.sourcePackage = sourcePackage;
    this.corePackage = corePackage;
    this.snapshotFetcher = snapshotFetcher;
    this.fpe = fpe;
  };

  /**
     * Get the definition for one of the base FHIR types.
     * @param type The type ID (e.g., "CodeableConcept", "Quantity", etc.).
     */
  public async getBaseType(type: string): Promise<ElementDefinition[]> {
    // Check if the type is already cached
    let elements = this.elementCache.get(type);
    if (elements) {
      return elements;
    }
    // If not cached, fetch the type definition from the FhirPackageExplorer
    const definition = await this.fpe.resolve({ resourceType: 'StructureDefinition', id: type, package: this.corePackage, derivation: ['Element', 'Resource'].includes(type) ? undefined : 'specialization'});
    if (!definition) {
      throw new Error(`FHIR type '${type}' not found in base package '${this.corePackage}'`);
    }
    if (!definition.snapshot || !definition.snapshot.element || definition.snapshot.element.length === 0) {
      throw new Error(`FHIR type '${type}' in base package '${this.corePackage.id}@${this.corePackage.version}' does not have a snapshot`);
    }
    // prepare the elements array for inheritance
    elements = migrateElements(definition.snapshot.element as ElementDefinition[], definition.url);
    // Cache the elements later use
    this.elementCache.set(type, elements);
    return elements;
  }

  /**
   * Get the structure of a contentReference element.
   * @param identifier The identifier of the contentReference (e.g., "#Observation.referenceRange").
   */
  public async getContentReference(identifier: string): Promise<ElementDefinition[]> {
    if (!identifier.startsWith('#')) {
      throw new Error(`Invalid contentReference identifier '${identifier}'. Must start with '#'`);
    }
    // Check if the type is already cached
    const elements = this.elementCache.get(identifier);
    if (elements) {
      return elements;
    }
    const elementId: string = identifier.substring(1);
    const baseType: string = elementId.split('.')[0];
    const allElements: ElementDefinition[] = await this.getBaseType(baseType);
    const matchingElements: ElementDefinition[] = allElements.filter((e) => e?.id === elementId || String(e?.id).startsWith(elementId + '.'));
    if (matchingElements.length === 0) {
      throw new Error(`No matching elements found for contentReference '${identifier}'`);
    }
    // Cache the elements for future use
    this.elementCache.set(identifier, matchingElements);
    return matchingElements;
  }

  /**
   * When a profile references a type using a URL, the target may be either a profile or a base type.
   * This method resolves the URL, and if it is a base type (derivation=specialization), returns its snapshot.
   * If it is a profile, it returns the snapshot of the profile using the injected snapshotFetcher().
   * The snapshotFetcher is expected to return a pre-generated snapshot from the cache or generate a new one.
   * @param url Canonical URL of the type or profile.
   * @returns The snapshot elements of the resolved type or profile.
   */
  public async getByUrl(url: string): Promise<ElementDefinition[]> {
    // Check if the URL is already cached
    const elements = this.elementCache.get(url);
    if (elements) {
      return elements;
    }
    // If not cached, fetch the metadata first
    const metadata = await this.fpe.resolve({ resourceType: 'StructureDefinition', url, package: this.sourcePackage });
    if (!metadata) {
      throw new Error(`StructureDefinition '${url}' not found in package '${this.sourcePackage.id}@${this.sourcePackage.version}'`);
    }
    if (metadata.derivation === 'specialization') {
      // It's a base type, return the snapshot from the original StructureDefinition
      const sd = await this.fpe.resolve({ filename: metadata.filename, package: { id: metadata.__packageId, version: metadata.__packageVersion} });
      const elements = migrateElements(sd.snapshot?.element as ElementDefinition[], url);
      if (!elements || elements.length === 0) {
        throw new Error(`StructureDefinition '${url}' does not have a snapshot`);
      }
      // Cache the elements for future use
      this.elementCache.set(url, elements);
      return elements;
    }
    if (metadata?.derivation === 'constraint') {
      // It's a profile, return the snapshot using the injected snapshotFetcher
      const elements = migrateElements(await this.snapshotFetcher(url), url);
      if (!elements || elements.length === 0) {
        throw new Error(`Profile '${url}' does not have a snapshot`);
      }
      // Cache the elements for future use
      this.elementCache.set(url, elements);
      return elements;
    }
    throw new Error(`StructureDefinition '${url}' is neither a base type nor a profile`);
  }
};