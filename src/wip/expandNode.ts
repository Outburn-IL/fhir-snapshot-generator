import { FhirTreeNode } from './types';
import { ElementDefinition } from './types';
import { getSnapshotElements } from './getSnapshotElements';
import { FhirPackageExplorer } from 'fhir-package-explorer';
import { isNodeSliceable } from './isNodeSliceable';
import { rewriteElementPaths } from './rewriteElementPaths';
import { buildTreeFromSnapshot } from './sdTransformer';

export const expandNode = async (
  node: FhirTreeNode,
  fpe: FhirPackageExplorer
): Promise<void> => {
  const logger = fpe.getLogger();
  // if node is sliceable - throw.
  if (isNodeSliceable(node)) {
    throw new Error(`Node '${node.id}' is sliceable. Expand node must be called on a specific slice, headslice or a non-sliceable node.`);
  }

  // if node has children - it is already expanded
  if (node.children.length > 0) return;

  // if node has no definition - throw.
  if (!node.definition) {
    throw new Error(`Node '${node.id}' has no ElementDefinition to expand.`);
  }

  // if node has no type - throw.
  if (!node.definition.type || node.definition.type.length === 0) {
    throw new Error(`Node '${node.id}' has no type to expand.`);
  }

  // if there are multiple types (polymorphic) - throw. 
  // (We shouldn't have arrived here since polymorphic elements are sliceable...)
  if (node.definition.type.length > 1) {
    throw new Error(`Node '${node.id}' has multiple types. Node expansion must be called on a specific type.`);
  }
  logger.info(`Expanding node: ${node.id}`);
  // get the type
  const elementType = node.definition.type[0];
  // if type has `profile` - use it to get the snapshot.
  // Currently only the first profile is used. It is not clear how to handle multiple profiles.
  // In the spec it says "one must apply" - but expansion can only be done using one profile...
  // TODO: Test how SUSHI handles this case.
  const typeIdentifier = elementType.profile?.[0] ?? elementType.code;
  const snapshotElements: ElementDefinition[] = await getSnapshotElements(fpe, typeIdentifier);
  if (!snapshotElements || snapshotElements.length === 0) {
    throw new Error(`Snapshot for type '${typeIdentifier}' is empty or missing.`);
  }
  // rewrite the paths of the snapshot elements to match the current node
  const oldPrefix = snapshotElements[0].id;
  const newPrefix = node.id;
  const rewrittenElements = rewriteElementPaths(snapshotElements, newPrefix, oldPrefix);
  // construct the new node from the element array
  const expandedSubtree = buildTreeFromSnapshot(rewrittenElements);
  node.children = expandedSubtree.children;
  logger.info(`Node '${node.id}' expanded with ${expandedSubtree.children.length} children.`);
};