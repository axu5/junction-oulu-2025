export async function tryCatch<T>(
  fn: () => Promise<T>
): Promise<{ data: T; err: null } | { data: null; err: unknown }> {
  try {
    const data = await fn();
    return { data, err: null };
  } catch (err) {
    return { data: null, err };
  }
}

export function tryCatchSync<T>(
  fn: () => T
): { data: T; err: null } | { data: null; err: unknown } {
  try {
    return { data: fn(), err: null };
  } catch (err) {
    return { data: null, err };
  }
}
