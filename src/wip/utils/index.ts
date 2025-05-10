export { 
  applyDiffs,
  childExists,
  ensureChild,
  ensureBranch,
  toNodeType,
  injectElementBlock,
  mergeElement,
  elementExists,
  rewriteElementPaths
} from './element';

export {
  isNodeSliceable,
  rewriteNodePaths,
  toTree,
  expandNode,
  fromTree
} from './tree';

export {
  getSnapshotElements,
  resolveFhirVersion
} from './misc';