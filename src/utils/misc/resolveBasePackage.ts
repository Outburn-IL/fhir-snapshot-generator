/**
 * © Copyright Outburn Ltd. 2022-2025 All Rights Reserved
 *   Project name: fhir-snapshot-generator
 */

import { FhirPackageExplorer, ILogger, PackageIdentifier } from 'fhir-package-explorer';
import { fhirCorePackages, resolveFhirVersion } from './resolveFhirVersion';
import { BaseFhirVersion } from '../..';

const findCorePackage = async (pkg: PackageIdentifier, fpe: FhirPackageExplorer): Promise<PackageIdentifier[]> => {
  // if the requested package is a base package itself, return it as is
  if (Object.values(fhirCorePackages).includes(`${pkg.id}@${pkg.version}`)) {
    return [{ id: pkg.id, version: pkg.version }];
  }
  // otherwise, find the direct dependencies that are base FHIR packages
  const deps = await fpe.getDirectDependencies(pkg);
  return deps.filter(dep => Object.values(fhirCorePackages).includes(`${dep.id}@${dep.version}`));
};

/**
 * Resolves the base FHIR package for a given package ID and version.
 * If no base package is found in the dependencies, or there are multiple FHIR versions - returns undefined.
 * @param packageId The source package name (e.g., "hl7.fhir.us.core").
 * @param packageVersion The source package version (e.g., "6.1.0").
 * @param fpe The FhirPackageExplorer instance. Used to expand package dependencies.
 * @param logger The logger instance. Used to log warnings.
 * @return (string) The resolved base FHIR package (e.g., "hl7.fhir.r4.core@4.0.1").
 */
export const resolveBasePackage = async (packageId: string, packageVersion: string, fpe: FhirPackageExplorer, logger: ILogger): Promise<string | undefined> => {
  const corePackages = await findCorePackage({ id: packageId, version: packageVersion }, fpe);
  if (corePackages.length === 0) {
    logger.warn(`No base FHIR package dependency found for ${packageId}@${packageVersion}.`);
    // Check if the package manifest has a fhirVersions array
    const pkgManifest = await fpe.getPackageManifest({ id: packageId, version: packageVersion });
    if (pkgManifest.fhirVersions && pkgManifest.fhirVersions.length > 0) {
      // translate each fhirVersion to a package identifier and push into corePackages
      pkgManifest.fhirVersions.map((fhirVersion: string) => {
        logger.info(`Resolving core package for FHIR version ${fhirVersion}`);
        const corePackageId = resolveFhirVersion(fhirVersion as BaseFhirVersion, true) as PackageIdentifier | undefined;
        if (corePackageId) {
          const { id, version } = corePackageId;
          corePackages.push(
            {
              id,
              version
            }
          );
        } else {
          logger.warn(`Unknown FHIR version ${version} in package ${packageId}@${packageVersion}.`);
        }
      });
      // if still empty, return undefined
      if (corePackages.length === 0) return undefined;
    }
  }
  if (corePackages.length > 1) {
    logger.warn(`Multiple base FHIR packages found for ${packageId}@${packageVersion}: ${corePackages.map(pkg => `${pkg.id}@${pkg.version}`).join(', ')}.`);
    return undefined;
  }
  // We have exactly one base package
  const version = corePackages[0].id === 'hl7.fhir.r4.core' && corePackages[0].version === '4.0.0' ? '4.0.1' : corePackages[0].version; // Normalize 4.0.0 to 4.0.1
  return `${corePackages[0].id}@${version}`;
};