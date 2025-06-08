import fs from 'fs-extra';
import path from 'path';

const targetDir = path.resolve('test', '.test-cache', 'fsg.test.pkg#0.1.0');
const manualInputDir = path.resolve('test', 'FsgTestPkg', 'input', 'manual');
const distSrc = path.resolve('test', 'FsgTestPkg', 'dist', 'fsh-generated', 'resources');
const distDest = path.join(targetDir, 'package');

console.log((`Adding manual input files from ${manualInputDir}...`));
fs.copySync(manualInputDir, distSrc);

console.log(`Ensuring ${targetDir} exists...`);
fs.ensureDirSync(targetDir);

console.log(`Copying FSH package from ${distSrc} to ${distDest}...`);
fs.copySync(distSrc, distDest);

console.log(`Deleting .fpi.index.json from ${distDest}...`);
const fpeIndexPath = path.join(distDest, '.fpi.index.json');
if (fs.pathExistsSync(fpeIndexPath)) {
  fs.removeSync(fpeIndexPath);
  console.log('✅ Removed .fpi.index.json');
}

console.log('✅ Done.');
