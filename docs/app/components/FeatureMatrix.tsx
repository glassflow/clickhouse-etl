import { Fragment } from 'react'
import styles from './FeatureMatrix.module.css'

export interface MatrixFeature {
  label: string
  /** Optional link to the feature page. External (http) links open in a new tab. */
  href?: string
  oss?: boolean
  enterprise?: boolean
}

export interface MatrixGroup {
  category: string
  features: MatrixFeature[]
}

interface FeatureMatrixProps {
  groups: MatrixGroup[]
}

function CheckIcon() {
  return (
    <svg
      className={styles.check}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Included"
    >
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
    </svg>
  )
}

function NotIncluded() {
  return (
    <span className={styles.dash} role="img" aria-label="Not included">
      –
    </span>
  )
}

function FeatureLabel({ feature }: { feature: MatrixFeature }) {
  if (!feature.href) return <>{feature.label}</>
  const external = feature.href.startsWith('http')
  return (
    <a
      href={feature.href}
      className={styles.link}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
    >
      {feature.label}
    </a>
  )
}

/**
 * Open Source vs Enterprise availability matrix. One table, grouped by
 * category, with a check or dash per edition. The Enterprise column carries a
 * faint brand-orange tint so the upgrade path reads at a glance. Feature names
 * link to the page whose Tier badge confirms the same fact.
 */
export function FeatureMatrix({ groups }: FeatureMatrixProps) {
  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.headerCell} scope="col">
              Capability
            </th>
            <th className={`${styles.headerCell} ${styles.editionCol}`} scope="col">
              Open Source
            </th>
            <th className={`${styles.headerCell} ${styles.editionCol} ${styles.eeCol}`} scope="col">
              Enterprise
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map(group => (
            <Fragment key={group.category}>
              <tr>
                <th className={styles.groupCell} colSpan={3} scope="colgroup">
                  {group.category}
                </th>
              </tr>
              {group.features.map((feature, i) => (
                <tr key={i} className={styles.row}>
                  <th className={styles.featureCell} scope="row">
                    <FeatureLabel feature={feature} />
                  </th>
                  <td className={`${styles.markCell} ${styles.editionCol}`}>
                    {feature.oss ? <CheckIcon /> : <NotIncluded />}
                  </td>
                  <td className={`${styles.markCell} ${styles.editionCol} ${styles.eeCol}`}>
                    {feature.enterprise ? <CheckIcon /> : <NotIncluded />}
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
