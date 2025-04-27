import { FhirSnapshotGenerator } from '../src';
import fs from 'fs-extra';
import path from 'path';

const runTest = async () => {
  console.log('Running test...');
  try {
    fs.removeSync('test/.test-cache/fsg.test.pkg#0.1.0/.fsg.snapshots/v1/StructureDefinition-SimpleCardinalityPatient.json');
    const fpe = await FhirSnapshotGenerator.create({
      cachePath: './test/.test-cache',
      context: ['fsg.test.pkg#0.1.0']
    });
    console.log('FhirPackageExplorer created!');
    const snapshot = await fpe.getSnapshot('SimpleCardinalityPatient');
    const outputPath = path.join(fpe.getCachePath(), 'SimpleCardinalityPatient.json');
    fs.writeJSONSync(outputPath, snapshot, { spaces: 2 });
    console.log('Done!');
    console.log('Output written to:', outputPath);
  } catch (error) {
    console.error('Error during snapshot generation:', error);
  }
  
};

runTest();