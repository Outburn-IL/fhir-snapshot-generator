import path from 'path';
import fs from 'fs-extra';
import { describe, it, expect, beforeAll } from 'vitest';

import { FhirSnapshotGenerator } from 'fhir-snapshot-generator';
import { ElementDefinition } from '../src/wip/types';

const deleteInternalFields = (snapshot) => {
  delete snapshot['__filename'];
  delete snapshot['__packageId'];
  delete snapshot['__packageVersion'];
  snapshot.snapshot.element.forEach((element) => {
    if (element['comment']) {
      delete element['comment'];
    }
    if (element['definition']) {
      delete element['definition'];
    }
    if (element['short']) {
      delete element['short'];
    }
    if (element['alias']) {
      delete element['alias'];
    }
    if (element['mapping']) {
      delete element['mapping'];
    }
    if (element['extension']) {
      delete element['extension'];
    }
    // if element contains constraint array, remove the `source` field from each constraint
    if (element['constraint']) {
      element['constraint'].forEach((constraint) => {
        if (constraint['source']) {
          delete constraint['source'];
        }
      });
    }
  });
  return snapshot;
};

describe.skip('FhirSnapshotGenerator', () => {
  let fsg: FhirSnapshotGenerator;
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
    fsg = await FhirSnapshotGenerator.create({
      cachePath,
      context
    });
  }, 240000); // 4min timeout for setup
    
  it.skip('should create a snapshot for CQF-Questionnaire by URL', async () => {
    const snapshot = await fsg.getSnapshot('http://hl7.org/fhir/StructureDefinition/cqf-questionnaire');
    const compare = fs.readJSONSync(path.join('.', 'test', 'CQF-Questionnaire.json'));
    expect(snapshot).toEqual(compare);
  });

  it.skip('should create a snapshot for bp by id', async () => {
    const snapshot = await fsg.getSnapshot('bp');
    const compare = fs.readJSONSync(path.join('.', 'test', 'bp.json'));
    expect(snapshot).toEqual(compare);
  }, 10000); // 10s timeout for this test

  it.skip('should create a snapshot for il-core-patient by id', async () => {
    const snapshot = await fsg.getSnapshot('il-core-patient');
    const compare = fs.readJSONSync(path.join('.', 'test', 'il-core-patient.json'));
    expect(snapshot).toEqual(compare);
  }, 10000);

  it.skip('should create a snapshot for il-core-practitioner by id', async () => {
    const snapshot = await fsg.getSnapshot('il-core-practitioner');
    const compare = fs.readJSONSync(path.join('.', 'test', 'il-core-practitioner.json'));
    expect(snapshot).toEqual(compare);
  }, 15000); // 15s timeout for this test

  it.skip('should get a partial snapshot of a BackboneElement', async () => {
    const snapshot = await fsg.getSnapshot('#Questionnaire.item.item');
    const compare = fs.readJSONSync(path.join('.', 'test', 'Questionnaire.item.item.json'));
    expect(snapshot).toEqual(compare);
  });

  it.skip('should get original StructureDefinition for MedicationRequest', async () => {
    const snapshot = await fsg.getSnapshot('MedicationRequest', { id: 'il.core.fhir.r4', version: '0.17.0' });
    const compare = fs.readJSONSync(path.join('.', 'test', 'MedicationRequest.json'));
    expect(snapshot).toEqual(compare);
  });

  it.skip('should fetch previously generated snapshots from cache (fast retrieval)', async () => {
    const start = Date.now();
    await fsg.getSnapshot('il-core-practitioner');
    await fsg.getSnapshot('ILCorePractitioner');
    await fsg.getSnapshot('http://fhir.health.gov.il/StructureDefinition/il-core-practitioner');
    await fsg.getSnapshot('il-core-patient');
    await fsg.getSnapshot('bp');
    await fsg.getSnapshot('MedicationRequest');
    const lastSnapshot = await fsg.getSnapshot('http://hl7.org/fhir/StructureDefinition/cqf-questionnaire');
    const duration = Date.now() - start;
    expect(lastSnapshot).toBeDefined();
    expect(duration).toBeLessThan(50);
  });

  it.skip( // skip this test for now, it is to big to debug
    'should match FSH generated snapshot for il-core-practitioner', async () => {
      const snapshot = await fsg.getSnapshot('il-core-practitioner');
      fs.writeJSONSync(path.join(fsg.getCachePath(), 'generated_il-core-practitioner.json'), snapshot.snapshot, { spaces: 2 });
      const compare = fs.readJSONSync(path.join('.', 'test', 'StructureDefinition-il-core-practitioner.json'));
      fs.writeJSONSync(path.join(fsg.getCachePath(), 'compared_il-core-practitioner.json'), compare.snapshot, { spaces: 2 });
      delete snapshot['__filename'];
      delete snapshot['__packageId'];
      delete snapshot['__packageVersion'];
      // delete comment, short and definition from the snapshot elements
      snapshot.snapshot.element.forEach((element: ElementDefinition) => {
        if (element['comment']) {
          delete element['comment'];
        }
        if (element['definition']) {
          delete element['definition'];
        }
        if (element['short']) {
          delete element['short'];
        }
        if (element['alias']) {
          delete element['alias'];
        }
        if (element['mapping']) {
          delete element['mapping'];
        }
        if (element['mustSupport']) {
          delete element['mustSupport'];
        }
      });
      compare.snapshot.element.forEach((element: ElementDefinition) => {
        if (element['comment']) {
          delete element['comment'];
        }
        if (element['definition']) {
          delete element['definition'];
        }
        if (element['short']) {
          delete element['short'];
        }
        if (element['alias']) {
          delete element['alias'];
        }
        if (element['mapping']) {
          delete element['mapping'];
        }
        if (element['mustSupport']) {
          delete element['mustSupport'];
        }
      });
      expect(snapshot).toEqual(compare);
    });

  it('should create a correct snapshot for SimpleCardinalityPatient', async () => {
    const snapshot = deleteInternalFields(await fsg.getSnapshot('SimpleCardinalityPatient'));
    const compare = deleteInternalFields(fs.readJSONSync(path.join(cachePath, 'fsg.test.pkg#0.1.0', 'package', 'StructureDefinition-SimpleCardinalityPatient.json')));
    expect(snapshot).toEqual(compare);
  });

  //HearingLossDisability
  it.skip('should create a correct snapshot for HearingLossDisability', async () => {
    const snapshot = deleteInternalFields(await fsg.getSnapshot('HearingLossDisability'));
    const compare = deleteInternalFields(fs.readJSONSync(path.join(cachePath, 'fsg.test.pkg#0.1.0', 'package', 'StructureDefinition-ext-hearing-loss.json')));
    expect(snapshot).toEqual(compare);
  });

  //FixedSystemIdentifier
  it.skip('should create a correct snapshot for FixedSystemIdentifier', async () => {
    const snapshot = deleteInternalFields(await fsg.getSnapshot('FixedSystemIdentifier'));
    const compare = deleteInternalFields(fs.readJSONSync(path.join(cachePath, 'fsg.test.pkg#0.1.0', 'package', 'StructureDefinition-fixed-system-identifier.json')));
    expect(snapshot).toEqual(compare);
  });

  //FixedSystemPatientIdentifier
  it.skip('should create a correct snapshot for FixedSystemPatientIdentifier', async () => {
    const snapshot = deleteInternalFields(await fsg.getSnapshot('FixedSystemPatientIdentifier'));
    const compare = deleteInternalFields(fs.readJSONSync(path.join(cachePath, 'fsg.test.pkg#0.1.0', 'package', 'StructureDefinition-fixed-system-patient-identifier.json')));
    expect(snapshot).toEqual(compare);
  });

  //FixedSystemPatientIdentifierProfile
  it.skip('should create a correct snapshot for FixedSystemPatientIdentifierProfile', async () => {
    const snapshot = deleteInternalFields(await fsg.getSnapshot('FixedSystemPatientIdentifierProfile'));
    const compare = deleteInternalFields(fs.readJSONSync(path.join(cachePath, 'fsg.test.pkg#0.1.0', 'package', 'StructureDefinition-FixedSystemPatientIdentifierProfile.json')));
    expect(snapshot).toEqual(compare);
  });

  //OrganizationBasicProfile
  it.skip('should create a correct snapshot for OrganizationBasicProfile', async () => {
    const snapshot = deleteInternalFields(await fsg.getSnapshot('OrganizationBasicProfile'));
    const compare = deleteInternalFields(fs.readJSONSync(path.join(cachePath, 'fsg.test.pkg#0.1.0', 'package', 'StructureDefinition-OrganizationBasicProfile.json')));
    expect(snapshot).toEqual(compare);
  });

  //PractitionerQualificationSlices
  it.skip('should create a correct snapshot for PractitionerQualificationSlices', async () => {
    const snapshot = deleteInternalFields(await fsg.getSnapshot('PractitionerQualificationSlices'));
    const compare = deleteInternalFields(fs.readJSONSync(path.join(cachePath, 'fsg.test.pkg#0.1.0', 'package', 'StructureDefinition-PractitionerQualificationSlices.json')));
    expect(snapshot).toEqual(compare);
  });

},480000); // 8min timeout for all tests