import { useState } from 'react';
import { useAgentStore } from '../store/agentStore.js';
import { useWsStore } from '../store/wsStore.js';
import { Input } from '../components/ui/Input.js';
import { Textarea } from '../components/ui/Textarea.js';
import { Button } from '../components/ui/Button.js';

interface CreateAgentFormProps {
  onSuccess?: () => void;
}

interface FormData {
  id: string;
  workspace: string;
  model: string;
  apiKey: string;
  baseURL: string;
  temperature: string;
  maxIterations: string;
  agentsMd: string;
  soulMd: string;
  userMd: string;
  toolsMd: string;
}

interface FormErrors {
  id?: string;
  workspace?: string;
  model?: string;
}

export function CreateAgentForm({ onSuccess }: CreateAgentFormProps) {
  const agents = useAgentStore((s) => s.agents);
  const send = useWsStore((s) => s.send);

  const [form, setForm] = useState<FormData>({
    id: '',
    workspace: '',
    model: '',
    apiKey: '',
    baseURL: '',
    temperature: '',
    maxIterations: '',
    agentsMd: '',
    soulMd: '',
    userMd: '',
    toolsMd: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [bootstrapOpen, setBootstrapOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const setField = (key: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const validate = (): boolean => {
    const errs: FormErrors = {};
    if (!form.id.trim()) errs.id = '必填';
    else if (agents.some((a) => a.id === form.id.trim())) errs.id = 'Agent ID 已存在';
    if (!form.workspace.trim()) errs.workspace = '必填';
    if (!form.model.trim()) errs.model = '必填';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError(null);

    const bootstrap: Record<string, string> = {};
    if (form.agentsMd.trim()) bootstrap['agents'] = form.agentsMd;
    if (form.soulMd.trim()) bootstrap['soul'] = form.soulMd;
    if (form.userMd.trim()) bootstrap['user'] = form.userMd;
    if (form.toolsMd.trim()) bootstrap['tools'] = form.toolsMd;

    const config: Record<string, unknown> = {
      id: form.id.trim(),
      workspace: form.workspace.trim(),
      provider: {
        model: form.model.trim(),
        ...(form.apiKey.trim() && { apiKey: form.apiKey.trim() }),
        ...(form.baseURL.trim() && { baseURL: form.baseURL.trim() }),
      },
      ...(form.temperature && { temperature: parseFloat(form.temperature) }),
      ...(form.maxIterations && { maxIterations: parseInt(form.maxIterations, 10) }),
    };

    send({
      type: 'create-agent',
      config,
      ...(Object.keys(bootstrap).length > 0 && { bootstrap }),
    });

    // 等待 agent-created 或 error 响应（通过 wsStore 分发到 agentStore）
    // 简化处理：1.5 秒后检查是否已创建
    setTimeout(() => {
      setSubmitting(false);
      onSuccess?.();
    }, 1500);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {submitError && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm text-red-600 dark:text-red-400">
          {submitError}
        </div>
      )}

      {/* 必填字段 */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Agent ID *"
          placeholder="my-assistant"
          value={form.id}
          onChange={setField('id')}
          error={errors.id}
        />
        <Input
          label="Workspace *"
          placeholder="/path/to/workspace"
          value={form.workspace}
          onChange={setField('workspace')}
          error={errors.workspace}
        />
      </div>

      <Input
        label="模型 *"
        placeholder="openai:gpt-4o 或 glm-4"
        value={form.model}
        onChange={setField('model')}
        error={errors.model}
      />

      {/* 可选字段 */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="API Key"
          type="password"
          placeholder="sk-..."
          value={form.apiKey}
          onChange={setField('apiKey')}
        />
        <Input
          label="Base URL"
          placeholder="https://api.openai.com/v1"
          value={form.baseURL}
          onChange={setField('baseURL')}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="温度 (0-2)"
          type="number"
          min="0"
          max="2"
          step="0.1"
          placeholder="0.7"
          value={form.temperature}
          onChange={setField('temperature')}
        />
        <Input
          label="最大迭代次数"
          type="number"
          min="1"
          max="50"
          placeholder="10"
          value={form.maxIterations}
          onChange={setField('maxIterations')}
        />
      </div>

      {/* Bootstrap 折叠面板 */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setBootstrapOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
        >
          <span>Bootstrap 文件内容（可选）</span>
          <svg
            className={`w-4 h-4 transition-transform ${bootstrapOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {bootstrapOpen && (
          <div className="p-4 space-y-3">
            <Textarea
              label="AGENTS.md"
              placeholder="Agent 身份、能力描述…"
              value={form.agentsMd}
              onChange={setField('agentsMd')}
              rows={3}
            />
            <Textarea
              label="SOUL.md"
              placeholder="性格、价值观…"
              value={form.soulMd}
              onChange={setField('soulMd')}
              rows={3}
            />
            <Textarea
              label="USER.md"
              placeholder="用户信息…"
              value={form.userMd}
              onChange={setField('userMd')}
              rows={3}
            />
            <Textarea
              label="TOOLS.md"
              placeholder="工具使用说明…"
              value={form.toolsMd}
              onChange={setField('toolsMd')}
              rows={3}
            />
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? '创建中…' : '创建 Agent'}
        </Button>
      </div>
    </form>
  );
}
