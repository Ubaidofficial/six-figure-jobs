import { BLOG_POSTS } from '../../lib/blog/posts'
import { SITE_NAME } from '../../lib/seo/site'

describe('blog title tags', () => {
  // The page title is `${metaTitle ?? title} | ${SITE_NAME}`; past ~65 characters search results cut it off.
  it.each(BLOG_POSTS.map((p) => [p.slug, `${p.metaTitle ?? p.title} | ${SITE_NAME}`]))('%s fits in a search result', (_slug, title) => {
    expect(title.length).toBeLessThanOrEqual(65)
  })

  it('gives every post its own title', () => {
    const titles = BLOG_POSTS.map((p) => p.metaTitle ?? p.title)
    expect(new Set(titles).size).toBe(titles.length)
  })
})
