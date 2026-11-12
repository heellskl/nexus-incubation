// Nexus Incubation Program — письма по заявкам.
//
// Вызывается триггером базы данных (pg_net) при новой заявке и при смене статуса.
// Функция сама читает заявку из базы и отправляет только те письма, которые ещё
// не отправлялись (отметки *_sent_at), поэтому повторный вызов ничего не дублирует.
//
// Секреты (Supabase → Edge Functions → Secrets):
//   GMAIL_USER          — адрес Gmail, с которого уходят письма
//   GMAIL_APP_PASSWORD  — пароль приложения Google (16 символов), не обычный пароль
//   ORGANIZER_EMAILS    — адреса организаторов через запятую
// SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY Supabase подставляет сам.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

type App = {
  id: string;
  created_at: string;
  role: "volunteer" | "speaker" | "mentor" | "tracker";
  role_title: string;
  name: string;
  email: string;
  phone: string;
  telegram: string | null;
  city: string;
  not_student_confirmed: boolean;
  details: Record<string, unknown>;
  status: "new" | "in_review" | "accepted" | "rejected";
  confirmation_sent_at: string | null;
  organizers_notified_at: string | null;
  decision_sent_status: string | null;
};

const LABELS: Record<string, string> = {
  status: "Текущий статус", org: "Университет / место работы", help: "Чем хочет помочь",
  availability: "Когда готов помогать", motivation: "Мотивация", position: "Должность и компания",
  format: "Формат выступления", topic: "Тема", about: "О выступлении и опыте", link: "Ссылка",
  years: "Профессиональный опыт", experience: "Место работы и опыт", areas: "Экспертиза",
  workplace: "Место работы", tracked: "Опыт трекинга", capacity: "Готов вести команд",
};

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const val = (v: unknown) => (Array.isArray(v) ? v.join(", ") : String(v ?? ""));

function layout(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#13132F;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#17173F;border:1px solid #2D2F68;border-radius:16px">
<tr><td style="padding:28px 32px 8px">
  <div style="font-family:Georgia,serif;font-size:22px;letter-spacing:1.5px;color:#ffffff">NEXUS
    <span style="font-family:Arial,sans-serif;font-size:12px;color:#F3A367;border:1px solid #F3A367;border-radius:999px;padding:2px 9px;margin-left:6px;letter-spacing:0">2026–2027</span></div>
</td></tr>
<tr><td style="padding:16px 32px 0">
  <div style="border-left:5px solid #F3A367;padding-left:14px;font-family:Georgia,serif;font-size:26px;line-height:1.2;color:#ffffff">${title}</div>
</td></tr>
<tr><td style="padding:18px 32px 30px;color:#B3B5DD;font-size:16px;line-height:1.6">${body}</td></tr>
<tr><td style="padding:18px 32px;border-top:1px solid #2D2F68;color:#7F82B8;font-size:13px">
  Nexus Incubation Program · SDU University · NDS · Almaty Hub</td></tr>
</table></td></tr></table></body></html>`;
}

function answersTable(a: App) {
  const rows: [string, unknown][] = [
    ["Роль", a.role_title], ["Имя", a.name], ["Email", a.email], ["Телефон", a.phone],
    ["Telegram", a.telegram], ["Город", a.city],
    ...Object.entries(a.details || {}).map(([k, v]) => [LABELS[k] || k, v] as [string, unknown]),
  ];
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:14px;border-collapse:collapse">` +
    rows.filter(([, v]) => val(v).trim()).map(([k, v]) =>
      `<tr><td style="padding:8px 10px 8px 0;color:#A5A8DC;font-size:14px;vertical-align:top;width:38%;border-bottom:1px solid #2D2F68">${esc(k)}</td>
       <td style="padding:8px 0;color:#ffffff;font-size:15px;border-bottom:1px solid #2D2F68;white-space:pre-wrap">${esc(val(v))}</td></tr>`).join("") +
    `</table>`;
}

