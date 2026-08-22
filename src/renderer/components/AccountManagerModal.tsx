import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  ShieldCheck,
  Plus,
  Trash2,
  Check,
  ExternalLink,
  Copy,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  KeyRound,
  Gamepad2
} from 'lucide-react';
import { UserAccount, DeviceCodeInfo } from '../types';

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
  const [activeTab, setActiveTab] = useState<'list' | 'add_microsoft' | 'add_offline'>('list');
  const [offlineName, setOfflineName] = useState('');
  const [deviceCodeInfo, setDeviceCodeInfo] = useState<DeviceCodeInfo | null>(null);
  const [isStartingMs, setIsStartingMs] = useState(false);
  const [isPollingMs, setIsPollingMs] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

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
      setPollError(null);
      setDeviceCodeInfo(null);
    } else {
      if (window.launcherAPI?.cancelMicrosoftLogin) {
        window.launcherAPI.cancelMicrosoftLogin();
      }
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

  const handleStartMicrosoftLogin = async () => {
    setIsStartingMs(true);
    setPollError(null);
    setDeviceCodeInfo(null);

    try {
      if (window.launcherAPI?.startMicrosoftLogin) {
        const info = await window.launcherAPI.startMicrosoftLogin();
        setDeviceCodeInfo(info);
        setIsStartingMs(false);
        setIsPollingMs(true);

        // Iniciar polling
        if (window.launcherAPI?.pollMicrosoftLogin) {
          const account = await window.launcherAPI.pollMicrosoftLogin(info.deviceCode, info.interval, info.expiresIn);
          setIsPollingMs(false);
          await fetchAccounts();
          onAccountSwitched(account);
          setActiveTab('list');
          onClose();
        }
      }
    } catch (err: any) {
      setIsStartingMs(false);
      setIsPollingMs(false);
      setPollError(err.message || 'Error durante la autenticación de Microsoft');
    }
  };

  const handleCopyCode = () => {
    if (!deviceCodeInfo?.userCode) return;
    navigator.clipboard.writeText(deviceCodeInfo.userCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleOpenBrowser = () => {
    if (deviceCodeInfo?.verificationUri) {
      window.open(deviceCodeInfo.verificationUri, '_blank');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#121620] border border-mc-border/80 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scaleUp">
        {/* Header */}
        <div className="p-6 border-b border-mc-border/60 flex items-center justify-between bg-mc-darker/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-glow">
              <KeyRound className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                Gestor de Cuentas
                <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full font-bold border border-emerald-500/30">
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
          {/* Tabs */}
          {activeTab === 'list' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Cuentas Guardadas</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setActiveTab('add_microsoft');
                      handleStartMicrosoftLogin();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow transition-all active:scale-95"
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
                      acc.skinUrl || `https://minotar.net/helm/${encodeURIComponent(acc.username)}/64.png`;

                    return (
                      <div
                        key={acc.id}
                        onClick={() => handleSwitchAccount(acc)}
                        className={`group relative p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-emerald-500/10 border-emerald-500/50 shadow-glow'
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
                            <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/20 px-2.5 py-1 rounded-xl border border-emerald-500/30">
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

          {/* Tab: Add Microsoft (Device Code Flow) */}
          {activeTab === 'add_microsoft' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setActiveTab('list');
                    if (window.launcherAPI?.cancelMicrosoftLogin) window.launcherAPI.cancelMicrosoftLogin();
                  }}
                  className="text-xs font-bold text-slate-400 hover:text-white transition-colors"
                >
                  ← Volver a la lista
                </button>
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                  Inicio Seguro de Microsoft
                </span>
              </div>

              {isStartingMs ? (
                <div className="p-10 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
                  <p className="text-sm font-bold text-white">Generando código de autenticación seguro...</p>
                </div>
              ) : deviceCodeInfo ? (
                <div className="bg-mc-darker/90 border border-mc-border/80 rounded-2xl p-6 space-y-5">
                  <div className="text-center space-y-2">
                    <p className="text-xs text-slate-300">
                      1. Copia tu código de verificación temporal e inicia sesión en la web oficial de Microsoft:
                    </p>

                    {/* Big Code Box */}
                    <div className="flex items-center justify-center gap-3 bg-black/60 border border-blue-500/40 rounded-2xl p-4 my-2">
                      <span className="text-2xl font-mono font-black text-blue-400 tracking-widest select-all">
                        {deviceCodeInfo.userCode}
                      </span>
                      <button
                        onClick={handleCopyCode}
                        className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
                      >
                        {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        {copiedCode ? '¡Copiado!' : 'Copiar'}
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-400">
                      Válido por {Math.floor(deviceCodeInfo.expiresIn / 60)} minutos
                    </p>
                  </div>

                  <div className="pt-2 flex flex-col gap-2.5">
                    <button
                      onClick={handleOpenBrowser}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-sm font-black shadow-glow transition-all active:scale-95"
                    >
                      <ExternalLink className="w-4 h-4" />
                      2. Abrir Microsoft Login (microsoft.com/link)
                    </button>
                  </div>

                  {/* Polling Live Indicator */}
                  {isPollingMs && (
                    <div className="flex items-center justify-center gap-2 text-xs text-amber-300 font-bold bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                      Esperando que autorices el acceso en el navegador...
                    </div>
                  )}
                </div>
              ) : null}

              {pollError && (
                <div className="flex items-center gap-2 p-3.5 bg-red-500/15 border border-red-500/30 text-red-300 rounded-2xl text-xs font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{pollError}</span>
                </div>
              )}
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
