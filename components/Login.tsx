import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { BoardplanLogo } from './Brand';

// ─────────────────────────────────────────────────────────────
// Tela de acesso (sem sessão): login + pedido de recuperação.
// Todo o estado é local — o App só decide QUANDO mostrar a tela.
// ─────────────────────────────────────────────────────────────
export const Login: React.FC = () => {
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [sendingReset, setSendingReset] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans text-slate-900">
      {/* ── Painel de marca (ardósia) ── */}
      <div className="md:w-1/2 bg-[#0F172A] text-white p-8 md:p-16 flex flex-col justify-between gap-10 min-h-[38vh] md:min-h-screen">
        <div><BoardplanLogo tone="dark" height={76} /></div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-500 mb-3">Governança de conselhos</div>
          <p className="font-voice italic text-2xl md:text-[26px] leading-snug text-white text-balance">Onde o conselho governa e planeja o futuro da empresa.</p>
          <p className="text-sm text-slate-400 mt-4 max-w-xs leading-relaxed">Convocações, deliberações, atas e plano de ação — do agendamento à decisão.</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-wide text-slate-500"><span className="w-4 h-px bg-slate-700" /> INEPAD Governança e Sucessão</div>
      </div>

      {/* ── Painel de acesso (branco) ── */}
      <div className="md:w-1/2 bg-white flex items-center justify-center p-8 md:p-16">
        <div className="w-full max-w-sm">
          <div className="mb-6">
            <h1 className="font-voice italic text-2xl text-slate-800">Acesso ao portal do conselho</h1>
            <p className="text-sm text-slate-500 mt-1">Use o e-mail cadastrado pela sua empresa.</p>
          </div>

          {!forgotMode ? (
            /* ── Formulário de Login ── */
            <form className="space-y-4" onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              const { error } = await supabase.auth.signInWithPassword({ email: authForm.email, password: authForm.password });
              if (error) alert('Erro de Acesso: ' + error.message);
              setLoading(false);
            }}>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">E-mail</label>
                <input type="email" placeholder="conselheiro@empresa.com.br" className="w-full mt-1.5 p-3.5 bg-white border border-slate-200 rounded-lg outline-none font-semibold focus:border-amber-400 transition-colors" value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} required />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Senha</label>
                <input type="password" placeholder="••••••••" className="w-full mt-1.5 p-3.5 bg-white border border-slate-200 rounded-lg outline-none font-semibold focus:border-amber-400 transition-colors" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} required />
              </div>
              <button disabled={loading} className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3.5 rounded-lg font-bold uppercase tracking-widest text-xs shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2">{loading ? 'Entrando...' : <>Entrar <ChevronRight size={16} /></>}</button>
              <button type="button" onClick={() => { setForgotMode(true); setForgotEmail(authForm.email); }} className="w-full text-center text-xs text-slate-400 hover:text-amber-600 transition-colors font-bold pt-1">
                Esqueci minha senha
              </button>
            </form>
          ) : (
            /* ── Formulário de Recuperação de Senha ── */
            <form className="space-y-4" onSubmit={async (e) => {
              e.preventDefault();
              if (!forgotEmail) return alert('Digite seu e-mail.');
              setSendingReset(true);
              const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
                redirectTo: window.location.origin,
              });
              setSendingReset(false);
              if (error) { alert('Erro: ' + error.message); return; }
              alert(`✅ E-mail de recuperação enviado para ${forgotEmail}.\n\nVerifique sua caixa de entrada e clique no link para definir uma nova senha.`);
              setForgotMode(false);
              setForgotEmail('');
            }}>
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 font-bold">
                Informe o e-mail da sua conta. Enviaremos um link para redefinir sua senha.
              </div>
              <input
                type="email"
                placeholder="Seu e-mail corporativo"
                className="w-full p-3.5 bg-white border border-slate-200 rounded-lg outline-none font-semibold focus:border-amber-400 transition-colors"
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                required
                autoFocus
              />
              <button disabled={sendingReset} className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3.5 rounded-lg font-bold uppercase tracking-widest text-xs shadow-md transition-all disabled:opacity-50">
                {sendingReset ? 'Enviando...' : 'Enviar Link de Recuperação'}
              </button>
              <button type="button" onClick={() => setForgotMode(false)} className="w-full text-center text-xs text-slate-400 hover:text-slate-600 transition-colors font-bold pt-1">
                ← Voltar para o login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Tela de definição de nova senha (após clicar no link do e-mail).
// onDone: avisa o App que a recuperação terminou (volta para o login).
// ─────────────────────────────────────────────────────────────
export const RecoverPassword: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [recoveryForm, setRecoveryForm] = useState({ password: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-900">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
        <div className="flex flex-col items-center text-center mb-8">
          <BoardplanLogo tone="light" height={38} />
          <h1 className="text-xl font-bold text-slate-800 mt-6">Nova senha</h1>
          <p className="text-xs text-slate-500 mt-1 font-bold">Defina sua nova senha de acesso</p>
        </div>
        <form className="space-y-4" onSubmit={async (e) => {
          e.preventDefault();
          if (recoveryForm.password !== recoveryForm.confirm)
            return alert('As senhas não coincidem.');
          if (recoveryForm.password.length < 8)
            return alert('A senha deve ter no mínimo 8 caracteres.');
          if (!/[a-zA-Z]/.test(recoveryForm.password) || !/[0-9]/.test(recoveryForm.password))
            return alert('A senha deve conter letras e números.');
          setLoading(true);
          const { error } = await supabase.auth.updateUser({ password: recoveryForm.password });
          setLoading(false);
          if (error) { alert('Erro ao redefinir senha: ' + error.message); return; }
          alert('✅ Senha redefinida com sucesso! Faça login com a nova senha.');
          await supabase.auth.signOut();
          setRecoveryForm({ password: '', confirm: '' });
          onDone();
        }}>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nova Senha</label>
            <input
              type="password"
              placeholder="Mínimo 8 caracteres com letras e números"
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-lg outline-none font-bold focus:border-amber-400 transition-colors"
              value={recoveryForm.password}
              onChange={e => setRecoveryForm({ ...recoveryForm, password: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Confirmar Nova Senha</label>
            <input
              type="password"
              placeholder="Repita a nova senha"
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-lg outline-none font-bold focus:border-amber-400 transition-colors"
              value={recoveryForm.confirm}
              onChange={e => setRecoveryForm({ ...recoveryForm, confirm: e.target.value })}
              required
            />
          </div>
          <button disabled={loading} className="w-full bg-amber-600 hover:bg-amber-700 text-white py-4 rounded-lg font-bold uppercase shadow-md transition-all disabled:opacity-50">
            {loading ? 'Salvando...' : 'Salvar Nova Senha'}
          </button>
        </form>
      </div>
    </div>
  );
};
