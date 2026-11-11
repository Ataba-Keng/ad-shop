import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getSeoForPage } from '../lib/seo.js';

function setMeta(selector, attribute, value) {
  let element = document.head.querySelector(selector);
  if (!value) {
    element?.remove();
    return;
  }
  if (!element) {
    element = document.createElement('meta');
    const [key, name] = attribute;
    element.setAttribute(key, name);
    document.head.append(element);
  }
  element.setAttribute('content', value);
}

function setCanonical(value) {
  let element = document.head.querySelector('link[rel="canonical"]');
  if (!value) {
    element?.remove();
    return;
  }
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.append(element);
  }
  element.setAttribute('href', value);
}

export function SeoHead({ data = {} }) {
  const location = useLocation();
  const siteUrl = import.meta.env.VITE_PUBLIC_SITE_URL
    || (typeof window !== 'undefined' ? window.__SPORTPRESS_PUBLIC_SITE_URL__ || '' : '');
  const seo = getSeoForPage(`${location.pathname}${location.search}`, data, siteUrl);

  useEffect(() => {
    document.title = seo.title;
    setMeta('meta[name="description"]', ['name', 'description'], seo.description);
    setMeta('meta[name="robots"]', ['name', 'robots'], seo.noindex ? 'noindex, nofollow' : 'index, follow');
    setMeta('meta[property="og:type"]', ['property', 'og:type'], seo.type);
    setMeta('meta[property="og:site_name"]', ['property', 'og:site_name'], 'AD Shop');
    setMeta('meta[property="og:title"]', ['property', 'og:title'], seo.title);
    setMeta('meta[property="og:description"]', ['property', 'og:description'], seo.description);
    setMeta('meta[property="og:url"]', ['property', 'og:url'], seo.canonical);
    setMeta('meta[property="og:image"]', ['property', 'og:image'], seo.image);
    setMeta('meta[name="twitter:card"]', ['name', 'twitter:card'], seo.image ? 'summary_large_image' : 'summary');
    setMeta('meta[name="twitter:title"]', ['name', 'twitter:title'], seo.title);
    setMeta('meta[name="twitter:description"]', ['name', 'twitter:description'], seo.description);
    setMeta('meta[name="twitter:image"]', ['name', 'twitter:image'], seo.image);
    setCanonical(seo.canonical);
  }, [seo.canonical, seo.description, seo.image, seo.noindex, seo.title, seo.type]);

  return null;
}
