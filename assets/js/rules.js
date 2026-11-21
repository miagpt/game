export const LEVELS=[
 {id:1,name:'У озера',place:'Пикник уже ждёт, а ветерок совсем не страшный.',icon:'☀️',gates:8,speed:180,gap:250,color:'#b7ddd8',hazard:'Солнечные ворота'},
 {id:2,name:'Парк качелей',place:'Воздушные шарики качаются вместе с воротами.',icon:'🎈',gates:9,speed:185,gap:245,color:'#c9d8ea',hazard:'Качающиеся арки'},
 {id:3,name:'Бабушкин огород',place:'Яблоки падают сами. Ловить их необязательно!',icon:'🍎',gates:10,speed:190,gap:238,color:'#d4e7bf',hazard:'Яблоки и капли'},
 {id:4,name:'Речной мост',place:'По пути попадаются рыбки и блестящие лапки.',icon:'🐟',gates:11,speed:198,gap:230,color:'#b8d8e5',hazard:'Брызги реки'},
 {id:5,name:'Старый лес',place:'В старом лесу было сумеречно, зато светлячки включили крошечные фонарики.',icon:'🌲',gates:12,speed:205,gap:225,color:'#b9cbb6',hazard:'Ветер в чаще'},
 {id:6,name:'Дорога домой',place:'Вот и знакомая крыша. Остался последний рывок!',icon:'🏠',gates:13,speed:210,gap:220,color:'#e8cda7',hazard:'Чердачные люки'}
];
export const HEROES=[
 {id:'porshik',name:'Поршик',kind:'кот · смелый разведчик',emoji:'🐈',photo:'cat-face.webp',color:'#f3a667',flap:1,gravity:1,lives:6,skill:'Большой запас жизней'},
 {id:'archie',name:'Арчи',kind:'пёс · надёжный штурман',emoji:'🐕',photo:'archi-puppy.webp',color:'#78a88a',flap:1.04,gravity:1,lives:5,skill:'Находит больше лапок'},
 {id:'grace',name:'Грэйс',kind:'кот · мудрый пилот',emoji:'😺',photo:'cat-nap.webp',color:'#a995c2',flap:1.08,gravity:.94,lives:6,skill:'Прощающий полёт'},
 {id:'egor',name:'Егор',kind:'пилот · бумажный самолёт',emoji:'🧑‍✈️',photo:null,color:'#5f9cbd',flap:1.06,gravity:1,lives:4,skill:'Чуть более сильный взмах'},
 {id:'liza',name:'Лиза',kind:'пилот · дрон-наблюдатель',emoji:'🛸',photo:null,color:'#e78d8b',flap:1,gravity:.9,lives:4,skill:'Плавное парение'}
];
export const BONUS_CARDS=[
 {id:'super-porshik',base:'porshik',name:'Поршик · Суперястреб',mission:'stars2',flap:1.12,gravity:1,lives:7,skill:'Мощный взмах'},
 {id:'postman-archie',base:'archie',name:'Арчи · Почтальон',mission:'three',flap:1.04,gravity:1,lives:6,skill:'Дополнительная жизнь и лапки'},
 {id:'wise-grace',base:'grace',name:'Грэйс · Советчик',mission:'stars4',flap:1.08,gravity:.94,lives:7,skill:'Плавное планирование'},
 {id:'fighter-egor',base:'egor',name:'Егор · Истребитель',mission:'perfect5',flap:1.1,gravity:1,lives:5,skill:'Усиленный взмах'},
 {id:'director-liza',base:'liza',name:'Лиза · Режиссёр',mission:'paws500',flap:1.02,gravity:.86,lives:5,skill:'Очень плавное планирование'},
 {id:'whole-family',base:'porshik',name:'Вся семья',mission:'final',flap:1.12,gravity:.88,lives:5,skill:'Пять жизней и командный дух'}
];
export function playableCards(unlocked=[]){return [...HEROES,...BONUS_CARDS.filter(c=>unlocked.includes(c.id)).map(c=>({...HEROES.find(h=>h.id===c.base),...c,baseId:c.base,photo:HEROES.find(h=>h.id===c.base)?.photo}))]}
export const MISSION_REWARDS={first:'starter-boost',three:'postman-archie',paws200:'postman-archie',stars2:'super-porshik',stars4:'wise-grace',perfect5:'fighter-egor',paws500:'director-liza',final:'whole-family'};
export function earnedMissionIds(save,last={}){const done=Array.isArray(save.stars)?save.stars.filter(x=>x>0).length:0,ids=[];if(save.played>0)ids.push('first');if(done>=3)ids.push('three');if(save.stars?.[1]===3)ids.push('stars2');if(save.stars?.[3]===3)ids.push('stars4');if(last.level===4&&last.livesLost===0)ids.push('perfect5');if(save.totalPaws>=200)ids.push('paws200');if(save.totalPaws>=500)ids.push('paws500');if(save.stars?.[5]>0)ids.push('final');return ids}
export function starsFor({cleared,collected,gates,livesLost}){if(!cleared)return 0;return 1+(collected>=Math.ceil(gates*.65)?1:0)+(livesLost===0?1:0)}
export function endlessDifficulty(gatesPassed){const k=Math.min(1,Math.max(0,gatesPassed/45));return {speed:210+125*k,gap:205-70*k,spacing:300-45*k}}
export function normalizeSave(value){const blank={unlocked:0,stars:Array(6).fill(0),paws:0,totalPaws:0,best:0,played:0,hero:'porshik',sound:true,seenNotes:[],completedMissions:[],bonusCards:[],ownedOutfits:[],equippedOutfits:{},boosts:0,birthdayClaimed:''};if(!value||typeof value!=='object'||Array.isArray(value))return blank;const n={...blank,...value};n.unlocked=Math.max(0,Math.min(5,Number(n.unlocked)||0));for(const k of ['paws','totalPaws','best','played','boosts'])n[k]=Math.max(0,Number(n[k])||0);n.stars=Array.isArray(n.stars)?Array.from({length:6},(_,i)=>Math.max(0,Math.min(3,Number(n.stars[i])||0))):blank.stars;n.seenNotes=Array.isArray(n.seenNotes)?n.seenNotes.filter(i=>Number.isInteger(i)&&i>=0&&i<6):[];n.completedMissions=Array.isArray(n.completedMissions)?[...new Set(n.completedMissions.filter(x=>typeof x==='string'))]:[];n.bonusCards=Array.isArray(n.bonusCards)?[...new Set(n.bonusCards.filter(x=>BONUS_CARDS.some(c=>c.id===x)))]:[];n.ownedOutfits=Array.isArray(n.ownedOutfits)?[...new Set(n.ownedOutfits.filter(x=>['scarf','pilot','star'].includes(x)))]:[];const outfitMap=n.equippedOutfits&&typeof n.equippedOutfits==='object'&&!Array.isArray(n.equippedOutfits)?n.equippedOutfits:{};n.equippedOutfits=Object.fromEntries(Object.entries(outfitMap).filter(([heroId,outfitId])=>HEROES.some(h=>h.id===heroId)&&n.ownedOutfits.includes(outfitId)));n.sound=typeof n.sound==='boolean'?n.sound:true;n.boosts=Math.floor(Math.min(99,n.boosts));n.birthdayClaimed=typeof n.birthdayClaimed==='string'?n.birthdayClaimed:'';if(!HEROES.some(h=>h.id===n.hero)&&!n.bonusCards.includes(n.hero))n.hero='porshik';return n}
