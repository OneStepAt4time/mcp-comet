/** Check if a hostname is perplexity.ai or a subdomain of perplexity.ai. */
export function isPerplexityDomain(hostname: string): boolean {
  return hostname === 'perplexity.ai' || hostname.endsWith('.perplexity.ai')
}
