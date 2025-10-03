import './globals.css';

export const metadata = { title: 'L2 Dash', description: 'Live trading dashboard' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="h-full min-h-screen bg-zinc-950 text-zinc-100">
        <main className="h-full min-h-screen overflow-x-hidden overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
