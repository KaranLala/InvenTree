/**
 * Extract a human-readable message from a DRF error response.
 */
export function extractErrorMessage(error: any): string {
  const data = error?.response?.data;

  if (!data) {
    return error?.message ?? 'Request failed';
  }

  if (typeof data === 'string') {
    return data;
  }

  if (data.detail) {
    return String(data.detail);
  }

  if (data.non_field_errors) {
    return Array.isArray(data.non_field_errors)
      ? String(data.non_field_errors[0])
      : String(data.non_field_errors);
  }

  const firstKey = Object.keys(data)[0];

  if (firstKey) {
    const value = data[firstKey];
    const message = Array.isArray(value) ? value[0] : value;
    return `${firstKey}: ${String(message)}`;
  }

  return 'Request failed';
}
