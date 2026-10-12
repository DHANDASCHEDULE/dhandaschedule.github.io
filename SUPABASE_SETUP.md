# Preparar login e edição do calendário da DHANDA

O site continua público para consulta. A conta autenticada `dhanda@dhandaschedule.github.io` é a única autorizada pelo banco a inserir, alterar ou remover horários. O campo de usuário do site aceita `dhanda` e o código converte esse nome para o e-mail usado pelo Supabase Auth.

## Configuração do projeto

1. Crie um projeto Supabase para o calendário.
2. No SQL Editor, execute `supabase-setup.sql` uma vez.
3. Em Authentication, desative inscrições públicas e crie somente a usuária `dhanda@dhandaschedule.github.io` com a senha escolhida para ela. Não coloque a senha em nenhum arquivo do site.
4. Importe `schedule-seed.csv` para `public.schedule_events`, mapeando apenas `event_date` e `start_time`. Faça essa importação uma vez para carregar os horários já publicados de outubro de 2026.
5. Em Project Settings → API, copie a Project URL e a chave pública Publishable (ou anon, em projetos que ainda exibem esse formato) para `supabase-config.js`.
6. Nunca copie a chave `service_role` para o site. Ela ignora as regras de segurança do banco.
7. Depois de preencher os dados públicos do projeto no arquivo de configuração, publique o site. O login e a gravação remota só ficam ativos quando esse projeto estiver configurado.

## O que o painel faz

- Login com usuário `dhanda` e senha validada pelo Supabase Auth.
- “Adicionar horário” grava a data e hora SLT e atualiza a agenda pública e o cartão de próximo set.
- “Remover horário” permite apagar um horário específico ou todos os horários de um dia.
- O banco permite leitura pública e restringe alterações à identidade autenticada da DHANDA usando Row Level Security.
- A sessão autenticada fica no navegador; “Sair” encerra a sessão.

O site mantém a agenda inicial visível enquanto o Supabase não estiver configurado. Não publique a integração como pronta antes de preencher a configuração, executar o SQL e importar a agenda inicial.
