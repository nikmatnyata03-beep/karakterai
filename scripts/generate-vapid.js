// scripts/generate-vapid.js
// Run: node scripts/generate-vapid.js
// Copy the output into your Vercel Environment Variables

const webpush = require('web-push');
const keys = webpush.generateVAPIDKeys();

console.log('\n✅ VAPID Keys Generated!\n');
console.log('Add these to Vercel Environment Variables:\n');
console.log('VAPID_PUBLIC_KEY =', keys.publicKey);
console.log('VAPID_PRIVATE_KEY =', keys.privateKey);
console.log('\n⚠️  Keep VAPID_PRIVATE_KEY secret — never expose it in client code!\n');
