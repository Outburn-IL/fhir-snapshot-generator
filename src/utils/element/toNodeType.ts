import { ElementDefinition } from '../../types';

/**
 * Gets the node type based on the element definition properties.
 * @param element - the element definition to check
 * @returns - the node type as a string
 */
export const toNodeType = (element: ElementDefinition): 'array' | 'poly' | 'element' | 'resliced' | 'slice' => {
  if (element.id.endsWith('[x]')) {
    return 'poly';
  }
  if (element.sliceName) {
    if (element.slicing) return 'resliced';
    return 'slice';
  }
  if (element.base?.max && (element.base.max === '*' || parseInt(element.base.max) > 1)) {
    return 'array';
  }
  return 'element';
};