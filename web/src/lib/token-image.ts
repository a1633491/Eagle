export function getTokenImageUrl(metadataURI?: string) {
  if (!metadataURI) return '';
  const trimmed = metadataURI.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('data:application/json,')) {
    const payload = trimmed.slice('data:application/json,'.length);
    try {
      const parsed = JSON.parse(decodeURIComponent(payload)) as { image?: unknown };
      return typeof parsed.image === 'string' ? parsed.image : '';
    } catch {
      return '';
    }
  }

  return '';
}
