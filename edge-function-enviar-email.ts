// =============================================================
// EDGE FUNCTION: enviar-credencial-email
// =============================================================
// Envia a credencial de acesso por e-mail automaticamente via Resend.
//
// COMO INSTALAR:
//
// 1) Crie conta gratuita em https://resend.com (3.000 emails/mês grátis)
// 2) Em Resend: API Keys → Create API Key → copie a chave
// 3) No painel Supabase:
//    Settings → Edge Functions → Secrets → adicione:
//      RESEND_API_KEY = sua_chave_resend_aqui
//      EMAIL_REMETENTE = portaria@seudominio.com  (precisa verificar o domínio no Resend)
//      EMPRESA_NOME = Sua Empresa Ltda
//
// 4) Instale a Supabase CLI: https://supabase.com/docs/guides/cli
//
// 5) No terminal, na pasta do seu projeto Supabase:
//      supabase functions new enviar-credencial-email
//      (cole este código no arquivo index.ts criado em supabase/functions/enviar-credencial-email/)
//      supabase functions deploy enviar-credencial-email
//
// 6) Pronto! O frontend já chama esta função automaticamente.
//    Se ela não existir, o sistema usa o fallback mailto.
// =============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      idAcesso, para, nome, codigoQr, qrImageBase64, linkCredencial,
      setor, tipo, nivel, validade, endereco, veiculo
    } = await req.json();

    if (!para || !nome || !codigoQr) {
      throw new Error("Dados obrigatórios faltando.");
    }

    // Fallback caso o frontend não envie endereço
    const end = endereco || {
      nome: "Unidade Industrial",
      rua: "—",
      bairro: "—",
      cidade: "—",
      cep: "—",
      mapsUrl: "#"
    };

    // Veículo (opcional)
    const veic = veiculo || {};
    const tiposVeic: Record<string, string> = {
      CARRO: "Carro", MOTO: "Moto", CAMINHAO: "Caminhão",
      VAN: "Van", UTILITARIO: "Utilitário", OUTRO: "Outro"
    };

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const EMAIL_REMETENTE = Deno.env.get("EMAIL_REMETENTE") || "onboarding@resend.dev";
    const EMPRESA_NOME = Deno.env.get("EMPRESA_NOME") || "Empresa";

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY não configurada nos secrets.");
    }

    const niveis: Record<number, string> = { 1: "Operacional", 2: "Restrito", 3: "Crítico" };
    const validadeFmt = new Date(validade).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    });

    // Imagem inline via CID
    let qrCid = "";
    let attachments: any[] = [];
    if (qrImageBase64) {
      const base64Data = qrImageBase64.replace(/^data:image\/\w+;base64,/, "");
      attachments.push({
        filename: `qr-${codigoQr}.png`,
        content: base64Data
      });
    }

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f7f5f0; padding: 24px; color: #1a1d1f;">
  <div style="background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.08);">
    <div style="background: #1a1d1f; color: #f7f5f0; padding: 24px 32px;">
      <div style="font-size: 11px; letter-spacing: .18em; text-transform: uppercase; opacity: .7; margin-bottom: 6px;">${EMPRESA_NOME}</div>
      <h1 style="font-family: Georgia, serif; font-weight: 500; font-size: 26px; margin: 0;">Credencial de Acesso</h1>
    </div>

    <div style="padding: 32px;">
      <p style="font-size: 16px; margin: 0 0 16px;">Olá, <strong>${escapeHtml(nome)}</strong>!</p>
      <p style="font-size: 14px; color: #4a5056; margin: 0 0 24px;">Sua visita foi agendada. Apresente o QR Code abaixo na portaria.</p>

      <div style="background: #f7f5f0; border: 1px dashed #d8d2c4; border-radius: 4px; padding: 20px; text-align: center; margin-bottom: 24px;">
        ${qrImageBase64 ? `<img src="${qrImageBase64}" alt="QR Code" style="max-width: 200px; width: 100%; height: auto;">` : ""}
        <div style="margin-top: 12px; font-family: monospace; font-size: 11px; color: #4a5056; word-break: break-all;">${escapeHtml(codigoQr)}</div>
        ${linkCredencial ? `
        <a href="${linkCredencial}" target="_blank" style="display: inline-block; margin-top: 14px; padding: 12px 20px; background: #1a1d1f; color: #f7f5f0; text-decoration: none; font-size: 13px; font-weight: 600; border-radius: 4px;">🎫 Abrir credencial completa</a>
        <div style="margin-top: 8px; font-size: 11px; color: #4a5056;">(Salve no celular ou imprima)</div>` : ""}
      </div>

      <table style="width: 100%; font-size: 13px; margin-bottom: 24px; border-collapse: collapse;">
        <tr><td style="padding: 6px 0; color: #4a5056; text-transform: uppercase; letter-spacing: .08em; font-size: 10px; font-weight: 600; width: 30%;">Setor</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(setor)}</td></tr>
        <tr><td style="padding: 6px 0; color: #4a5056; text-transform: uppercase; letter-spacing: .08em; font-size: 10px; font-weight: 600;">Tipo</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(tipo)}</td></tr>
        <tr><td style="padding: 6px 0; color: #4a5056; text-transform: uppercase; letter-spacing: .08em; font-size: 10px; font-weight: 600;">Nível</td><td style="padding: 6px 0; font-weight: 600;">${nivel} · ${niveis[nivel]}</td></tr>
        <tr><td style="padding: 6px 0; color: #4a5056; text-transform: uppercase; letter-spacing: .08em; font-size: 10px; font-weight: 600;">Válido até</td><td style="padding: 6px 0; font-weight: 600;">${validadeFmt}</td></tr>
      </table>

      ${(veic.placa || veic.modelo) ? `
      <div style="background: #fff; border: 1px solid #d8d2c4; border-left: 4px solid #2c5e8f; border-radius: 4px; padding: 14px 16px; margin-bottom: 16px;">
        <div style="font-size: 10px; text-transform: uppercase; letter-spacing: .12em; color: #4a5056; font-weight: 600; margin-bottom: 6px;">🚗 Veículo cadastrado</div>
        ${veic.placa ? `<div style="font-family: monospace; font-size: 18px; font-weight: 700; letter-spacing: .06em; color: #1a1d1f; margin-bottom: 4px;">${escapeHtml(veic.placa)}</div>` : ""}
        <div style="font-size: 12px; color: #4a5056;">
          ${veic.tipo ? escapeHtml(tiposVeic[veic.tipo] || veic.tipo) : ""}
          ${veic.modelo ? ` · ${escapeHtml(veic.modelo)}` : ""}
          ${veic.cor ? ` · ${escapeHtml(veic.cor)}` : ""}
        </div>
      </div>` : ""}

      <div style="background: #fff; border: 1px solid #d8d2c4; border-left: 4px solid #c8553d; border-radius: 4px; padding: 16px; margin-bottom: 24px;">
        <div style="font-size: 10px; text-transform: uppercase; letter-spacing: .12em; color: #4a5056; font-weight: 600; margin-bottom: 6px;">📍 Endereço da visita</div>
        <div style="font-size: 15px; font-weight: 600; color: #1a1d1f; line-height: 1.4;">${escapeHtml(end.rua)}</div>
        <div style="font-size: 12px; color: #4a5056; margin-top: 2px;">${escapeHtml(end.bairro)} · CEP ${escapeHtml(end.cep)}</div>
        <div style="font-size: 12px; color: #4a5056;">${escapeHtml(end.cidade)}</div>
        <a href="${end.mapsUrl}" target="_blank" style="display: inline-block; margin-top: 10px; padding: 8px 14px; background: #2c5e8f; color: #fff; text-decoration: none; font-size: 12px; font-weight: 600; border-radius: 3px;">🗺 Abrir no Google Maps</a>
      </div>

      <h2 style="font-family: Georgia, serif; font-size: 17px; font-weight: 500; margin: 24px 0 12px; padding-top: 16px; border-top: 1px solid #d8d2c4;">Normas de Segurança</h2>

      <div style="font-size: 13px; line-height: 1.55; color: #4a5056;">
        <p style="margin: 8px 0;"><strong style="color: #c8553d;">▸ Identificação visual:</strong> motorista e passageiros devem abaixar totalmente os vidros e retirar bonés, chapéus, óculos escuros ou capuzes ao se aproximarem da portaria.</p>
        <p style="margin: 8px 0;"><strong style="color: #c8553d;">▸ Inspeção de veículos:</strong> obrigatória a vistoria de entrada e saída (porta-malas, caçambas ou baús). Apresente documentação veicular e nota fiscal da carga quando solicitado.</p>
        <p style="margin: 8px 0;"><strong style="color: #c8553d;">▸ Uso de EPIs:</strong> em áreas operacionais, é obrigatório o uso de Equipamentos de Proteção Individual (botas com biqueira, colete reflexivo e demais aplicáveis), conforme NR-12.</p>
        <p style="margin: 8px 0;"><strong style="color: #c8553d;">▸ Itens restritos:</strong> proibida a entrada com armas, bebidas alcoólicas, drogas, e gravações não autorizadas nas áreas operacionais.</p>
        <p style="margin: 8px 0;"><strong style="color: #c8553d;">▸ Estacionamento e circulação:</strong> estacione apenas no local indicado. Velocidade máxima de 20 km/h dentro do perímetro.</p>
        <p style="margin: 8px 0;"><strong style="color: #c8553d;">▸ Acompanhamento:</strong> permaneça junto ao anfitrião responsável e não circule por áreas não autorizadas.</p>
      </div>

      <div style="margin-top: 20px; padding: 12px; background: #fdf6e3; border-left: 3px solid #b8860b; font-size: 12px; color: #1a1d1f; border-radius: 3px;">
        <strong>Atenção:</strong> Ambiente monitorado por câmeras 24h. O descumprimento das normas implica em revogação imediata do acesso.
      </div>
    </div>

    <div style="background: #fbfaf6; padding: 16px 32px; border-top: 1px solid #d8d2c4; text-align: center; font-size: 11px; color: #4a5056;">
      ${EMPRESA_NOME} · Mensagem automática — não responda este e-mail
    </div>
  </div>
</body>
</html>`;

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_REMETENTE,
        to: [para],
        subject: `Credencial de Acesso - ${EMPRESA_NOME}`,
        html,
        attachments
      }),
    });

    const resendData = await resendResp.json();

    if (!resendResp.ok) {
      throw new Error(resendData.message || "Erro no envio via Resend");
    }

    return new Response(
      JSON.stringify({ sucesso: true, id: resendData.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ sucesso: false, erro: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function escapeHtml(s: string): string {
  return String(s || "").replace(/[&<>"']/g, c =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]!));
}
