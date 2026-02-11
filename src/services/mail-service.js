const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const host = String(process.env.SMTP_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "false") === "true";
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").trim();

  if (!host || !user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });

  return transporter;
}

async function sendOtpEmail(email, code, purpose = "login") {
  const from = String(process.env.SMTP_FROM || "KutleWe <no-reply@kutlewe.local>");
  const to = String(email || "").trim().toLowerCase();
  const transport = getTransporter();
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
    return {
      delivered: false,
      message: "SMTP konfiqurasiya olunmayib. Kod server log-a yazildi."
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
