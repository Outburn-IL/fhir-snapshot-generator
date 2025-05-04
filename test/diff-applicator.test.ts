import { describe, it, expect } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { FhirPackageExplorer } from 'fhir-package-explorer';
import { applyDiffs } from '../src/wip';

const applyDiffTest = async (fpe: FhirPackageExplorer, id: string) => {
  const sd = await fpe.resolve({ id, resourceType: 'StructureDefinition' });
  const parentSnapshot = await fpe.resolve({ url: sd.baseDefinition, resourceType: 'StructureDefinition' });
  const result = await applyDiffs(parentSnapshot.snapshot.element, sd.differential.element, fpe);
  fs.writeJSONSync(path.join(fpe.getCachePath(), id + '-applied-snapshot.json'), result, { spaces: 2 });
  fs.writeJSONSync(path.join(fpe.getCachePath(), id + '-compare-snapshot.json'), sd.snapshot.element, { spaces: 2 });
  return {
    compare: sd.snapshot.element,
    applied: result
  };
};

describe('Apply differential to parent snapshot', async () => {

  const cachePath = './test/.test-cache';
  const context = ['il.core.fhir.r4#0.17.0', 'fsg.test.pkg#0.1.0'];
    

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
    'CodeableConceptSliceInherit',
    'il-core-patient',
    'il-core-practitioner',
    'il-core-bp',
    // 'bp'
  ];

  const fpe = await FhirPackageExplorer.create({
    cachePath,
    context,
    skipExamples: true
  });

  for (const sd of listOfSd) {
    it(`${sd}: should get identical snapshot to original after applying diff to parent snapshot`, async () => {
      const result = await applyDiffTest(fpe, sd);
      const { compare, applied } = result;
      expect(applied).toEqual(compare);
    });
  }
},480000); // 8min timeout for all tests