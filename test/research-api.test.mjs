import test from 'node:test';
import assert from 'node:assert/strict';
process.env.SUPABASE_URL='https://example.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY='publishable-test-key';
const {default:handler}=await import('../api/research.mjs');

function response(){return {statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v},end(value){this.body=value?JSON.parse(value):null}}}
const ids={session_id:'11111111-1111-4111-8111-111111111111',attempt_id:'22222222-2222-4222-8222-222222222222'};

test('POST recalculates the result and sends no names when name consent is absent',async()=>{
 let rpcBody;globalThis.fetch=async(_url,options)=>{rpcBody=JSON.parse(options.body);return new Response('{"stored":true}',{status:200})};
 const req={method:'POST',headers:{origin:'https://flames-love-story.vercel.app'},body:{...ids,analytics_consent:true,names_consent:false,consent_version:'2026-10-25',deletion_token:'x'.repeat(64),name_one:'Alex',name_two:'Maria',result_letter:'E',remaining_count:999}};
 const res=response();await handler(req,res);assert.equal(res.statusCode,201);assert.equal(rpcBody.p_name_one,null);assert.equal(rpcBody.p_name_two,null);assert.notEqual(rpcBody.p_remaining_count,999);assert.equal(rpcBody.p_algorithm_version,'1.1.0');
});

test('invalid origin and missing consent fail before database access',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;return new Response('{}')};
 const blocked=response();await handler({method:'POST',headers:{origin:'https://attacker.example'},body:{}},blocked);assert.equal(blocked.statusCode,403);
 const denied=response();await handler({method:'POST',headers:{},body:{...ids,name_one:'A',name_two:'B'}},denied);assert.equal(denied.statusCode,400);assert.equal(calls,0);
});

test('feedback updates the existing attempt id',async()=>{
 let rpcBody;globalThis.fetch=async(_url,options)=>{rpcBody=JSON.parse(options.body);return new Response('{}',{status:200})};
 const res=response();await handler({method:'PATCH',headers:{},body:{...ids,liked_result:false,wants_change:true,desired_letter:'L'}},res);assert.equal(res.statusCode,200);assert.equal(rpcBody.p_attempt_id,ids.attempt_id);assert.equal(rpcBody.p_session_id,ids.session_id);
});

test('unsupported methods return 405 without parsing identifiers',async()=>{
 const res=response();await handler({method:'GET',headers:{},body:null},res);assert.equal(res.statusCode,405);assert.match(res.headers.allow,/POST/);
});
