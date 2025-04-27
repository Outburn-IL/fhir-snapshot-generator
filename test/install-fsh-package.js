import fs from 'fs-extra';
import path from 'path';

const targetDir = path.resolve('test', '.test-cache', 'fsg.test.pkg#0.1.0');
const distSrc = path.resolve('test', 'FsgTestPkg', 'dist', 'fsh-generated', 'resources');
const distDest = path.join(targetDir, 'package');

console.log(`Creating ${targetDir}...`);
await fs.ensureDir(targetDir);

console.log(`Copying FSH package from ${distSrc} to ${distDest}...`);
await fs.copy(distSrc, distDest);

console.log('✅ Done.');
