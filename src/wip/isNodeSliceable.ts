import { FhirTreeNode } from './types';

export const isNodeSliceable = (node: FhirTreeNode): boolean => {
  return node.nodeType === 'array' || node.nodeType === 'poly' || node.nodeType === 'resliced';
};