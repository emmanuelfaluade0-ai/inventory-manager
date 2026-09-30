const BASE = '/api';

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || 'Something went wrong');
    this.status = status;
    this.field = body?.error?.field;
    this.code = body?.error?.code;
    this.available = body?.error?.available;
  }
}

export async function apiFetch(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch {
    throw new ApiError(0, { error: { message: 'Could not reach the server' } });
  }

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    throw new ApiError(res.status, body);
  }

  return body;
}
