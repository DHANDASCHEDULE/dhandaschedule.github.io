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
- “Adicionar horário” grava a data e hora SLT e atualiza o schedule público e o cartão de próximo turno.
- “Remover horário” permite apagar um horário específico ou todos os horários de um dia.
- Dhanda can edit a time slot and mark it available, reserved, or unavailable. Existing October time slots are marked reserved by the upgrade.
- The public “BOOK DHANDA” form sends inquiries to Supabase. Only the authenticated Dhanda account can read them, accept or decline them, and acceptance reserves the requested time.
- O banco permite leitura pública e restringe alterações à identidade autenticada da DHANDA usando Row Level Security.
- A sessão autenticada fica no navegador; “Sair” encerra a sessão.

## Upgrade: private booking inbox and availability states

For an already configured project, run `supabase-booking-upgrade.sql` once in the Supabase SQL Editor before publishing the matching website update. This preserves existing rows, marks them `reserved`, adds the status field, and creates a booking inquiry table whose rows are private to DHANDA. Public visitors can submit requests but cannot read them.

The schedule stores one date and start time per slot. It does not store an end time or duration yet. The calendar only shows explicit available slots as available; clubs can still submit a preferred date and time for DHANDA to review.

## Upgrade: party requests and delete controls

The public booking form includes a request type for regular host bookings or parties/special events. The selected type is saved with the inquiry so DHANDA can identify it in her private inbox. To enable the inbox's **APAGAR MENSAGEM** action, run `supabase-booking-delete-upgrade.sql` in the Supabase SQL Editor. It is safe to run again: it grants the table permission and installs the `dhanda_delete_booking_request` RPC, which checks DHANDA's authenticated email before deleting. Removing an accepted inquiry only removes its message; its reserved calendar slot stays in place.

## Upgrade: public party-flyer gallery

Run `supabase-party-flyers-setup.sql` once in the Supabase SQL Editor. It creates the public `dhanda-party-flyers` storage bucket (JPG, PNG, or WebP up to 10 MB) and policies that allow public viewing while limiting upload/removal to DHANDA.

## Upgrade: admin dashboard and flyer management

Before publishing this update, run `supabase-flyer-management-upgrade.sql` once in the SQL Editor. It creates a flyer metadata table, imports current flyers from the storage bucket, and restricts draft visibility and flyer management to DHANDA's login. The signed-in panel shows the next available period, available-period count, pending booking requests, and published/draft flyer counts. Quick actions open the calendar editor, private booking inbox, and flyer editor. Flyers can be edited, reordered, saved as drafts, published/unpublished, or deleted. Existing flyers remain published and keep their current images.

Drafts do not appear in the public gallery. The existing flyer bucket is public, so someone with a direct image URL can still open the image; only the site gallery listing is hidden until publication.

## Upgrade: booking contact details and time ranges

Before publishing the matching update, run `supabase-time-range-upgrade.sql` once in the SQL Editor. It adds the requester's SL nickname, Discord, club, landmark, and requested start/end times, plus end times for DHANDA's availability blocks. Existing calendar entries remain unchanged and continue to display their original start times until DHANDA edits them into ranges. When a request is accepted, only the requested part of an available block is reserved; any remaining available time is preserved.

## Upgrade: periods ending at midnight

Run [`supabase-midnight-range-upgrade.sql`](supabase-midnight-range-upgrade.sql) once in the SQL Editor to allow a range such as 11:00 PM–12:00 AM. It updates the database checks and booking-acceptance function to treat `00:00` as midnight at the end of that date. The site displays these ranges with “(+1 day)”.

O site mantém o schedule inicial visível enquanto o Supabase não estiver configurado. Não publique a integração como pronta antes de preencher a configuração, executar o SQL e importar os horários iniciais.
