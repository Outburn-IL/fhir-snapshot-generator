import { FhirPackageExplorer, ILogger } from 'fhir-package-explorer';

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
  const expanded = await fpe.expandPackageDependencies({id: packageId, version: packageVersion});
  const basePackages = expanded.filter(pkg => /^hl7\.fhir\.[^.]+\.core$/.test(pkg.id));
  if (basePackages.length === 0) {
    logger.warn(`No base FHIR package found for ${packageId}@${packageVersion}.`);
    return undefined;
  }
  if (basePackages.length > 1) {
    logger.warn(`Multiple base FHIR packages found for ${packageId}@${packageVersion}.`);
    return undefined;
  }
  return `${basePackages[0].id}@${basePackages[0].version}`;
};