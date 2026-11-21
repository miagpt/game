export const LEVELS=[
 {id:1,name:'У озера',gates:9,speed:205,gap:215},{id:2,name:'Парк качелей',gates:11,speed:215,gap:207},{id:3,name:'Бабушкин огород',gates:12,speed:225,gap:200},{id:4,name:'Речной мост',gates:13,speed:236,gap:196},{id:5,name:'Старый лес',gates:15,speed:245,gap:190},{id:6,name:'Дорога домой',gates:17,speed:250,gap:187}
];
export function starsFor({cleared, collected, gates, livesLost}){if(!cleared)return 0;return 1+(collected>=Math.ceil(gates*.65)?1:0)+(livesLost===0?1:0)}
export function endlessDifficulty(gatesPassed){const k=Math.min(1,Math.max(0,gatesPassed/45));return {speed:210+125*k,gap:205-70*k,spacing:300-45*k}}
export function nextLives(current,shield=false){return shield?current:Math.max(0,current-1)}
export function normalizeSave(value){const blank={unlocked:0,stars:Array(6).fill(0),paws:0,totalPaws:0,best:0,played:0,hero:'porshik',sound:true,seenNotes:[]};if(!value||typeof value!=='object'||Array.isArray(value))return blank;const n={...blank,...value};n.unlocked=Math.max(0,Math.min(5,Number(n.unlocked)||0));n.paws=Math.max(0,Number(n.paws)||0);n.totalPaws=Math.max(0,Number(n.totalPaws)||0);n.best=Math.max(0,Number(n.best)||0);n.played=Math.max(0,Number(n.played)||0);n.stars=Array.isArray(n.stars)?Array.from({length:6},(_,i)=>Math.max(0,Math.min(3,Number(n.stars[i])||0))):blank.stars;return n}
