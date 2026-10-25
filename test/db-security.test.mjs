import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rpc} from '../api/_postgres.mjs';

test('public research API refuses missing, admin and direct database URLs before networking',async()=>{
 const before=process.env.FLAMES_PUBLIC_DATABASE_URL;
 try{
  delete process.env.FLAMES_PUBLIC_DATABASE_URL;
  await assert.rejects(rpc('delete_session_data',{}),/not configured/);
  process.env.FLAMES_PUBLIC_DATABASE_URL='postgres://postgres:placeholder@db.nowlwprtcnieihelqjoa.supabase.co:5432/postgres?sslmode=require';
  await assert.rejects(rpc('delete_session_data',{}),/identity\/configuration is invalid/);
  process.env.FLAMES_PUBLIC_DATABASE_URL='postgres://flames_lab_admin.nowlwprtcnieihelqjoa:placeholder@fake-test.pooler.supabase.com:6543/postgres?sslmode=require';
  await assert.rejects(rpc('delete_session_data',{}),/identity\/configuration is invalid/);
  await assert.rejects(rpc('admin_dashboard',{}),/Unapproved FLAMES RPC/);
 }finally{
  if(before===undefined)delete process.env.FLAMES_PUBLIC_DATABASE_URL;
  else process.env.FLAMES_PUBLIC_DATABASE_URL=before;
 }
});
test('migration source grants no anonymous RPC access and null admin bypass is closed',()=>{
 const text=readFileSync(new URL('../supabase/migrations/202610250001_flames_central_data.sql',import.meta.url),'utf8');
 assert.ok(!/grant\s+(?:execute|usage)[^\n]*\bto\s+anon\s*;/i.test(text));
 assert.equal((text.match(/p_admin_token_hash is null/g)||[]).length,2);
 assert.match(text,/create role flames_public_submitter nologin/i);
 assert.match(text,/create role flames_lab_admin nologin/i);
});
