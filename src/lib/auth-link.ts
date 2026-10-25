// Supabase reports a used or expired link as error params on the redirect,
// in the hash (implicit flow) or the query string.
export const getLinkError = (search: string, hash: string): string | null => {
  const params = new URLSearchParams(search);
  const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
  const code = params.get('error_code') ?? hashParams.get('error_code');
  const error = params.get('error') ?? hashParams.get('error');
  if (!code && !error) return null;
  return code ?? error;
};
