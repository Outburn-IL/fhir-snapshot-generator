/**
 * Flatten CodeSystem concepts (collect all nested {code, display}).
 * Returns a Map<code, display?>.
 */
export function flattenCodeSystemConcepts(cs: any): Map<string, string | undefined> {
  const map = new Map<string, string | undefined>();
  const walk = (concepts: any[]) => {
    if (!Array.isArray(concepts)) return;
    for (const c of concepts) {
      if (c && typeof c === 'object' && typeof c.code === 'string') {
        if (!map.has(c.code)) map.set(c.code, c.display);
      }
      if (Array.isArray(c?.concept)) walk(c.concept);
    }
  };
  if (Array.isArray(cs?.concept)) walk(cs.concept);
  return map;
}
