/**
 * © Copyright Outburn Ltd. 2022-2025 All Rights Reserved
 *   Project name: fhir-snapshot-generator
 */

import { Prethrower } from '../../../types';
import { Logger } from '@outburn/types';

/**
 * default logger uses global console methods
 */
export const defaultLogger: Logger = {
  info: (msg: any) => console.log(msg),
  warn: (msg: any) => console.warn(msg),
  error: (msg: any) => console.error(msg)
};

/**
 * Default prethrow function does nothing since the regular throw prints to console.error, which is the default error logger.
 * If the same prethrow function was used with both custom and default loggers, in default mode duplicate errors would have been printed
 */
export const defaultPrethrow: Prethrower = (msg: Error | any): Error => {
  if (msg instanceof Error) {
    return msg;
  }
  const error = new Error(msg);
  return error;
};

export const customPrethrower = (logger: Logger): Prethrower => {
  return (msg: Error | any): Error => {
    if (msg instanceof Error) {
      logger.error(msg);
      return msg;
    }
    const error = new Error(msg);
    logger.error(error);
    return error;
  };
};
