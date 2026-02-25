'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { getToken, getProjectId } from '@/lib/auth';
import { useAuth } from '@/lib/auth-context';

interface TeamMemberInfo {
  id: string;
  userId: string;
  role: string;
  createdAt: string;
  user: { email: string };
}

interface Team {
  id: string;
  name: string;
  slug: string;
  description: string;
  color: string;
  createdAt: string;
  members: TeamMemberInfo[];
  _count: { prompts: number };
}

interface OrgMember {
  id: string;
  email: string;
  role: string;
}

const TEAM_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16',
];

export default function TeamsPage() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create team form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newColor, setNewColor] = useState(TEAM_COLORS[0]);
  const [creating, setCreating] = useState(false);

  // Add member form
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addUserId, setAddUserId] = useState('');
  const [addRole, setAddRole] = useState('editor');

  const projectId = getProjectId();

  const loadTeams = useCallback(async () => {
    const token = getToken();
    if (!token || !projectId) return;
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const data = await apiFetch<Team[]>(`/team/${projectId}`, { headers });
      setTeams(data);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [projectId]);

  const loadOrgMembers = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const data = await apiFetch<OrgMember[]>('/invitations/team', { headers });
      setOrgMembers(data);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    Promise.all([loadTeams(), loadOrgMembers()]).finally(() => setLoading(false));
  }, [loadTeams, loadOrgMembers]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    const token = getToken();
    if (!token || !projectId) return;

    try {
      await apiFetch(`/team/${projectId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newName, description: newDesc, color: newColor }),
      });
      setNewName('');
      setNewDesc('');
      setShowCreate(false);
      await loadTeams();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string, promptCount: number) => {
    const msg = promptCount > 0
      ? `Delete team "${teamName}"? ${promptCount} prompt(s) will become unassigned.`
      : `Delete team "${teamName}"?`;
    if (!confirm(msg)) return;

    const token = getToken();
    if (!token || !projectId) return;

    try {
      await apiFetch(`/team/${projectId}/${teamId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadTeams();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleAddMember = async (teamId: string) => {
    setError('');
    const token = getToken();
    if (!token || !projectId || !addUserId) return;

    try {
      await apiFetch(`/team/${projectId}/${teamId}/members`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: addUserId, role: addRole }),
      });
      setAddingTo(null);
      setAddUserId('');
      setAddRole('editor');
      await loadTeams();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRemoveMember = async (teamId: string, targetUserId: string) => {
    if (!confirm('Remove this member from the team?')) return;
    const token = getToken();
    if (!token || !projectId) return;

    try {
      await apiFetch(`/team/${projectId}/${teamId}/members/${targetUserId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadTeams();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleChangeRole = async (teamId: string, targetUserId: string, newRole: string) => {
    const token = getToken();
    if (!token || !projectId) return;

    try {
      await apiFetch(`/team/${projectId}/${teamId}/members/${targetUserId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: newRole }),
      });
      await loadTeams();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-gray-400">Loading...</div>;
  }

  const isOrgAdmin = user?.role === 'admin';

  // Members not in a specific team (for the "add member" dropdown)
  const availableMembers = (teamId: string) => {
    const team = teams.find((t) => t.id === teamId);
    const existingIds = new Set(team?.members.map((m) => m.userId) ?? []);
    return orgMembers.filter((m) => !existingIds.has(m.id));
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Teams</h1>
          <p className="mt-1 text-sm text-gray-500">
            Organize prompts by team. Team members only see their team&apos;s prompts.
          </p>
        </div>
        {isOrgAdmin && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Create Team
          </button>
        )}
      </div>

      {/* Role Permissions Reference */}
      <div className="mt-4 rounded-lg border bg-white p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Role Permissions</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 pr-4 font-medium">Action</th>
                <th className="pb-2 px-3 text-center font-medium">
                  <span className="rounded bg-gray-50 px-2 py-0.5 text-gray-600">Viewer</span>
                </th>
                <th className="pb-2 px-3 text-center font-medium">
                  <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-700">Editor</span>
                </th>
                <th className="pb-2 px-3 text-center font-medium">
                  <span className="rounded bg-purple-50 px-2 py-0.5 text-purple-700">Lead</span>
                </th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              <tr className="border-b border-gray-100">
                <td className="py-1.5 pr-4">View prompts, versions &amp; deployments</td>
                <td className="py-1.5 px-3 text-center text-green-600">&#10003;</td>
                <td className="py-1.5 px-3 text-center text-green-600">&#10003;</td>
                <td className="py-1.5 px-3 text-center text-green-600">&#10003;</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-1.5 pr-4">View eval datasets &amp; run results</td>
                <td className="py-1.5 px-3 text-center text-green-600">&#10003;</td>
                <td className="py-1.5 px-3 text-center text-green-600">&#10003;</td>
                <td className="py-1.5 px-3 text-center text-green-600">&#10003;</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-1.5 pr-4">Create &amp; edit prompt versions</td>
                <td className="py-1.5 px-3 text-center text-gray-300">&mdash;</td>
                <td className="py-1.5 px-3 text-center text-green-600">&#10003;</td>
                <td className="py-1.5 px-3 text-center text-green-600">&#10003;</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-1.5 pr-4">Deploy to environments</td>
                <td className="py-1.5 px-3 text-center text-gray-300">&mdash;</td>
                <td className="py-1.5 px-3 text-center text-green-600">&#10003;</td>
                <td className="py-1.5 px-3 text-center text-green-600">&#10003;</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-1.5 pr-4">Create datasets, add cases &amp; run evals</td>
                <td className="py-1.5 px-3 text-center text-gray-300">&mdash;</td>
                <td className="py-1.5 px-3 text-center text-green-600">&#10003;</td>
                <td className="py-1.5 px-3 text-center text-green-600">&#10003;</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-1.5 pr-4">Generate datasets &amp; optimize prompts</td>
                <td className="py-1.5 px-3 text-center text-gray-300">&mdash;</td>
                <td className="py-1.5 px-3 text-center text-green-600">&#10003;</td>
                <td className="py-1.5 px-3 text-center text-green-600">&#10003;</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-1.5 pr-4">Delete prompts &amp; datasets</td>
                <td className="py-1.5 px-3 text-center text-gray-300">&mdash;</td>
                <td className="py-1.5 px-3 text-center text-gray-300">&mdash;</td>
                <td className="py-1.5 px-3 text-center text-green-600">&#10003;</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-1.5 pr-4">Deploy to critical environments</td>
                <td className="py-1.5 px-3 text-center text-gray-300">&mdash;</td>
                <td className="py-1.5 px-3 text-center text-gray-300">&mdash;</td>
                <td className="py-1.5 px-3 text-center text-green-600">&#10003;</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-4">Manage team members &amp; roles</td>
                <td className="py-1.5 px-3 text-center text-gray-300">&mdash;</td>
                <td className="py-1.5 px-3 text-center text-gray-300">&mdash;</td>
                <td className="py-1.5 px-3 text-center text-green-600">&#10003;</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[10px] text-gray-400">
          Org admins bypass all team restrictions. Unassigned prompts are accessible to all org members.
        </p>
      </div>

      {error && (
        <div className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError('')} className="ml-2 font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Create Team Form */}
      {showCreate && (
        <form onSubmit={handleCreateTeam} className="mt-4 rounded-lg border bg-white p-4">
          <h2 className="text-lg font-semibold">New Team</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="ML Engineering"
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Color</label>
              <div className="mt-1 flex gap-2">
                {TEAM_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColor(c)}
                    className={`h-8 w-8 rounded-full border-2 ${
                      newColor === c ? 'border-gray-800' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Optional description"
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Team'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded border px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Team List */}
      <div className="mt-6 space-y-4">
        {teams.map((team) => (
          <div key={team.id} className="rounded-lg border bg-white">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-3">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: team.color }}
                />
                <h3 className="text-lg font-semibold">{team.name}</h3>
                <span className="text-xs text-gray-400">{team.slug}</span>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                  {team.members.length} member{team.members.length !== 1 && 's'}
                </span>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                  {team._count.prompts} prompt{team._count.prompts !== 1 && 's'}
                </span>
              </div>
              {isOrgAdmin && (
                <button
                  onClick={() => handleDeleteTeam(team.id, team.name, team._count.prompts)}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              )}
            </div>
            {team.description && (
              <p className="px-4 pt-2 text-sm text-gray-500">{team.description}</p>
            )}
            <div className="p-4">
              <h4 className="mb-2 text-sm font-medium text-gray-700">Members</h4>
              <div className="space-y-2">
                {team.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded border px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm">{member.user.email}</span>
                      <select
                        value={member.role}
                        onChange={(e) => handleChangeRole(team.id, member.userId, e.target.value)}
                        className={`rounded border px-2 py-0.5 text-xs font-medium ${
                          member.role === 'lead'
                            ? 'bg-purple-50 text-purple-700'
                            : member.role === 'editor'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-gray-50 text-gray-600'
                        }`}
                      >
                        <option value="viewer">Viewer — read-only</option>
                        <option value="editor">Editor — create &amp; deploy</option>
                        <option value="lead">Lead — full control</option>
                      </select>
                      {member.userId === user?.id && (
                        <span className="text-xs text-gray-400">(you)</span>
                      )}
                    </div>
                    {member.userId !== user?.id && (
                      <button
                        onClick={() => handleRemoveMember(team.id, member.userId)}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Member */}
              {addingTo === team.id ? (
                <div className="mt-3 flex items-center gap-2">
                  <select
                    value={addUserId}
                    onChange={(e) => setAddUserId(e.target.value)}
                    className="flex-1 rounded border px-2 py-1.5 text-sm"
                  >
                    <option value="">Select member...</option>
                    {availableMembers(team.id).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.email}
                      </option>
                    ))}
                  </select>
                  <select
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value)}
                    className="rounded border px-2 py-1.5 text-sm"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="lead">Team Lead</option>
                  </select>
                  <button
                    onClick={() => handleAddMember(team.id)}
                    disabled={!addUserId}
                    className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { setAddingTo(null); setAddUserId(''); }}
                    className="rounded border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingTo(team.id)}
                  className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  + Add Member
                </button>
              )}
            </div>
          </div>
        ))}

        {teams.length === 0 && !showCreate && (
          <div className="rounded-lg border border-dashed bg-gray-50 p-8 text-center">
            <p className="text-gray-500">No teams yet.</p>
            {isOrgAdmin && (
              <p className="mt-1 text-sm text-gray-400">
                Create a team to organize prompts by group.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