function confirmationMail(a: App) {
  return {
    subject: `Nexus: заявка на роль «${a.role_title}» получена`,
    html: layout("Спасибо, заявка получена!",
      `<p style="margin:0">Здравствуйте, ${esc(a.name)}!</p>
       <p>Мы получили вашу заявку на роль <b style="color:#F3A367">«${esc(a.role_title)}»</b> в команде Nexus Incubation Program.
       Организаторы рассмотрят её и сообщат о решении письмом на этот адрес.</p>
       <p style="margin-bottom:0">Ваши ответы:</p>${answersTable(a)}
       <p style="margin-top:20px;font-size:14px;color:#7F82B8">Если вы заметили ошибку, просто ответьте на это письмо.</p>`),
  };
}

function organizersMail(a: App) {
  return {
    subject: `Новая заявка: ${a.role_title} — ${a.name}`,
    html: layout(`Новая заявка: ${esc(a.role_title)}`,
      `<p style="margin:0">Поступила новая заявка${a.not_student_confirmed ? " (кандидат подтвердил, что не является студентом)" : ""}.</p>
       ${answersTable(a)}
       <p style="margin-top:20px;font-size:14px">Чтобы ответить кандидату, смените <b>status</b> на <b>accepted</b> или <b>rejected</b>
       в Supabase → Table Editor → applications — письмо уйдёт автоматически.</p>`),
    replyTo: a.email,
  };
}

function decisionMail(a: App) {
  if (a.status === "accepted") {
    return {
      subject: `Nexus: вы в команде! Роль «${a.role_title}»`,
      html: layout("Поздравляем, вы в команде Nexus!",
        `<p style="margin:0">Здравствуйте, ${esc(a.name)}!</p>
         <p>Рады сообщить, что ваша заявка на роль <b style="color:#F3A367">«${esc(a.role_title)}»</b> одобрена.
         В ближайшее время организаторы свяжутся с вами и расскажут о следующих шагах.</p>
         <p style="margin-bottom:0">До встречи на Nexus Incubation Program!</p>`),
    };
  }
  return {
    subject: `Nexus: решение по заявке на роль «${a.role_title}»`,
    html: layout("Спасибо за интерес к Nexus",
      `<p style="margin:0">Здравствуйте, ${esc(a.name)}!</p>
       <p>Благодарим за заявку на роль «${esc(a.role_title)}». К сожалению, в этот раз мы не можем предложить вам место в команде.</p>
       <p style="margin-bottom:0">Будем рады видеть вас среди гостей мероприятий программы и в следующих наборах.</p>`),
  };
}

Deno.serve(async (req) => {
  try {
    const { id } = await req.json().catch(() => ({}));
    if (!id || typeof id !== "string") return new Response("id required", { status: 400 });

    const user = Deno.env.get("GMAIL_USER"), pass = Deno.env.get("GMAIL_APP_PASSWORD");
    if (!user || !pass) return new Response("GMAIL_USER / GMAIL_APP_PASSWORD not set", { status: 500 });
    const organizers = (Deno.env.get("ORGANIZER_EMAILS") || user).split(",").map((s) => s.trim()).filter(Boolean);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: a, error } = await db.from("applications").select("*").eq("id", id).single<App>();
    if (error || !a) return new Response("not found", { status: 404 });

    const smtp = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } });
    const from = `"Nexus Incubation Program" <${user}>`;
    const sent: string[] = [];
    const patch: Partial<App> = {};

    if (!a.confirmation_sent_at) {
      const m = confirmationMail(a);
      await smtp.sendMail({ from, to: a.email, subject: m.subject, html: m.html });
      patch.confirmation_sent_at = new Date().toISOString(); sent.push("confirmation");
    }
    if (!a.organizers_notified_at && organizers.length) {
      const m = organizersMail(a);
      await smtp.sendMail({ from, to: organizers, replyTo: m.replyTo, subject: m.subject, html: m.html });
      patch.organizers_notified_at = new Date().toISOString(); sent.push("organizers");
    }
    if ((a.status === "accepted" || a.status === "rejected") && a.decision_sent_status !== a.status) {
      const m = decisionMail(a);
      await smtp.sendMail({ from, to: a.email, subject: m.subject, html: m.html });
      patch.decision_sent_status = a.status; sent.push("decision:" + a.status);
    }

    if (Object.keys(patch).length) {
      const { error: upErr } = await db.from("applications").update(patch).eq("id", id);
      if (upErr) console.error("update failed", upErr);
    }
    return new Response(JSON.stringify({ ok: true, sent }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
