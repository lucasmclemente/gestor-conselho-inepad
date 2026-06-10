-- Adiciona o flag de ativação da conta da empresa (cliente).
-- Contas inativas têm o acesso bloqueado no login, mas mantêm os dados.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
