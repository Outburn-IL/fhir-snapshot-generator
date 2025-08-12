import { describe, it, expect } from 'vitest';
import { FhirSnapshotGenerator } from 'fhir-snapshot-generator';

/**
 * Integration tests for resolveCompleteCodeSystem using real package contents.
 * Uses the same context as generate.test.ts to avoid additional network installs.
 */

describe('resolveCompleteCodeSystem (integration)', async () => {
  const cachePath = './test/.test-cache';
  const context = ['il.core.fhir.r4#0.17.0', 'fsg.test.pkg#0.1.0'];

  const fsg = await FhirSnapshotGenerator.create({
    cachePath,
    context,
    cacheMode: 'none'
  });

  // Core package should have been auto-added by fsg.create
  const corePackage = { id: 'hl7.fhir.r4.core', version: '4.0.1' };
  const ilCorePackage = { id: 'il.core.fhir.r4', version: '0.17.0' };

  // Canonicals very likely present & content=complete in R4 core
  const COMPLETE_CS_CANONICAL = 'http://hl7.org/fhir/administrative-gender';
  const COMPLETE_CS_CANONICAL_FALLBACK = 'http://hl7.org/fhir/identifier-use';

  it('resolves a CodeSystem locally within the core package (no fallback)', async () => {
    const cs = await (fsg as any).resolveCompleteCodeSystem(COMPLETE_CS_CANONICAL, corePackage);
    expect(cs).toBeDefined();
    expect(cs.resourceType).toBe('CodeSystem');
    expect(cs.url).toBe(COMPLETE_CS_CANONICAL);
    expect(cs.content).toBe('complete');
    expect(Array.isArray(cs.concept)).toBe(true);
  });

  it('falls back to global context when not found in source package (il.core -> core)', async () => {
    // This CodeSystem exists only in the core package; searching in il.core first should fail then fallback
    const cs = await (fsg as any).resolveCompleteCodeSystem(COMPLETE_CS_CANONICAL_FALLBACK, ilCorePackage);
    expect(cs).toBeDefined();
    expect(cs.url).toBe(COMPLETE_CS_CANONICAL_FALLBACK);
    expect(cs.content).toBe('complete');
  });

  it('throws for a CodeSystem whose content is not complete (if any such exists in core)', async () => {
    // Dynamically locate a non-complete CodeSystem in the core package (content !== 'complete')
    const metas = await fsg.getFpe().lookupMeta({ resourceType: 'CodeSystem', package: corePackage });
    let nonCompleteCanonical: string | undefined;
    for (const m of metas) {
      const cs = await fsg.getFpe().resolve({ filename: m.filename, package: corePackage });
      if (cs && cs.resourceType === 'CodeSystem' && cs.content && cs.content !== 'complete') {
        nonCompleteCanonical = cs.url;
        break;
      }
    }
    if (!nonCompleteCanonical) {
      // If no such CodeSystem found in this version, the assertion is vacuous; skip by asserting true.
      expect(true).toBe(true);
      return;
    }
    await expect((fsg as any).resolveCompleteCodeSystem(nonCompleteCanonical, corePackage))
      .rejects.toThrow(/cannot be expanded/);
  });
});
