import {LEVELS,HEROES} from '../assets/js/rules.js';
const dt=1/60,PLAYER_X=180,GRAVITY=1150,FLAP=-410;
function random(seed){let n=seed>>>0;return()=>{n=(1664525*n+1013904223)>>>0;return n/4294967296}}
function attempt(level,seed,hero){const rng=random(seed);const gates=Array.from({length:level.gates},(_,i)=>{const base=155+rng()*220;return{x:650+i*300,base,phase:rng()*Math.PI*2,passed:false}});let y=270,vy=0,lives=hero.lives,cooldown=0,passed=0,t=0,invuln=0;
 while(t<100&&lives>0&&passed<level.gates){t+=dt;cooldown=Math.max(0,cooldown-dt);invuln=Math.max(0,invuln-dt);const next=gates.find(g=>!g.passed);const amplitude=level.id>=2?8+(level.id-1)*2:0;const target=next?next.base+Math.sin(t*1.25+next.phase)*amplitude:270;
  if(cooldown===0&&(y>target+12&&vy>-90||vy>170&&y>target-12)){vy=FLAP*hero.flap;cooldown=.23}
  vy=Math.min(520,vy+GRAVITY*hero.gravity*dt);y+=vy*dt;if((y<19||y>510)&&invuln===0){lives--;invuln=1.4;y=Math.max(90,Math.min(410,y));vy=-180;cooldown=.5}
  for(const g of gates){g.x-=level.speed*dt;const center=g.base+Math.sin(t*1.25+g.phase)*amplitude;if(invuln===0&&g.x<PLAYER_X+18&&g.x+70>PLAYER_X-14&&Math.abs(y-center)>level.gap/2-15){lives--;invuln=1.4;y=Math.max(90,Math.min(410,y));vy=-180;cooldown=.5;break}if(!g.passed&&g.x+70<PLAYER_X){g.passed=true;passed++}}
 }
 return passed>=level.gates&&lives>0}
let failed=0;for(const level of LEVELS){const byHero=[];for(const hero of HEROES){let wins=0;for(let i=1;i<=100;i++)if(attempt(level,i*7919+level.id*131,hero))wins++;const pct=Math.round(wins);byHero.push(`${hero.name} ${pct}%`);if(pct<60)failed++}console.log(`Ур.${level.id} ${level.name.padEnd(19)} ${byHero.join(' · ')}`)}
if(failed){console.error('Найден уровень/пилот с проходимостью ниже 60%.');process.exitCode=1}else console.log('Симуляция пройдена: все пилоты проходят каждый маршрут не менее чем в 60% из 100 seed-тестов. Это грубая модель, а не замена игровому QA.');
