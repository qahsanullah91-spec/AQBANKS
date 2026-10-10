import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import {
  ShieldAlert,
  Users,
  Settings,
  ShieldCheck,
  Building2,
  RefreshCw,
  Key
} from 'lucide-react';

export const Admin: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const [users, setUsers] = useState<any[]>([]);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [uRes, aRes] = await Promise.all([
        api.getUsers().catch(() => []),
        api.getAuditEvents().catch(() => ({ events: [] }))
      ]);
      setUsers(uRes);
      setAuditEvents(aRes.events || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white tracking-tight">{t('admin.heading')}</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          {t('admin.headingSubtitle')}
        </p>
      </div>

      {/* Authorized Users & Role Governance */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-400" /> {t('admin.usersHeading')}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className={`py-2.5 px-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('admin.name')}</th>
                <th className={`py-2.5 px-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('admin.email')}</th>
                <th className={`py-2.5 px-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('admin.role')}</th>
                <th className={`py-2.5 px-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('admin.active')}</th>
                <th className={`py-2.5 px-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('admin.createdAt')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-800/40">
                  <td className="py-2.5 px-3 font-semibold text-white">{u.firstName} {u.lastName}</td>
                  <td className="py-2.5 px-3 text-slate-300 font-mono text-[11px]" dir="ltr">{u.email}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                      {u.roles.join(', ')}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-emerald-400 font-medium">{t('admin.activeStatus')}</td>
                  <td className="py-2.5 px-3 text-slate-500" dir="ltr">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compliance Audit Trail */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" /> {t('admin.auditHeading')}
          </h2>
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs border border-slate-700"
          >
            <RefreshCw className="w-3 h-3" /> {t('common.refresh')}
          </button>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {auditEvents.length > 0 ? (
            auditEvents.map(evt => (
              <div key={evt.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono">
                <div className="flex justify-between items-center text-slate-300 font-sans">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> {evt.action}
                  </span>
                  <span className="text-slate-500 text-[11px]" dir="ltr">
                    {new Date(evt.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  {t('admin.actor')}: <strong className="text-slate-200" dir="ltr">{evt.actor?.email || 'SYSTEM'}</strong> • {t('admin.entity')}: <strong className="text-slate-300" dir="ltr">{evt.entityType}</strong>
                </div>
                {evt.newValuesJson && (
                  <pre className="mt-1.5 p-2 bg-slate-900 rounded text-[10px] text-slate-400 overflow-x-auto" dir="ltr">
                    {evt.newValuesJson}
                  </pre>
                )}
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500 py-4 text-center">{t('admin.noEvents')}</p>
          )}
        </div>
      </div>
    </div>
  );
};

