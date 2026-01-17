/**
 * Generates a URL-friendly slug from a string
 * TODO: Store slug in publisher profile, allow customization
 */
export const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars
    .replace(/[\s_-]+/g, '-') // Replace spaces/underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

/**
 * Generates a publisher profile URL
 */
export const getPublisherProfileUrl = (publisherName: string, baseUrl = 'neesh.art'): string => {
  const slug = slugify(publisherName);
  return `${baseUrl}/p/${slug}`;
};
