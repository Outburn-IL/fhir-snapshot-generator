import fs from 'fs-extra';
import path from 'path';

const targetFile = path.resolve('test', 'FsgTestPkg', 'dist', 'fsh-generated', 'resources', 'package.json');

console.log(`Creating ${targetFile}...`);
fs.ensureDirSync(path.dirname(targetFile));

fs.writeJSONSync(targetFile, {
  name: 'fsg.test.pkg',
  version: '0.1.0',
  fhirVersions: ['4.0.1'],
  dependencies: {
    'hl7.fhir.r4.core' : '4.0.1'
  }
});

console.log('✅ Done.');
