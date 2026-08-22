import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  ShieldCheck,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Loader2,
  KeyRound
} from 'lucide-react';
import { UserAccount } from '../types';

interface AccountManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUsername: string;
  onAccountSwitched: (account: UserAccount) => void;
}

export const AccountManagerModal: React.FC<AccountManagerModalProps> = ({
  isOpen,
  onClose,
  currentUsername,
  onAccountSwitched
}) => {
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [activeTab, setActiveTab] = useState<'list' | 'add_offline'>('list');
  const [offlineName, setOfflineName] = useState('');
  const [isLoggingInMs, setIsLoggingInMs] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const fetchAccounts = async () => {
    if (window.launcherAPI?.getAccounts) {
      try {
        const list = await window.launcherAPI.getAccounts();
        setAccounts(list);
      } catch (err) {
        console.warn('Error fetching accounts:', err);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAccounts();
      setActiveTab('list');
      setLoginError(null);
      setIsLoggingInMs(false);
    }
  }, [isOpen]);

  const handleSwitchAccount = async (account: UserAccount) => {
    if (window.launcherAPI?.setActiveAccount) {
      await window.launcherAPI.setActiveAccount(account.id);
      await fetchAccounts();
      onAccountSwitched(account);
      onClose();
    }
  };

  const handleRemoveAccount = async (accountId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('¿Estás seguro de que deseas eliminar esta cuenta del Launcher?')) {
      if (window.launcherAPI?.removeAccount) {
        await window.launcherAPI.removeAccount(accountId);
        await fetchAccounts();
      }
    }
  };

  const handleAddOfflineAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = offlineName.trim();
    if (!clean) return;

    if (window.launcherAPI?.addOfflineAccount) {
      const newAcc = await window.launcherAPI.addOfflineAccount(clean);
      setOfflineName('');
      await fetchAccounts();
      onAccountSwitched(newAcc);
      setActiveTab('list');
      onClose();
    }
  };

  const handleMicrosoftLogin = async () => {
    setIsLoggingInMs(true);
    setLoginError(null);

    try {
      if (window.launcherAPI?.loginMicrosoft) {
        const account = await window.launcherAPI.loginMicrosoft();
        await fetchAccounts();
        onAccountSwitched(account);
        onClose();
      }
    } catch (err: any) {
      setLoginError(err.message || 'Inicio de sesión cancelado o denegado');
    } finally {
      setIsLoggingInMs(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#121620] border border-mc-border/80 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scaleUp">
        {/* Header */}
        <div className="p-6 border-b border-mc-border/60 flex items-center justify-between bg-mc-darker/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-glow">
              <KeyRound className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                Gestor de Cuentas
                <span className="text-[10px] px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full font-bold border border-blue-500/30">
                  Dual Auth
                </span>
              </h3>
              <p className="text-xs text-slate-400">Microsoft Oficial (Premium) y Perfiles No-Premium</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {loginError && (
            <div className="flex items-center gap-2 p-3.5 bg-red-500/15 border border-red-500/30 text-red-300 rounded-2xl text-xs font-bold animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          {isLoggingInMs && (
            <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-2xl flex items-center justify-center gap-3 text-blue-300 text-xs font-bold animate-pulse">
              <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
              Iniciando sesión en la ventana oficial de Microsoft...
            </div>
          )}

          {/* Tabs */}
          {activeTab === 'list' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Cuentas Guardadas</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleMicrosoftLogin}
                    disabled={isLoggingInMs}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Cuenta Microsoft
                  </button>
                  <button
                    onClick={() => setActiveTab('add_offline')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-mc-darker hover:bg-white/10 text-slate-200 border border-mc-border rounded-xl text-xs font-bold transition-all active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    No-Premium
                  </button>
                </div>
              </div>

              {/* Accounts List */}
              <div className="space-y-2.5">
                {accounts.length === 0 ? (
                  <div className="bg-mc-darker/60 border border-dashed border-mc-border/80 rounded-2xl p-8 text-center space-y-3">
                    <User className="w-8 h-8 text-slate-500 mx-auto" />
                    <div>
                      <p className="text-sm font-bold text-slate-300">No hay cuentas guardadas</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Inicia sesión con tu cuenta oficial de Microsoft o crea un perfil No-Premium.
                      </p>
                    </div>
                  </div>
                ) : (
                  accounts.map((acc) => {
                    const isSelected = acc.active;
                    const avatarUrl =
                      acc.type === 'microsoft' && acc.uuid
                        ? `https://mc-heads.net/avatar/${encodeURIComponent(acc.uuid)}/64`
                        : `https://mc-heads.net/avatar/${encodeURIComponent(acc.username)}/64`;

                    return (
                      <div
                        key={acc.id}
                        onClick={() => handleSwitchAccount(acc)}
                        className={`group relative p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-blue-500/10 border-blue-500/50 shadow-glow'
                            : 'bg-mc-darker/80 border-mc-border/60 hover:border-slate-600 hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="relative shrink-0">
                            <img
                              src={avatarUrl}
                              alt={acc.username}
                              className="w-11 h-11 rounded-xl bg-black/40 border border-mc-border p-0.5 shadow-inner"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://minotar.net/helm/Steve/64.png';
                              }}
                            />
                            {acc.type === 'microsoft' && (
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-[#121620] flex items-center justify-center">
                                <ShieldCheck className="w-2.5 h-2.5 text-white" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-white truncate">{acc.username}</span>
                              {acc.type === 'microsoft' ? (
                                <span className="text-[10px] px-2 py-0.2 bg-blue-500/20 text-blue-300 rounded font-bold border border-blue-500/30">
                                  Microsoft Official
                                </span>
                              ) : (
                                <span className="text-[10px] px-2 py-0.2 bg-slate-500/20 text-slate-300 rounded font-bold border border-slate-500/30">
                                  No-Premium
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-slate-400 truncate block">
                              UUID: {acc.uuid ? `${acc.uuid.slice(0, 12)}...` : 'Local'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isSelected && (
                            <span className="flex items-center gap-1 text-xs font-bold text-blue-400 bg-blue-500/20 px-2.5 py-1 rounded-xl border border-blue-500/30">
                              <Check className="w-3.5 h-3.5" />
                              Activa
                            </span>
                          )}
                          <button
                            onClick={(e) => handleRemoveAccount(acc.id, e)}
                            className="w-8 h-8 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                            title="Eliminar cuenta"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Tab: Add Offline Account */}
          {activeTab === 'add_offline' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setActiveTab('list')}
                  className="text-xs font-bold text-slate-400 hover:text-white transition-colors"
                >
                  ← Volver a la lista
                </button>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Nuevo Perfil No-Premium</span>
              </div>

              <form onSubmit={handleAddOfflineAccount} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-2">Apodo de Jugador</label>
                  <input
                    type="text"
                    value={offlineName}
                    onChange={(e) => setOfflineName(e.target.value)}
                    placeholder="Ej. Rafa_Pro, Minecraftero..."
                    maxLength={20}
                    autoFocus
                    className="w-full bg-black/40 border border-mc-border focus:border-emerald-500 rounded-2xl px-4 py-3 text-sm font-bold text-white placeholder-slate-500 focus:outline-none transition-all shadow-inner"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!offlineName.trim()}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-2xl text-sm font-bold shadow-glow transition-all active:scale-95 disabled:opacity-50"
                >
                  Guardar Perfil No-Premium
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
