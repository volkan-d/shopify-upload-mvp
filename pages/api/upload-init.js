import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { nanoid } from "nanoid";
import path from "path";

const ALLOWED = new Set(["image/png", "image/jpeg", "application/pdf"]);
const MAX_MB = 25;

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT, // https://<accountid>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { filename, contentType, sizeBytes } = body;

    if (!filename || !contentType) return res.status(400).json({ error: "missing filename/contentType" });
    if (!ALLOWED.has(contentType)) return res.status(400).json({ error: "file type not allowed" });
    if (sizeBytes && sizeBytes > MAX_MB * 1024 * 1024) return res.status(400).json({ error: "file too large" });

    const ext = (path.extname(filename) || "").toLowerCase();
    const key = \`uploads/\${Date.now()}-\${nanoid(12)}\${ext}\`;

    const cmd = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 60 });
    const publicUrl = \`\${process.env.PUBLIC_BASE_URL.replace(/\\/$/, "")}/\${key}\`;

    return res.status(200).json({ uploadUrl, publicUrl, key });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server error" });
  }
}
