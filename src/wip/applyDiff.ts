import { ElementDefinition, FhirTreeNode } from './types';
import { findMatchingNode } from './findMatchingNode';
import { FhirPackageExplorer } from 'fhir-package-explorer';
import { isNodeSliceable } from './isNodeSliceable';

export const applyDiffToTree = async (
  tree: FhirTreeNode,
  diffElements: ElementDefinition[],
  fpe: FhirPackageExplorer
): Promise<FhirTreeNode> => {
  const logger = fpe.getLogger();
  logger.info(`Applying diff to tree: ${tree.id}`);
  const clonedTree = structuredClone(tree);
  const diffById = new Map(diffElements.map(e => [e.id, e]));
  const appliedIds = new Set<string>();

  if (clonedTree.definition && clonedTree.definition.extension) {
    delete clonedTree.definition.extension;
  }

  // Main loop: iterate over diff elements and apply them to the tree
  for (const [diffId, diffElement] of diffById.entries()) {
    logger.info(`Applying diff element: ${diffId}`);
    // first ensure that diffId's root is the same as the tree's root
    // if not - throw an error. If it is, shift the diffId one level up.
    let targetNode: FhirTreeNode | undefined;
    const diffIdSegments = diffId.split('.');
    if (clonedTree.id !== diffIdSegments[0]) {
      throw new Error(`Diff id '${diffId}' does not match the tree root '${clonedTree.id}'.`);
    }
    if (diffIdSegments.length === 1) {
      // this is a diff on the root of the tree. apply it directly to the root.
      targetNode = clonedTree;
    } else {
    // remove the root id from the diffId
      diffIdSegments.shift();
      const diffIdShifted = diffIdSegments.join('.');
      logger.info(`diffId shifted: ${diffIdShifted}`);
      // find the matching node in the tree
      targetNode = await findMatchingNode(diffIdShifted, clonedTree, fpe);
    }
    logger.info(`Found target node: ${targetNode?.id}`);
    // if target is sliceable, we need to apply the diff to the headslice
    if (isNodeSliceable(targetNode)) {
      logger.info(`Target node is sliceable: ${targetNode.id}, applying diff to all slices`);
      // get the headslice node
      targetNode = targetNode.children[0]; // headslice is always the first child
    }
    appliedIds.add(diffId);

    for (const key of Object.keys(diffElement) as string[]) {
      if (key === 'constraint') {
        logger.info(`Applying \`constraint\` to node: ${targetNode.id}`);
        const baseConstraints = targetNode.definition!.constraint || [];
        const diffConstraints = diffElement.constraint || [];
        targetNode.definition!.constraint = [...baseConstraints, ...diffConstraints];
      } else if (key === 'condition') {
        logger.info(`Applying \`condition\` to node: ${targetNode.id}`);
        const baseConditions = targetNode.definition!.condition || [];
        const diffConditions = diffElement.condition || [];
        const mergedConditions = [...baseConditions, ...diffConditions];
        targetNode.definition!.condition = Array.from(new Set(mergedConditions));
      } else if (key !== 'id' && key !== 'path') {
        if (diffElement[key] !== undefined) {
          logger.info(`Applying \`${key}\` to node: ${targetNode.id}`);
          targetNode.definition![key] = diffElement[key];
        }
      }
    }
  }

  return clonedTree;
};

