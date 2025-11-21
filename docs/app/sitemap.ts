import { MetadataRoute } from 'next'
import { promises as fs } from 'fs'
import path from 'path'

// Base URL for the documentation site
// You can set NEXT_PUBLIC_SITE_URL environment variable for production builds
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

interface SitemapEntry {
  url: string
  lastModified?: string | Date
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority?: number
}

async function getAllPages(): Promise<SitemapEntry[]> {
  const appDir = path.join(process.cwd(), 'app')
  const pages: SitemapEntry[] = []

  async function scanDirectory(dir: string, urlPath: string = ''): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        
        if (entry.isDirectory()) {
          // Skip special Next.js directories
          if (entry.name.startsWith('_') || entry.name.startsWith('.') || 
              entry.name === 'api' || entry.name === 'globals.css') {
            continue
          }
          
          // Recursively scan subdirectories
          const newUrlPath = urlPath ? `${urlPath}/${entry.name}` : entry.name
          await scanDirectory(fullPath, newUrlPath)
        } else if (entry.name === 'page.mdx' || entry.name === 'page.tsx' || entry.name === 'page.js') {
          // Found a page file
          const url = urlPath ? `${baseUrl}/${urlPath}` : baseUrl
          
          try {
            const stats = await fs.stat(fullPath)
            pages.push({
              url,
              lastModified: stats.mtime,
              changeFrequency: 'weekly',
              priority: urlPath === '' ? 1.0 : 0.8
            })
          } catch (error) {
            // If we can't get file stats, still include the page
            pages.push({
              url,
              changeFrequency: 'weekly',
              priority: urlPath === '' ? 1.0 : 0.8
            })
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dir}:`, error)
    }
  }

  await scanDirectory(appDir)
  return pages
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const pages = await getAllPages()
    
    // Sort pages by URL for consistent ordering
    pages.sort((a, b) => a.url.localeCompare(b.url))
    
    return pages
  } catch (error) {
    console.error('Error generating sitemap:', error)
    
    // Fallback to basic sitemap if directory scanning fails
    return [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 1.0,
      },
      {
        url: `${baseUrl}/getting-started`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.9,
      },
      {
        url: `${baseUrl}/installation`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.9,
      },
      {
        url: `${baseUrl}/usage-guide`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      },
      {
        url: `${baseUrl}/configuration`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      },
      {
        url: `${baseUrl}/architecture`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.7,
      },
    ]
  }
}
