import postgres from 'postgres';

// Only the public FLAMES role, never postgres, service_role, or a different app.
const PROJECT_REF='nowlwprtcnieihelqjoa';
const ROLE='flames_public_submitter';
let sql;
let testRpc=null;
const signatures=Object.freeze({
  ingest_attempt:[
    ['p_session_id','uuid'],['p_attempt_id','uuid'],['p_parent_attempt_id','uuid'],
    ['p_client_occurred_at','timestamptz'],['p_consent_version','text'],
    ['p_names_consent','boolean'],['p_deletion_token_hash','text'],
    ['p_name_one','text'],['p_name_two','text'],['p_result_letter','text'],
    ['p_remaining_count','integer'],['p_is_alternative','boolean'],
    ['p_previous_result_letter','text'],['p_algorithm_version','text'],['p_variations','jsonb']
  ],
  record_feedback:[
    ['p_session_id','uuid'],['p_attempt_id','uuid'],['p_liked_result','boolean'],
    ['p_wants_change','boolean'],['p_desired_letter','text']
  ],
  delete_session_data:[['p_session_id','uuid'],['p_deletion_token_hash','text']]
});

/**
 * Validate the isolated FLAMES connection without giving the database driver
 * a raw URL. A literal percent sign in a password is otherwise decoded by
 * Postgres.js's URL parser and can throw "URI malformed" before connecting.
 * The project role, host pattern and target database remain strictly scoped.
 */
export function scopedConnectionOptions(value=process.env.FLAMES_PUBLIC_DATABASE_URL){
  if(!value)throw Error('FLAMES public database connection is not configured');
  let u;
  try{u=new URL(value)}catch{throw Error('Invalid FLAMES database configuration')}
  if(!['postgres:','postgresql:'].includes(u.protocol)
    || !/^[a-z0-9-]+\.pooler\.supabase\.com$/.test(u.hostname)
    || u.port!=='6543' || u.pathname!=='/postgres'
    || u.username!==(ROLE+'.'+PROJECT_REF)
    || !u.password || u.searchParams.get('sslmode')!=='require'
    || [...u.searchParams.keys()].some(x=>x!=='sslmode')
    || u.hash || u.searchParams.has('options'))
    throw Error('FLAMES public pooler identity/configuration is invalid');
  let password;
  try{password=decodeURIComponent(u.password)}
  catch{
    // A literal '%' is valid in PostgreSQL passwords but must not be treated
    // as a malformed URI escape by the database driver.
    password=u.password.replace(/%([0-9a-fA-F]{2})/g,(_,hex)=>String.fromCharCode(parseInt(hex,16)));
  }
  return {
    host:u.hostname,
    port:Number(u.port),
    database:'postgres',
    username:ROLE+'.'+PROJECT_REF,
    password
  };
}
function client(){
  if(!sql)sql=postgres({
    ...scopedConnectionOptions(),
    ssl:'require',prepare:false,max:2,connect_timeout:5,idle_timeout:10
  });
  return sql;
}
export function setRpcTestDouble(fn){
  if(process.env.NODE_ENV!=='test'||process.env.FLAMES_ALLOW_TEST_RPC!=='1')
    throw Error('Test-only RPC injection is disabled');
  testRpc=fn;
}
export async function rpc(name,body){
  const signature=signatures[name];
  if(!signature || !body || typeof body!=='object')throw Error('Unapproved FLAMES RPC');
  if(testRpc)return testRpc(name,body);
  const db=client();
  const args=signature.map(([key,type])=>type==='jsonb'?db.json(body[key]??[]):(body[key]??null));
  const placeholders=signature.map(([,type],i)=>'$'+(i+1)+'::'+type).join(',');
  const [row]=await db.unsafe('SELECT flames.'+name+'('+placeholders+') AS payload',args);
  return row?.payload??null;
}
