import {createHash} from 'node:crypto';
import {calculateFlames} from '../engine.mjs';
import {allowedOrigin, parseBody, rpc, send} from './_supabase.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LETTER = /^(?:F|L|A|M|E|S)$/;
const hash = value => createHash('sha256').update(String(value)).digest('hex');
const cleanName = value => typeof value === 'string' ? value.normalize('NFC').trim() : '';

export default async function handler(req, res) {
  if (!allowedOrigin(req)) return send(res, 403, {error:'Origin is not allowed'});
  if (req.method === 'OPTIONS') {
    res.setHeader('allow','POST, PATCH, OPTIONS');
    return send(res,204,{});
  }
  if (!['POST','PATCH'].includes(req.method)) {
    res.setHeader('allow','POST, PATCH, OPTIONS');
    return send(res,405,{error:'Method not allowed'});
  }
  const body = parseBody(req);
  if (!body) return send(res,400,{error:'Invalid JSON'});
  if (!UUID.test(body.session_id || '') || !UUID.test(body.attempt_id || ''))
    return send(res,400,{error:'Invalid identifier'});
  try {
    if (req.method === 'POST') {
      if (body.analytics_consent !== true || body.consent_version !== '2026-10-25')
        return send(res,400,{error:'Current consent is required'});
      const nameOne=cleanName(body.name_one),nameTwo=cleanName(body.name_two);
      if (!nameOne || !nameTwo || nameOne.length>120 || nameTwo.length>120)
        return send(res,400,{error:'Names must contain 1–120 characters'});
      const calculation=calculateFlames(nameOne,nameTwo);
      if (calculation.status==='invalid-input') return send(res,400,{error:'Both names must contain letters'});
      const token=String(body.deletion_token || '');
      if (token.length<32 || token.length>200) return send(res,400,{error:'Invalid deletion token'});
      const namesConsent=body.names_consent===true;
      const variations=Array.isArray(body.variations)?body.variations.slice(0,24).map(x=>({
        person_side:Number(x.person_side),variation_type:String(x.variation_type||''),name_value:cleanName(x.name_value).slice(0,120)
      })):[];
      const data=await rpc('ingest_attempt',{
        p_session_id:body.session_id,p_attempt_id:body.attempt_id,
        p_parent_attempt_id:UUID.test(body.parent_attempt_id||'')?body.parent_attempt_id:null,
        p_client_occurred_at:body.occurred_at||null,p_consent_version:body.consent_version,
        p_names_consent:namesConsent,p_deletion_token_hash:hash(token),
        p_name_one:namesConsent?nameOne:null,p_name_two:namesConsent?nameTwo:null,
        p_result_letter:calculation.letter,p_remaining_count:calculation.remainingCount,
        p_is_alternative:body.is_alternative===true,
        p_previous_result_letter:LETTER.test(body.previous_result_letter||'')?body.previous_result_letter:null,
        p_algorithm_version:'1.1.0',p_variations:namesConsent?variations:[]
      });
      return send(res,201,{ok:true,attempt_id:body.attempt_id,data});
    }
    if (req.method === 'PATCH') {
      const data=await rpc('record_feedback',{
        p_session_id:body.session_id,p_attempt_id:body.attempt_id,
        p_liked_result:typeof body.liked_result==='boolean'?body.liked_result:null,
        p_wants_change:body.wants_change===true,
        p_desired_letter:LETTER.test(body.desired_letter||'')?body.desired_letter:null
      });
      return send(res,200,{ok:true,data});
    }
    } catch (error) {
    console.error('FLAMES research request failed', {method:req.method,message:error.message});
    return send(res,error.message.includes('rate')?429:503,{error:'Research service is temporarily unavailable'});
  }
}
