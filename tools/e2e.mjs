import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import puppeteer from 'puppeteer-core';
import {access} from 'node:fs/promises';

let chrome=process.env.CHROME_PATH;for(const candidate of ['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser']){if(chrome)break;try{await access(candidate);chrome=candidate}catch{}}
if(!chrome){console.error('CHROME_PATH is required (Chrome/Chromium must be installed).');process.exit(2)}
const port=Number(process.env.PORT||8179);const server=spawn(process.execPath,['tools/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:'ignore'});let browser;
try{
 let ready=false;for(let i=0;i<80;i++){try{const r=await fetch(`http://127.0.0.1:${port}/`);if(r.ok){ready=true;break}}catch{}await delay(150)}assert.ok(ready,'dev server did not start');
 browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [320,380,768,1280]){await page.setViewport({width,height:850});await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'networkidle0'});assert.equal(await page.title(),'Дорога домой — семейное приключение');assert.equal((await page.$$('#levelGrid .level-card')).length,6);assert.equal((await page.$$('#heroCards .hero-card')).length,5);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false,`horizontal overflow at ${width}px`)}
 await page.setViewport({width:390,height:844});await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'networkidle0'});await page.click('#startAdventure');await page.waitForSelector('#goButton');await page.click('[data-hero="liza"]');await page.click('#goButton');await page.waitForFunction(()=>document.querySelector('#screenLayer').innerHTML==='');await page.keyboard.press('Space');await delay(160);await page.keyboard.press('Escape');await page.waitForSelector('#resumeButton');await page.click('#resumeButton');await page.waitForFunction(()=>document.querySelector('#screenLayer').innerHTML==='');
 await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('doroga-domoy.save.v2'));s.paws=600;s.totalPaws=600;localStorage.setItem('doroga-domoy.save.v2',JSON.stringify(s))});await page.reload({waitUntil:'networkidle0'});await page.click('[data-buy="scarf"]');assert.match(await page.$eval('#walletPaws',e=>e.textContent),/540/);await page.click('#soundToggle');assert.equal(await page.$eval('#soundToggle',e=>e.getAttribute('aria-label')),'Включить звук');assert.equal(errors.length,0,errors.join('\n'));
 console.log('E2E passed: 4 responsive widths; 6 levels; 5 pilots; start, controls, pause/resume, save, wardrobe purchase and sound toggle.');
}finally{if(browser)await browser.close();server.kill('SIGTERM')}
