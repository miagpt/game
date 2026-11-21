export const LEVELS=[
 {id:1,name:'У озера',place:'Пикник уже ждёт, а ветерок совсем не страшный.',icon:'☀️',gates:9,speed:205,gap:215,color:'#b7ddd8',hazard:'Солнечные ворота'},
 {id:2,name:'Парк качелей',place:'Воздушные шарики качаются вместе с воротами.',icon:'🎈',gates:11,speed:215,gap:207,color:'#c9d8ea',hazard:'Качающиеся арки'},
 {id:3,name:'Бабушкин огород',place:'Яблоки падают сами. Ловить их необязательно!',icon:'🍎',gates:12,speed:225,gap:200,color:'#d4e7bf',hazard:'Яблоки и капли'},
 {id:4,name:'Речной мост',place:'По пути попадаются рыбки и блестящие лапки.',icon:'🐟',gates:13,speed:236,gap:196,color:'#b8d8e5',hazard:'Брызги реки'},
 {id:5,name:'Старый лес',place:'Светлячки подсвечивают дорогу в сумерках.',icon:'🌲',gates:15,speed:245,gap:190,color:'#b9cbb6',hazard:'Ветер в чаще'},
 {id:6,name:'Дорога домой',place:'Вот и знакомая крыша. Остался последний рывок!',icon:'🏠',gates:17,speed:250,gap:187,color:'#e8cda7',hazard:'Чердачные люки'}
];
export const HEROES=[
 {id:'porshik',name:'Поршик',kind:'кот · смелый разведчик',emoji:'🐈',photo:'cat-face.webp',color:'#f3a667',flap:1,gravity:1,lives:4,skill:'Дополнительная жизнь'},
 {id:'archie',name:'Арчи',kind:'пёс · надёжный штурман',emoji:'🐕',photo:'archi-puppy.webp',color:'#78a88a',flap:1.04,gravity:1,lives:3,skill:'Находит больше лапок'},
 {id:'grace',name:'Грэйс',kind:'кот · мудрый пилот',emoji:'😺',photo:'cat-nap.webp',color:'#a995c2',flap:1.08,gravity:.94,lives:4,skill:'Прощающий полёт'},
 {id:'egor',name:'Егор',kind:'пилот · бумажный самолёт',emoji:'🧑‍✈️',photo:null,color:'#5f9cbd',flap:1.14,gravity:1.02,lives:3,skill:'Сильный взмах'},
 {id:'liza',name:'Лиза',kind:'пилот · дрон-наблюдатель',emoji:'🛸',photo:null,color:'#e78d8b',flap:1,gravity:.78,lives:3,skill:'Плавное парение'}
];
export function starsFor({cleared,collected,gates,livesLost}){if(!cleared)return 0;return 1+(collected>=Math.ceil(gates*.65)?1:0)+(livesLost===0?1:0)}
export function endlessDifficulty(gatesPassed){const k=Math.min(1,Math.max(0,gatesPassed/45));return {speed:210+125*k,gap:205-70*k,spacing:300-45*k}}
export function normalizeSave(value){const blank={unlocked:0,stars:Array(6).fill(0),paws:0,totalPaws:0,best:0,played:0,hero:'porshik',sound:true,seenNotes:[]};if(!value||typeof value!=='object'||Array.isArray(value))return blank;const n={...blank,...value};n.unlocked=Math.max(0,Math.min(5,Number(n.unlocked)||0));n.paws=Math.max(0,Number(n.paws)||0);n.totalPaws=Math.max(0,Number(n.totalPaws)||0);n.best=Math.max(0,Number(n.best)||0);n.played=Math.max(0,Number(n.played)||0);n.stars=Array.isArray(n.stars)?Array.from({length:6},(_,i)=>Math.max(0,Math.min(3,Number(n.stars[i])||0))):blank.stars;return n}
