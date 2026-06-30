import React, { useState, useEffect, useCallback } from 'react';
import { Mail, MessageSquare, Save, FlaskConical, Loader2, Eye, EyeOff } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useToast } from '../../hooks/useToast';

// ── Types ────────────────────────────────────────────────────────────────────

interface EmailConfig {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  fromName: string;
  fromEmail: string;
  hasPassword?: boolean;
}

interface SmsConfig {
  enabled: boolean;
  apiUrl: string;
  apiToken: string;
  hasToken?: boolean;
}

const DEFAULT_EMAIL: EmailConfig = {
  enabled: false,
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: '',
  smtpPassword: '',
  fromName: '',
  fromEmail: '',
};

const DEFAULT_SMS: SmsConfig = {
  enabled: false,
  apiUrl: '',
  apiToken: '',
};

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('authToken') || ''}`,
});

// ── Email tab ────────────────────────────────────────────────────────────────

const EmailTab: React.FC = () => {
  const [config, setConfig] = useState<EmailConfig>(DEFAULT_EMAIL);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { success, error: toastError } = useToast();

  const loadConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/alerts/delivery-config/email', { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.data) {
        setConfig({ ...DEFAULT_EMAIL, ...data.data, smtpPassword: '' });
      }
    } catch {
      // No config saved yet — use defaults silently
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const payload: any = { ...config };
      if (!payload.smtpPassword) delete payload.smtpPassword;
      const res = await fetch('/api/alerts/delivery-config/email', {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Save failed');
      success('Configuration saved', 'Email server settings have been updated.');
      setConfig(prev => ({ ...prev, smtpPassword: '', hasPassword: true }));
    } catch (err: any) {
      toastError('Save failed', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testRecipient) { toastError('Enter a test recipient email address'); return; }
    try {
      setIsTesting(true);
      const res = await fetch('/api/alerts/delivery-config/email/test', {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ testRecipient }),
      });
      const data = await res.json();
      if (data.success) success('Test email sent', `Email sent to ${testRecipient}`);
      else toastError('Test failed', data.message || 'Could not send test email');
    } catch (err: any) {
      toastError('Test failed', err.message);
    } finally {
      setIsTesting(false);
    }
  };

  const textField = (label: string, key: keyof EmailConfig, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={config[key] as string | number}
        onChange={e => setConfig(prev => ({
          ...prev,
          [key]: type === 'number' ? Number(e.target.value) : e.target.value,
        }))}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      />
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading configuration...
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Enable toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div>
          <p className="text-sm font-semibold text-gray-900">Enable Email Alerts</p>
          <p className="text-xs text-gray-500 mt-0.5">Send alert notifications and scheduled reports via email</p>
        </div>
        <button
          type="button"
          onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
          className={cn(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
            config.enabled ? 'bg-primary-600' : 'bg-gray-300'
          )}
          aria-label="Toggle email alerts"
        >
          <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition-transform', config.enabled ? 'translate-x-6' : 'translate-x-1')} />
        </button>
      </div>

      {/* SMTP Server */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">SMTP Server</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">{textField('Host', 'smtpHost', 'text', 'smtp.gmail.com')}</div>
          <div>{textField('Port', 'smtpPort', 'number', '587')}</div>
        </div>
        <div className="mt-3 flex items-center space-x-3">
          <input
            id="smtp-secure"
            type="checkbox"
            checked={config.smtpSecure}
            onChange={e => setConfig(prev => ({ ...prev, smtpSecure: e.target.checked }))}
            className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
          />
          <label htmlFor="smtp-secure" className="text-sm text-gray-700">
            Use SSL/TLS (port 465). Leave unchecked for STARTTLS (port 587).
          </label>
        </div>
      </div>

      {/* Authentication */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Authentication</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {textField('Username / Email', 'smtpUser', 'text', 'alerts@example.com')}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
              {config.hasPassword && !config.smtpPassword && (
                <span className="ml-2 text-xs text-gray-400">(saved — leave blank to keep)</span>
              )}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={config.smtpPassword}
                onChange={e => setConfig(prev => ({ ...prev, smtpPassword: e.target.value }))}
                placeholder={config.hasPassword ? '••••••••' : 'Enter password'}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sender Identity */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Sender Identity</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {textField('From Name', 'fromName', 'text', 'Historian Reports')}
          {textField('From Email', 'fromEmail', 'email', 'alerts@example.com')}
        </div>
        <p className="mt-2 text-xs text-gray-500">If left blank, the username above is used as the sender address.</p>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-gray-100">
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>{isSaving ? 'Saving…' : 'Save Configuration'}</span>
        </button>
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <input
            type="email"
            value={testRecipient}
            onChange={e => setTestRecipient(e.target.value)}
            placeholder="Test recipient email"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-full sm:w-52"
          />
          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting || !testRecipient}
            className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
            <span>{isTesting ? 'Testing…' : 'Send Test'}</span>
          </button>
        </div>
      </div>
    </form>
  );
};

// ── SMS tab ──────────────────────────────────────────────────────────────────

const SmsTab: React.FC = () => {
  const [config, setConfig] = useState<SmsConfig>(DEFAULT_SMS);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');
  const [showToken, setShowToken] = useState(false);
  const { success, error: toastError } = useToast();

  const loadConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/alerts/delivery-config/sms', { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.data) {
        setConfig({ ...DEFAULT_SMS, ...data.data, apiToken: '' });
      }
    } catch {
      // No config saved yet
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const payload: any = { ...config };
      if (!payload.apiToken) delete payload.apiToken;
      const res = await fetch('/api/alerts/delivery-config/sms', {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Save failed');
      success('Configuration saved', 'SMS settings have been updated.');
      setConfig(prev => ({ ...prev, apiToken: '', hasToken: true }));
    } catch (err: any) {
      toastError('Save failed', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testRecipient) { toastError('Enter a test phone number'); return; }
    try {
      setIsTesting(true);
      const res = await fetch('/api/alerts/delivery-config/sms/test', {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ testRecipient }),
      });
      const data = await res.json();
      if (data.success) success('Test SMS sent', `SMS sent to ${testRecipient}`);
      else toastError('Test failed', data.message || 'Could not send test SMS');
    } catch (err: any) {
      toastError('Test failed', err.message);
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading configuration...
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Enable toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div>
          <p className="text-sm font-semibold text-gray-900">Enable SMS Alerts</p>
          <p className="text-xs text-gray-500 mt-0.5">Send alert notifications via SMS through the notifications API</p>
        </div>
        <button
          type="button"
          onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
          className={cn(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
            config.enabled ? 'bg-primary-600' : 'bg-gray-300'
          )}
          aria-label="Toggle SMS alerts"
        >
          <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition-transform', config.enabled ? 'translate-x-6' : 'translate-x-1')} />
        </button>
      </div>

      {/* API Configuration */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Notifications API</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API URL</label>
            <input
              type="url"
              value={config.apiUrl}
              onChange={e => setConfig(prev => ({ ...prev, apiUrl: e.target.value }))}
              placeholder="https://notifications.example.com/api/publish/sms"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Token
              {config.hasToken && !config.apiToken && (
                <span className="ml-2 text-xs text-gray-400">(saved — leave blank to keep)</span>
              )}
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={config.apiToken}
                onChange={e => setConfig(prev => ({ ...prev, apiToken: e.target.value }))}
                placeholder={config.hasToken ? '••••••••' : 'Enter API token'}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <button
                type="button"
                onClick={() => setShowToken(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Toggle token visibility"
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Sent as the <code className="text-gray-600">X-TOKEN-AUTH</code> header.
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-gray-100">
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>{isSaving ? 'Saving…' : 'Save Configuration'}</span>
        </button>
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <input
            type="tel"
            value={testRecipient}
            onChange={e => setTestRecipient(e.target.value)}
            placeholder="+61400000000"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-full sm:w-44"
          />
          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting || !testRecipient}
            className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
            <span>{isTesting ? 'Testing…' : 'Send Test'}</span>
          </button>
        </div>
      </div>
    </form>
  );
};

// ── Shell ────────────────────────────────────────────────────────────────────

export const AlertDeliveryConfiguration: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'email' | 'sms'>('email');

  return (
    <div className="space-y-6">
      {/* Subtabs */}
      <div className="flex space-x-4 border-b border-gray-100">
        {(['email', 'sms'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex items-center space-x-2 pb-2 px-1 text-sm font-medium transition-colors border-b-2',
              activeTab === tab
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            )}
          >
            {tab === 'email' ? <Mail className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
            <span>{tab === 'email' ? 'Email Server' : 'SMS'}</span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {activeTab === 'email' ? <EmailTab /> : <SmsTab />}
      </div>
    </div>
  );
};

export default AlertDeliveryConfiguration;
