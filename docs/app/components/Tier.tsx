import styles from './Tier.module.css'

export type TierValue = 'oss' | 'enterprise' | 'both'

interface TierProps {
  /**
   * Which edition the page or section applies to.
   *   enterprise — Enterprise Edition only
   *   both       — available in Open Source, with Enterprise extensions
   *   oss        — Open Source (no visible badge by convention)
   */
  badge?: TierValue
  /**
   * Render inline next to an H2 / H3 heading rather than as a block under the
   * page H1. Inline badges do not emit the page-level meta tag.
   */
  inline?: boolean
}

const LABELS: Record<Exclude<TierValue, 'oss'>, string> = {
  enterprise: 'Enterprise',
  both: 'Open Source and Enterprise',
}

/**
 * Edition tier indicator. Drop `<Tier badge="enterprise" />` directly under a
 * page H1, or `<Tier badge="enterprise" inline />` next to an H2 / H3 to flag a
 * single Enterprise sub-feature on an otherwise Open Source page.
 *
 * Registered globally in mdx-components.js, so MDX pages can use it without an
 * import. Pages should also carry a matching `tier:` frontmatter value so site
 * search can facet on it.
 */
export function Tier({ badge = 'oss', inline = false }: TierProps) {
  // Open Source is the default and carries no visible badge. We still emit the
  // page-level meta tag (Next hoists it to <head>) so search can facet later.
  if (badge === 'oss') {
    return inline ? null : <meta name="glassflow-tier" content="oss" />
  }

  const className = [styles.tier, styles[badge], inline ? styles.inline : styles.block].join(' ')

  return (
    <>
      {!inline && <meta name="glassflow-tier" content={badge} />}
      <span className={className} data-glassflow-tier={badge}>
        {LABELS[badge]}
      </span>
    </>
  )
}
