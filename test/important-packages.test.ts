import { describe, expect, it } from 'vitest';
import { FhirSnapshotGenerator } from 'fhir-snapshot-generator';
import { FhirPackageExplorer } from 'fhir-package-explorer';
import { Logger } from '@outburn/types';


// TODO: improve performance of these tests or run them separately from the main test suite
describe.skip('Build all snapshots in a list of important packages', async () => {

  const cachePath = './test/.test-cache';
  const context = [
    'hl7.fhir.us.core#6.1.0',
    'hl7.fhir.us.davinci-pdex#2.0.0',
    'hl7.fhir.us.davinci-pas#2.0.1',
    'de.gematik.epa.medication@1.0.2-rc1',
    'hl7.fhir.uv.sdc@3.0.0',
    {'id':'hl7.fhir.us.davinci-crd','version':'2.0.0'}
  ];

  it('should generate all snapshots without unexpected issues', async () => {
    const warnings: any[] = [];
    const errors: any[] = [];
    const logger: Logger = {
      info: () => {}, // no-op
      warn: (msg) => {
        if (typeof msg === 'string' && msg === '{}') return; // ignore empty warning messages
        // ignore warning about known failed snapshots where it falls back to original due to cross-version extensions
        if (typeof msg === 'string') {
          
          if (            
            // sdc-questionnaire-behave has illegal children under the primitive value of Questionnaire.item.required (boolean)
            msg.includes('Failed to generate snapshot for \'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-behave\'')
            
            // sdc-usagecontext uses the monopoly shortcut form for two different types.
            // TODO: detect this by examining the diff array - if there are other elements in the diff that use this shortcut form on the same element
            // then treat then as polymorphic slices and not a monopoly.
            || msg.includes('Failed to generate snapshot for \'http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-usagecontext\'')
            
            // HL7's biologicallyderivedproduct-processing and biologicallyderivedproduct-manipulation
            // have diffs on Extension.extension:time[x].
            // This error is justified, it is truely an illegal element id.
            // TODO: figure out if it worth handling this case by fixing the element id and rerouting children.
            || msg.includes('Parent node not found for element Extension.extension:time[x]')
          ) {
            return;
          }
        }
        // ignore warning about cross-version extensions, they are expected
        if (typeof msg === 'string' && msg.includes('http://hl7.org/fhir/5.0/StructureDefinition/extension-')) {
          return;
        }
        warnings.push(msg);
      },
      error: (msg) => {
        if (typeof msg === 'string' && msg === '{}') return; // ignore empty error messages
        // ignore errors about cross-version extensions, they are expected (currently not supported).
        // TODO: support this by fetching the element definition from the appropriate FHIR version and:
        // 1. if type exists in current version - use it as the type of Extension.value[x]
        // 2. if type does not exist in current version - create a complex extension mimicking the target type
        //    steps 1+2 should be repeated on all children of the target type - they may themselves require complex extensions
        if (typeof msg === 'string' && msg.includes('http://hl7.org/fhir/5.0/StructureDefinition/extension-')) {
          return;
        }
        errors.push(msg);
      }
    };
  
    const fpe = await FhirPackageExplorer.create({
      cachePath,
      context,
      skipExamples: true
    });

    await FhirSnapshotGenerator.create({
      fpe,
      fhirVersion: '4.0.1',
      // use rebuild (and not 'none') to get a realistic duration assessment of a large pre-generation process.
      // using 'none' leads to repeated re-generation of the same snapshots due to other profiles referencing them
      cacheMode: 'rebuild',
      logger
    });

    const filteredErrors = errors.filter(e => typeof e === 'string' && !e.includes('CodeSystem') && !e.includes('ValueSet'));
    const filteredWarnings = warnings.filter(w => typeof w === 'string' && !w.includes('ValueSet') && !w.includes('CodeSystem'));
    expect(filteredWarnings, `Warnings: ${JSON.stringify(filteredWarnings, null, 2)}`).toStrictEqual([
      'No base FHIR package dependency found for de.gematik.fhir.directory@0.11.7.'
    ]);
    expect(filteredErrors, `Errors: ${JSON.stringify(filteredErrors, null, 2)}`).toEqual([]);
  }, 3600000); // 60min timeout for setup

}, 3600000); // 60min timeout for all tests