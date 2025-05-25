import path from 'path';
import fs from 'fs-extra';
import { describe, it, expect, beforeAll } from 'vitest';

import { toTree, fromTree } from '../src/utils';
import { FhirPackageExplorer } from 'fhir-package-explorer';

const roundTripTest = async (fpe: FhirPackageExplorer, sd: string) => {
  const snapshot = await fpe.resolve({ id: sd, resourceType: 'StructureDefinition' });
  const tree = toTree(snapshot.snapshot.element);
  fs.writeJSONSync(path.join(fpe.getCachePath(), `${sd}-tree.json`), tree, { spaces: 2 });
  const flattenedSnapshot = fromTree(tree);
  fs.writeJSONSync(path.join(fpe.getCachePath(), `${sd}-flattened-snapshot.json`), flattenedSnapshot, { spaces: 2 });
  fs.writeJSONSync(path.join(fpe.getCachePath(), `${sd}-flattened-snapshot-compare.json`), snapshot.snapshot.element, { spaces: 2 });
  return {
    compare: snapshot.snapshot.element,
    roundtrip: flattenedSnapshot
  };
};

describe('Snapshot Tree Round-trip', () => {
  let fpe: FhirPackageExplorer;
  const cachePath = './test/.test-cache';
  const context = ['il.core.fhir.r4#0.17.0', 'fsg.test.pkg#0.1.0'];
    
  beforeAll(async () => {
    // create empty directories for unsused dependencies
    ['hl7.fhir.uv.bulkdata#2.0.0', 'hl7.fhir.uv.sdc#3.0.0', 'hl7.fhir.uv.smart-app-launch#2.1.0', 'ihe.formatcode.fhir#1.1.0', 'us.cdc.phinvads#0.12.0', 'us.nlm.vsac#0.11.0', 'hl7.terminology.r4#5.0.0', 'hl7.fhir.uv.extensions.r4#1.0.0'].forEach((dep) => {
      fs.ensureDirSync(path.join(cachePath, dep));
      fs.ensureDirSync(path.join(cachePath, dep, 'package'));
      fs.writeJSONSync(path.join(cachePath, dep, 'package', '.fpi.index.json'),{
        'index-version': 2,
        files: []
      });
      fs.writeJSONSync(path.join(cachePath, dep, 'package', 'package.json'),{
        name: dep.split('#')[0],
        version: dep.split('#')[1]
      });
    });
    fpe = await FhirPackageExplorer.create({
      cachePath,
      context,
      skipExamples: true
    });
  }, 240000); // 4min timeout for setup
    
  const listOfSd = [
    'SimpleLiberalExtension',
    'SimpleMonopolyExtension',
    'ext-hearing-loss',
    'fixed-system-identifier',
    'fixed-system-patient-identifier',
    'FixedSystemPatientIdentifierProfile',
    'OrganizationBasicProfile',
    'ComplexLiberalExtension',
    'SimpleBinaryTypeExtension',
    'SimpleCardinalityPatient',
    'PractitionerQualificationSlices',
    'PatientIdentifierDeepDiff',
    'language',
    'CodeableConceptSliceInherit',
    'il-core-patient',
    'il-core-practitioner',
    'Observation',
    'il-core-observation',
    'il-core-vital-signs',
    'il-core-bp',
    'il-core-address',
    'us-core-patient',
    'SimpleMonopolyExtensionVariation1',
    'SimpleMonopolyExtensionVariation2',
    'vitalsigns',
    // 'bp' // skipped because original snapshot has both value[x] and value[x]:valueQuantity although it's a monopoly
  ];

  for (const sd of listOfSd) {
    it(`should get identical snapshot to original after round-trip for ${sd}`, async () => {
      const result = await roundTripTest(fpe, sd);
      const { compare, roundtrip } = result;
      expect(roundtrip).toEqual(compare);
    }
    , 240000);
  } // 4min timeout for this test
},480000); // 8min timeout for all tests