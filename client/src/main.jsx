import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { App } from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './index.css';

const initialData = window.__SPORTPRESS_INITIAL__ || { key: '', data: null, demoMode: false };
window.__SPORTPRESS_PUBLIC_SITE_URL__ = initialData.publicSiteUrl || '';

hydrateRoot(
  document.getElementById('root'),
  <BrowserRouter>
    <AuthProvider>
      <App initialData={initialData} />
    </AuthProvider>
  </BrowserRouter>,
);

// Sonner reads browser-only document state. Keep it in its own client root so
// it does not add DOM nodes that were absent from the server-rendered app.
const toastContainer = document.createElement('div');
toastContainer.id = 'toast-root';
document.body.appendChild(toastContainer);
createRoot(toastContainer).render(
  <Toaster position="top-right" richColors closeButton />,
);
