import type { HandleClientError } from '@sveltejs/kit';
import { isRequestError } from '$lib/api/errors';
import { trackError } from '$lib/utils/telemetry';

export const handleError: HandleClientError = ({ error, event, status, message }) => {
  const route = `${event.url.pathname}${event.url.search}`;

  if (isRequestError(error)) {
    trackError('route_error', {
      message: error.appError.message,
      statusCode: error.appError.status ?? status,
      details: error.appError.details,
      correlationId: error.appError.correlationId,
      route,
    });

    return {
      message: error.appError.message,
      correlationId: error.appError.correlationId,
    };
  }

  trackError('route_error', {
    message: error instanceof Error ? error.message : message,
    statusCode: status,
    route,
  });

  return {
    message,
  };
};
