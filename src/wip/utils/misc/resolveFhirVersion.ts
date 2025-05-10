import { BaseFhirVersion } from '../../types';

const fhirVersionMap = {
  '3.0.2': 'STU3',
  '3.0': 'STU3',
  'R3': 'STU3',
  '4.0.1': 'R4',
  '4.0': 'R4',
  '4.3.0': 'R4B',
  '4.3': 'R4B',
  '5.0.0': 'R5',
  '5.0': 'R5'
};

const fhirCorePackages = {
  'STU3': 'hl7.fhir.r3.core@3.0.2',
  'R4': 'hl7.fhir.r4.core@4.0.1',
  'R4B': 'hl7.fhir.r4b.core@4.3.0',
  'R5': 'hl7.fhir.r5.core@5.0.0'
};

/**
 * Resolves any of the allowed FHIR version identifiers to a canonical version string.
 * If toPackage is true, it will return the base FHIR package name instead of the version identifier.
 * @param version Any valid FHIR version identifier (e.g., "R4", "4.0.1", "4.3", etc.).
 * @param toPackage If true, return the base FHIR package name instead of the version identifier.
 * @throws Error if the version is not supported.
 * @returns The resolved FHIR version or base package name.
 */
export const resolveFhirVersion = (version: BaseFhirVersion, toPackage?: boolean): string => {
  if (fhirVersionMap[version]) {
    return fhirVersionMap[version] as BaseFhirVersion;
  }
  if (!fhirCorePackages[version]) {
    throw new Error(`Unsupported FHIR version: ${version}. Supported versions are: ${Object.keys(fhirCorePackages).join(', ')}`);
  }
  if (toPackage) {
    return fhirCorePackages[version];
  }
  return version;
};