import { describe, it, expect, beforeAll } from 'vitest';
import { FhirPackageExplorer } from 'fhir-package-explorer';
import { expandNode } from '../src/wip/expandNode';
import { FhirTreeNode } from '../src/wip/types';
import fs from 'fs-extra';
import path from 'path';

const baseSnapshotTree: FhirTreeNode = fs.readJSONSync('./test/ExtensionBaseTree.test.json');
const cachePath = './test/.test-cache';
const context = ['fsg.test.pkg#0.1.0'];
let fpe: FhirPackageExplorer;

describe.skip('Expand the Extension.extension node', async () => {
  beforeAll(() => {
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
  }, 240000); // 4min timeout for setup

  beforeAll(async () => {
    fpe = await FhirPackageExplorer.create({
      cachePath,
      context,
      skipExamples: true
    });
  }, 240000); // 4min timeout for setup

  it('should expand the Extension.extension node', async () => {
    // first find the Extension.extension node in the base snapshot tree
    const extensionNode = baseSnapshotTree.children[1].children[0];
    await expandNode(extensionNode, fpe);
    expect(extensionNode.children.length).toBeGreaterThan(2);
    expect(extensionNode.children[1].id).toEqual('Extension.extension.extension');
  });

  it('should expand the Extension.extension.extension node', async () => {
    // first find the Extension.extension.extension node in the base snapshot tree
    const extensionNode = baseSnapshotTree.children[1].children[0].children[1].children[0];
    await expandNode(extensionNode, fpe);
    expect(extensionNode.children.length).toBeGreaterThan(2);
    expect(extensionNode.children[2].id).toEqual('Extension.extension.extension.url');
  });
},480000);
