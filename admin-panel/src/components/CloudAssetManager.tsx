import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import {
  Upload,
  Cloud,
  FolderArchive,
  FileCode,
  Sparkles,
  Trash2,
  Download,
  Key,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Layers,
  FileText,
  Save,
  Search,
  ShieldCheck,
  Server,
  Settings,
  Plus,
  Copy,
  ToggleLeft,
  ToggleRight,
  Check,
  Edit3,
  FilePlus,
  Palette,
  ExternalLink
} from 'lucide-react';
import { gitHubStorage, GitHubAsset } from '../github-storage';
import { supabase, RemoteInstance, ModpackMod, Shaderpack } from '../supabase';

interface ConfigItem {
  id?: string;
  name: string;
  path: string;
  content: string;
  downloadUrl?: string;
}

export const CloudAssetManager: React.FC = () => {
  // Navigation & Instances state
  const [instances, setInstances] = useState<RemoteInstance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('atm10');
  const [selectedInstance, setSelectedInstance] = useState<RemoteInstance | null>(null);
  const [isEditingParams, setIsEditingParams] = useState(false);
  const [instanceParamsDraft, setInstanceParamsDraft] = useState<Partial<RemoteInstance>>({});

  // Tabs & Security state
  const [activeTab, setActiveTab] = useState<'mods' | 'modpack_zip' | 'configs' | 'shaders' | 'manifest'>('mods');
  const [token, setToken] = useState(gitHubStorage.getToken());
  const [repo, setRepo] = useState(gitHubStorage.getRepo());
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Mods list state (from Supabase & GitHub)
  const [mods, setMods] = useState<ModpackMod[]>([]);
  const [uploadStatus, setUploadStatus] = useState<{ [key: string]: { percent: number; status: string } }>({});

  // Modpack .ZIP Extractor state
  const [zipFiles, setZipFiles] = useState<{ name: string; path: string; size: number; file: JSZip.JSZipObject }[]>([]);
  const [zipTotalSize, setZipTotalSize] = useState(0);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isBatchUploading, setIsBatchUploading] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, currentFile: '' });

  // Configs state
  const [configsList, setConfigsList] = useState<ConfigItem[]>([]);
  const [activeConfigIndex, setActiveConfigIndex] = useState(0);
  const [configDraft, setConfigDraft] = useState('');
  const [configSavedNotice, setConfigSavedNotice] = useState(false);
  const [isCreatingConfig, setIsCreatingConfig] = useState(false);
  const [newConfigPath, setNewConfigPath] = useState('');

  // Shaders & Textures state
  const [shadersList, setShadersList] = useState<Shaderpack[]>([]);
  const [isAddingShaderModal, setIsAddingShaderModal] = useState(false);
  const [newShaderName, setNewShaderName] = useState('');
  const [newShaderDesc, setNewShaderDesc] = useState('');
  const [newShaderTier, setNewShaderTier] = useState<'fast' | 'balanced' | 'ultra'>('balanced');
  const [newShaderUrl, setNewShaderUrl] = useState('');
  const [newShaderFile, setNewShaderFile] = useState('');

  // Load instances from Supabase
  const loadInstances = async (targetId?: string) => {
    try {
      let { data, error } = await supabase.from('instances').select('*').order('created_at', { ascending: true });
      if (error || !data || data.length === 0) {
        const alt = await supabase.from('remote_instances').select('*').order('created_at', { ascending: true });
        if (!alt.error && alt.data) data = alt.data;
      }

      if (data && data.length > 0) {
        setInstances(data);
        const wantedId = targetId || selectedInstanceId;
        const current = data.find((inst) => inst.id === wantedId) || data[0];
        setSelectedInstanceId(current.id);
        setSelectedInstance(current);
        setInstanceParamsDraft(current);
        await loadInstanceData(current.id);
      }
    } catch (err: any) {
      console.warn('Error cargando instancias:', err.message);
    }
  };

  useEffect(() => {
    loadInstances();
  }, []);

  const handleSelectInstance = (newId: string) => {
    setSelectedInstanceId(newId);
    const inst = instances.find((i) => i.id === newId);
    if (inst) {
      setSelectedInstance(inst);
      setInstanceParamsDraft(inst);
      // Limpiar inmediatamente estado de la instancia anterior para evitar contaminación cruzada
      setMods([]);
      setConfigsList([]);
      setShadersList([]);
      setActiveConfigIndex(0);
      setConfigDraft('');
      setSearchTerm('');
      loadInstanceData(newId);
    }
  };

  useEffect(() => {
    if (configsList[activeConfigIndex]) {
      setConfigDraft(configsList[activeConfigIndex].content);
    } else {
      setConfigDraft('');
    }
  }, [activeConfigIndex, configsList]);

  // Load mods, configs and shaders strictly for the selected instance
  const loadInstanceData = async (instanceId: string) => {
    setIsLoading(true);
    try {
      // 1. Fetch all items from modpack_mods for this specific instance
      const { data: modsData, error: modsError } = await supabase
        .from('modpack_mods')
        .select('*')
        .eq('instance_id', instanceId)
        .order('mod_name', { ascending: true });

      if (!modsError && modsData) {
        // Mods tab: only actual mods (.jar or category === 'mod'/'mods')
        const modsOnly = modsData.filter(
          (m) =>
            (m.category === 'mod' || m.category === 'mods' || !m.category) &&
            !m.file_path.startsWith('config/') &&
            !m.file_path.startsWith('defaultconfigs/') &&
            !m.file_path.startsWith('shaderpacks/') &&
            (m.file_name.endsWith('.jar') || m.file_path.startsWith('mods/'))
        );
        setMods(modsOnly);

        // Configs tab: actual config files for this instance
        const configsFromDb = modsData.filter(
          (m) =>
            m.category === 'config' ||
            m.category === 'configs' ||
            m.file_path.startsWith('config/') ||
            m.file_path.startsWith('defaultconfigs/') ||
            m.file_path.startsWith('kubejs/') ||
            m.file_name.endsWith('.toml') ||
            m.file_name.endsWith('.json') ||
            m.file_name.endsWith('.snbt') ||
            m.file_name.endsWith('.cfg') ||
            m.file_name.endsWith('.ini')
        );

        const loadedConfigs: ConfigItem[] = await Promise.all(
          configsFromDb.map(async (c) => {
            let text = '';
            if (c.download_url) {
              try {
                const res = await fetch(c.download_url);
                if (res.ok) text = await res.text();
              } catch {}
            }
            return {
              id: c.id,
              name: c.file_name,
              path: c.file_path || `config/${c.file_name}`,
              content: text || `# Configuración: ${c.file_name}\n`,
              downloadUrl: c.download_url
            };
          })
        );

        setConfigsList(loadedConfigs);
        setActiveConfigIndex(0);
        if (loadedConfigs.length > 0) {
          setConfigDraft(loadedConfigs[0].content);
        } else {
          setConfigDraft('');
        }

        // Shaders tab: shaders belonging to this instance
        const shadersFromMods = modsData.filter(
          (m) =>
            m.category === 'shaders' ||
            m.category === 'shader' ||
            m.file_path.startsWith('shaderpacks/') ||
            (m.file_name.endsWith('.zip') && !m.file_path.startsWith('mods/'))
        );

        const instanceShaders: Shaderpack[] = shadersFromMods.map((s) => ({
          id: s.id,
          name: s.mod_name || s.file_name.replace(/\.zip$/i, ''),
          description: `Shaderpack de ${instanceId}`,
          performance_tier: 'balanced',
          download_url: s.download_url,
          file_name: s.file_name,
          file_size: Number(s.file_size) || 0,
          is_active: s.is_enabled
        }));

        // Query shaderpacks strictly belonging to this specific instance
        const { data: shaderTableData } = await supabase
          .from('shaderpacks')
          .select('*')
          .eq('instance_id', instanceId)
          .order('name', { ascending: true });

        const mergedShaders = [...instanceShaders];
        if (shaderTableData) {
          shaderTableData.forEach((st) => {
            if (!mergedShaders.some((s) => s.file_name === st.file_name)) {
              mergedShaders.push(st);
            }
          });
        }
        setShadersList(mergedShaders);
      } else {
        setMods([]);
        setConfigsList([]);
        setShadersList([]);
      }
    } catch (err) {
      console.warn(`Error cargando datos para ${instanceId}:`, err);
    } finally {
      setIsLoading(false);
    }
  };

  // Save instance parameters
  const handleSaveInstanceParams = async () => {
    if (!selectedInstance) return;
    try {
      setIsLoading(true);
      const payload = {
        name: instanceParamsDraft.name,
        description: instanceParamsDraft.description,
        minecraft_version: instanceParamsDraft.minecraft_version,
        mod_loader: instanceParamsDraft.mod_loader,
        mod_loader_version: instanceParamsDraft.mod_loader_version,
        custom_ram: Number(instanceParamsDraft.custom_ram) || 8192,
        server_ip: instanceParamsDraft.server_ip,
        server_port: Number(instanceParamsDraft.server_port) || 25565,
        updated_at: new Date().toISOString()
      };

      let { error } = await supabase.from('instances').update(payload).eq('id', selectedInstance.id);
      if (error) {
        const alt = await supabase.from('remote_instances').update(payload).eq('id', selectedInstance.id);
        if (alt.error) throw alt.error;
      }

      alert(`✅ ¡Parámetros de la instancia "${instanceParamsDraft.name}" actualizados con éxito!`);
      setIsEditingParams(false);
      await loadInstances();
    } catch (err: any) {
      alert(`Error actualizando parámetros: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Upload single / bulk files to GitHub CDN + Supabase
  const handleFileUpload = async (files: FileList | null, category = 'mods') => {
    if (!files || files.length === 0 || !selectedInstance) return;
    const releaseTag = `modpack-${selectedInstance.id}-assets`;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file.name;
      setUploadStatus((prev) => ({ ...prev, [fileName]: { percent: 5, status: 'Iniciando subida...' } }));

      try {
        const uploaded = await gitHubStorage.uploadAsset(
          file,
          (fName, percent, status) => {
            setUploadStatus((prev) => ({ ...prev, [fName]: { percent, status } }));
          },
          releaseTag
        );

        // Register in Supabase modpack_mods table
        const modName = fileName.replace(/\.(jar|zip|toml|json|snbt|cfg)$/i, '').replace(/[-_]/g, ' ');
        const filePath = category === 'shaders' ? `shaderpacks/${fileName}` : category === 'config' ? `config/${fileName}` : `mods/${fileName}`;

        const { error } = await supabase.from('modpack_mods').upsert(
          {
            instance_id: selectedInstance.id,
            mod_name: modName,
            file_name: fileName,
            file_path: filePath,
            file_size: uploaded.size,
            sha1: uploaded.sha1,
            download_url: uploaded.url,
            is_enabled: true,
            category: category
          },
          { onConflict: 'instance_id,file_name' }
        );

        if (error) console.warn('Aviso registrando en Supabase:', error.message);

        // If shader, also upsert to shaderpacks table
        if (category === 'shaders') {
          await supabase.from('shaderpacks').upsert({
            id: fileName.replace(/\.zip$/i, '').toLowerCase().replace(/[^a-z0-9]/g, '-'),
            name: modName,
            description: `Shaderpack optimizado para ${selectedInstance.name}`,
            performance_tier: 'balanced',
            download_url: uploaded.url,
            file_name: fileName,
            file_size: uploaded.size,
            is_active: true
          });
        }
      } catch (err: any) {
        setUploadStatus((prev) => ({
          ...prev,
          [fileName]: { percent: 0, status: `❌ Error: ${err.message}` }
        }));
      }
    }

    await loadInstanceData(selectedInstance.id);
  };

  // Toggle mod enabled/disabled
  const handleToggleMod = async (mod: ModpackMod) => {
    try {
      const nextState = !mod.is_enabled;
      const { error } = await supabase
        .from('modpack_mods')
        .update({ is_enabled: nextState })
        .eq('id', mod.id);

      if (error) throw error;
      setMods((prev) => prev.map((m) => (m.id === mod.id ? { ...m, is_enabled: nextState } : m)));
    } catch (err: any) {
      alert(`Error cambiando estado del mod: ${err.message}`);
    }
  };

  // Delete a mod from Supabase and GitHub
  const handleDeleteMod = async (mod: ModpackMod) => {
    if (!confirm(`¿Estás seguro de eliminar "${mod.file_name}" de esta instancia?`)) return;
    const releaseTag = `modpack-${selectedInstanceId}-assets`;

    try {
      await supabase.from('modpack_mods').delete().eq('id', mod.id);
      await gitHubStorage.deleteAssetIfExists(mod.file_name, releaseTag);
      setMods((prev) => prev.filter((m) => m.id !== mod.id));
    } catch (err: any) {
      alert(`Error eliminando archivo: ${err.message}`);
    }
  };

  // Process .ZIP Modpack drop
  const handleZipFileDrop = async (file: File) => {
    if (!file.name.endsWith('.zip')) {
      alert('Por favor, selecciona un archivo comprimido .ZIP válido.');
      return;
    }

    setIsExtracting(true);
    setZipFiles([]);

    try {
      const zip = new JSZip();
      const zipData = await zip.loadAsync(file);
      const extracted: { name: string; path: string; size: number; file: JSZip.JSZipObject }[] = [];
      let totalBytes = 0;

      for (const [relativePath, zipEntry] of Object.entries(zipData.files)) {
        if (!zipEntry.dir) {
          const isEligible =
            relativePath.startsWith('mods/') ||
            relativePath.startsWith('config/') ||
            relativePath.startsWith('defaultconfigs/') ||
            relativePath.startsWith('kubejs/') ||
            relativePath.startsWith('shaderpacks/') ||
            relativePath.endsWith('.jar') ||
            relativePath.endsWith('.json') ||
            relativePath.endsWith('.toml') ||
            relativePath.endsWith('.snbt') ||
            relativePath.endsWith('.cfg');

          if (isEligible) {
            const fileName = relativePath.split('/').pop() || relativePath;
            extracted.push({
              name: fileName,
              path: relativePath,
              size: 50000,
              file: zipEntry
            });
            totalBytes += 50000;
          }
        }
      }

      setZipFiles(extracted);
      setZipTotalSize(totalBytes);
    } catch (err: any) {
      alert(`Error leyendo el archivo ZIP: ${err.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  // Upload Extracted ZIP contents to GitHub CDN + Supabase
  const handleUploadZipContents = async () => {
    if (!zipFiles.length || !selectedInstance) return;
    setIsBatchUploading(true);
    setBatchProgress({ current: 0, total: zipFiles.length, currentFile: '' });
    const releaseTag = `modpack-${selectedInstance.id}-assets`;

    try {
      for (let i = 0; i < zipFiles.length; i++) {
        const item = zipFiles[i];
        setBatchProgress({ current: i + 1, total: zipFiles.length, currentFile: item.name });

        const arrayBuffer = await item.file.async('arraybuffer');
        const uploaded = await gitHubStorage.uploadAsset(
          { name: item.name, buffer: arrayBuffer },
          undefined,
          releaseTag
        );

        let category = 'mods';
        if (item.path.startsWith('shaderpacks/')) category = 'shaders';
        else if (
          item.path.startsWith('config/') ||
          item.path.startsWith('defaultconfigs/') ||
          item.path.startsWith('kubejs/') ||
          item.name.endsWith('.toml') ||
          item.name.endsWith('.cfg') ||
          item.name.endsWith('.snbt')
        ) {
          category = 'config';
        }

        // Insert into modpack_mods table
        await supabase.from('modpack_mods').upsert(
          {
            instance_id: selectedInstance.id,
            mod_name: item.name.replace(/\.(jar|zip|toml|json|snbt|cfg)$/i, '').replace(/[-_]/g, ' '),
            file_name: item.name,
            file_path: item.path,
            file_size: uploaded.size,
            sha1: uploaded.sha1,
            download_url: uploaded.url,
            is_enabled: true,
            category: category
          },
          { onConflict: 'instance_id,file_name' }
        );

        if (category === 'shaders') {
          await supabase.from('shaderpacks').upsert({
            id: item.name.replace(/\.zip$/i, '').toLowerCase().replace(/[^a-z0-9]/g, '-'),
            name: item.name.replace(/\.zip$/i, ''),
            description: `Shaderpack de ${selectedInstance.name}`,
            performance_tier: 'balanced',
            download_url: uploaded.url,
            file_name: item.name,
            file_size: uploaded.size,
            is_active: true
          });
        }
      }

      alert(`✅ ¡${zipFiles.length} archivos subidos y clasificados con éxito en "${selectedInstance.name}"!`);
      setZipFiles([]);
      await loadInstanceData(selectedInstance.id);
    } catch (err: any) {
      alert(`Error durante la subida masiva: ${err.message}`);
    } finally {
      setIsBatchUploading(false);
    }
  };

  // Save current config file text content
  const handleSaveCurrentConfig = async () => {
    if (!selectedInstance || !configsList[activeConfigIndex]) return;
    const currentCfg = configsList[activeConfigIndex];
    setIsLoading(true);
    const releaseTag = `modpack-${selectedInstance.id}-assets`;

    try {
      const blob = new Blob([configDraft], { type: 'text/plain;charset=utf-8' });
      const file = new File([blob], currentCfg.name.split('/').pop() || currentCfg.name);

      const uploaded = await gitHubStorage.uploadAsset(file, undefined, releaseTag);

      await supabase.from('modpack_mods').upsert(
        {
          instance_id: selectedInstance.id,
          mod_name: currentCfg.name,
          file_name: currentCfg.name.split('/').pop() || currentCfg.name,
          file_path: currentCfg.path,
          file_size: uploaded.size,
          sha1: uploaded.sha1,
          download_url: uploaded.url,
          is_enabled: true,
          category: 'config'
        },
        { onConflict: 'instance_id,file_name' }
      );

      const updated = [...configsList];
      updated[activeConfigIndex].content = configDraft;
      updated[activeConfigIndex].downloadUrl = uploaded.url;
      setConfigsList(updated);

      setConfigSavedNotice(true);
      setTimeout(() => setConfigSavedNotice(false), 3000);
    } catch (err: any) {
      alert(`Error guardando configuración: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Create brand new config file
  const handleCreateNewConfigFile = async () => {
    if (!newConfigPath.trim() || !selectedInstance) return;
    const cleanPath = newConfigPath.startsWith('config/') ? newConfigPath.trim() : `config/${newConfigPath.trim()}`;
    const fileName = cleanPath.split('/').pop() || cleanPath;

    const newEntry: ConfigItem = {
      name: fileName,
      path: cleanPath,
      content: `# Configuración: ${fileName}\n`
    };

    const nextList = [newEntry, ...configsList];
    setConfigsList(nextList);
    setActiveConfigIndex(0);
    setConfigDraft(newEntry.content);
    setIsCreatingConfig(false);
    setNewConfigPath('');
  };

  // Delete config file
  const handleDeleteConfig = async (cfg: ConfigItem, index: number) => {
    if (!confirm(`¿Estás seguro de eliminar el archivo "${cfg.name}"?`)) return;
    if (cfg.id) {
      await supabase.from('modpack_mods').delete().eq('id', cfg.id);
    }
    const nextList = configsList.filter((_, idx) => idx !== index);
    setConfigsList(nextList);
    setActiveConfigIndex(Math.max(0, index - 1));
  };

  // Add Manual Shaderpack
  const handleAddManualShader = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShaderName.trim() || !newShaderUrl.trim()) return;

    try {
      const id = newShaderName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const fileName = newShaderFile || `${id}.zip`;
      const { error } = await supabase.from('shaderpacks').insert({
        id: `${id}-${Date.now().toString().slice(-4)}`,
        name: newShaderName,
        description: newShaderDesc || 'Shaderpack personalizado',
        performance_tier: newShaderTier,
        download_url: newShaderUrl,
        file_name: fileName,
        file_size: 15000000,
        is_active: true
      });

      if (error) throw error;

      if (selectedInstance) {
        await supabase.from('modpack_mods').insert({
          instance_id: selectedInstance.id,
          mod_name: newShaderName,
          file_name: fileName,
          file_path: `shaderpacks/${fileName}`,
          file_size: 15000000,
          sha1: '',
          download_url: newShaderUrl,
          is_enabled: true,
          category: 'shaders'
        });
      }
      alert('✅ Shaderpack registrado con éxito');
      setIsAddingShaderModal(false);
      setNewShaderName('');
      setNewShaderDesc('');
      setNewShaderUrl('');
      setNewShaderFile('');
      if (selectedInstance) loadInstanceData(selectedInstance.id);
    } catch (err: any) {
      alert(`Error al registrar shader: ${err.message}`);
    }
  };

  // Toggle Shader Active
  const handleToggleShader = async (shader: Shaderpack) => {
    try {
      const nextState = !shader.is_active;
      // 1. Update shaderpacks table
      await supabase.from('shaderpacks').update({ is_active: nextState }).eq('id', shader.id);
      // 2. Also update in modpack_mods if stored there
      await supabase
        .from('modpack_mods')
        .update({ is_enabled: nextState })
        .or(`id.eq.${shader.id},file_name.eq.${shader.file_name}`);

      setShadersList((prev) => prev.map((s) => (s.id === shader.id ? { ...s, is_active: nextState } : s)));
    } catch (err: any) {
      alert(`Error al cambiar estado del shader: ${err.message}`);
    }
  };

  // Delete Shader
  const handleDeleteShader = async (shader: Shaderpack) => {
    if (!confirm(`¿Estás seguro de eliminar el shader "${shader.name}"?`)) return;
    try {
      await supabase.from('shaderpacks').delete().eq('id', shader.id);
      await supabase
        .from('modpack_mods')
        .delete()
        .or(`id.eq.${shader.id},file_name.eq.${shader.file_name}`);

      setShadersList((prev) => prev.filter((s) => s.id !== shader.id));
    } catch (err: any) {
      alert(`Error al eliminar shader: ${err.message}`);
    }
  };

  // Broadcast Realtime Update Signal & Save Generated Manifest
  const handleBroadcastSync = async () => {
    if (!selectedInstance) return;
    setIsLoading(true);

    try {
      // 1. Update instance timestamp in instances table
      const { error: instErr } = await supabase
        .from('instances')
        .update({
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedInstance.id);

      if (instErr) {
        console.warn('Aviso actualizando timestamp de instancia:', instErr.message);
      }

      // 2. Update launcher_config timestamp to notify all connected launcher clients in realtime
      const { error: cfgErr } = await supabase
        .from('launcher_config')
        .update({
          updated_at: new Date().toISOString()
        })
        .eq('id', 'global');

      if (cfgErr) {
        console.warn('Aviso actualizando launcher_config:', cfgErr.message);
      }

      alert(`🚀 ¡Instancia "${selectedInstance.name}" sincronizada en tiempo real con todos los jugadores!`);
    } catch (err: any) {
      alert(`Error sincronizando: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Clone instance
  const handleCloneInstance = async () => {
    if (!selectedInstance) return;
    const newId = prompt('Introduce el ID para la nueva instancia clonada (ej: atm10-test):', `${selectedInstance.id}-copia`);
    if (!newId || newId.trim() === '') return;

    try {
      setIsLoading(true);
      const cleanId = newId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      const newInstancePayload = {
        id: cleanId,
        name: `${selectedInstance.name} (Copia)`,
        description: selectedInstance.description,
        minecraft_version: selectedInstance.minecraft_version,
        mod_loader: selectedInstance.mod_loader,
        mod_loader_version: selectedInstance.mod_loader_version,
        custom_ram: selectedInstance.custom_ram,
        server_ip: selectedInstance.server_ip,
        server_port: selectedInstance.server_port,
        icon: selectedInstance.icon,
        is_official: false,
        is_default: false,
        is_active: true
      };

      let { error } = await supabase.from('instances').insert(newInstancePayload);
      if (error) {
        await supabase.from('remote_instances').insert(newInstancePayload);
      }

      // Clone ALL files (mods, configs, shaders) from selectedInstance to the new instance
      const { data: allInstanceFiles } = await supabase
        .from('modpack_mods')
        .select('*')
        .eq('instance_id', selectedInstance.id);

      if (allInstanceFiles && allInstanceFiles.length > 0) {
        const clonedFiles = allInstanceFiles.map((m) => ({
          instance_id: cleanId,
          mod_name: m.mod_name,
          file_name: m.file_name,
          file_path: m.file_path,
          file_size: m.file_size,
          sha1: m.sha1,
          download_url: m.download_url,
          is_enabled: m.is_enabled,
          category: m.category
        }));
        await supabase.from('modpack_mods').insert(clonedFiles);
      }

      alert(`🎉 ¡Instancia clonada exitosamente como "${cleanId}" con todos sus mods, configs y shaders!`);
      await loadInstances(cleanId);
    } catch (err: any) {
      alert(`Error clonando instancia: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredMods = mods.filter(
    (m) =>
      m.mod_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.file_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & Multi-Instance Selector */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-indigo-500/20 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/20 border border-indigo-500/40 rounded-2xl text-indigo-400 shadow-inner">
              <Cloud className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white tracking-wide">
                  Almacenamiento Ilimitado de Modpacks
                </h2>
                <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> CDN 100% Gratis
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Sube modpacks enteros, mods, configs y shaders con distribución ultrarrápida.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCloneInstance}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
              title="Clonar este modpack completo a una nueva instancia"
            >
              <Copy className="w-3.5 h-3.5 text-indigo-400" />
              Clonar Instancia
            </button>

            <button
              onClick={handleBroadcastSync}
              disabled={isLoading}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg active:scale-95 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Publicar y Sincronizar en Vivo
            </button>
          </div>
        </div>

        {/* Active Instance Header Control */}
        <div className="mt-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Server className="w-4 h-4 text-indigo-400" /> Instancia Activa:
            </span>

            <select
              value={selectedInstanceId}
              onChange={(e) => handleSelectInstance(e.target.value)}
              className="bg-slate-950 border border-indigo-500/40 text-white font-bold text-sm rounded-xl px-3.5 py-2 outline-none focus:border-indigo-400 transition-all cursor-pointer shadow-inner"
            >
              {instances.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name} ({inst.mod_loader.toUpperCase()} {inst.minecraft_version})
                </option>
              ))}
            </select>

            <button
              onClick={() => selectedInstance && loadInstanceData(selectedInstance.id)}
              disabled={isLoading}
              className="p-2 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-xl transition-all"
              title="Refrescar datos de la instancia seleccionada"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>

            <button
              onClick={() => setIsEditingParams(!isEditingParams)}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                isEditingParams
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              {isEditingParams ? 'Cerrar Parámetros' : 'Editar Parámetros'}
            </button>
          </div>

          {selectedInstance && (
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300 font-mono">
                Minecraft: <strong className="text-indigo-400">{selectedInstance.minecraft_version}</strong>
              </span>
              <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300 font-mono">
                Loader: <strong className="text-purple-400">{selectedInstance.mod_loader} {selectedInstance.mod_loader_version}</strong>
              </span>
              <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300 font-mono">
                RAM: <strong className="text-teal-400">{selectedInstance.custom_ram || 8192} MB</strong>
              </span>
            </div>
          )}
        </div>

        {/* Quick Parameters Editor Drawer */}
        {isEditingParams && selectedInstance && (
          <div className="mt-5 p-5 bg-slate-950 border border-indigo-500/30 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-400" />
                Configurar Parámetros de "{selectedInstance.name}"
              </h3>
              <button
                onClick={handleSaveInstanceParams}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
              >
                <Save className="w-3.5 h-3.5" />
                Guardar Cambios
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nombre</label>
                <input
                  type="text"
                  value={instanceParamsDraft.name || ''}
                  onChange={(e) => setInstanceParamsDraft({ ...instanceParamsDraft, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Versión MC</label>
                <input
                  type="text"
                  value={instanceParamsDraft.minecraft_version || ''}
                  onChange={(e) => setInstanceParamsDraft({ ...instanceParamsDraft, minecraft_version: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mod Loader</label>
                <select
                  value={instanceParamsDraft.mod_loader || 'neoforge'}
                  onChange={(e) => setInstanceParamsDraft({ ...instanceParamsDraft, mod_loader: e.target.value as any })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="neoforge">NeoForge</option>
                  <option value="forge">Forge</option>
                  <option value="fabric">Fabric</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Versión Loader</label>
                <input
                  type="text"
                  value={instanceParamsDraft.mod_loader_version || ''}
                  onChange={(e) => setInstanceParamsDraft({ ...instanceParamsDraft, mod_loader_version: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">RAM (MB)</label>
                <input
                  type="number"
                  value={instanceParamsDraft.custom_ram || 8192}
                  onChange={(e) => setInstanceParamsDraft({ ...instanceParamsDraft, custom_ram: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">IP Servidor</label>
                <input
                  type="text"
                  value={instanceParamsDraft.server_ip || ''}
                  onChange={(e) => setInstanceParamsDraft({ ...instanceParamsDraft, server_ip: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Puerto</label>
                <input
                  type="number"
                  value={instanceParamsDraft.server_port || 25565}
                  onChange={(e) => setInstanceParamsDraft({ ...instanceParamsDraft, server_port: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Descripción</label>
                <input
                  type="text"
                  value={instanceParamsDraft.description || ''}
                  onChange={(e) => setInstanceParamsDraft({ ...instanceParamsDraft, description: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('mods')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'mods' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" /> Mods ({mods.length})
        </button>
        <button
          onClick={() => setActiveTab('modpack_zip')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'modpack_zip' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          <FolderArchive className="w-4 h-4" /> Extractor .ZIP
        </button>
        <button
          onClick={() => setActiveTab('configs')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'configs' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileCode className="w-4 h-4" /> Editor de Configs ({configsList.length})
        </button>
        <button
          onClick={() => setActiveTab('shaders')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'shaders' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4" /> Shaders y Texturas ({shadersList.length})
        </button>
        <button
          onClick={() => setActiveTab('manifest')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
            activeTab === 'manifest' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" /> Manifiesto JSON
        </button>
      </div>

      {/* TAB 1: MODS */}
      {activeTab === 'mods' && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 border-2 border-dashed border-indigo-500/30 hover:border-indigo-500/60 rounded-3xl p-8 text-center transition-all group">
            <input type="file" multiple accept=".jar" id="mod-upload-input" className="hidden" onChange={(e) => handleFileUpload(e.target.files, 'mods')} />
            <label htmlFor="mod-upload-input" className="cursor-pointer flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Upload className="w-8 h-8" />
              </div>
              <h3 className="text-base font-black text-white">Arrastra mods (.JAR) para {selectedInstance?.name}</h3>
              <p className="text-xs text-slate-400 max-w-md">Se subirán directamente al CDN de GitHub Releases con hashes SHA-1 calculados automáticamente.</p>
              <span className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md">Examinar Archivos .JAR</span>
            </label>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar mods instalados..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white outline-none focus:border-indigo-500"
              />
            </div>
            <span className="text-xs text-slate-400 font-mono font-bold">Total: {filteredMods.length} mods</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Nombre del Mod</th>
                  <th className="px-6 py-4">Archivo</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredMods.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      No hay mods registrados en esta instancia. ¡Sube tus archivos .jar arriba o extrae un modpack .zip!
                    </td>
                  </tr>
                ) : (
                  filteredMods.map((mod) => (
                    <tr key={mod.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleMod(mod)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                            mod.is_enabled
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {mod.is_enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          {mod.is_enabled ? 'Activo' : 'Desactivado'}
                        </button>
                      </td>
                      <td className="px-6 py-4 font-bold text-white">{mod.mod_name}</td>
                      <td className="px-6 py-4 font-mono text-slate-300">{mod.file_name}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteMod(mod)}
                          className="p-2 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                          title="Eliminar Mod"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: EXTRACTOR .ZIP */}
      {activeTab === 'modpack_zip' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="bg-slate-950 border-2 border-dashed border-indigo-500/30 rounded-2xl p-8 text-center">
            <input type="file" accept=".zip" id="zip-upload-input" className="hidden" onChange={(e) => e.target.files?.[0] && handleZipFileDrop(e.target.files[0])} />
            <label htmlFor="zip-upload-input" className="cursor-pointer flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <FolderArchive className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-white">Arrastra o selecciona un archivo Modpack.zip</h4>
              <p className="text-xs text-slate-400 max-w-md">
                El panel extraerá y clasificará automáticamente los mods (`mods/`), configs (`config/`) y shaders (`shaderpacks/`) para subirlos a la instancia "{selectedInstance?.name}".
              </p>
              <span className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md">
                Cargar Archivo .ZIP
              </span>
            </label>
          </div>

          {zipFiles.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-3">
                <span className="font-bold text-slate-200">
                  📦 {zipFiles.length} archivos listos para extraer y subir
                </span>
                <button
                  onClick={handleUploadZipContents}
                  disabled={isBatchUploading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  {isBatchUploading ? `Subiendo (${batchProgress.current}/${batchProgress.total})...` : 'Subir contenido al Modpack'}
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-2 font-mono text-[11px]">
                {zipFiles.map((file, idx) => (
                  <div key={idx} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 flex items-center justify-between">
                    <span className="text-slate-300 truncate">{file.path}</span>
                    <span className="text-[10px] text-indigo-400 font-bold uppercase">{file.path.startsWith('config/') ? 'Config' : file.path.startsWith('shaderpacks/') ? 'Shader' : 'Mod'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CONFIGS */}
      {activeTab === 'configs' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileCode className="w-4 h-4 text-indigo-400" />
                Archivos de Configuración de "{selectedInstance?.name}"
              </h3>
              <p className="text-xs text-slate-400">
                Edita o sube archivos de configuración (.toml, .json, .snbt, .cfg, .ini) que se sincronizan con los jugadores.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="file"
                multiple
                accept=".toml,.json,.cfg,.snbt,.ini,.txt,.properties"
                id="config-upload-input"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files, 'config')}
              />
              <label
                htmlFor="config-upload-input"
                className="cursor-pointer px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-700"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-400" /> Subir Configs
              </label>

              <button
                onClick={() => setIsCreatingConfig(true)}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md"
              >
                <FilePlus className="w-3.5 h-3.5" /> Nueva Config
              </button>
            </div>
          </div>

          {/* New Config Dialog */}
          {isCreatingConfig && (
            <div className="p-4 bg-slate-950 border border-indigo-500/40 rounded-2xl space-y-3 animate-in fade-in">
              <h4 className="text-xs font-bold text-white">Crear Nuevo Archivo de Configuración</h4>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="ej: config/modernfix.toml o defaultconfigs/ftb.snbt"
                  value={newConfigPath}
                  onChange={(e) => setNewConfigPath(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleCreateNewConfigFile}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
                >
                  Crear
                </button>
                <button
                  onClick={() => setIsCreatingConfig(false)}
                  className="px-3 py-2 bg-slate-800 text-slate-400 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {configsList.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/50 border border-dashed border-slate-800 rounded-3xl p-8 space-y-4 shadow-inner">
              <FileCode className="w-10 h-10 text-indigo-400 mx-auto opacity-70" />
              <div>
                <h4 className="text-sm font-bold text-white">No hay archivos de configuración en esta instancia</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                  Puedes crear un nuevo archivo (ej: <code>config/jei-client.ini</code>) o subir configs arriba (.toml, .json, .snbt, .cfg, .ini) para sincronizarlos con los jugadores.
                </p>
              </div>
              <button
                onClick={() => setIsCreatingConfig(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-lg transition-all"
              >
                <Plus className="w-4 h-4" /> Crear Primer Archivo de Configuración
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Sidebar list of configs */}
              <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase">Archivos ({configsList.length})</h4>
                </div>
                <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                  {configsList.map((cfg, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-2 rounded-xl text-xs font-mono transition-all group ${
                        activeConfigIndex === idx
                          ? 'bg-indigo-600 text-white shadow-md font-bold'
                          : 'bg-slate-950 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <button
                        onClick={() => setActiveConfigIndex(idx)}
                        className="flex-1 text-left truncate pr-2"
                      >
                        {cfg.path || cfg.name}
                      </button>
                      <button
                        onClick={() => handleDeleteConfig(cfg, idx)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-300 transition-opacity"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Code Editor */}
              <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs font-mono font-bold text-indigo-300">
                    {configsList[activeConfigIndex]?.path || configsList[activeConfigIndex]?.name || 'Editor'}
                  </span>
                  <button
                    onClick={handleSaveCurrentConfig}
                    disabled={isLoading || !configsList.length}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {configSavedNotice ? '✅ ¡Guardado y Sincronizado!' : 'Guardar Archivo'}
                  </button>
                </div>

                <textarea
                  value={configDraft}
                  onChange={(e) => setConfigDraft(e.target.value)}
                  placeholder="# Escribe aquí la configuración..."
                  className="w-full flex-1 min-h-[460px] bg-slate-950 border border-slate-800/90 rounded-2xl p-4 font-mono text-xs text-slate-200 outline-none focus:border-indigo-500/60 leading-relaxed shadow-inner"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SHADERS Y TEXTURAS */}
      {activeTab === 'shaders' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-3xl">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-2xl text-purple-400">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Paquetes de Shaders y Texturas</h3>
                <p className="text-xs text-slate-400">Sube paquetes .zip compatibles con Iris, Oculus y Sodium para tu modpack.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="file"
                multiple
                accept=".zip"
                id="shader-direct-upload"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files, 'shaders')}
              />
              <label
                htmlFor="shader-direct-upload"
                className="cursor-pointer px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md"
              >
                <Upload className="w-4 h-4" /> Subir Shaderpack .ZIP
              </label>

              <button
                onClick={() => setIsAddingShaderModal(true)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 border border-slate-700"
              >
                <Plus className="w-4 h-4 text-purple-400" /> Añadir por URL
              </button>
            </div>
          </div>

          {/* Add Shader by URL Modal */}
          {isAddingShaderModal && (
            <form onSubmit={handleAddManualShader} className="p-6 bg-slate-950 border border-purple-500/40 rounded-3xl space-y-4 animate-in fade-in shadow-2xl">
              <h4 className="text-sm font-bold text-white">Registrar Nuevo Shaderpack por URL</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Nombre del Shader</label>
                  <input
                    type="text"
                    required
                    placeholder="ej: Complementary Reimagined"
                    value={newShaderName}
                    onChange={(e) => setNewShaderName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">URL de Descarga Directa (.zip)</label>
                  <input
                    type="url"
                    required
                    placeholder="https://..."
                    value={newShaderUrl}
                    onChange={(e) => setNewShaderUrl(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Perfil de Rendimiento</label>
                  <select
                    value={newShaderTier}
                    onChange={(e) => setNewShaderTier(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-purple-500"
                  >
                    <option value="fast">⚡ Rendimiento (PCs Gama Media/Baja)</option>
                    <option value="balanced">⚖️ Balanceado (Recomendado)</option>
                    <option value="ultra">🌟 Ultra / Cinematic (RTX 3060+)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Nombre de Archivo (.zip)</label>
                  <input
                    type="text"
                    placeholder="ej: ComplementaryReimagined_r5.4.zip"
                    value={newShaderFile}
                    onChange={(e) => setNewShaderFile(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-purple-500 font-mono"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsAddingShaderModal(false)} className="px-4 py-2 bg-slate-800 text-slate-400 rounded-xl text-xs font-bold">Cancelar</button>
                <button type="submit" className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-md">Guardar Shaderpack</button>
              </div>
            </form>
          )}

          {/* Shaders Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4">Nombre del Shader</th>
                  <th className="px-6 py-4">Perfil</th>
                  <th className="px-6 py-4">Archivo</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {shadersList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      No hay shaders registrados. ¡Sube un paquete .zip arriba para asignarlo a tus jugadores!
                    </td>
                  </tr>
                ) : (
                  shadersList.map((shader) => (
                    <tr key={shader.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleShader(shader)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                            shader.is_active
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {shader.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          {shader.is_active ? 'Activo' : 'Oculto'}
                        </button>
                      </td>
                      <td className="px-6 py-4 font-bold text-white flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        {shader.name}
                      </td>
                      <td className="px-6 py-4 font-bold">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase ${
                          shader.performance_tier === 'ultra' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                          shader.performance_tier === 'fast' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' :
                          'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                        }`}>
                          {shader.performance_tier || 'balanced'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-300">{shader.file_name}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteShader(shader)}
                          className="p-2 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                          title="Eliminar Shader"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: MANIFEST JSON */}
      {activeTab === 'manifest' && selectedInstance && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                Manifiesto Generado de "{selectedInstance.name}"
              </h3>
              <p className="text-xs text-slate-400">
                Estructura JSON exacta con {mods.filter((m) => m.is_enabled).length} mods, {configsList.length} configs y shaders activos que el launcher sincronizará.
              </p>
            </div>
            <button
              onClick={() => {
                const manifestData = {
                  name: selectedInstance.name,
                  version: '1.0.0',
                  minecraftVersion: selectedInstance.minecraft_version || '1.21.1',
                  modLoader: selectedInstance.mod_loader || 'neoforge',
                  modLoaderVersion: selectedInstance.mod_loader_version || '21.1.247',
                  files: [
                    ...mods.filter((m) => m.is_enabled).map((m) => ({
                      path: m.file_path || `mods/${m.file_name}`,
                      sha1: m.sha1,
                      size: m.file_size,
                      downloadUrl: m.download_url
                    })),
                    ...configsList.filter((c) => c.downloadUrl).map((c) => ({
                      path: c.path,
                      sha1: '',
                      size: c.content.length,
                      downloadUrl: c.downloadUrl
                    }))
                  ]
                };
                const blob = new Blob([JSON.stringify(manifestData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `manifest-${selectedInstance.id}.json`;
                a.click();
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 border border-slate-700"
            >
              <Download className="w-4 h-4 text-indigo-400" />
              Descargar manifest.json
            </button>
          </div>
          <pre className="bg-slate-950 border border-slate-800/80 rounded-2xl p-5 text-xs font-mono text-emerald-400 overflow-x-auto max-h-[460px]">
            {JSON.stringify(
              {
                name: selectedInstance.name,
                version: '1.0.0',
                minecraftVersion: selectedInstance.minecraft_version || '1.21.1',
                modLoader: selectedInstance.mod_loader || 'neoforge',
                modLoaderVersion: selectedInstance.mod_loader_version || '21.1.247',
                files: [
                  ...mods.filter((m) => m.is_enabled).map((m) => ({
                    path: m.file_path || `mods/${m.file_name}`,
                    sha1: m.sha1,
                    size: m.file_size,
                    downloadUrl: m.download_url
                  })),
                  ...configsList.filter((c) => c.downloadUrl).map((c) => ({
                    path: c.path,
                    sha1: '',
                    size: c.content.length,
                    downloadUrl: c.downloadUrl
                  }))
                ]
              },
              null,
              2
            )}
          </pre>
        </div>
      )}

      {showTokenModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Configurar Token de GitHub</h3>
            <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="ghp_..." className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white" />
            <button onClick={() => { gitHubStorage.setToken(token); gitHubStorage.setRepo(repo); setShowTokenModal(false); loadInstanceData(selectedInstanceId); }} className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold">Guardar</button>
          </div>
        </div>
      )}
    </div>
  );
};
