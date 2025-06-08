/**
 * © Copyright Outburn Ltd. 2022-2025 All Rights Reserved
 *   Project name: fhir-snapshot-generator
 */

import { version as fsgVersion } from '../../../package.json';

export const versionedCacheDir = `v${fsgVersion.split('.').slice(0, 2).join('.')}.x`;