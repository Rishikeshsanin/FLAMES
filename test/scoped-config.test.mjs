import test from 'node:test';
import assert from 'node:assert/strict';
import {scopedConnectionOptions} from '../api/_postgres.mjs';
const host='aws-0-ap-south-1.pooler.supabase.com';
const user='flames_public_submitter.nowlwprtcnieihelqjoa';
const url=password=>'postgresql://'+user+':'+password+'@'+host+':6543/postgres?sslmode=require';

test('accepts strictly scoped pooler connection',()=>{
 const out=scopedConnectionOptions(url('p4ssword987'));
 assert.equal(out.host,host);
 assert.equal(out.port,6543);
 assert.equal(out.username,user);
 assert.equal(out.database,'postgres');
 assert.equal(out.password,'p4ssword987');
});

test('accepts percent signs in a password without URI malformed errors',()=>{
 assert.equal(scopedConnectionOptions(url('a%broken-value')).password,'a%broken-value');
 assert.equal(scopedConnectionOptions(url('a%25broken-value')).password,'a%broken-value');
 assert.equal(scopedConnectionOptions(url('a%40password')).password,'a@password');
});

test('rejects other app roles, endpoints, ports, protocols, and query options',()=>{
 const examples=[
  url('abc').replace('flames_public_submitter','postgres'),
  url('abc').replace(host,'evil.example'),
  url('abc').replace(':6543/',':5432/'),
  url('abc').replace('postgresql://','http://'),
  url('abc').replace('/postgres?','/private?'),
  url('abc')+'&options=-c%20search_path',
  url('abc')+'#token',
  url('abc').replace('nowlwprtcnieihelqjoa','otherproject'),
 ];
 for(const value of examples)
   assert.throws(()=>scopedConnectionOptions(value),/configuration is invalid|identity\/configuration is invalid/);
});

test('missing connection fails closed',()=>{
 assert.throws(()=>scopedConnectionOptions(''),/not configured/);
});
