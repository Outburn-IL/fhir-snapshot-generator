import { FhirTreeNode } from './types';

export default (node: FhirTreeNode): boolean => {
  return node.nodeType === 'array' || node.nodeType === 'poly' || node.nodeType === 'resliced';
};