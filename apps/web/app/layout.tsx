import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'Pazaryeri Katalog Denetçisi — Demo',
  description:
    'Sentetik bir katalog üzerinde deterministik denetim kurallarını çalıştıran, özet ve önem sıralı bulguları gösteren Next.js demosu.',
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
