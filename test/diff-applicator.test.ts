/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { FhirSnapshotGenerator } from 'fhir-snapshot-generator';

const normalizeSnapshotForTest = (input: any): any => {
  return {
    ...input,
    snapshot: {
      element: input.snapshot.element.map((el: any) => {
        const basePath = el.base?.path;

        const newEl = {
          ...el,
          definition: undefined,
          alias: undefined,
          mapping: undefined,
          comment: undefined,
          short: undefined,
          requirements: el.requirements
            ? el.requirements.replace('(http://hl7.org/fhir/', '(').replace('(R4/', '(')
            : undefined,
          condition: undefined,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          constraint: el.constraint?.map(({ source, xpath, ...rest }: any) => rest),
          isSummary: el.isSummary ? el.isSummary : undefined,
        };

        // 1. Override `type` if base.path === "Resource.id"
        if (basePath === 'Resource.id') {
          newEl.type = [
            {
              extension: [
                {
                  url: 'http://hl7.org/fhir/StructureDefinition/structuredefinition-fhir-type',
                  valueUrl: 'id',
                },
              ],
              code: 'http://hl7.org/fhirpath/System.String',
            },
          ];
        }

        // 2a. Add slicing if it doesn't exist and base.path matches
        if (
          !el.slicing &&
          (basePath === 'DomainResource.extension' || basePath === 'Element.extension')
        ) {
          newEl.slicing = {
            discriminator: [
              {
                type: 'value',
                path: 'url',
              },
            ],
            // description intentionally omitted to allow test-specific flexibility
            rules: 'open',
          };
        }

        // 2b. Clean up slicing.ordered if it exists and is false
        if (el.slicing && el.slicing.ordered === false) {
          newEl.slicing = { ...el.slicing };
          delete newEl.slicing.ordered;
        }

        return newEl;
      }),
    },
  };
};



const applyDiffTest = async (fsg: FhirSnapshotGenerator, id: string) => {
  const sd = normalizeSnapshotForTest(await fsg.getFpe().resolve({ id, resourceType: 'StructureDefinition' }));
  const result = normalizeSnapshotForTest(await fsg.getSnapshot(id));
  fs.writeJSONSync(path.join(fsg.getFpe().getCachePath(), id + '-applied-snapshot.json'), result, { spaces: 2 });
  fs.writeJSONSync(path.join(fsg.getFpe().getCachePath(), id + '-compare-snapshot.json'), sd, { spaces: 2 });
  return {
    compare: sd,
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
    'SimpleMonopolyExtensionVariation2'
    // 'bp'
  ];

  const fsg = await FhirSnapshotGenerator.create({
    cachePath,
    context,
    cacheMode: 'none'
  });

  for (const sd of listOfSd) {
    it(`${sd}: should get identical snapshot to original after applying diff to parent snapshot`, async () => {
      const result = await applyDiffTest(fsg, sd);
      const { compare, applied } = result;
      expect(applied).toEqual(compare);
    });
  }
},480000); // 8min timeout for all tests