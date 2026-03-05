import { useState } from 'react';
import { useAgentStore } from '../store/agentStore.js';
import { useWsStore } from '../store/wsStore.js';
import { Input } from '../components/ui/Input.js';
import { Button } from '../components/ui/Button.js';
import { Avatar } from '../components/ui/Avatar.js';
import { StatusBadge } from '../components/StatusBadge.js';

interface CreateGroupFormProps {
  onSuccess?: () => void;
}

export function CreateGroupForm({ onSuccess }: CreateGroupFormProps) {
  const agents = useAgentStore((s) => s.agents);
  const send = useWsStore((s) => s.send);

  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [nameError, setNameError] = useState('');
  const [selectionError, setSelectionError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const toggleAgent = (agentId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  };

  const validate = (): boolean => {
    let valid = true;
    if (!name.trim()) {
      setNameError('请输入群组名');
      valid = false;
    } else {
      setNameError('');
    }
    if (selectedIds.size < 2) {
      setSelectionError('至少选择 2 个 agent');
      valid = false;
    } else {
      setSelectionError('');
    }
    return valid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    const groupId = `group-${Date.now()}`;
    send({
      type: 'create-group',
      groupId,
      name: name.trim(),
      agentIds: [...selectedIds],
    });

    setTimeout(() => {
      setSubmitting(false);
      onSuccess?.();
    }, 800);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="群组名称 *"
        placeholder="我的群组"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={nameError}
      />

      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          选择 Agent（至少 2 个）
        </p>
        {agents.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 py-2">暂无可用 agent</p>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {agents.map((agent) => (
              <label
                key={agent.id}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(agent.id)}
                  onChange={() => toggleAgent(agent.id)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <Avatar agentId={agent.id} size="sm" />
                <span className="flex-1 text-sm text-gray-900 dark:text-gray-100">{agent.id}</span>
                <StatusBadge status={agent.status} />
              </label>
            ))}
          </div>
        )}
        {selectionError && <p className="mt-1 text-xs text-red-500">{selectionError}</p>}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={submitting || agents.length < 2}>
          {submitting ? '创建中…' : '创建群组'}
        </Button>
      </div>
    </form>
  );
}
