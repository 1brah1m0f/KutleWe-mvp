const nodemailer = require("nodemailer");

let transporter = null;
let transporterInitState = null;

function getTransporter() {
  if (transporterInitState) {
    return transporterInitState;
  }

  if (transporter) {
    transporterInitState = { transport: transporter, missing: [] };
    return transporterInitState;
  }

  const host = String(process.env.SMTP_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "false") === "true";
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").trim();

  const missing = [];
  if (!host) missing.push("SMTP_HOST");
  if (!user) missing.push("SMTP_USER");
  if (!pass) missing.push("SMTP_PASS");

  if (missing.length > 0) {
    transporterInitState = { transport: null, missing };
    return transporterInitState;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });

  transporterInitState = { transport: transporter, missing: [] };
  return transporterInitState;
}

async function sendOtpEmail(email, code, purpose = "login") {
  const from = String(process.env.SMTP_FROM || "KutleWe <no-reply@kutlewe.local>");
  const to = String(email || "").trim().toLowerCase();
  const { transport, missing } = getTransporter();
  const title = purpose === "admin" ? "Admin giris kodu" : "Giris kodu";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.6">
      <h2>${title}</h2>
      <p>KutleWe hesabina giris ucun kod:</p>
      <p style="font-size:28px; letter-spacing:4px; font-weight:700">${code}</p>
      <p>Bu kod 10 deqiqe erzinde aktivdir.</p>
    </div>
  `;

  if (!transport) {
    console.log(`[MAIL-FAKE] ${to} -> ${code}`);
    const missingText = missing.length ? ` Bos ENV: ${missing.join(", ")}` : "";
    return {
      delivered: false,
      message: `SMTP konfiqurasiya olunmayib.${missingText} Kod server log-a yazildi.`
    };
  }

  await transport.sendMail({
    from,
    to,
    subject: `KutleWe ${title}`,
    text: `Giris kodunuz: ${code}. Kod 10 deqiqe erzinde aktivdir.`,
    html
  });

  return {
    delivered: true,
    message: "Kod email unvana gonderildi."
  };
}

module.exports = {
  sendOtpEmail
};
