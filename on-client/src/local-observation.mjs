import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import * as os from 'node:os';
import {join} from 'node:path';

const SCHEMA='keshev.local-observation.v1';
const MAX_OUTPUT_BYTES=262144;
const POWERSHELL_TIMEOUT_MS=8000;
const POWERSHELL_SCRIPT=String.raw`
$ErrorActionPreference='Stop'
$since=(Get-Date).AddHours(-24)
$observedAt=(Get-Date).ToUniversalTime().ToString('o')
function unavailable($code,$reason){[pscustomobject]@{status='unavailable';reasonCode=$code;reason=$reason}}
function readNetwork{
  try{
    $adapters=@(Get-NetAdapter -Physical -ErrorAction Stop | Select-Object -First 32)
    $items=@(foreach($adapter in $adapters){
      $config=Get-NetIPConfiguration -InterfaceIndex $adapter.ifIndex -ErrorAction SilentlyContinue
      $ipv4=@($config.IPv4Address | ForEach-Object {$_.IPAddress} | Where-Object {$_})
      $gateway=@($config.IPv4DefaultGateway | ForEach-Object {$_.NextHop} | Where-Object {$_})
      $dns=@($config.DnsServer.ServerAddresses | Where-Object {$_})
      [pscustomobject]@{name=[string]$adapter.Name;status=[string]$adapter.Status;linkSpeed=[string]$adapter.LinkSpeed;ipv4=$ipv4;gateway=$gateway;dns=$dns}
    })
    $up=@($items | Where-Object {$_.status -eq 'Up'})
    $connection=if($up.Count -gt 0){'connected'}else{'disconnected'}
    [pscustomobject]@{status='measured';connection=$connection;adapters=$items}
  }catch{unavailable 'NETWORK_UNAVAILABLE' '네트워크 구성을 읽지 못했습니다.'}
}
function readFirewall{
  try{
    $raw=@(Get-NetFirewallProfile -ErrorAction Stop)
    if($raw.Count -eq 0){throw 'FIREWALL_EMPTY'}
    $profiles=@($raw | ForEach-Object {[pscustomobject]@{name=[string]$_.Name;enabled=[bool]$_.Enabled;defaultInboundAction=[string]$_.DefaultInboundAction;defaultOutboundAction=[string]$_.DefaultOutboundAction}})
    $enabled=@($profiles | Where-Object {$_.enabled}).Count
    $summary=if($enabled -eq $profiles.Count){'enabled'}elseif($enabled -eq 0){'disabled'}else{'mixed'}
    [pscustomobject]@{status='measured';summary=$summary;profiles=$profiles}
  }catch{unavailable 'FIREWALL_UNAVAILABLE' '방화벽 프로필을 읽지 못했습니다. 설정을 변경하지 않았습니다.'}
}
function readEventLog($name){
  try{
    Get-WinEvent -ListLog $name -ErrorAction Stop | Out-Null
    $items=@(Get-WinEvent -FilterHashtable @{LogName=$name;StartTime=$since;Level=2,3} -ErrorAction SilentlyContinue)
    $errors=@($items | Where-Object {$_.Level -eq 2}).Count
    $warnings=@($items | Where-Object {$_.Level -eq 3}).Count
    [pscustomobject]@{status='measured';logName=$name;errorCount=$errors;warningCount=$warnings;totalCount=($errors+$warnings);windowHours=24}
  }catch{unavailable 'EVENT_LOG_UNAVAILABLE' ($name+' Windows 기록을 읽지 못했습니다.')}
}
[pscustomobject]@{
  schema='keshev.local-observation.v1'
  observedAt=$observedAt
  source='windows-read-only'
  network=(readNetwork)
  firewall=(readFirewall)
  events=@((readEventLog 'System'),(readEventLog 'Application'))
} | ConvertTo-Json -Compress -Depth 8
`;

