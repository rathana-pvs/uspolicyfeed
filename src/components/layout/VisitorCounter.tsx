'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Resolves the cleanest, most descriptive human-readable title for the current route.
 * Returns { title, isFinal } where isFinal indicates whether this is the final, definitive title
 * or a placeholder that should be upgraded once the DOM/RSC finishes streaming.
 */
function resolveRouteTitle(pathname: string): { title: string; isFinal: boolean } {
  // 1. Home page
  if (pathname === '/' || pathname === '') {
    return { title: 'Home', isFinal: true }
  }

  // 2. Article page: prioritize article <h1> or .article-title, then document.title
  if (pathname.startsWith('/article/')) {
    const articleH1 = document.querySelector('.article-title, article h1, h1')
    const h1Text = articleH1?.textContent?.trim()

    // Check if valid headline found (ignore loading screen / generic site name)
    if (
      h1Text &&
      h1Text !== 'US Policy Feed' &&
      !h1Text.toLowerCase().includes('retrieving latest') &&
      !h1Text.toLowerCase().includes('loading')
    ) {
      return { title: h1Text, isFinal: true }
    }

    // Check document.title if it has been updated with the article title
    const docTitle = document.title?.trim()
    if (
      docTitle &&
      docTitle !== 'US Policy Feed' &&
      !docTitle.startsWith('US Policy Feed —')
    ) {
      const clean = docTitle
        .replace(/\s*(—|-)\s*US Policy (Feed|Brief).*$/i, '')
        .trim()
      if (clean && clean !== 'US Policy Feed') {
        return { title: clean, isFinal: true }
      }
    }

    // Not yet loaded (Next.js server component is streaming)
    return { title: '', isFinal: false }
  }

  // 3. Category pages
  if (pathname.startsWith('/category/')) {
    const categoryH1 = document.querySelector('.category-title, h1')
    const catText = categoryH1?.textContent?.trim()
    if (catText && catText !== 'US Policy Feed') {
      return { title: `${catText} News`, isFinal: true }
    }

    const slug = pathname.replace('/category/', '').split('/')[0] || ''
    if (slug) {
      const formatted = slug.charAt(0).toUpperCase() + slug.slice(1)
      return { title: `${formatted} News`, isFinal: false }
    }
  }

  // 4. Other known static pages
  if (pathname === '/about') {
    return { title: 'About Us', isFinal: true }
  }
  if (pathname === '/contact') {
    return { title: 'Contact Us', isFinal: true }
  }
  if (pathname === '/policy') {
    return { title: 'Editorial Policy', isFinal: true }
  }
  if (pathname === '/privacy') {
    return { title: 'Privacy Policy', isFinal: true }
  }
  if (pathname === '/live') {
    return { title: 'Live Coverage', isFinal: true }
  }
  if (pathname === '/search') {
    return { title: 'Search', isFinal: true }
  }

  // 5. Generic fallback
  const h1 = document.querySelector('h1')?.textContent?.trim()
  if (h1 && h1 !== 'US Policy Feed') {
    return { title: h1, isFinal: true }
  }

  if (document.title && document.title !== 'US Policy Feed') {
    const clean = document.title
      .replace(/\s*(—|-)\s*US Policy (Feed|Brief).*$/i, '')
      .trim()
    if (clean) return { title: clean, isFinal: true }
  }

  return { title: '', isFinal: false }
}

function sendPing(wauKey: string, title: string, url: string) {
  if (typeof window === 'undefined' || !title) return

  // Format title according to whos.amung.us limits (80 chars max, strip problematic characters)
  const cleanTitle = title.replace(/\s*(—|-)\s*US Policy (Feed|Brief).*$/i, '').trim()
  const pageTitle = encodeURIComponent(cleanTitle.substring(0, 80).replace(/(\?=)|(\/)/g, ''))
  const pageUrl = encodeURIComponent(url)
  const referrer = encodeURIComponent(document.referrer || '')
  const randomId = Math.ceil(99999 * Math.random())

  const pingScript = document.createElement('script')
  const scriptId = `_wau_ping_${Date.now()}`
  pingScript.id = scriptId
  pingScript.async = true
  pingScript.src = `https://whos.amung.us/pingjs/?k=${wauKey}&t=${pageTitle}&c=d&x=${pageUrl}&y=${referrer}&a=-1&v=27&r=${randomId}`

  document.head.appendChild(pingScript)

  // Remove script tag after execution to prevent memory/DOM leaks
  setTimeout(() => {
    const el = document.getElementById(scriptId)
    if (el && el.parentNode) {
      el.parentNode.removeChild(el)
    }
  }, 5000)
}

export function VisitorCounter() {
  const pathname = usePathname()
  const lastPingRef = useRef<{ url: string; title: string }>({ url: '', title: '' })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const wauKey = process.env.NEXT_PUBLIC_WAU_KEY || 'cv8yp1ovlc'

    // 1. Setup global queue & config script required by whos.amung.us
    window._wau = window._wau || []
    window._wau.push(['dynamic', wauKey, 'xyn', 'c4302bffffff', 'small'])

    if (!document.getElementById('_wauxyn')) {
      const configScript = document.createElement('script')
      configScript.id = '_wauxyn'
      configScript.innerHTML = `var _wau = _wau || []; _wau.push(["dynamic", "${wauKey}", "xyn", "c4302bffffff", "small"]);`
      document.body.appendChild(configScript)
    }

    // 2. Clear stale cache
    try {
      localStorage.removeItem('_wautime')
      localStorage.removeItem('_waucount')
    } catch (e) {}

    let isSubscribed = true
    let pollInterval: NodeJS.Timeout | null = null
    let observer: MutationObserver | null = null

    const checkAndPing = (): boolean => {
      if (!isSubscribed) return true
      const currentUrl = window.location.href
      const { title, isFinal } = resolveRouteTitle(pathname)

      if (title && (lastPingRef.current.url !== currentUrl || lastPingRef.current.title !== title)) {
        lastPingRef.current = { url: currentUrl, title }
        sendPing(wauKey, title, currentUrl)
      }

      return isFinal
    }

    // 3. Initial check
    const isDone = checkAndPing()

    // 4. If title is not final yet (e.g., RSC streaming in progress), observe DOM and poll
    if (!isDone) {
      let attempts = 0
      pollInterval = setInterval(() => {
        attempts++
        const done = checkAndPing()
        if (done || attempts >= 25) {
          if (pollInterval) clearInterval(pollInterval)
        }
      }, 200)

      observer = new MutationObserver(() => {
        const done = checkAndPing()
        if (done) {
          if (observer) observer.disconnect()
          if (pollInterval) clearInterval(pollInterval)
        }
      })

      observer.observe(document.head, { subtree: true, childList: true, characterData: true })
      if (document.body) {
        observer.observe(document.body, { subtree: true, childList: true })
      }
    }

    // 5. Heartbeat ping every 60 seconds to maintain accurate active reader status
    const heartbeatInterval = setInterval(() => {
      if (!isSubscribed) return
      const currentUrl = window.location.href
      const { title } = resolveRouteTitle(pathname)
      if (title) {
        sendPing(wauKey, title, currentUrl)
      }
    }, 60000)

    return () => {
      isSubscribed = false
      if (pollInterval) clearInterval(pollInterval)
      if (heartbeatInterval) clearInterval(heartbeatInterval)
      if (observer) observer.disconnect()
    }
  }, [pathname])

  return (
    <div
      id="wau-container-hidden"
      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
        opacity: 0,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    />
  )
}
