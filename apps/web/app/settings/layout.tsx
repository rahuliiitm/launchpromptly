'use client';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="mx-auto max-w-7xl p-6">{children}</div>;
}
