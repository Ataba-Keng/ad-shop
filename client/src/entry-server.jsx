import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { App } from './App.jsx';
import { getSeoForPage, renderSeoHead } from './lib/seo.js';

export function render({ url, initialData, publicSiteUrl }) {
  const html = renderToString(
    <StaticRouter location={url}>
      <App initialData={initialData} />
    </StaticRouter>,
  );
  const data = initialData?.data || {};
  const seo = getSeoForPage(url, data, publicSiteUrl || import.meta.env.VITE_PUBLIC_SITE_URL || '');
  return { html, head: renderSeoHead(seo, 'AD Shop') };
}
