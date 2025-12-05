import {
  describe,
  it,
  // afterAll,
  expect
} from 'vitest';
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
          // eslint-disable-next-line no-unused-vars
          constraint: el.constraint?.map(({ source, xpath, ...rest }: any) => rest),
          isSummary: el.isSummary ? el.isSummary : undefined,
          contentReference: el.contentReference ? (
            el.contentReference.startsWith('http://hl7.org/fhir/StructureDefinition/') ? '#' + el.contentReference.split('#')[1] : el.contentReference
          ) : undefined
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

        // 2. Normalize Extension.id type to handle cross-version differences
        if (basePath === 'Element.id' && (el.path === 'Extension.id' || el.path.endsWith('.extension.id'))) {
          newEl.type = newEl.type?.map((typeObj: any) => {
            if (typeObj.extension) {
              // Remove the structuredefinition-fhir-type extension to normalize R4/R5 differences
              
              const filteredExtensions = typeObj.extension.filter((ext: any) => 
                ext.url !== 'http://hl7.org/fhir/StructureDefinition/structuredefinition-fhir-type'
              );
              return {
                ...typeObj,
                extension: filteredExtensions.length > 0 ? filteredExtensions : undefined
              };
            }
            return typeObj;
          });
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
    

  // create empty directories for unsused dependencies if they don't exist.
  // This is to save time on installing these packages. 
  // Once the folders exists, fpi will assume they are installed.
  // const unusedDeps = [
  //   'hl7.fhir.uv.bulkdata#2.0.0',
  //   'hl7.fhir.uv.smart-app-launch#2.1.0',
  //   'ihe.formatcode.fhir#1.1.0',
  //   'us.cdc.phinvads#0.12.0',
  //   'us.nlm.vsac#0.11.0',
  //   'hl7.terminology.r4#5.0.0',
  //   'hl7.fhir.uv.extensions.r4#1.0.0',
  // ];

  // unusedDeps.forEach((dep) => {
  //   const [name, version] = dep.split('#');
  //   const basePath = path.join(cachePath, dep, 'package');
  //   const indexPath = path.join(basePath, '.fpi.index.json');
  //   const packageJsonPath = path.join(basePath, 'package.json');

  //   fs.ensureDirSync(basePath);

  //   if (!fs.existsSync(indexPath)) {
  //     // make a dummy index file with an empty files array
  //     fs.writeJSONSync(indexPath, {
  //       'index-version': 2,
  //       files: [],
  //     });
  //   }

  //   if (!fs.existsSync(packageJsonPath)) {
  //     // make a dummy package.json file with just name and version
  //     fs.writeJSONSync(packageJsonPath, {
  //       name,
  //       version,
  //     });
  //   }
  // });

  

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
    'ExtensionWithPolySlices',
    'ExtensionWithPolySlice',
    // 'head-occipital-frontal-circumference-percentile'
    // 'bp' // skipped because original snapshot has both value[x] and value[x]:valueQuantity although it's a monopoly
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
      delete applied.__corePackage;
      expect(applied).toEqual(compare);
    });

    it(`${sd}: should get correct core package for the snapshot`, async () => {
      const sdData = await fsg.getSnapshot(sd);
      expect(sdData.__corePackage).toBeDefined();
      expect(sdData.__corePackage.id).toBe('hl7.fhir.r4.core');
      expect(sdData.__corePackage.version).toBe('4.0.1');
    });
  }

  // afterAll(async () => {
  //   // remove the unsused dependencies directories - only if they don't contain real package files
  //   unusedDeps.forEach((dep) => {
  //     // check if the package directory contains any files other than .fpi.index.json and package.json
  //     const basePath = path.join(cachePath, dep, 'package');
  //     if (fs.existsSync(basePath)) {
  //       const files = fs.readdirSync(basePath).filter(file => !file.startsWith('.fpi.index.json') && file !== 'package.json');
  //       if (files.length === 0) {
  //         fs.removeSync(path.join(cachePath, dep));
  //       }
  //     }
  //   }
  //   );
  // });


},480000); // 8min timeout for all tests