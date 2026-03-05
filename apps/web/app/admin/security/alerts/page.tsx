'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';
import { PageLoader, Spinner } from '@/components/spinner';

// ── Types ──────────────────────────────────────────────────────────────────

interface AlertCondition {
  type: string;
  threshold?: number;
}

interface AlertRule {
  id: string;
  projectId: string;
  name: string;
  condition: AlertCondition;
  channel: string;
  webhookUrl: string | null;
  email: string | null;
  throttleMinutes: number;
  enabled: boolean;
  lastFiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const CONDITION_TYPES = [
  { value: 'pii_threshold', label: 'PII Threshold', hasThreshold: true, description: 'Fires when PII detections exceed a count' },
  { value: 'injection_blocked', label: 'Injection Blocked', hasThreshold: false, description: 'Fires when a prompt injection attempt is blocked' },
  { value: 'cost_exceeded', label: 'Cost Exceeded', hasThreshold: true, description: 'Fires when per-request cost exceeds a USD amount' },
  { value: 'content_violation', label: 'Content Violation', hasThreshold: false, description: 'Fires on any content filter violation' },
] as const;

const CHANNEL_TYPES = [
  { value: 'webhook', label: 'Webhook', placeholder: 'https://your-server.com/webhook' },
  { value: 'email', label: 'Email', placeholder: 'alerts@your-company.com' },
  { value: 'slack', label: 'Slack', placeholder: 'https://hooks.slack.com/services/...' },
] as const;

const THROTTLE_OPTIONS = [
  { value: 5, label: '5 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 360, label: '6 hours' },
  { value: 1440, label: '24 hours' },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────

function conditionLabel(condition: AlertCondition): string {
  const meta = CONDITION_TYPES.find(c => c.value === condition.type);
  const label = meta?.label ?? condition.type;
  return condition.threshold != null ? `${label} > ${condition.threshold}` : label;
}

function channelBadgeColor(channel: string): string {
  switch (channel) {
    case 'webhook': return 'bg-purple-100 text-purple-700';
    case 'email': return 'bg-blue-100 text-blue-700';
    case 'slack': return 'bg-green-100 text-green-700';
    default: return 'bg-gray-100 text-gray-600';
  }
}

// ── Form Component ─────────────────────────────────────────────────────────

interface FormState {
  name: string;
  conditionType: string;
  threshold: string;
  channel: string;
  webhookUrl: string;
  email: string;
  throttleMinutes: number;
  enabled: boolean;
}

function AlertRuleForm({ form, onChange }: { form: FormState; onChange: (f: FormState) => void }) {
  const condMeta = CONDITION_TYPES.find(c => c.value === form.conditionType);
  const chanMeta = CHANNEL_TYPES.find(c => c.value === form.channel);
  const needsUrl = form.channel === 'webhook' || form.channel === 'slack';
  const needsEmail = form.channel === 'email';

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-500">Alert Name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          placeholder="e.g. PII Exposure Alert"
          className="mt-1 w-full rounded border px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500">Condition</label>
          <select
            value={form.conditionType}
            onChange={(e) => onChange({ ...form, conditionType: e.target.value, threshold: '' })}
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
          >
            {CONDITION_TYPES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          {condMeta && <p className="mt-1 text-xs text-gray-400">{condMeta.description}</p>}
        </div>
        {condMeta?.hasThreshold && (
          <div>
            <label className="block text-xs font-medium text-gray-500">Threshold</label>
            <input
              type="number"
              step={form.conditionType === 'cost_exceeded' ? '0.10' : '1'}
              min="0"
              value={form.threshold}
              onChange={(e) => onChange({ ...form, threshold: e.target.value })}
              placeholder={form.conditionType === 'cost_exceeded' ? 'USD amount' : 'Count'}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500">Channel</label>
          <select
            value={form.channel}
            onChange={(e) => onChange({ ...form, channel: e.target.value })}
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
          >
            {CHANNEL_TYPES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">
            {needsEmail ? 'Email Address' : 'Webhook URL'}
          </label>
          {needsUrl && (
            <input
              type="url"
              value={form.webhookUrl}
              onChange={(e) => onChange({ ...form, webhookUrl: e.target.value })}
              placeholder={chanMeta?.placeholder}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          )}
          {needsEmail && (
            <input
              type="email"
              value={form.email}
              onChange={(e) => onChange({ ...form, email: e.target.value })}
              placeholder={chanMeta?.placeholder}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500">Throttle (cooldown)</label>
          <select
            value={form.throttleMinutes}
            onChange={(e) => onChange({ ...form, throttleMinutes: parseInt(e.target.value) })}
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
          >
            {THROTTLE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-400">Minimum time between repeated alerts for this rule.</p>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <button
              type="button"
              role="switch"
              aria-checked={form.enabled}
              onClick={() => onChange({ ...form, enabled: !form.enabled })}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${form.enabled ? 'bg-green-600' : 'bg-gray-200'}`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
            <span className="text-sm text-gray-700">{form.enabled ? 'Enabled' : 'Disabled'}</span>
          </label>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

function ruleToForm(rule: AlertRule): FormState {
  return {
    name: rule.name,
    conditionType: rule.condition.type,
    threshold: rule.condition.threshold != null ? String(rule.condition.threshold) : '',
    channel: rule.channel,
    webhookUrl: rule.webhookUrl ?? '',
    email: rule.email ?? '',
    throttleMinutes: rule.throttleMinutes,
    enabled: rule.enabled,
  };
}

function formToBody(form: FormState) {
  const condMeta = CONDITION_TYPES.find(c => c.value === form.conditionType);
  const condition: AlertCondition = { type: form.conditionType };
  if (condMeta?.hasThreshold && form.threshold) {
    condition.threshold = parseFloat(form.threshold);
  }

  return {
    name: form.name,
    condition,
    channel: form.channel,
    webhookUrl: form.channel !== 'email' ? form.webhookUrl || undefined : undefined,
    email: form.channel === 'email' ? form.email || undefined : undefined,
    throttleMinutes: form.throttleMinutes,
    enabled: form.enabled,
  };
}

export default function AlertsPage() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const defaultForm: FormState = {
    name: '',
    conditionType: 'pii_threshold',
    threshold: '5',
    channel: 'webhook',
    webhookUrl: '',
    email: '',
    throttleMinutes: 60,
    enabled: true,
  };

  const [createForm, setCreateForm] = useState<FormState>(defaultForm);
  const [editForm, setEditForm] = useState<FormState>(defaultForm);

  const fetchRules = useCallback(() => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) { setLoading(false); return; }

    setLoading(true);
    setError('');
    apiFetch<AlertRule[]>(`/v1/security/alerts/${projectId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(setRules)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const handleCreate = async () => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;

    setFormError('');
    if (!createForm.name.trim()) { setFormError('Alert name is required.'); return; }

    const body = formToBody(createForm);
    if ((body.channel === 'webhook' || body.channel === 'slack') && !body.webhookUrl) {
      setFormError('Webhook URL is required.'); return;
    }
    if (body.channel === 'email' && !body.email) {
      setFormError('Email address is required.'); return;
    }

    setSaving(true);
    try {
      const created = await apiFetch<AlertRule>(`/v1/security/alerts/${projectId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      setRules(prev => [created, ...prev]);
      setCreateForm(defaultForm);
      setShowCreateForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create alert rule');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (ruleId: string) => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;

    setSaving(true);
    setFormError('');
    try {
      const updated = await apiFetch<AlertRule>(`/v1/security/alerts/${projectId}/${ruleId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(formToBody(editForm)),
      });
      setRules(prev => prev.map(r => r.id === ruleId ? updated : r));
      setEditingId(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update alert rule');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (rule: AlertRule) => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;

    try {
      const updated = await apiFetch<AlertRule>(`/v1/security/alerts/${projectId}/${rule.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      setRules(prev => prev.map(r => r.id === rule.id ? updated : r));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle alert rule');
    }
  };

  const handleDelete = async (ruleId: string) => {
    const token = getToken();
    const projectId = getProjectId();
    if (!token || !projectId) return;

    try {
      await apiFetch(`/v1/security/alerts/${projectId}/${ruleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setRules(prev => prev.filter(r => r.id !== ruleId));
      setDeleteConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete alert rule');
    }
  };

  if (loading) return <PageLoader message="Loading alert rules..." />;

  if (error && rules.length === 0) {
    return (
      <div className="flex flex-col items-center py-20">
        <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-4 text-center">
          <p className="font-medium text-red-700">Failed to load alert rules</p>
          <p className="mt-1 text-sm text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Alert Rules</h1>
          <p className="mt-1 text-sm text-gray-500">
            Get notified via webhook, email, or Slack when your SDK guardrails detect security events.
          </p>
        </div>
        <button
          onClick={() => { setShowCreateForm(!showCreateForm); setFormError(''); }}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {showCreateForm ? 'Cancel' : 'Create Alert Rule'}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Create form */}
      {showCreateForm && (
        <div className="mt-6 rounded-lg border bg-white p-5">
          <h3 className="text-base font-semibold text-gray-800">New Alert Rule</h3>
          {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}
          <div className="mt-4">
            <AlertRuleForm form={createForm} onChange={setCreateForm} />
          </div>
          <div className="mt-5 flex justify-end border-t pt-4">
            <button
              onClick={handleCreate}
              disabled={saving || !createForm.name.trim()}
              className="flex items-center gap-2 rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving && <Spinner className="h-4 w-4 text-white" />}
              {saving ? 'Creating...' : 'Create Alert Rule'}
            </button>
          </div>
        </div>
      )}

      {/* Rule list */}
      <div className="mt-6 space-y-4">
        {rules.length === 0 && !showCreateForm && (
          <div className="rounded-lg border bg-white p-8 text-center">
            <h2 className="text-lg font-semibold text-gray-700">No alert rules yet</h2>
            <p className="mt-2 text-sm text-gray-500">
              Create your first alert rule to get notified when the SDK detects PII exposure, prompt injection, cost overruns, or content violations.
            </p>
          </div>
        )}

        {rules.map(rule => (
          <div key={rule.id} className="rounded-lg border bg-white p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">{rule.name}</h3>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${rule.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {rule.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                    {conditionLabel(rule.condition)}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${channelBadgeColor(rule.channel)}`}>
                    {rule.channel}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                    {THROTTLE_OPTIONS.find(o => o.value === rule.throttleMinutes)?.label ?? `${rule.throttleMinutes}m`} cooldown
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  {rule.lastFiredAt ? `Last fired ${new Date(rule.lastFiredAt).toLocaleString()}` : 'Never fired'}
                  {' · '}Destination: {rule.channel === 'email' ? rule.email : rule.webhookUrl ? rule.webhookUrl.substring(0, 50) + (rule.webhookUrl.length > 50 ? '...' : '') : 'Not configured'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleEnabled(rule)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${rule.enabled ? 'bg-green-600' : 'bg-gray-200'}`}
                  title={rule.enabled ? 'Disable' : 'Enable'}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${rule.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
                <button
                  onClick={() => {
                    if (editingId === rule.id) {
                      setEditingId(null);
                      setFormError('');
                    } else {
                      setEditingId(rule.id);
                      setEditForm(ruleToForm(rule));
                      setFormError('');
                    }
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {editingId === rule.id ? 'Cancel' : 'Edit'}
                </button>
                {deleteConfirmId === rule.id ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleDelete(rule.id)} className="text-sm font-medium text-red-600 hover:text-red-800">Confirm</button>
                    <button onClick={() => setDeleteConfirmId(null)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConfirmId(rule.id)} className="text-sm text-red-600 hover:text-red-800">Delete</button>
                )}
              </div>
            </div>

            {/* Inline editor */}
            {editingId === rule.id && (
              <div className="mt-4 border-t pt-4">
                {formError && <p className="mb-2 text-sm text-red-600">{formError}</p>}
                <AlertRuleForm form={editForm} onChange={setEditForm} />
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => handleUpdate(rule.id)}
                    disabled={saving}
                    className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving && <Spinner className="h-4 w-4 text-white" />}
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