function cancelled(){return Object.assign(Error('REQUEST_CANCELLED'),{code:'REQUEST_CANCELLED'});}
function unavailableArea(code,reason){return {status:'unavailable',reasonCode:code,reason};}
function readNetwork(){
  try{
    const interfaces=os.networkInterfaces();
    const adapters=Object.entries(interfaces).map(([name,addresses])=>{
      const rows=Array.isArray(addresses)?addresses:[];
      const external=rows.filter(item=>item&&item.internal!==true);
      return {name,status:external.length>0?'Up':'Down',linkSpeed:'확인 불가',ipv4:external.filter(item=>item.family==='IPv4').map(item=>item.address).slice(0,20),gateway:[],dns:[]};
    }).slice(0,32);
    return {status:'measured',connection:adapters.some(adapter=>adapter.status==='Up')?'connected':'disconnected',adapters,source:'node:os.networkInterfaces',note:'기본 게이트웨이·DNS·링크 속도는 일반 권한 OS API에서 확인하지 않습니다.'};
  }catch{return unavailableArea('NETWORK_UNAVAILABLE','네트워크 구성을 읽지 못했습니다.');}
}
function unavailableObservation(checkedAt,network,code='LOCAL_OBSERVATION_UNAVAILABLE',reason='Windows 읽기 전용 조회를 실행하지 못했습니다.'){
  return {schema:SCHEMA,checkedAt,source:'local-read-only',network,firewall:unavailableArea(code,reason),events:[unavailableArea(code,reason),unavailableArea(code,reason)]};
}
async function readStartupSnapshot(clock){
  const temporaryDirectory=typeof process.env.TEMP==='string'&&process.env.TEMP.length>0?process.env.TEMP:process.env.TMP;
  if(!temporaryDirectory)throw Error('LOCAL_OBSERVATION_SNAPSHOT_MISSING');
  const raw=JSON.parse((await readFile(join(temporaryDirectory,'keshev-local-observation.json'),'utf8')).replace(/^\uFEFF/,'').trim());
  if(!raw||raw.schema!==SCHEMA||raw.source!=='windows-read-only'||typeof raw.observedAt!=='string')throw Error('LOCAL_OBSERVATION_SNAPSHOT_INVALID');
  const observedAtMs=Date.parse(raw.observedAt),nowMs=clock().getTime();
  if(!Number.isFinite(observedAtMs)||!Number.isFinite(nowMs)||observedAtMs>nowMs+60000||nowMs-observedAtMs>86400000)throw Error('LOCAL_OBSERVATION_SNAPSHOT_STALE');
  const firewall=raw.firewall?.reasonCode==='FIREWALL_ACCESS_UNAVAILABLE'
    ? {...raw.firewall,reason:'일반 권한에서 방화벽 프로필을 읽지 못했습니다. 설정은 변경하지 않았습니다.'}:raw.firewall;
  const events=Array.isArray(raw.events)?raw.events.map(event=>event?.reasonCode==='EVENT_LOG_ACCESS_UNAVAILABLE'
    ? {...event,reason:`${event.logName||'Windows'} 기록을 읽지 못했습니다.`}:event):raw.events;
  return {...raw,firewall,events,collection:'startup-snapshot'};
}
function runPowerShell(signal){
  return new Promise((resolve,reject)=>{
    if(process.platform!=='win32'){reject(Object.assign(Error('WINDOWS_ONLY'),{code:'WINDOWS_ONLY'}));return;}
    const child=spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command','-'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    let stdout='';let settled=false;let timer;
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);if(error)reject(error);else resolve(value);};
    const stop=()=>{try{child.kill();}catch{};finish(cancelled());};
    const abort=()=>stop();
    timer=setTimeout(()=>{try{child.kill();}catch{};finish(Object.assign(Error('LOCAL_OBSERVATION_TIMEOUT'),{code:'LOCAL_OBSERVATION_TIMEOUT'}));},POWERSHELL_TIMEOUT_MS);
    if(signal?.aborted){stop();return;}
    signal?.addEventListener('abort',abort,{once:true});
    child.stdin.end(POWERSHELL_SCRIPT);
    child.stdout.setEncoding('utf8');child.stdout.on('data',(chunk)=>{stdout+=chunk;if(Buffer.byteLength(stdout,'utf8')>MAX_OUTPUT_BYTES){try{child.kill();}catch{};finish(Object.assign(Error('LOCAL_OBSERVATION_TOO_LARGE'),{code:'LOCAL_OBSERVATION_TOO_LARGE'}));}});
    child.on('error',()=>finish(Object.assign(Error('POWERSHELL_UNAVAILABLE'),{code:'POWERSHELL_UNAVAILABLE'})));
    child.on('close',(code)=>{if(settled)return;if(code!==0){finish(Object.assign(Error('POWERSHELL_FAILED'),{code:'POWERSHELL_FAILED'}));return;}try{finish(null,JSON.parse(stdout));}catch{finish(Object.assign(Error('LOCAL_OBSERVATION_INVALID'),{code:'LOCAL_OBSERVATION_INVALID'}));}});
  });
}

export async function readLocalObservation({clock=()=>new Date(),signal}={}){
  const checkedAt=clock().toISOString();
  const network=readNetwork();
  try{
    const snapshot=await readStartupSnapshot(clock);
    return {...snapshot,source:'local-read-only',network,collection:'startup-snapshot',checkedAt:snapshot.observedAt};
  }catch{}
  try{
    const raw=await runPowerShell(signal);
    if(!raw||raw.schema!==SCHEMA||raw.source!=='windows-read-only')throw Error('LOCAL_OBSERVATION_INVALID');
    return {...raw,source:'local-read-only',network,collection:'direct-read',checkedAt:typeof raw.observedAt==='string'?raw.observedAt:checkedAt};
  }catch(error){
    if(error?.code==='REQUEST_CANCELLED')throw error;
    const code=error?.code==='WINDOWS_ONLY'?'WINDOWS_ONLY':'LOCAL_OBSERVATION_UNAVAILABLE';
    const reason=code==='WINDOWS_ONLY'?'Windows에서만 읽을 수 있는 PC 조회입니다.':'Windows 읽기 전용 조회를 실행하지 못했습니다.';
    return unavailableObservation(checkedAt,network,code,reason);
  }
}
