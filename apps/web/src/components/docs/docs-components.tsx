'use client';

import { SECTIONS } from './docs-data';

export function CodeBlock({
  code,
  onCopy,
  copied,
}: {
  code: string;
  onCopy: (code: string) => void;
  copied: boolean;
}) {
  return (
    <div className="relative mt-3 rounded-lg bg-gray-900 p-4">
      <button
        onClick={() => onCopy(code)}
        className="absolute right-2 top-2 rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 transition hover:bg-gray-600"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <pre className="overflow-x-auto text-sm leading-relaxed text-green-400">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function CodeTabs({
  nodeCode,
  pythonCode,
  activeTab,
  copiedCode,
  onCopy,
}: {
  nodeCode: string;
  pythonCode: string;
  activeTab: 'node' | 'python';
  copiedCode: string;
  onCopy: (code: string) => void;
}) {
  const code = activeTab === 'node' ? nodeCode : pythonCode;
  return <CodeBlock code={code} onCopy={onCopy} copied={copiedCode === code} />;
}

export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 pt-10">
      <h2 className="group text-lg font-semibold text-gray-900">
        <a href={`#${id}`} className="flex items-center gap-2">
          {title}
          <span className="text-sm text-gray-300 opacity-0 transition group-hover:opacity-100">
            #
          </span>
        </a>
      </h2>
      <div className="mt-3 space-y-4 text-sm text-gray-700 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export function SubSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 pt-8">
      <h3 className="group text-base font-semibold text-gray-800">
        <a href={`#${id}`} className="flex items-center gap-2">
          {title}
          <span className="text-sm text-gray-300 opacity-0 transition group-hover:opacity-100">
            #
          </span>
        </a>
      </h3>
      <div className="mt-3 space-y-4 text-sm text-gray-700 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export function OptionTable({
  options,
}: {
  options: Array<{
    name: string;
    type: string;
    default: string;
    description: string;
  }>;
}) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Option</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Type</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Default</th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {options.map((opt) => (
            <tr key={opt.name} className="hover:bg-gray-50">
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-blue-700">
                {opt.name}
              </td>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-gray-500">
                {opt.type}
              </td>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-gray-500">
                {opt.default}
              </td>
              <td className="px-3 py-2 text-gray-700">{opt.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InfoBox({
  variant,
  title,
  children,
}: {
  variant: 'info' | 'warning' | 'tip';
  title?: string;
  children: React.ReactNode;
}) {
  const styles = {
    info: 'border-blue-200 bg-blue-50',
    warning: 'border-amber-200 bg-amber-50',
    tip: 'border-purple-200 bg-purple-50',
  };
  const titleColors = {
    info: 'text-blue-800',
    warning: 'text-amber-800',
    tip: 'text-purple-800',
  };
  return (
    <div className={`rounded-lg border p-4 ${styles[variant]}`}>
      {title && <p className={`mb-1 text-sm font-semibold ${titleColors[variant]}`}>{title}</p>}
      <div className="text-sm text-gray-700">{children}</div>
    </div>
  );
}

export function SideNav({
  sections,
  activeSection,
}: {
  sections: typeof SECTIONS;
  activeSection: string;
}) {
  return (
    <nav className="space-y-0.5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
        On this page
      </p>
      {sections.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className={`block rounded py-1 text-xs transition-colors ${
            s.depth === 2 ? 'pl-4' : 'pl-2'
          } ${
            activeSection === s.id
              ? 'font-medium text-blue-700'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}

export function TabButtons({
  activeTab,
  onTabChange,
}: {
  activeTab: 'node' | 'python';
  onTabChange: (tab: 'node' | 'python') => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
      <button
        onClick={() => onTabChange('node')}
        className={`rounded-md px-3 py-1 text-xs font-medium transition ${
          activeTab === 'node'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        Node.js
      </button>
      <button
        onClick={() => onTabChange('python')}
        className={`rounded-md px-3 py-1 text-xs font-medium transition ${
          activeTab === 'python'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        Python
      </button>
    </div>
  );
}
