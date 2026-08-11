const crypto = require("crypto");

// 🔴 PON TU PASSWORD REAL DEL CERTIFICADO
const password = "06092023DJ";

// 🔴 PON EL MISMO QUE VAS A USAR EN SUPABASE
const secret = "FE_SECRET_2026_SUPER_SEGURO";

const salt = Buffer.from("certificado-fe-salt-v1");

const key = crypto.pbkdf2Sync(secret, salt, 100000, 32, "sha256");

const iv = crypto.randomBytes(12);

const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

let encrypted = cipher.update(password, "utf8");
encrypted = Buffer.concat([encrypted, cipher.final()]);

const tag = cipher.getAuthTag();

const final = Buffer.concat([encrypted, tag]);

const result =
  iv.toString("base64") + ":" + final.toString("base64");

console.log("\nENCRYPTED PASSWORD:\n");
console.log(result);