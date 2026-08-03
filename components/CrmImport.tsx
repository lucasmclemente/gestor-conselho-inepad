import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { X, Upload, Building2, Users, CheckCircle2, FileSpreadsheet } from 'lucide-react';

type Props = {
  cid: string;
  currentUser: any;
  members?: any[];
  pipelineId: string | null;
  stages: any[]; // ordenadas por position; usamos a primeira etapa
  addLog?: (action: string, details: string) => Promise<void> | void;
  onClose: () => void;
  onDone: () => void;
};

const digits = (s: string) => (s || '').replace(/\D/g, '');
const firstOf = (row: any, keys: string[]) => { for (const k of keys) { if (row[k]) return row[k]; } return ''; };
const chunk = (arr: any[], n: number) => { const out: any[][] = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };
const isDecisor = (occ: string) => /ADMINISTRADOR|DIRETOR|PRESIDENTE|TITULAR/.test((occ || '').toUpperCase());

const parseCSV = (text: string): any[] => {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const headers = lines[0].split(';').map(h => h.trim());
  return lines.slice(1).map(line => {
    const cells = line.split(';');
    const row: any = {};
    headers.forEach((h, i) => { row[h] = (cells[i] ?? '').trim(); });
    return row;
  });
};

export const CrmImport: React.FC<Props> = ({ cid, currentUser, members = [], pipelineId, stages, addLog, onClose, onDone }) => {
  const log = async (a: string, d: string) => { try { await addLog?.(a, d); } catch { /* noop */ } };
  const crmUsers = members.filter((m: any) => ['SuperAdmin', 'Administrador', 'Comercial'].includes(m.role));

  const [empresas, setEmpresas] = useState<any[]>([]);
  const [socios, setSocios] = useState<any[]>([]);
  const [empName, setEmpName] = useState('');
  const [socName, setSocName] = useState('');
  const [onlyDecisores, setOnlyDecisores] = useState(true);
  const [source, setSource] = useState('');
  const [ownerId, setOwnerId] = useState<string>(currentUser?.id || '');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [report, setReport] = useState<any>(null);

  const readFile = (file: File, setRows: (r: any[]) => void, setName: (n: string) => void) => {
    const reader = new FileReader();
    reader.onload = () => { setRows(parseCSV(String(reader.result || ''))); setName(file.name); };
    reader.readAsText(file, 'utf-8');
  };

  // Prévia
  const compByCnpj = new Map<string, any>();
  for (const r of empresas) {
    const cnpj = digits(r['CNPJ']); if (!cnpj) continue;
    compByCnpj.set(cnpj, {
      cnpj,
      name: (r['RAZAO'] || r['NOME_FANTASIA'] || '').trim(),
      segment: (r['DESCRICAO_CNAE'] || r['ATIVIDADE'] || '').trim(),
      phone: firstOf(r, ['DDDFONEMOVEL1', 'DDDFONEFIXO1']),
      email: (r['EMAIL1'] || '').trim(),
      address: [r['LOGRADOURO'], r['NUMERO'], r['BAIRRO']].filter(Boolean).join(', '),
      city: (r['CIDADE'] || '').trim(),
      uf: (r['UF'] || '').trim(),
    });
  }
  const sociosPF = socios.filter(r => (r['TIPO'] || '').toUpperCase() === 'PF');
  const sociosFiltered = onlyDecisores ? sociosPF.filter(r => isDecisor(r['OCUPACAO'])) : sociosPF;

  const runImport = async () => {
    if (!empresas.length) return alert('Envie ao menos o arquivo de Empresas.');
    const stage0 = stages[0];
    if (!stage0 || !pipelineId) return alert('O funil não tem etapas para receber os leads.');
    setBusy(true); setReport(null);
    try {
      // 1) Empresas existentes por CNPJ
      setProgress('Verificando empresas existentes...');
      const { data: existingOrgs } = await supabase.from('crm_organizations').select('id, cnpj').eq('client_id', cid).not('cnpj', 'is', null);
      const orgIdByCnpj = new Map<string, string>();
      (existingOrgs || []).forEach((o: any) => { if (o.cnpj) orgIdByCnpj.set(o.cnpj, o.id); });

      // 2) Inserir empresas novas
      setProgress('Importando empresas...');
      const newOrgs = [...compByCnpj.values()].filter(c => !orgIdByCnpj.has(c.cnpj)).map(c => ({
        client_id: cid, name: c.name, cnpj: c.cnpj, segment: c.segment, phone: c.phone,
        address: c.address, city: c.city, uf: c.uf, owner_member_id: ownerId || currentUser?.id || null,
      }));
      for (const part of chunk(newOrgs, 200)) {
        const { data, error } = await supabase.from('crm_organizations').insert(part).select('id, cnpj');
        if (error) throw error;
        (data || []).forEach((o: any) => orgIdByCnpj.set(o.cnpj, o.id));
      }

      // 3) Criar um lead (deal) por empresa que ainda não tem
      setProgress('Criando leads no funil...');
      const orgIds = [...orgIdByCnpj.values()];
      const { data: existingDeals } = await supabase.from('crm_deals').select('id, organization_id').eq('client_id', cid).in('organization_id', orgIds.length ? orgIds : ['00000000-0000-0000-0000-000000000000']);
      const dealByOrg = new Map<string, string>();
      (existingDeals || []).forEach((d: any) => { if (d.organization_id) dealByOrg.set(d.organization_id, d.id); });
      const newDeals: any[] = [];
      for (const [cnpj, c] of compByCnpj) {
        const orgId = orgIdByCnpj.get(cnpj);
        if (orgId && !dealByOrg.has(orgId)) newDeals.push({
          client_id: cid, pipeline_id: pipelineId, stage_id: stage0.id, title: c.name,
          organization_id: orgId, value: 0, status: 'open', source: source.trim() || 'Importação',
          owner_member_id: ownerId || currentUser?.id || null,
        });
      }
      let leadsCriados = 0;
      for (const part of chunk(newDeals, 200)) {
        const { data, error } = await supabase.from('crm_deals').insert(part).select('id, organization_id');
        if (error) throw error;
        (data || []).forEach((d: any) => dealByOrg.set(d.organization_id, d.id));
        leadsCriados += (data || []).length;
      }

      // 4) Inserir contatos (sócios) vinculados à empresa pelo CNPJ
      let contatosCriados = 0;
      const insertedContacts: any[] = [];
      if (sociosFiltered.length) {
        setProgress('Importando contatos...');
        const { data: existingContacts } = await supabase.from('crm_contacts').select('id, organization_id, name').eq('client_id', cid).in('organization_id', orgIds.length ? orgIds : ['00000000-0000-0000-0000-000000000000']);
        const keyOf = (orgId: string, name: string) => orgId + '|' + (name || '').toUpperCase();
        const seen = new Set<string>((existingContacts || []).map((c: any) => keyOf(c.organization_id, c.name)));
        const newContacts: any[] = [];
        for (const s of sociosFiltered) {
          const orgId = orgIdByCnpj.get(digits(s['CNPJ']));
          if (!orgId) continue; // sócio de empresa fora da lista de empresas
          const name = (s['NOME'] || '').trim();
          if (!name) continue;
          const k = keyOf(orgId, name);
          if (seen.has(k)) continue;
          seen.add(k);
          newContacts.push({
            client_id: cid, organization_id: orgId, name,
            role_title: (s['OCUPACAO'] || '').trim() || null,
            phone: firstOf(s, ['DDDFONEMOVEL1', 'DDDFONEMOVEL2', 'DDDFONEMOVEL3']) || null,
            email: (s['EMAILCORPORATIVO'] || '').trim() || null,
            owner_member_id: ownerId || currentUser?.id || null,
          });
        }
        for (const part of chunk(newContacts, 200)) {
          const { data, error } = await supabase.from('crm_contacts').insert(part).select('id, organization_id, role_title');
          if (error) throw error;
          insertedContacts.push(...(data || []));
          contatosCriados += (data || []).length;
        }
      }

      // 5) Definir o contato principal do lead (preferir decisor) onde ainda não há
      if (insertedContacts.length) {
        setProgress('Vinculando contato principal...');
        const bestByOrg = new Map<string, string>();
        for (const c of insertedContacts) {
          if (!bestByOrg.has(c.organization_id)) bestByOrg.set(c.organization_id, c.id);
          if (isDecisor(c.role_title)) bestByOrg.set(c.organization_id, c.id);
        }
        const { data: dealsNoContact } = await supabase.from('crm_deals').select('id, organization_id, contact_id').eq('client_id', cid).in('organization_id', orgIds.length ? orgIds : ['00000000-0000-0000-0000-000000000000']);
        for (const d of (dealsNoContact || [])) {
          if (!d.contact_id && bestByOrg.has(d.organization_id)) {
            await supabase.from('crm_deals').update({ contact_id: bestByOrg.get(d.organization_id) }).eq('id', d.id);
          }
        }
      }

      setProgress('');
      log('CRM', `Importação: ${leadsCriados} leads, ${contatosCriados} contatos${source.trim() ? ` (${source.trim()})` : ''}`);
      setReport({ empresas: compByCnpj.size, leadsCriados, contatosCriados });
      onDone();
    } catch (e: any) {
      alert('Erro na importação: ' + (e?.message || e));
    }
    setBusy(false); setProgress('');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 animate-in fade-in" onClick={() => !busy && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-800 italic flex items-center gap-2"><FileSpreadsheet size={20} className="text-amber-600" /> Importar Leads e Contatos</h3>
          <button onClick={() => !busy && onClose()} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>

        {report ? (
          <div className="space-y-4 text-center py-6">
            <CheckCircle2 size={48} className="text-emerald-500 mx-auto" />
            <div>
              <p className="text-lg font-bold text-slate-800 italic">Importação concluída!</p>
              <p className="text-sm text-slate-500 mt-2"><b>{report.leadsCriados}</b> novos leads no funil e <b>{report.contatosCriados}</b> contatos.</p>
              <p className="text-[11px] text-slate-400 mt-1">Empresas na planilha: {report.empresas}. Já existentes foram ignoradas (sem duplicar).</p>
            </div>
            <button onClick={onClose} className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest">Fechar</button>
          </div>
        ) : (
          <>
            <p className="text-[11px] text-slate-500">Suba a planilha de <b>empresas</b> (vira lead no funil) e a de <b>sócios</b> (vira contato). O vínculo é feito pelo <b>CNPJ</b>. Empresas já cadastradas não são duplicadas.</p>

            <div className="space-y-2">
              <label className="flex items-center justify-between gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:border-amber-400 transition-all">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-700 italic"><Building2 size={16} className="text-amber-600" /> Empresas (leads)</span>
                <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600 flex items-center gap-1"><Upload size={13} /> {empName ? 'Trocar' : 'Escolher CSV'}</span>
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f, setEmpresas, setEmpName); }} />
              </label>
              {empName && <p className="text-[10px] text-slate-400 pl-1">{empName} — <b>{compByCnpj.size}</b> empresa(s)</p>}

              <label className="flex items-center justify-between gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:border-amber-400 transition-all">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-700 italic"><Users size={16} className="text-amber-600" /> Sócios (contatos)</span>
                <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600 flex items-center gap-1"><Upload size={13} /> {socName ? 'Trocar' : 'Escolher CSV'}</span>
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f, setSocios, setSocName); }} />
              </label>
              {socName && <p className="text-[10px] text-slate-400 pl-1">{socName} — <b>{sociosFiltered.length}</b> contato(s){onlyDecisores ? ' (só decisores)' : ''}</p>}
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={onlyDecisores} onChange={e => setOnlyDecisores(e.target.checked)} className="w-4 h-4 accent-amber-600" />
              Importar só decisores (sócio administrador, diretor, presidente)
            </label>

            {crmUsers.length > 0 && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Responsável (dono dos leads)</label>
                <select value={ownerId} onChange={e => setOwnerId(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-amber-500 bg-white">
                  {crmUsers.map((m: any) => <option key={m.id} value={m.id}>{m.name}{m.id === currentUser?.id ? ' (você)' : ''}</option>)}
                </select>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Origem / lista (opcional)</label>
              <input type="text" placeholder="Ex: Patos de Minas / Ituiutaba" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-amber-500" value={source} onChange={e => setSource(e.target.value)} />
            </div>

            <button disabled={busy || !empresas.length} onClick={runImport} className="w-full px-8 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-50">
              <Upload size={16} /> {busy ? (progress || 'Importando...') : `Importar ${compByCnpj.size} lead(s) e ${sociosFiltered.length} contato(s)`}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
