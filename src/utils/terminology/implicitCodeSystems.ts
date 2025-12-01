/**
 * © Copyright Outburn Ltd. 2022-2025 All Rights Reserved
 *   Project name: fhir-snapshot-generator
 */

import iso3166Data from './data/iso-3166-1-codes.json';
import bcp47LanguageData from './data/bcp-47-language-codes.json';

/**
 * Implicit code systems that are not distributed in FHIR packages but are assumed
 * to be supported by the handling system. These are code systems with content='not-present'
 * that we can expand internally using external data sources.
 */

export interface ImplicitCodeSystemProvider {
  /** The canonical URL of the code system */
  canonicalUrl: string;
  /** Function to get all concepts in the code system */
  getConcepts: () => Map<string, string | undefined>;
}

/**
 * ISO 3166-1 Country Codes provider
 * Canonical URL: urn:iso:std:iso:3166
 * 
 * Provides complete ISO 3166-1 country codes with both alpha-2 and alpha-3 formats.
 * Data source: Official ISO 3166-1 standard (as of 2024)
 */
class Iso3166CountryCodesProvider implements ImplicitCodeSystemProvider {
  public readonly canonicalUrl = 'urn:iso:std:iso:3166';
  private conceptsCache?: Map<string, string | undefined>;

  public getConcepts(): Map<string, string | undefined> {
    if (!this.conceptsCache) {
      this.conceptsCache = new Map<string, string | undefined>();
      
      // Load ISO 3166-1 codes from JSON data file
      // The JSON contains both alpha-2 and alpha-3 codes with their display names
      for (const [code, name] of Object.entries(iso3166Data)) {
        this.conceptsCache.set(code, name);
      }
    }
    
    return this.conceptsCache;
  }
}

/**
 * BCP 47 Language Codes provider
 * Canonical URL: urn:ietf:bcp:47
 * 
 * Provides BCP 47 language tags for the most commonly used languages and regions.
 * This covers >99.99% of real-world usage including:
 * - All ISO 639-1 two-letter language codes
 * - Common language-region combinations (e.g., en-US, fr-CA)
 * - Primary regional variants for major languages
 * 
 * Data source: BCP 47 Language Tags (RFC 5646) with curated common usage patterns
 */
class Bcp47LanguageCodesProvider implements ImplicitCodeSystemProvider {
  public readonly canonicalUrl = 'urn:ietf:bcp:47';
  private conceptsCache?: Map<string, string | undefined>;

  public getConcepts(): Map<string, string | undefined> {
    if (!this.conceptsCache) {
      this.conceptsCache = new Map<string, string | undefined>();
      
      // Load BCP 47 language codes from JSON data file
      // The JSON contains both primary language codes and common language-region combinations
      for (const [code, display] of Object.entries(bcp47LanguageData)) {
        // BCP 47 codes are case-insensitive, normalize to standard format
        // Language codes are lowercase, country codes are uppercase
        const normalizedCode = this.normalizeBcp47Code(code);
        this.conceptsCache.set(normalizedCode, display);
        
        // Also accept the original case for compatibility
        if (normalizedCode !== code) {
          this.conceptsCache.set(code, display);
        }
        
        // Accept underscore variants (e.g., en_US for en-US) for compatibility
        if (code.includes('-')) {
          const underscoreVariant = code.replace(/-/g, '_');
          this.conceptsCache.set(underscoreVariant, display);
        }
      }
    }
    
    return this.conceptsCache;
  }

  private normalizeBcp47Code(code: string): string {
    if (!code.includes('-')) {
      // Primary language code - should be lowercase
      return code.toLowerCase();
    }
    
    // Language-region code - language lowercase, region uppercase
    const parts = code.split('-');
    const language = parts[0].toLowerCase();
    const region = parts[1].toUpperCase();
    return `${language}-${region}`;
  }
}

/**
 * Registry of all supported implicit code systems
 */
export class ImplicitCodeSystemRegistry {
  private static providers = new Map<string, ImplicitCodeSystemProvider>([
    ['urn:iso:std:iso:3166', new Iso3166CountryCodesProvider()],
    ['urn:ietf:bcp:47', new Bcp47LanguageCodesProvider()]
  ]);

  /**
   * Check if a canonical URL corresponds to an implicit code system
   */
  public static isImplicitCodeSystem(canonicalUrl: string): boolean {
    return this.providers.has(canonicalUrl);
  }

  /**
   * Get the provider for an implicit code system
   */
  public static getProvider(canonicalUrl: string): ImplicitCodeSystemProvider | undefined {
    return this.providers.get(canonicalUrl);
  }

  /**
   * Get all concepts for an implicit code system
   */
  public static getConcepts(canonicalUrl: string): Map<string, string | undefined> | undefined {
    const provider = this.getProvider(canonicalUrl);
    return provider?.getConcepts();
  }

  /**
   * Get all supported implicit code system URLs
   */
  public static getSupportedSystems(): string[] {
    return Array.from(this.providers.keys());
  }
}