begin;

insert into comissionamento.notificacao_templates (
    codigo,
    versao,
    canal,
    assunto,
    titulo,
    corpo_html,
    corpo_texto,
    cta_label,
    cta_url_template,
    variaveis_obrigatorias,
    politica_mascaramento,
    ativo,
    publicado_em
)
values (
    'comissionado_regra_publicada',
    1,
    'email',
    '[{{codigo_comissao}}] Sua regra de comissão foi alterada - {{ciclo}}',
    'Regra de comissão atualizada',
    '<p>Olá, {{nome_destinatario}}.</p><h3>O que aconteceu</h3><p>A Secretaria publicou uma alteração na sua regra de comissão do ciclo <strong>{{ciclo}}</strong>.</p><h3>Quem alterou</h3><p>{{acao_executada_por_nome}} ({{acao_executada_por_email}}).</p><h3>Regra alterada</h3><p><strong>{{regra}}</strong> - campo/base: <strong>{{campo}}</strong>.</p><h3>O que mudou e como está</h3><pre style="white-space:pre-wrap;background:#f6f8fb;border:1px solid #e1e7f0;border-radius:6px;padding:12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45;color:#223047;">{{alteracoes_texto}}</pre><h3>Comissão</h3><p>ID: <strong>{{codigo_comissao}}</strong><br>Ciclo: <strong>{{ciclo}}</strong><br>Comissionado: <strong>{{nome_comissionado}}</strong></p><p>Consulte o portal para ver o detalhamento completo da sua comissão atualizada.</p><p style="color:#667085;font-size:13px;">Correlação: {{correlation_id}}</p>',
    'A Secretaria publicou uma alteração na sua regra de comissão. Comissão: {{codigo_comissao}} / {{ciclo}}. Regra: {{regra}}. O que mudou e como está: {{alteracoes_texto}}. Portal: {{link_comissionamento}}. Correlação: {{correlation_id}}.',
    'Abrir minha comissão',
    '{{link_comissionamento}}',
    array['codigo_comissao','ciclo','nome_comissionado','regra','campo','alteracoes_texto','correlation_id'],
    '{"valor_bruto":"mascarar","valor_liquido":"mascarar","valor_nf":"mascarar"}'::jsonb,
    true,
    now()
)
on conflict (codigo, versao, canal) do update set
    assunto = excluded.assunto,
    titulo = excluded.titulo,
    corpo_html = excluded.corpo_html,
    corpo_texto = excluded.corpo_texto,
    cta_label = excluded.cta_label,
    cta_url_template = excluded.cta_url_template,
    variaveis_obrigatorias = excluded.variaveis_obrigatorias,
    politica_mascaramento = excluded.politica_mascaramento,
    ativo = excluded.ativo,
    publicado_em = excluded.publicado_em;

commit;
