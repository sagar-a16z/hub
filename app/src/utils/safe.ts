import { HubError } from '@hub/errors';
import { Result } from 'neverthrow';

export const safeJsonStringify = Result.fromThrowable(
  JSON.stringify,
  () => new HubError('bad_request.parse_failure', 'json stringify failure')
);

export const safeJsonParse = Result.fromThrowable(
  JSON.parse,
  () => new HubError('bad_request.parse_failure', 'json parse failure')
);
