import test from 'node:test';
import assert from 'node:assert/strict';
import {LEVELS,HEROES,starsFor,endlessDifficulty,normalizeSave} from '../assets/js/rules.js';

test('в игре ровно шесть последовательно усложняющихся глав',()=>{assert.equal(LEVELS.length,6);assert.deepEqual(LEVELS.map(l=>l.id),[1,2,3,4,5,6]);for(const l of LEVELS){assert.ok(l.gates>=8);assert.ok(l.speed>0);assert.ok(l.gap>=160&&l.gap<=230)}assert.ok(LEVELS.at(-1).speed>LEVELS[0].speed)});
test('пять пилотов имеют устойчивые уникальные идентификаторы и параметры',()=>{assert.equal(HEROES.length,5);assert.equal(new Set(HEROES.map(h=>h.id)).size,5);for(const h of HEROES){assert.ok(h.lives>=2);assert.ok(h.flap>0);assert.ok(h.gravity>0);assert.ok(h.skill)}});
test('звёзды: финиш, сбор лапок, отсутствие потерь жизни',()=>{assert.equal(starsFor({cleared:false,collected:100,gates:10,livesLost:0}),0);assert.equal(starsFor({cleared:true,collected:0,gates:10,livesLost:1}),1);assert.equal(starsFor({cleared:true,collected:7,gates:10,livesLost:1}),2);assert.equal(starsFor({cleared:true,collected:7,gates:10,livesLost:0}),3)});
test('бесконечный режим растёт плавно и ограничивает экстремальные значения',()=>{assert.deepEqual(endlessDifficulty(0),{speed:210,gap:205,spacing:300});assert.ok(endlessDifficulty(45).speed>endlessDifficulty(0).speed);assert.equal(endlessDifficulty(100).gap,135);assert.equal(endlessDifficulty(-100).speed,210)});
test('повреждённое сохранение безопасно нормализуется',()=>{assert.equal(normalizeSave(null).stars.length,6);const save=normalizeSave({unlocked:900,paws:-1,stars:[4,-2,'x'],best:'9'});assert.equal(save.unlocked,5);assert.equal(save.paws,0);assert.deepEqual(save.stars,[3,0,0,0,0,0]);assert.equal(save.best,9);assert.equal(normalizeSave([]).unlocked,0)});
