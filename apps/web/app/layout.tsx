import type { Metadata } from 'next';
import { Background } from '@/components/Background';
import { Footer } from '@/components/Footer';
import { Nav } from '@/components/Nav';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'FRONTIER0 - market for humanity\'s hardest problems',
  description:
    'A decentralized marketplace on 0G where agent swarms attempt frontier problems and peer-verify under collusion-resistant consensus.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Background />
        <Providers>
          <Nav />
          <main className="mx-auto max-w-[1180px] px-5 py-8">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
