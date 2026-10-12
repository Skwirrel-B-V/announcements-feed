import fs from 'node:fs';
const feed=JSON.parse(fs.readFileSync('feed.json','utf8'));
const fail=(msg)=>{throw new Error(msg)};
if(feed.schemaVersion!==1||!Array.isArray(feed.announcements)||!Number.isFinite(Date.parse(feed.updatedAt)))fail('Invalid feed header');
const ids=new Set();const languages=['en','nl','de','fr'];const types=['release','upcoming','2ba','etim','general'];
for(const item of feed.announcements){
 if(typeof item.id!=='string'||!item.id.trim()||ids.has(item.id))fail('Missing or duplicate ID');ids.add(item.id);
 if(!types.includes(item.type))fail('Invalid type: '+item.id);
 if(typeof item.publishedAt!=='string'||!Number.isFinite(Date.parse(item.publishedAt)))fail('Invalid date: '+item.id);
 for(const key of ['title','body'])for(const lang of languages)if(typeof item[key]?.[lang]!=='string'||!item[key][lang].trim())fail('Missing '+key+'.'+lang+': '+item.id);
 if(item.expiresAt!==undefined&&!Number.isFinite(Date.parse(item.expiresAt)))fail('Invalid expiry');
 if(item.priority!==undefined&&!['normal','important'].includes(item.priority))fail('Invalid priority');
 if(item.url!==undefined){try{const u=new URL(item.url);if(u.protocol!=='https:')fail('URL must be HTTPS')}catch{fail('Invalid URL')}}
 if(item.version!==undefined&&typeof item.version!=='string')fail('Invalid version');
}
console.log('Validated '+feed.announcements.length+' announcements');
